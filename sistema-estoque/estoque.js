(() => {
  "use strict";
  const PRODUCTS_KEY = "veste-products-v1";
  const MOVEMENTS_KEY = "veste-movements-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  let products = read(PRODUCTS_KEY, []);
  let movements = read(MOVEMENTS_KEY, []);
  let activeFilter = "todos";
  let toastTimer;

  function read(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; }
    catch { return fallback; }
  }
  function save() {
    try {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
      localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
    } catch { showToast("Não foi possível salvar. Verifique o espaço disponível no navegador."); }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function showToast(message) {
    const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function render() {
    const query = $("#searchInput").value.trim().toLocaleLowerCase("pt-BR");
    const shown = products.filter((p) => (activeFilter === "todos" || p.category === activeFilter) && `${p.name} ${p.size}`.toLocaleLowerCase("pt-BR").includes(query));
    $("#productRows").innerHTML = shown.map((p) => {
      const status = p.quantity === 0 ? ["Sem estoque", "status-out"] : p.quantity <= 5 ? ["Estoque baixo", "status-low"] : ["Disponível", "status-ok"];
      const kind = p.category === "camisa" ? "Camisa" : "Tênis";
      return `<tr><td><div class="product-cell"><span class="product-thumb">${p.category === "camisa" ? "👕" : "👟"}</span>${escapeHtml(p.name)}</div></td><td><span class="category-pill">${kind}</span></td><td>${escapeHtml(p.size)}</td><td>${money.format(p.price)}</td><td class="quantity-cell">${p.quantity}</td><td><span class="status-pill ${status[1]}">${status[0]}</span></td><td><div class="row-actions"><button class="mini-button" type="button" data-exit="${p.id}" ${p.quantity < 1 ? "disabled" : ""}>− Saída</button><button class="mini-button" type="button" data-delete="${p.id}" aria-label="Excluir ${escapeHtml(p.name)}">Excluir</button></div></td></tr>`;
    }).join("");
    $("#emptyState").hidden = shown.length > 0;
    $("#productRows").closest("table").hidden = shown.length === 0;
    $("#metricProducts").textContent = products.length;
    $("#metricUnits").textContent = products.reduce((sum, p) => sum + p.quantity, 0);
    $("#metricLow").textContent = products.filter((p) => p.quantity <= 5).length;
    $("#metricOut").textContent = movements.reduce((sum, m) => sum + m.quantity, 0);
    $("#countTodos").textContent = products.length;
    renderMovements();
  }
  function renderMovements() {
    const list = $("#movementList");
    list.innerHTML = movements.slice(0, 8).map((m) => `<div class="movement-item"><span class="movement-icon">↗</span><div class="movement-detail"><strong>${escapeHtml(m.productName)}</strong><small>${escapeHtml(m.reason)} · ${escapeHtml(m.size)}</small></div><span class="movement-qty">−${m.quantity} un.</span><span class="movement-time">${new Date(m.date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>`).join("");
    $("#movementEmpty").hidden = movements.length > 0;
  }
  function closeDialog(event) { event.target.closest("dialog").close(); }

  $("#todayLabel").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  document.querySelectorAll("[data-open-product]").forEach((button) => button.addEventListener("click", () => $("#productDialog").showModal()));
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
  $("#productForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: String(form.get("name")).trim(), category: String(form.get("category")), size: String(form.get("size")).trim(), price: Number(form.get("price")), quantity: Number(form.get("quantity")) };
    if (!product.name || !product.size || product.price < 0 || product.quantity < 0 || !Number.isInteger(product.quantity)) return showToast("Confira os dados do produto.");
    products.unshift(product); save(); event.currentTarget.reset(); $("#productDialog").close(); render(); showToast("Produto cadastrado com sucesso.");
  });
  $("#exitForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const product = products.find((p) => p.id === form.get("productId")); const quantity = Number(form.get("quantity"));
    if (!product || !Number.isInteger(quantity) || quantity < 1) return showToast("Informe uma quantidade válida.");
    if (quantity > product.quantity) return showToast(`Há apenas ${product.quantity} peça(s) disponíveis.`);
    product.quantity -= quantity;
    movements.unshift({ id: Date.now(), productName: product.name, size: product.size, quantity, reason: String(form.get("reason")), date: new Date().toISOString() });
    save(); event.currentTarget.reset(); $("#exitDialog").close(); render(); showToast("Saída registrada com sucesso.");
  });
  $("#productRows").addEventListener("click", (event) => {
    const exitButton = event.target.closest("[data-exit]"); const deleteButton = event.target.closest("[data-delete]");
    if (exitButton) {
      const product = products.find((p) => p.id === exitButton.dataset.exit); if (!product) return;
      const form = $("#exitForm"); form.elements.productId.value = product.id; form.elements.quantity.max = product.quantity; form.elements.quantity.value = "";
      $("#exitProductName").textContent = `${product.name} · tamanho ${product.size} · ${product.quantity} disponível(is)`; $("#exitDialog").showModal();
    }
    if (deleteButton) {
      const product = products.find((p) => p.id === deleteButton.dataset.delete); if (!product) return;
      if (!window.confirm(`Excluir o produto “${product.name}”?`)) return;
      products = products.filter((p) => p.id !== product.id); save(); render(); showToast("Produto excluído.");
    }
  });
  $("#searchInput").addEventListener("input", render);
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === button)); render();
  }));
  $("#clearHistory").addEventListener("click", () => {
    if (!movements.length) return showToast("O histórico já está vazio.");
    if (!window.confirm("Limpar todas as movimentações?")) return;
    movements = []; save(); render(); showToast("Histórico limpo.");
  });
  render();
})();
