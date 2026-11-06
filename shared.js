const STORAGE_KEY = "it-service-desk-tickets";
const ADMIN_SESSION_KEY = "it-service-desk-admin-session";
const ADMIN_CREDENTIALS_KEY = "it-service-desk-admin-credentials";
const APP_SETTINGS_KEY = "it-service-desk-settings";
const CATALOGS_KEY = "it-service-desk-catalogs";
const STATUSES = ["Aberto", "Em atendimento", "Resolvido"];
const MODULES = ["queue", "password", "settings", "user_management", "catalog_management"];
const USER_STATUSES = ["active", "blocked", "inactive"];
const DEFAULT_CATALOGS = {
  departments: [
    "Administrativo",
    "Comercial",
    "Financeiro",
    "Operacoes",
    "Recursos Humanos",
  ],
  categories: [
    "Acesso e senha",
    "Computador",
    "E-mail",
    "Impressora",
    "Internet e rede",
    "Sistema interno",
  ],
  priorities: ["Baixa", "Media", "Alta", "Critica"],
};
const DEFAULT_USERS = [
  {
    username: "admin",
    password: "admin123",
    name: "Administrador de TI",
    email: "admin@empresa.com",
    role: "admin",
    modules: MODULES,
  },
  {
    username: "lucas.dias",
    password: "mths10",
    name: "Lucas Dias",
    email: "lucas.dias@empresa.com",
    role: "master",
    modules: MODULES,
  },
  {
    username: "tecnico.ti",
    password: "ti123",
    name: "Tecnico de TI",
    email: "tecnico.ti@empresa.com",
    role: "technician",
    modules: ["queue"],
  },
];
const DEFAULT_SETTINGS = {
  userAdminLinkText: "Area do administrador",
  userSubmitButtonText: "Abrir chamado",
  adminUserLinkText: "Portal do usuario",
  adminLoginButtonText: "Entrar",
  adminSeedButtonText: "Carregar exemplos",
  adminLogoutButtonText: "Sair",
  showUserAdminLink: true,
};

function loadTickets() {
  const localTickets = loadTicketsFromLocalStorage();

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    const serverTickets = loadTicketsFromServer();

    if (serverTickets.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serverTickets));
      return serverTickets;
    }

    if (localTickets.length > 0) {
      saveTicketsToServer(localTickets);
      return localTickets;
    }
  }

  return localTickets;
}

function loadTicketsFromLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  saveTicketsToServer(tickets);
}

function loadTicketsFromServer() {
  try {
    const request = new XMLHttpRequest();
    request.open("GET", "/api/tickets", false);
    request.send();

    if (request.status >= 200 && request.status < 300) {
      const payload = JSON.parse(request.responseText || "{}");
      return Array.isArray(payload.tickets) ? payload.tickets : [];
    }
  } catch {}

  return [];
}

function saveTicketsToServer(tickets) {
  if (!(window.location.protocol === "http:" || window.location.protocol === "https:")) {
    return;
  }

  try {
    const payload = JSON.stringify({ tickets });

    if (navigator.sendBeacon) {
      const body = new Blob([payload], {
        type: "application/json",
      });

      if (navigator.sendBeacon("/api/tickets", body)) {
        return;
      }
    }

    fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function loadServerData(endpoint, fallback) {
  if (!(window.location.protocol === "http:" || window.location.protocol === "https:")) {
    return fallback;
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", endpoint, false);
    request.send();

    if (request.status >= 200 && request.status < 300) {
      const payload = JSON.parse(request.responseText || "{}");
      return Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : fallback;
    }
  } catch {}

  return fallback;
}

function saveServerData(endpoint, data) {
  if (!(window.location.protocol === "http:" || window.location.protocol === "https:")) {
    return;
  }

  try {
    const payload = JSON.stringify({ data });

    if (navigator.sendBeacon) {
      const body = new Blob([payload], {
        type: "application/json",
      });

      if (navigator.sendBeacon(endpoint, body)) {
        return;
      }
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createTicket(formData) {
  const now = new Date();
  const catalogs = loadCatalogs();
  const priority = String(formData.get("priority") || "");

  return {
    id: `TI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-5)}`,
    requester: String(formData.get("requester") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    department: String(formData.get("department") || ""),
    category: String(formData.get("category") || ""),
    priority: catalogs.priorities.includes(priority) ? priority : catalogs.priorities[0],
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    technician: "Nao atribuido",
    resolution: "Pendente",
    status: "Aberto",
    closedAt: null,
    createdAt: now.toISOString(),
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizePriority(priority) {
  return priority
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSeedTickets() {
  const now = Date.now();

  return [
    {
      id: "TI-202605-10001",
      requester: "Mariana Alves",
      email: "mariana.alves@empresa.com",
      department: "Financeiro",
      category: "Acesso e senha",
      priority: "Alta",
      title: "Bloqueio de acesso ao ERP",
      description: "Usuario nao consegue acessar o ERP apos troca de senha.",
      status: "Aberto",
      createdAt: new Date(now - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "TI-202605-10002",
      requester: "Rafael Lima",
      email: "rafael.lima@empresa.com",
      department: "Comercial",
      category: "Internet e rede",
      priority: "Critica",
      title: "Equipe sem acesso a rede",
      description: "Sala comercial esta sem conexao cabeada e Wi-Fi desde o inicio do expediente.",
      status: "Em atendimento",
      createdAt: new Date(now - 1000 * 60 * 110).toISOString(),
    },
    {
      id: "TI-202605-10003",
      requester: "Camila Rocha",
      email: "camila.rocha@empresa.com",
      department: "Recursos Humanos",
      category: "Impressora",
      priority: "Media",
      title: "Impressora nao imprime documentos",
      description: "Fila de impressao fica presa e nenhuma estacao consegue imprimir.",
      status: "Resolvido",
      createdAt: new Date(now - 1000 * 60 * 240).toISOString(),
    },
  ];
}

function loadAdminCredentials() {
  const serverCredentials = loadServerData("/api/admin-users", []);

  if (Array.isArray(serverCredentials) && serverCredentials.length > 0) {
    const normalizedUsers = ensureRequiredUsers(serverCredentials.map(normalizeUserRecord));
    localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(normalizedUsers));
    return normalizedUsers;
  }

  try {
    const credentials = JSON.parse(localStorage.getItem(ADMIN_CREDENTIALS_KEY));

    if (Array.isArray(credentials) && credentials.length > 0) {
      const normalizedUsers = ensureRequiredUsers(credentials.map(normalizeUserRecord));
      localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(normalizedUsers));
      saveServerData("/api/admin-users", normalizedUsers);
      return normalizedUsers;
    }

    if (credentials && credentials.username && credentials.password) {
      const migratedUsers = [
        normalizeUserRecord({
          username: credentials.username,
          password: credentials.password,
          name: credentials.name || "Administrador de TI",
          role: "admin",
        }),
      ];
      const normalizedUsers = ensureRequiredUsers(migratedUsers);
      localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(normalizedUsers));
      saveServerData("/api/admin-users", normalizedUsers);
      return normalizedUsers;
    }
  } catch {}

  const normalizedUsers = DEFAULT_USERS.map(normalizeUserRecord);
  localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(normalizedUsers));
  saveServerData("/api/admin-users", normalizedUsers);
  return normalizedUsers;
}

function saveAdminCredentials(credentials) {
  localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(credentials));
  saveServerData("/api/admin-users", credentials);
}

function getDefaultModulesByRole(role) {
  if (role === "technician") {
    return ["queue"];
  }

  return [...MODULES];
}

function normalizeModules(modules, role) {
  const baselineModules = getDefaultModulesByRole(role);

  if (!Array.isArray(modules) || modules.length === 0) {
    return baselineModules;
  }

  const normalized = MODULES.filter((module) => modules.includes(module));

  if (role === "admin" || role === "master") {
    return [...new Set([...normalized, ...baselineModules])];
  }

  return normalized;
}

function normalizeUserRecord(user) {
  const role = user.role || "technician";
  const status = USER_STATUSES.includes(user.status) ? user.status : "active";

  return {
    username: user.username,
    password: user.password,
    name: user.name,
    email: user.email || "",
    role,
    status,
    modules: normalizeModules(user.modules, role),
  };
}

function ensureRequiredUsers(users) {
  const nextUsers = [...users];

  DEFAULT_USERS.forEach((defaultUser) => {
    const exists = nextUsers.some((user) => user.username === defaultUser.username);

    if (!exists) {
      nextUsers.push(normalizeUserRecord(defaultUser));
    }
  });

  return nextUsers;
}

function findUser(username, password) {
  const users = loadAdminCredentials();

  return (
    users.find(
      (user) => user.username.trim() === username.trim() && user.password === password,
    ) || null
  );
}

function getUserStatusLabel(status) {
  if (status === "blocked") {
    return "Bloqueado";
  }

  if (status === "inactive") {
    return "Inativo";
  }

  return "Ativo";
}

function isUserAllowedToLogin(user) {
  return user && user.status !== "blocked" && user.status !== "inactive";
}

function authenticateAdmin(username, password) {
  const user = findUser(username, password);

  if (!user) {
    return { ok: false, code: "invalid_credentials" };
  }

  if (!isUserAllowedToLogin(user)) {
    return {
      ok: false,
      code: user.status,
      message:
        user.status === "blocked"
          ? "Este usuario esta bloqueado."
          : "Este usuario esta inativo.",
    };
  }

  localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      username: user.username,
      name: user.name,
      role: user.role,
      modules: user.modules,
      loggedAt: new Date().toISOString(),
    }),
  );

  return { ok: true, user };
}

function loginAdmin(username, password) {
  const result = authenticateAdmin(username, password);
  return result.ok;
}

function getAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY));
  } catch {
    return null;
  }
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function updateAdminPassword(username, password) {
  const users = loadAdminCredentials();
  const nextUsers = users.map((user) =>
    user.username === username ? { ...user, password } : user,
  );

  saveAdminCredentials(nextUsers);
  return nextUsers.find((user) => user.username === username) || null;
}

function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = loadAdminCredentials();

  return (
    users.find((user) => String(user.email || "").trim().toLowerCase() === normalizedEmail) ||
    null
  );
}

function findUserByUsernameOrEmail(identifier) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const users = loadAdminCredentials();

  return (
    users.find((user) => {
      const username = String(user.username || "").trim().toLowerCase();
      const email = String(user.email || "").trim().toLowerCase();
      return username === normalizedIdentifier || email === normalizedIdentifier;
    }) || null
  );
}

function createAdminUser(user) {
  const users = loadAdminCredentials();
  const exists = users.some((currentUser) => currentUser.username === user.username);

  if (exists) {
    return { ok: false, message: "Ja existe um usuario com esse login." };
  }

  const nextUsers = [...users, normalizeUserRecord(user)];
  saveAdminCredentials(nextUsers);
  return { ok: true, user: nextUsers[nextUsers.length - 1] };
}

function listAdminUsers() {
  return loadAdminCredentials();
}

function updateUserAccess(username, updates) {
  const users = loadAdminCredentials();
  const nextUsers = users.map((user) => {
    if (user.username !== username) {
      return user;
    }

    return normalizeUserRecord({
      ...user,
      ...updates,
    });
  });

  saveAdminCredentials(nextUsers);
  return nextUsers.find((user) => user.username === username) || null;
}

function updateAdminUser(username, updates) {
  const users = loadAdminCredentials();
  const currentUsername = String(username || "").trim();
  const nextUsername = String(updates.username || "").trim();
  const targetUser = users.find((user) => user.username === currentUsername);

  if (!targetUser) {
    return { ok: false, message: "Usuario nao encontrado." };
  }

  if (!nextUsername) {
    return { ok: false, message: "Informe um login para o usuario." };
  }

  const duplicate = users.some(
    (user) =>
      user.username.toLowerCase() === nextUsername.toLowerCase() &&
      user.username !== currentUsername,
  );

  if (duplicate) {
    return { ok: false, message: "Ja existe um usuario com esse login." };
  }

  const nextUsers = users.map((user) =>
    user.username === currentUsername
      ? normalizeUserRecord({
          ...user,
          name: String(updates.name || "").trim(),
          username: nextUsername,
          email: String(updates.email || "").trim(),
        })
      : user,
  );

  saveAdminCredentials(nextUsers);
  return {
    ok: true,
    user: nextUsers.find((user) => user.username === nextUsername) || null,
  };
}

function updateUserStatus(username, status) {
  if (!USER_STATUSES.includes(status)) {
    return { ok: false, message: "Status de usuario invalido." };
  }

  const users = loadAdminCredentials();
  const targetUser = users.find((user) => user.username === username);

  if (!targetUser) {
    return { ok: false, message: "Usuario nao encontrado." };
  }

  const nextUsers = users.map((user) =>
    user.username === username
      ? normalizeUserRecord({
          ...user,
          status,
        })
      : user,
  );

  saveAdminCredentials(nextUsers);

  return {
    ok: true,
    user: nextUsers.find((user) => user.username === username) || null,
  };
}

function userHasModule(session, module) {
  return Array.isArray(session?.modules) && session.modules.includes(module);
}

function loadSettings() {
  const serverSettings = loadServerData("/api/settings", null);

  if (serverSettings && typeof serverSettings === "object" && !Array.isArray(serverSettings)) {
    const normalizedSettings = {
      ...DEFAULT_SETTINGS,
      ...serverSettings,
    };
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(normalizedSettings));
    return normalizedSettings;
  }

  try {
    const settings = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY));

    if (settings) {
      const normalizedSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
      };
      saveServerData("/api/settings", normalizedSettings);
      return normalizedSettings;
    }
  } catch {}

  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  saveServerData("/api/settings", DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

function normalizeCatalogValues(values, fallback) {
  if (!Array.isArray(values) || values.length === 0) {
    return [...fallback];
  }

  const cleaned = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : [...fallback];
}

function loadCatalogs() {
  const serverCatalogs = loadServerData("/api/catalogs", null);

  if (serverCatalogs && typeof serverCatalogs === "object" && !Array.isArray(serverCatalogs)) {
    const normalizedCatalogs = {
      departments: normalizeCatalogValues(serverCatalogs.departments, DEFAULT_CATALOGS.departments),
      categories: normalizeCatalogValues(serverCatalogs.categories, DEFAULT_CATALOGS.categories),
      priorities: normalizeCatalogValues(serverCatalogs.priorities, DEFAULT_CATALOGS.priorities),
    };
    localStorage.setItem(CATALOGS_KEY, JSON.stringify(normalizedCatalogs));
    return normalizedCatalogs;
  }

  try {
    const catalogs = JSON.parse(localStorage.getItem(CATALOGS_KEY));

    if (catalogs) {
      const normalizedCatalogs = {
        departments: normalizeCatalogValues(catalogs.departments, DEFAULT_CATALOGS.departments),
        categories: normalizeCatalogValues(catalogs.categories, DEFAULT_CATALOGS.categories),
        priorities: normalizeCatalogValues(catalogs.priorities, DEFAULT_CATALOGS.priorities),
      };
      saveServerData("/api/catalogs", normalizedCatalogs);
      return normalizedCatalogs;
    }
  } catch {}

  localStorage.setItem(CATALOGS_KEY, JSON.stringify(DEFAULT_CATALOGS));
  saveServerData("/api/catalogs", DEFAULT_CATALOGS);
  return {
    departments: [...DEFAULT_CATALOGS.departments],
    categories: [...DEFAULT_CATALOGS.categories],
    priorities: [...DEFAULT_CATALOGS.priorities],
  };
}

function saveCatalogs(catalogs) {
  const nextCatalogs = {
    departments: normalizeCatalogValues(catalogs.departments, DEFAULT_CATALOGS.departments),
    categories: normalizeCatalogValues(catalogs.categories, DEFAULT_CATALOGS.categories),
    priorities: normalizeCatalogValues(catalogs.priorities, DEFAULT_CATALOGS.priorities),
  };

  localStorage.setItem(CATALOGS_KEY, JSON.stringify(nextCatalogs));
  saveServerData("/api/catalogs", nextCatalogs);
  return nextCatalogs;
}

function addCatalogItem(type, value) {
  const catalogs = loadCatalogs();
  const nextValue = String(value || "").trim();

  if (!nextValue) {
    return { ok: false, message: "Informe um valor valido." };
  }

  if (!Array.isArray(catalogs[type])) {
    return { ok: false, message: "Catalogo invalido." };
  }

  const exists = catalogs[type].some(
    (item) => item.toLowerCase() === nextValue.toLowerCase(),
  );

  if (exists) {
    return { ok: false, message: "Esse item ja esta cadastrado." };
  }

  const nextCatalogs = {
    ...catalogs,
    [type]: [...catalogs[type], nextValue],
  };

  saveCatalogs(nextCatalogs);
  return { ok: true, catalogs: nextCatalogs };
}

function removeCatalogItem(type, value) {
  const catalogs = loadCatalogs();

  if (!Array.isArray(catalogs[type])) {
    return { ok: false, message: "Catalogo invalido." };
  }

  const nextValues = catalogs[type].filter((item) => item !== value);

  if (nextValues.length === 0) {
    return { ok: false, message: "Cada lista precisa manter pelo menos um item." };
  }

  const nextCatalogs = {
    ...catalogs,
    [type]: nextValues,
  };

  saveCatalogs(nextCatalogs);
  return { ok: true, catalogs: nextCatalogs };
}

function saveSettings(settings) {
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
  };

  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(nextSettings));
  saveServerData("/api/settings", nextSettings);
  return nextSettings;
}

function applyButtonSettings(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  const settings = loadSettings();
  const elements = root.querySelectorAll("[data-setting-key], [data-visibility-key]");

  elements.forEach((element) => {
    const key = element.dataset.settingKey;
    const visibilityKey = element.dataset.visibilityKey;
    const settingValue = key ? settings[key] : null;

    if (typeof settingValue === "string") {
      element.textContent = settingValue;
    }

    if (visibilityKey) {
      element.hidden = !Boolean(settings[visibilityKey]);
    }
  });
}
