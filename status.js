const STORAGE_KEY = "copacol-trips-v1";
const $ = (id) => document.getElementById(id);
const list = $("tripList");
const formPanel = $("entryPanel");
const form = $("tripForm");
let trips = [];
let online = false;

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function setOnline(value) {
  online = value;
  const el = $("syncState");
  el.className = `sync-state ${value ? "online" : "offline"}`;
  el.innerHTML = `<i></i>${value ? " Sincronizado" : " Sem conexão · salvo neste aparelho"}`;
}
async function loadTrips() {
  try {
    const response = await fetch("/api/trips", { cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao carregar");
    const data = await response.json();
    trips = Array.isArray(data.trips) ? data.trips : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    setOnline(true);
  } catch {
    try { trips = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { trips = []; }
    setOnline(false);
  }
  render();
}
async function saveTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  try {
    const response = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trips }) });
    if (!response.ok) throw new Error("Falha ao salvar");
    setOnline(true);
  } catch { setOnline(false); }
  render();
}
function duration(start, end) {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm); if (minutes < 0) minutes += 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function render() {
  const date = $("filterDate").value;
  const query = $("searchInput").value.trim().toLocaleLowerCase("pt-BR");
  const dayTrips = trips.filter((trip) => trip.date === date);
  const visible = dayTrips.filter((trip) => [trip.client, trip.driver, trip.plate, trip.invoice, trip.destination].join(" ").toLocaleLowerCase("pt-BR").includes(query));
  $("totalCount").textContent = dayTrips.length;
  $("doneCount").textContent = dayTrips.filter((trip) => trip.status === "Finalizado").length;
  $("activeCount").textContent = dayTrips.filter((trip) => trip.status === "Em andamento").length;
  $("visibleCount").textContent = `${visible.length} ${visible.length === 1 ? "registro" : "registros"}`;
  $("listSubtitle").textContent = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div"); empty.className = "empty-state";
    empty.innerHTML = `<strong>${query ? "Nenhum resultado" : "Nenhuma viagem registrada"}</strong>${query ? "Tente buscar por outro termo." : "Toque em “Nova viagem” para começar o registro do dia."}`;
    list.append(empty); return;
  }
  visible.sort((a, b) => (a.arrival || "99:99").localeCompare(b.arrival || "99:99"));
  const template = $("tripTemplate");
  for (const trip of visible) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = trip.id;
    card.querySelector(".client-initial").textContent = (trip.client || "?").trim().slice(0, 1).toLocaleUpperCase("pt-BR");
    card.querySelector(".client-name").textContent = trip.client || "Cliente não informado";
    card.querySelector(".trip-destination").textContent = `⌖ ${trip.destination || "Destino não informado"}`;
    card.querySelector(".trip-driver").textContent = trip.driver || "—";
    card.querySelector(".trip-plate").textContent = trip.plate || "—";
    card.querySelector(".trip-carrier").textContent = trip.carrier || "";
    card.querySelector(".trip-arrival").textContent = trip.arrival || "—";
    card.querySelector(".trip-departure").textContent = trip.departure || "—";
    card.querySelector(".trip-duration").textContent = duration(trip.arrival, trip.departure);
    card.querySelector(".trip-state").textContent = trip.state || "—";
    card.querySelector(".trip-invoice").textContent = trip.invoice ? `NF ${trip.invoice}` : "NF —";
    const badge = card.querySelector(".status-badge"); badge.textContent = trip.status || "Aguardando"; badge.classList.add((trip.status || "").toLocaleLowerCase("pt-BR").replaceAll(" ", "-"));
    card.querySelector(".quick-status").addEventListener("click", () => cycleStatus(trip.id));
    card.querySelector(".edit-trip").addEventListener("click", () => openForm(trip));
    card.querySelector(".delete-trip").addEventListener("click", () => removeTrip(trip.id));
    list.append(card);
  }
}
function openForm(trip = null) {
  form.reset(); $("tripId").value = trip?.id || ""; $("tripDate").value = trip?.date || $("filterDate").value;
  $("driver").value = trip?.driver || ""; $("plate").value = trip?.plate || ""; $("carrier").value = trip?.carrier || "RODOMAR";
  $("client").value = trip?.client || ""; $("destination").value = trip?.destination || ""; $("state").value = trip?.state || "";
  $("arrival").value = trip?.arrival || ""; $("departure").value = trip?.departure || ""; $("invoice").value = trip?.invoice || ""; $("tripStatus").value = trip?.status || "Em andamento";
  $("formTitle").textContent = trip ? "Editar viagem" : "Nova viagem"; formPanel.hidden = false; formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}
function closeForm() { formPanel.hidden = true; form.reset(); }
function cycleStatus(id) {
  const order = ["Em andamento", "Finalizado", "Aguardando", "Cancelado"];
  const trip = trips.find((item) => item.id === id); if (!trip) return;
  trip.status = order[(order.indexOf(trip.status) + 1) % order.length]; saveTrips();
}
function removeTrip(id) {
  if (!window.confirm("Excluir este registro de viagem?")) return;
  trips = trips.filter((trip) => trip.id !== id); saveTrips();
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("tripId").value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const trip = { id, date: $("tripDate").value, driver: $("driver").value.trim(), plate: $("plate").value.trim().toLocaleUpperCase("pt-BR"), carrier: $("carrier").value.trim(), client: $("client").value.trim(), destination: $("destination").value.trim(), state: $("state").value.trim().toLocaleUpperCase("pt-BR"), arrival: $("arrival").value, departure: $("departure").value, invoice: $("invoice").value.trim(), status: $("tripStatus").value };
  const index = trips.findIndex((item) => item.id === id); if (index >= 0) trips[index] = trip; else trips.push(trip);
  $("filterDate").value = trip.date; closeForm(); await saveTrips();
});
$("addButton").addEventListener("click", () => openForm());
$("printButton").addEventListener("click", printDailyReport);
$("closeForm").addEventListener("click", closeForm); $("cancelForm").addEventListener("click", closeForm);
$("filterDate").addEventListener("change", render); $("searchInput").addEventListener("input", render);
$("todayLabel").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
$("filterDate").value = localDate(); $("tripDate").value = localDate();
loadTrips();

function printDailyReport() {
  const date = $("filterDate").value;
  const dayTrips = trips.filter((trip) => trip.date === date).sort((a, b) => (a.arrival || "99:99").localeCompare(b.arrival || "99:99"));
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const rows = dayTrips.map((trip) => `<tr>
    <td>${escapeText(new Date(`${trip.date}T12:00:00`).toLocaleDateString("pt-BR"))}</td>
    <td>${escapeText(trip.driver || "—")}</td><td>${escapeText(trip.plate || "—")}</td>
    <td>${escapeText(trip.carrier || "—")}</td><td>${escapeText(trip.client || "—")}</td>
    <td>${escapeText(trip.destination || "—")}</td><td>${escapeText(trip.arrival || "—")}</td>
    <td>${escapeText(trip.departure || "—")}</td><td>${escapeText(duration(trip.arrival, trip.departure))}</td>
    <td>${escapeText(trip.state || "—")}</td><td>${escapeText(trip.invoice || "—")}</td>
    <td>${escapeText(trip.status || "Aguardando")}</td>
  </tr>`).join("");
  $("printReport").innerHTML = `<header class="print-header">
    <img src="rondomar-logo.jpeg" alt="Rodomar Transportes" />
    <div><p>RELATÓRIO DE OPERAÇÃO</p><h1>Status diário de entregas</h1><span>${escapeText(dateLabel)}</span></div>
  </header>
  <div class="print-summary"><strong>${dayTrips.length}</strong> ${dayTrips.length === 1 ? "viagem registrada" : "viagens registradas"}<span>${dayTrips.filter((trip) => trip.status === "Finalizado").length} finalizadas</span></div>
  <table class="print-table"><thead><tr><th>Data</th><th>Motorista</th><th>Placa</th><th>Transportadora</th><th>Cliente</th><th>Destino</th><th>Chegada</th><th>Saída</th><th>Tempo no cliente</th><th>UF</th><th>NF</th><th>Status</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="12" class="print-empty">Nenhuma viagem registrada nesta data.</td></tr>`}</tbody></table>
  <footer class="print-footer">Emitido em ${escapeText(new Date().toLocaleString("pt-BR"))} · Status de entregas · Rodomar Transportes</footer>`;
  window.print();
}
