const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "0.0.0.0";
const port = Number(process.env.PORT) || 8080;
const root = __dirname;
const dataDir = path.join(root, "data");
const tripsFile = path.join(dataDir, "trips.json");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(tripsFile)) fs.writeFileSync(tripsFile, "[]", "utf8");

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
  if (pathname === "/api/trips" && request.method === "GET") {
    try {
      const trips = JSON.parse(fs.readFileSync(tripsFile, "utf8"));
      return sendJson(response, 200, { trips: Array.isArray(trips) ? trips : [] });
    } catch (error) {
      return sendJson(response, 500, { error: "trips_read_failed", details: error.message });
    }
  }
  if (pathname === "/api/trips" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const trips = Array.isArray(payload) ? payload : payload.trips;
        if (!Array.isArray(trips)) return sendJson(response, 400, { error: "invalid_trips_payload" });
        fs.writeFileSync(tripsFile, JSON.stringify(trips, null, 2), "utf8");
        return sendJson(response, 200, { ok: true, count: trips.length });
      } catch (error) {
        return sendJson(response, 400, { error: "trips_save_failed", details: error.message });
      }
    });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405); response.end("Method not allowed"); return;
  }

  let relativePath;
  try { relativePath = decodeURIComponent(pathname === "/" ? "/status.html" : pathname); }
  catch { response.writeHead(400); response.end("Bad request"); return; }
  const filePath = path.resolve(root, `.${relativePath}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end("Forbidden"); return; }
  fs.readFile(filePath, (error, contents) => {
    if (error) { response.writeHead(404); response.end("Arquivo nao encontrado"); return; }
    const headers = { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" };
    response.writeHead(200, headers);
    response.end(request.method === "HEAD" ? undefined : contents);
  });
});

server.listen(port, host, () => {
  console.log(`Status de entregas disponivel em http://localhost:${port}/status.html`);
  console.log("Para celulares na mesma rede, use o IP local deste computador.");
});
