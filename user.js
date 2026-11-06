const ticketForm = document.querySelector("#ticketForm");
const successMessage = document.querySelector("#successMessage");
const departmentSelect = document.querySelector("#department");
const categorySelect = document.querySelector("#category");
const prioritySelect = document.querySelector("#priority");

applyButtonSettings(document);

function fillSelect(select, values, options = {}) {
  select.innerHTML = "";

  if (options.includePlaceholder) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.placeholderText || "Selecione";
    select.append(placeholder);
  }

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = options.selectedValue === value;
    select.append(option);
  });
}

function hydrateCatalogs() {
  const catalogs = loadCatalogs();
  fillSelect(departmentSelect, catalogs.departments, {
    includePlaceholder: true,
    placeholderText: "Selecione",
  });
  fillSelect(categorySelect, catalogs.categories, {
    includePlaceholder: true,
    placeholderText: "Selecione",
  });
  fillSelect(prioritySelect, catalogs.priorities, {
    selectedValue: catalogs.priorities.includes("Media") ? "Media" : catalogs.priorities[0],
  });
}

hydrateCatalogs();

ticketForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(ticketForm);
  const email = String(formData.get("email") || "").trim();

  if (!isValidEmail(email)) {
    alert("Informe um e-mail valido para abrir o chamado.");
    document.querySelector("#email").focus();
    return;
  }

  const tickets = loadTickets();
  const newTicket = createTicket(formData);
  saveTickets([newTicket, ...tickets]);
  ticketForm.reset();
  hydrateCatalogs();

  successMessage.textContent = `Chamado ${newTicket.id} aberto com sucesso. Nossa equipe de TI vai analisar a solicitacao.`;
  successMessage.hidden = false;
});
