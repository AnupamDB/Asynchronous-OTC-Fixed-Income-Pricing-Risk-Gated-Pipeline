const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

function loadLocalEnv() {
  const allowedKeys = new Set(["PORT", "RFQ_API_KEY", "RFQ_API_URL", "RFQ_WORKER_URL"]);
  const envPath = [path.resolve(process.cwd(), ".env"), path.resolve(__dirname, "..", ".env")]
    .find((candidate) => fs.existsSync(candidate));
  if (!envPath) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || !allowedKeys.has(match[1]) || Object.hasOwn(process.env, match[1])) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const apiKey = process.env.RFQ_API_KEY || "";
const apiBase = new URL(process.env.RFQ_API_URL || "http://127.0.0.1:8080");
const workerBase = new URL(process.env.RFQ_WORKER_URL || "http://127.0.0.1:8081");
const distRoot = path.resolve(__dirname, "dist");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function sendText(response, status, message) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(message);
}

function proxyRequest(request, response, upstreamUrl, needsApiKey) {
  const transport = upstreamUrl.protocol === "https:" ? https : http;
  const headers = { ...request.headers, host: upstreamUrl.host };
  delete headers.connection;
  delete headers["content-length"];
  if (needsApiKey) {
    if (!apiKey) return sendText(response, 503, "Dashboard API access is not configured.");
    headers["x-api-key"] = apiKey;
  }

  const upstream = transport.request(
    upstreamUrl,
    { method: request.method, headers },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) sendText(response, 502, "The requested backend service is unavailable.");
    else response.destroy();
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  if (requestUrl.pathname === "/worker/health") {
    const target = new URL("/health", workerBase);
    target.search = requestUrl.search;
    return proxyRequest(request, response, target, false);
  }
  if (requestUrl.pathname === "/core/health") {
    const target = new URL("/actuator/health", apiBase);
    target.search = requestUrl.search;
    return proxyRequest(request, response, target, false);
  }
  if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")) {
    const target = new URL(request.url, apiBase);
    return proxyRequest(request, response, target, true);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return sendText(response, 405, "Method not allowed.");
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(distRoot, `.${requestedPath}`);
  if (!filePath.startsWith(`${distRoot}${path.sep}`)) {
    return sendText(response, 400, "Invalid path.");
  }
  const selectedPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(distRoot, "index.html");
  fs.readFile(selectedPath, (error, content) => {
    if (error) return sendText(response, 503, "Frontend assets are not built.");
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(selectedPath)] || "application/octet-stream",
      "cache-control": selectedPath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    if (request.method === "HEAD") response.end();
    else response.end(content);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`RFQ React dashboard listening on port ${port}`);
});
