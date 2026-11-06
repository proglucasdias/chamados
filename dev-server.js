const http = require("http");
const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";
const dataDir = path.join(root, "data");
const backupsDir = path.join(dataDir, "backups");
const ticketsPath = path.join(dataDir, "tickets.json");
const tripsPath = path.join(dataDir, "trips.json");
const adminUsersPath = path.join(dataDir, "admin-users.json");
const passwordResetsPath = path.join(dataDir, "password-resets.json");
const catalogsPath = path.join(dataDir, "catalogs.json");
const settingsPath = path.join(dataDir, "settings.json");
const reportsDir = path.join(root, "reports");
const exporterScript = path.join(root, "report_export.py");
const pythonExecutable =
  "C:\\Users\\Lucas Dias\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getCacheHeaders(extension) {
  if (extension === ".html" || extension === ".css" || extension === ".js") {
    return {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };
  }

  return {};
}

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(backupsDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

function readTicketsFile() {
  const tickets = readJsonFile(ticketsPath, []);
  return Array.isArray(tickets) ? tickets : [];
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, payload, prefix) {
  if (fs.existsSync(filePath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(filePath, path.join(backupsDir, `${prefix}-${stamp}.json`));
  }

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function writeTicketsFile(tickets) {
  writeJsonFile(ticketsPath, tickets, "tickets");
}

function getResetTokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getActivePasswordResets() {
  const resets = readJsonFile(passwordResetsPath, []);
  const now = Date.now();

  if (!Array.isArray(resets)) {
    return [];
  }

  return resets.filter(
    (reset) =>
      reset &&
      typeof reset.tokenHash === "string" &&
      !reset.usedAt &&
      new Date(reset.expiresAt).getTime() > now,
  );
}

function savePasswordResets(resets) {
  writeJsonFile(passwordResetsPath, resets, "password-resets");
}

function findUserByIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();

  if (!normalizedIdentifier) {
    return null;
  }

  const users = readJsonFile(adminUsersPath, []);
  if (!Array.isArray(users)) {
    return null;
  }

  return (
    users.find((user) => {
      const username = String(user.username || "").trim().toLowerCase();
      const email = String(user.email || "").trim().toLowerCase();
      return username === normalizedIdentifier || email === normalizedIdentifier;
    }) || null
  );
}

function getPublicBaseUrl(request) {
  const configuredUrl = String(process.env.APP_BASE_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const hostHeader = String(request.headers.host || "").trim();
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0];
  const protocol = forwardedProtocol || (request.socket.encrypted ? "https" : "http");
  return `${protocol}://${hostHeader}`;
}

function getSmtpTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const from = String(process.env.SMTP_FROM || "").trim();

  if (!host || !from) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");

  return {
    host,
    port,
    secure,
    from,
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function sendPasswordResetEmail({ recipient, recipientName, resetUrl }) {
  const smtp = getSmtpTransport();

  if (!smtp) {
    throw new Error("SMTP nao configurado. Defina SMTP_HOST e SMTP_FROM no servidor.");
  }

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    throw new Error("Modulo nodemailer nao encontrado. Execute npm install no servidor.");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  const safeName = String(recipientName || "usuario");
  await transporter.sendMail({
    from: smtp.from,
    to: recipient,
    subject: "Redefinicao de senha - Central de Chamados",
    text: `Ola, ${safeName}.

Recebemos uma solicitacao para redefinir sua senha.

Use este link para criar uma nova senha:
${resetUrl}

O link expira em 1 hora e pode ser usado uma unica vez. Se voce nao solicitou a troca, ignore esta mensagem.`,
    html: `<p>Ola, ${safeName}.</p>
<p>Recebemos uma solicitacao para redefinir sua senha.</p>
<p><a href="${resetUrl}">Criar nova senha</a></p>
<p>O link expira em 1 hora e pode ser usado uma unica vez. Se voce nao solicitou a troca, ignore esta mensagem.</p>`,
  });
}

function handleJsonStore(request, response, filePath, prefix, fallback, validate) {
  if (request.method === "GET") {
    sendJson(response, 200, {
      data: readJsonFile(filePath, fallback),
    });
    return true;
  }

  if (request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const data = Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;

        if (!validate(data)) {
          sendJson(response, 400, {
            error: `invalid_${prefix}_payload`,
          });
          return;
        }

        writeJsonFile(filePath, data, prefix);
        sendJson(response, 200, {
          ok: true,
        });
      })
      .catch((error) => {
        sendJson(response, 500, {
          error: `${prefix}_save_failed`,
          details: error.message,
        });
      });
    return true;
  }

  return false;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isValidPassword(value) {
  return typeof value === "string" && value.length >= 8;
}

function isValidPasswordResetToken(token) {
  const tokenHash = getResetTokenHash(String(token || ""));
  return getActivePasswordResets().some((reset) => reset.tokenHash === tokenHash);
}

function handlePasswordResetRequest(request, response) {
  readRequestBody(request)
    .then(async (body) => {
      const payload = JSON.parse(body || "{}");
      const user = findUserByIdentifier(payload.identifier);

      // The browser always gets the same answer, preventing account discovery.
      sendJson(response, 200, { ok: true });

      if (!user || !user.email) {
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const reset = {
        tokenHash: getResetTokenHash(token),
        username: user.username,
        expiresAt,
        usedAt: null,
        createdAt: new Date().toISOString(),
      };
      const activeResets = getActivePasswordResets().filter(
        (item) => item.username !== user.username,
      );

      activeResets.push(reset);
      savePasswordResets(activeResets);

      try {
        const resetUrl = `${getPublicBaseUrl(request)}/reset-password.html?token=${token}`;
        await sendPasswordResetEmail({
          recipient: user.email,
          recipientName: user.name,
          resetUrl,
        });
      } catch (error) {
        const remainingResets = getActivePasswordResets().filter(
          (item) => item.tokenHash !== reset.tokenHash,
        );
        savePasswordResets(remainingResets);
        console.error(`Falha ao enviar e-mail de redefinicao: ${error.message}`);
      }
    })
    .catch((error) => {
      console.error(`Falha ao solicitar redefinicao de senha: ${error.message}`);
      sendJson(response, 200, { ok: true });
    });
}

function handlePasswordResetValidation(request, response) {
  readRequestBody(request)
    .then((body) => {
      const payload = JSON.parse(body || "{}");
      sendJson(response, 200, {
        valid: isValidPasswordResetToken(payload.token),
      });
    })
    .catch(() => sendJson(response, 200, { valid: false }));
}

function handlePasswordResetConfirmation(request, response) {
  readRequestBody(request)
    .then((body) => {
      const payload = JSON.parse(body || "{}");
      const password = String(payload.password || "");
      const tokenHash = getResetTokenHash(String(payload.token || ""));
      const resets = getActivePasswordResets();
      const reset = resets.find((item) => item.tokenHash === tokenHash);

      if (!reset) {
        sendJson(response, 400, {
          ok: false,
          message: "Este link expirou ou ja foi utilizado.",
        });
        return;
      }

      if (!isValidPassword(password)) {
        sendJson(response, 400, {
          ok: false,
          message: "A senha precisa ter pelo menos 8 caracteres.",
        });
        return;
      }

      const users = readJsonFile(adminUsersPath, []);
      if (!Array.isArray(users)) {
        throw new Error("Arquivo de usuarios invalido.");
      }

      const userExists = users.some((user) => user.username === reset.username);
      if (!userExists) {
        sendJson(response, 400, {
          ok: false,
          message: "Este link nao pode mais ser utilizado.",
        });
        return;
      }

      const updatedUsers = users.map((user) =>
        user.username === reset.username ? { ...user, password } : user,
      );
      writeJsonFile(adminUsersPath, updatedUsers, "admin-users");
      savePasswordResets(
        resets.map((item) =>
          item.tokenHash === tokenHash
            ? { ...item, usedAt: new Date().toISOString() }
            : item,
        ),
      );

      sendJson(response, 200, { ok: true });
    })
    .catch((error) => {
      console.error(`Falha ao confirmar redefinicao de senha: ${error.message}`);
      sendJson(response, 500, {
        ok: false,
        message: "Nao foi possivel atualizar a senha.",
      });
    });
}

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent(request.url.split("?")[0]);

  if (request.method === "GET" && urlPath === "/api/tickets") {
    sendJson(response, 200, {
      tickets: readTicketsFile(),
    });
    return;
  }

  if (request.method === "GET" && urlPath === "/api/trips") {
    const trips = readJsonFile(tripsPath, []);
    sendJson(response, 200, { trips: Array.isArray(trips) ? trips : [] });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/trips") {
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const trips = Array.isArray(payload) ? payload : payload.trips;
        if (!Array.isArray(trips)) {
          sendJson(response, 400, { error: "invalid_trips_payload" });
          return;
        }
        writeJsonFile(tripsPath, trips, "trips");
        sendJson(response, 200, { ok: true, count: trips.length });
      })
      .catch((error) => {
        sendJson(response, 500, { error: "trips_save_failed", details: error.message });
      });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/password-reset/request") {
    handlePasswordResetRequest(request, response);
    return;
  }

  if (request.method === "POST" && urlPath === "/api/password-reset/validate") {
    handlePasswordResetValidation(request, response);
    return;
  }

  if (request.method === "POST" && urlPath === "/api/password-reset/confirm") {
    handlePasswordResetConfirmation(request, response);
    return;
  }

  if (
    urlPath === "/api/admin-users" &&
    handleJsonStore(request, response, adminUsersPath, "admin-users", [], Array.isArray)
  ) {
    return;
  }

  if (
    urlPath === "/api/catalogs" &&
    handleJsonStore(
      request,
      response,
      catalogsPath,
      "catalogs",
      {},
      (data) => data && typeof data === "object" && !Array.isArray(data),
    )
  ) {
    return;
  }

  if (
    urlPath === "/api/settings" &&
    handleJsonStore(
      request,
      response,
      settingsPath,
      "settings",
      {},
      (data) => data && typeof data === "object" && !Array.isArray(data),
    )
  ) {
    return;
  }

  if (request.method === "POST" && urlPath === "/api/tickets") {
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const tickets = Array.isArray(payload) ? payload : payload.tickets;

        if (!Array.isArray(tickets)) {
          sendJson(response, 400, {
            error: "invalid_tickets_payload",
          });
          return;
        }

        writeTicketsFile(tickets);
        sendJson(response, 200, {
          ok: true,
          count: tickets.length,
        });
      })
      .catch((error) => {
        sendJson(response, 500, {
          error: "tickets_save_failed",
          details: error.message,
        });
      });
    return;
  }

  if (request.method === "POST" && request.url === "/api/export-report") {
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const inputPath = path.join(reportsDir, `report-input-${Date.now()}.json`);
        fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2), "utf8");

        execFile(
          pythonExecutable,
          [exporterScript, inputPath, reportsDir],
          { cwd: root },
          (error, stdout, stderr) => {
            fs.unlink(inputPath, () => {});

            if (error) {
              sendJson(response, 500, {
                error: "report_export_failed",
                details: stderr || error.message,
              });
              return;
            }

            try {
              const result = JSON.parse(stdout);
              sendJson(response, 200, result);
            } catch (parseError) {
              sendJson(response, 500, {
                error: "invalid_export_response",
                details: parseError.message,
              });
            }
          },
        );
      })
      .catch((error) => {
        sendJson(response, 500, {
          error: "invalid_request",
          details: error.message,
        });
      });
    return;
  }

  const requestedPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.join(root, requestedPath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      ...getCacheHeaders(extension),
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Central de chamados disponivel em http://localhost:${port}`);
});
