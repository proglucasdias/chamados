const adminName = document.querySelector("#adminName");
const adminRole = document.querySelector("#adminRole");
const logoutButton = document.querySelector("#logoutButton");
const exportButton = document.querySelector("#exportButton");
const exportMessage = document.querySelector("#exportMessage");
const exportLinks = document.querySelector("#exportLinks");
const reportPeriod = document.querySelector("#reportPeriod");
const departmentForm = document.querySelector("#departmentForm");
const categoryForm = document.querySelector("#categoryForm");
const priorityForm = document.querySelector("#priorityForm");
const departmentMessage = document.querySelector("#departmentMessage");
const categoryMessage = document.querySelector("#categoryMessage");
const priorityCatalogMessage = document.querySelector("#priorityCatalogMessage");
const departmentList = document.querySelector("#departmentList");
const categoryList = document.querySelector("#categoryList");
const priorityList = document.querySelector("#priorityList");
const seedButton = document.querySelector("#seedButton");
const passwordForm = document.querySelector("#passwordForm");
const passwordMessage = document.querySelector("#passwordMessage");
const userForm = document.querySelector("#userForm");
const userMessage = document.querySelector("#userMessage");
const userList = document.querySelector("#userList");
const managedUserSelect = document.querySelector("#managedUserSelect");
const managedNameInput = document.querySelector("#managedNameInput");
const managedUsernameInput = document.querySelector("#managedUsernameInput");
const managedEmailInput = document.querySelector("#managedEmailInput");
const saveManagedUserButton = document.querySelector("#saveManagedUserButton");
const managedRoleSelect = document.querySelector("#managedRoleSelect");
const managedModuleInputs = document.querySelectorAll('input[name="managedModules"]');
const saveManagedAccessButton = document.querySelector("#saveManagedAccessButton");
const managedPasswordInput = document.querySelector("#managedPasswordInput");
const managedPasswordConfirmInput = document.querySelector("#managedPasswordConfirmInput");
const changeManagedPasswordButton = document.querySelector("#changeManagedPasswordButton");
const blockUserButton = document.querySelector("#blockUserButton");
const activateUserButton = document.querySelector("#activateUserButton");
const inactivateUserButton = document.querySelector("#inactivateUserButton");
const userManagementHint = document.querySelector("#userManagementHint");
const settingsForm = document.querySelector("#settingsForm");
const settingsMessage = document.querySelector("#settingsMessage");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const ticketList = document.querySelector("#ticketList");
const ticketTemplate = document.querySelector("#ticketTemplate");
const metricOpen = document.querySelector("#metricOpen");
const metricProgress = document.querySelector("#metricProgress");
const metricDone = document.querySelector("#metricDone");
const metricCritical = document.querySelector("#metricCritical");
const moduleSections = document.querySelectorAll("[data-module]");
const viewButtons = document.querySelectorAll("[data-view-trigger]");
const viewSections = document.querySelectorAll("[data-view-section]");

let tickets = loadTickets();
let activeView = "queue";

function setManagedFieldsDisabled(disabled) {
  managedNameInput.disabled = disabled;
  managedUsernameInput.disabled = disabled;
  managedEmailInput.disabled = disabled;
  saveManagedUserButton.disabled = disabled;
  managedRoleSelect.disabled = disabled;
  managedModuleInputs.forEach((input) => {
    input.disabled = disabled;
  });
  saveManagedAccessButton.disabled = disabled;
  managedPasswordInput.disabled = disabled;
  managedPasswordConfirmInput.disabled = disabled;
  changeManagedPasswordButton.disabled = disabled;
}

function syncManagedModulesByRole(role) {
  if (role === "technician") {
    managedModuleInputs.forEach((input) => {
      input.checked = input.value === "queue";
    });
    return;
  }

  managedModuleInputs.forEach((input) => {
    input.checked = true;
  });
}

function hydrateManagedUserFields(user) {
  if (!user) {
    managedNameInput.value = "";
    managedUsernameInput.value = "";
    managedEmailInput.value = "";
    managedRoleSelect.value = "technician";
    managedModuleInputs.forEach((input) => {
      input.checked = false;
    });
    managedPasswordInput.value = "";
    managedPasswordConfirmInput.value = "";
    setManagedFieldsDisabled(true);
    return;
  }

  managedNameInput.value = user.name || "";
  managedUsernameInput.value = user.username || "";
  managedEmailInput.value = user.email || "";
  managedRoleSelect.value = user.role || "technician";
  managedModuleInputs.forEach((input) => {
    input.checked = Array.isArray(user.modules) && user.modules.includes(input.value);
  });
  managedPasswordInput.value = "";
  managedPasswordConfirmInput.value = "";
  setManagedFieldsDisabled(false);
}

function getManagedUser() {
  const username = managedUserSelect?.value || "";
  if (!username) {
    return null;
  }

  return listAdminUsers().find((user) => user.username === username) || null;
}

function updateUserManagementControls() {
  const user = getManagedUser();

  if (!user) {
    hydrateManagedUserFields(null);
    blockUserButton.disabled = true;
    activateUserButton.disabled = true;
    inactivateUserButton.disabled = true;
    userManagementHint.hidden = true;
    userManagementHint.textContent = "";
    return;
  }

  const isCurrentUser = user.username === session.username;
  hydrateManagedUserFields(user);
  blockUserButton.disabled = isCurrentUser || user.status === "blocked";
  activateUserButton.disabled = isCurrentUser || user.status === "active";
  inactivateUserButton.disabled = isCurrentUser || user.status === "inactive";

  if (isCurrentUser) {
    userManagementHint.textContent = "Sua conta atual nao pode ser bloqueada nem inativada por esta tela.";
    userManagementHint.hidden = false;
    return;
  }

  userManagementHint.hidden = true;
  userManagementHint.textContent = "";
}

function populateManagedUserSelect(users) {
  const previousValue = managedUserSelect.value;
  managedUserSelect.innerHTML = '<option value="">Selecione um usuario</option>';

  users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.username;
    option.textContent = `${user.name} | ${user.username} | ${getUserStatusLabel(user.status)}`;
    option.selected = previousValue === user.username;
    managedUserSelect.append(option);
  });

  if (!listAdminUsers().some((user) => user.username === managedUserSelect.value)) {
    managedUserSelect.value = "";
  }

  updateUserManagementControls();
}

function showFormMessage(element, message, className) {
  element.textContent = message;
  element.className = className;
  element.hidden = false;
}

function renderUsers() {
  const users = listAdminUsers();
  userList.innerHTML = "";
  populateManagedUserSelect(users);

  users.forEach((user) => {
    const card = document.createElement("article");
    card.className = "user-card";

    const header = document.createElement("div");
    header.className = "user-card-header";

    const selectControl = document.createElement("label");
    selectControl.className = "user-select-control";
    selectControl.title = `Selecionar ${user.name}`;

    const selectInput = document.createElement("input");
    selectInput.type = "checkbox";
    selectInput.className = "user-select-checkbox";
    selectInput.checked = managedUserSelect.value === user.username;
    selectInput.setAttribute("aria-label", `Selecionar ${user.name}`);
    selectInput.addEventListener("change", () => {
      if (selectInput.checked) {
        document.querySelectorAll(".user-select-checkbox").forEach((input) => {
          if (input !== selectInput) {
            input.checked = false;
          }
        });
        managedUserSelect.value = user.username;
      } else {
        managedUserSelect.value = "";
      }

      updateUserManagementControls();
    });

    selectControl.append(selectInput);

    const title = document.createElement("p");
    title.className = "user-row";
    title.textContent = `${user.name} | ${user.username} | ${user.role}`;

    const email = document.createElement("p");
    email.className = "user-email";
    email.textContent = `E-mail: ${user.email || "nao informado"}`;

    const status = document.createElement("p");
    status.className = "user-status";
    status.textContent = `Status: ${getUserStatusLabel(user.status)}`;

    const modules = document.createElement("p");
    modules.className = "user-modules";
    modules.textContent = `Modulos: ${user.modules.join(", ")}`;

    header.append(selectControl, title);
    card.append(header, email, status, modules);

    userList.append(card);
  });
}

function saveManagedAccess() {
  const managedUser = getManagedUser();

  if (!managedUser) {
    showFormMessage(userMessage, "Selecione um usuario para alterar as permissoes.", "error-message");
    return;
  }

  if (managedUser.username === session.username) {
    showFormMessage(userMessage, "Nao altere as permissoes da conta em uso por esta tela.", "error-message");
    return;
  }

  const modules = [...managedModuleInputs]
    .filter((input) => input.checked)
    .map((input) => input.value);

  updateUserAccess(managedUser.username, {
    role: managedRoleSelect.value,
    modules,
  });
  renderUsers();
  managedUserSelect.value = managedUser.username;
  updateUserManagementControls();
  showFormMessage(userMessage, "Permissoes atualizadas com sucesso.", "success-message");
}

function saveManagedUser() {
  const managedUser = getManagedUser();

  if (!managedUser) {
    showFormMessage(userMessage, "Selecione um usuario para editar.", "error-message");
    return;
  }

  const name = managedNameInput.value.trim();
  const username = managedUsernameInput.value.trim();
  const email = managedEmailInput.value.trim();

  if (!name) {
    showFormMessage(userMessage, "Informe o nome do usuario.", "error-message");
    return;
  }

  if (!username) {
    showFormMessage(userMessage, "Informe o login do usuario.", "error-message");
    return;
  }

  if (!isValidEmail(email)) {
    showFormMessage(userMessage, "Informe um e-mail valido para o usuario.", "error-message");
    return;
  }

  if (managedUser.username === session.username && username !== session.username) {
    showFormMessage(
      userMessage,
      "O login da conta em uso nao pode ser alterado por esta tela.",
      "error-message",
    );
    return;
  }

  const result = updateAdminUser(managedUser.username, { name, username, email });

  if (!result.ok) {
    showFormMessage(userMessage, result.message, "error-message");
    return;
  }

  renderUsers();
  managedUserSelect.value = result.user.username;
  updateUserManagementControls();
  showFormMessage(userMessage, "Dados do usuario atualizados com sucesso.", "success-message");
}

function changeManagedPassword() {
  const managedUser = getManagedUser();
  const newPassword = managedPasswordInput.value.trim();
  const confirmPassword = managedPasswordConfirmInput.value.trim();

  if (!managedUser) {
    showFormMessage(userMessage, "Selecione um usuario para trocar a senha.", "error-message");
    return;
  }

  if (newPassword.length < 4) {
    showFormMessage(userMessage, "A nova senha precisa ter pelo menos 4 caracteres.", "error-message");
    return;
  }

  if (newPassword !== confirmPassword) {
    showFormMessage(userMessage, "A confirmacao da senha nao confere.", "error-message");
    return;
  }

  updateAdminPassword(managedUser.username, newPassword);
  managedPasswordInput.value = "";
  managedPasswordConfirmInput.value = "";
  showFormMessage(userMessage, "Senha do usuario atualizada com sucesso.", "success-message");
}

function applyStatusToManagedUser(status, successMessage) {
  const managedUser = getManagedUser();

  if (!managedUser) {
    showFormMessage(userMessage, "Selecione um usuario para alterar o status.", "error-message");
    return;
  }

  const result = updateUserStatus(managedUser.username, status);

  if (!result.ok) {
    showFormMessage(userMessage, result.message, "error-message");
    return;
  }

  renderUsers();
  managedUserSelect.value = managedUser.username;
  updateUserManagementControls();
  showFormMessage(userMessage, successMessage, "success-message");
}

function renderCatalogList(container, items, type, messageElement) {
  container.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "catalog-item";

    const text = document.createElement("span");
    text.textContent = item;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-inline-button";
    button.textContent = "Remover";
    button.addEventListener("click", () => {
      const result = removeCatalogItem(type, item);

      if (!result.ok) {
        showFormMessage(messageElement, result.message, "error-message");
        return;
      }

      renderCatalogs();
      showFormMessage(messageElement, "Cadastro atualizado com sucesso.", "success-message");
    });

    row.append(text, button);
    container.append(row);
  });
}

function renderCatalogs() {
  const catalogs = loadCatalogs();
  renderCatalogList(departmentList, catalogs.departments, "departments", departmentMessage);
  renderCatalogList(categoryList, catalogs.categories, "categories", categoryMessage);
  renderCatalogList(priorityList, catalogs.priorities, "priorities", priorityCatalogMessage);
}

function applyModuleAccess() {
  moduleSections.forEach((section) => {
    if (!section.dataset.viewSection) {
      section.hidden = !userHasModule(session, section.dataset.module);
    }
  });
}

function getAvailableViewButtons() {
  return [...viewButtons].filter((button) => userHasModule(session, button.dataset.module));
}

function resolveInitialView() {
  const availableButtons = getAvailableViewButtons();

  if (availableButtons.some((button) => button.dataset.viewTrigger === "queue")) {
    return "queue";
  }

  return availableButtons[0]?.dataset.viewTrigger || "queue";
}

function setActiveView(nextView) {
  activeView = nextView;

  viewButtons.forEach((button) => {
    const isAllowed = userHasModule(session, button.dataset.module);
    const isCurrent = isAllowed && button.dataset.viewTrigger === activeView;
    button.hidden = !isAllowed;
    button.classList.toggle("is-active", isCurrent);
    button.setAttribute("aria-pressed", String(isCurrent));
  });

  viewSections.forEach((section) => {
    const isAllowed = userHasModule(session, section.dataset.module);
    section.hidden = !(isAllowed && section.dataset.viewSection === activeView);
  });
}

function ensureAuthenticated() {
  const session = getAdminSession();

  if (!session) {
    window.location.href = "admin.html";
    return null;
  }

  return session;
}

function refreshTickets() {
  tickets = loadTickets();
}

function getFilteredTickets() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  return tickets.filter((ticket) => {
    const matchesStatus = status === "Todos" || ticket.status === status;
    const searchable = [
      ticket.id,
      ticket.requester,
      ticket.email,
      ticket.department,
      ticket.category,
      ticket.priority,
      ticket.title,
      ticket.description,
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && searchable.includes(query);
  });
}

function renderMetrics() {
  metricOpen.textContent = tickets.filter((ticket) => ticket.status === "Aberto").length;
  metricProgress.textContent = tickets.filter((ticket) => ticket.status === "Em atendimento").length;
  metricDone.textContent = tickets.filter((ticket) => ticket.status === "Resolvido").length;
  metricCritical.textContent = tickets.filter((ticket) => ticket.priority === "Critica").length;
}

function getPeriodRange(period) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);
  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  return { start, end };
}

function filterTicketsByPeriod(ticketsToFilter, period) {
  const { start, end } = getPeriodRange(period);

  return ticketsToFilter.filter((ticket) => {
    const openedAt = new Date(ticket.createdAt);
    return openedAt >= start && openedAt <= end;
  });
}

function getPeriodLabel(period) {
  if (period === "daily") {
    return "Diario";
  }

  if (period === "weekly") {
    return "Semanal";
  }

  return "Mensal";
}

function toExportTickets() {
  const period = reportPeriod.value;
  return filterTicketsByPeriod(getFilteredTickets(), period)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((ticket) => ({
      ...ticket,
      technician: ticket.technician || "Nao atribuido",
      resolution: ticket.resolution || "Pendente",
      closedAt: ticket.closedAt || null,
    }));
}

function getTicketRequesterLabel(ticket) {
  const requester = String(ticket.requester || "").trim();

  if (requester && requester.toLowerCase() !== "nao informado") {
    return requester;
  }

  if (ticket.email) {
    return ticket.email;
  }

  return "Solicitante nao recuperado";
}

function getTicketMeta(ticket) {
  const category = ticket.category || "Categoria nao informada";
  const department = ticket.department && ticket.department !== "Nao informado"
    ? ticket.department
    : "Setor nao recuperado";
  const email = ticket.email || "E-mail nao recuperado";

  return `${category} | ${department} | ${email} | ${formatDate(ticket.createdAt)}`;
}

async function exportReport() {
  exportButton.disabled = true;
  showFormMessage(exportMessage, "Gerando arquivos do relatorio...", "hint-message");
  exportLinks.innerHTML = "";

  try {
    const period = reportPeriod.value;
    const ticketsForExport = toExportTickets();

    if (ticketsForExport.length === 0) {
      throw new Error("Nenhum chamado encontrado para a periodicidade selecionada.");
    }

    const response = await fetch("/api/export-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tickets: ticketsForExport,
        generatedBy: session.name || session.username,
        generatedAt: new Date().toISOString(),
        periodicity: period,
        periodicityLabel: getPeriodLabel(period),
        filters: {
          status: statusFilter.value,
          search: searchInput.value.trim(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Falha ao gerar o relatorio.");
    }

    const result = await response.json();
    showFormMessage(exportMessage, "Relatorio gerado com sucesso.", "success-message");

    result.files.forEach((file) => {
      const link = document.createElement("a");
      link.className = "export-link";
      link.href = file.url;
      link.textContent = `${file.label} (${file.filename})`;
      link.target = "_blank";
      exportLinks.append(link);
    });
  } catch (error) {
    showFormMessage(exportMessage, error.message || "Nao foi possivel gerar o relatorio.", "error-message");
  } finally {
    exportButton.disabled = false;
  }
}

function renderTickets() {
  refreshTickets();
  const filteredTickets = getFilteredTickets();
  ticketList.innerHTML = "";

  if (filteredTickets.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Nenhum chamado encontrado.";
    ticketList.append(emptyState);
    renderMetrics();
    return;
  }

  filteredTickets
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((ticket) => {
      const row = ticketTemplate.content.firstElementChild.cloneNode(true);
      const statusSelect = row.querySelector(".status-select");
      const deleteButton = row.querySelector(".danger-button");
      const priorityBadge = row.querySelector(".priority-badge");

      row.querySelector(".ticket-title").textContent = `${ticket.id} - ${ticket.title}`;
      row.querySelector(".ticket-meta").textContent = getTicketMeta(ticket);
      row.querySelector(".ticket-description").textContent = ticket.description;
      row.querySelector(".ticket-requester").textContent = getTicketRequesterLabel(ticket);

      priorityBadge.textContent = ticket.priority;
      priorityBadge.classList.add(`priority-${normalizePriority(ticket.priority)}`);

      STATUSES.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = ticket.status === status;
        statusSelect.append(option);
      });

      statusSelect.addEventListener("change", () => {
        const nextTickets = tickets.map((item) =>
          item.id === ticket.id
            ? {
                ...item,
                status: statusSelect.value,
                technician: session.name || session.username,
                closedAt:
                  statusSelect.value === "Resolvido"
                    ? item.closedAt || new Date().toISOString()
                    : null,
              }
            : item,
        );
        saveTickets(nextTickets);
        renderTickets();
      });

      deleteButton.addEventListener("click", () => {
        const nextTickets = tickets.filter((item) => item.id !== ticket.id);
        saveTickets(nextTickets);
        renderTickets();
      });

      ticketList.append(row);
    });

  renderMetrics();
}

function seedTickets() {
  if (tickets.length > 0 && !confirm("Substituir os chamados atuais pelos exemplos?")) {
    return;
  }

  saveTickets(getSeedTickets());
  renderTickets();
}

function hydrateSettingsForm() {
  const settings = loadSettings();
  settingsForm.elements.userSubmitButtonText.value = settings.userSubmitButtonText;
  settingsForm.elements.userAdminLinkText.value = settings.userAdminLinkText;
  settingsForm.elements.adminUserLinkText.value = settings.adminUserLinkText;
  settingsForm.elements.adminLoginButtonText.value = settings.adminLoginButtonText;
  settingsForm.elements.adminLogoutButtonText.value = settings.adminLogoutButtonText;
  settingsForm.elements.adminSeedButtonText.value = settings.adminSeedButtonText;
  settingsForm.elements.showUserAdminLink.checked = Boolean(settings.showUserAdminLink);
}

const session = ensureAuthenticated();

if (session) {
  adminName.textContent = session.name || session.username;
  adminRole.textContent = `Perfil: ${session.role === "master" ? "Master" : session.role === "admin" ? "Administrador" : "Tecnico de TI"}`;
  applyModuleAccess();
  hydrateSettingsForm();
  applyButtonSettings(document);
  renderUsers();
  renderCatalogs();

  setActiveView(resolveInitialView());

  if (userHasModule(session, "queue")) {
    renderTickets();
  }
}

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  const newPassword = String(formData.get("newPassword") || "").trim();
  const confirmPassword = String(formData.get("confirmPassword") || "").trim();

  if (newPassword.length < 4) {
    showFormMessage(passwordMessage, "A senha precisa ter pelo menos 4 caracteres.", "error-message");
    return;
  }

  if (newPassword !== confirmPassword) {
    showFormMessage(passwordMessage, "A confirmacao da senha nao confere.", "error-message");
    return;
  }

  updateAdminPassword(session.username, newPassword);
  passwordForm.reset();
  showFormMessage(passwordMessage, "Senha atualizada com sucesso.", "success-message");
});

userForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(userForm);
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "technician");
  const modules = formData.getAll("modules").map(String);

  if (!isValidEmail(email)) {
    showFormMessage(userMessage, "Informe um e-mail valido para o usuario.", "error-message");
    return;
  }

  if (password.length < 4) {
    showFormMessage(userMessage, "A senha do usuario precisa ter pelo menos 4 caracteres.", "error-message");
    return;
  }

  const result = createAdminUser({
    name,
    username,
    email,
    password,
    role,
    modules,
  });

  if (!result.ok) {
    showFormMessage(userMessage, result.message, "error-message");
    return;
  }

  userForm.reset();
  renderUsers();
  showFormMessage(userMessage, "Usuario criado com sucesso.", "success-message");
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(settingsForm);

  saveSettings({
    userSubmitButtonText: String(formData.get("userSubmitButtonText") || "").trim(),
    userAdminLinkText: String(formData.get("userAdminLinkText") || "").trim(),
    adminUserLinkText: String(formData.get("adminUserLinkText") || "").trim(),
    adminLoginButtonText: String(formData.get("adminLoginButtonText") || "").trim(),
    adminLogoutButtonText: String(formData.get("adminLogoutButtonText") || "").trim(),
    adminSeedButtonText: String(formData.get("adminSeedButtonText") || "").trim(),
    showUserAdminLink: formData.get("showUserAdminLink") === "on",
  });

  applyButtonSettings(document);
  showFormMessage(settingsMessage, "Configuracoes salvas com sucesso.", "success-message");
});

function bindCatalogForm(form, type, messageElement) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const value = String(formData.get("value") || "").trim();
    const result = addCatalogItem(type, value);

    if (!result.ok) {
      showFormMessage(messageElement, result.message, "error-message");
      return;
    }

    form.reset();
    renderCatalogs();
    showFormMessage(messageElement, "Item cadastrado com sucesso.", "success-message");
  });
}

bindCatalogForm(departmentForm, "departments", departmentMessage);
bindCatalogForm(categoryForm, "categories", categoryMessage);
bindCatalogForm(priorityForm, "priorities", priorityCatalogMessage);

logoutButton.addEventListener("click", () => {
  logoutAdmin();
  window.location.href = "admin.html";
});

if (userHasModule(session, "queue")) {
  seedButton.addEventListener("click", seedTickets);
  exportButton.addEventListener("click", exportReport);
  searchInput.addEventListener("input", renderTickets);
  statusFilter.addEventListener("change", renderTickets);
}

managedUserSelect.addEventListener("change", updateUserManagementControls);
saveManagedUserButton.addEventListener("click", saveManagedUser);
managedRoleSelect.addEventListener("change", () => {
  syncManagedModulesByRole(managedRoleSelect.value);
});
saveManagedAccessButton.addEventListener("click", saveManagedAccess);
changeManagedPasswordButton.addEventListener("click", changeManagedPassword);
blockUserButton.addEventListener("click", () => {
  applyStatusToManagedUser("blocked", "Usuario bloqueado com sucesso.");
});
activateUserButton.addEventListener("click", () => {
  applyStatusToManagedUser("active", "Usuario ativado com sucesso.");
});
inactivateUserButton.addEventListener("click", () => {
  applyStatusToManagedUser("inactive", "Usuario inativado com sucesso.");
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!userHasModule(session, button.dataset.module)) {
      return;
    }

    setActiveView(button.dataset.viewTrigger);
  });
});
