const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
const preferredPort = Number(process.env.PORT) || 5199;
const dataFile = path.join(root, "documents-data.json");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function isPathInsideRoot(targetPath) {
  const relative = path.relative(root, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request, callback) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) {
      request.destroy();
    }
  });
  request.on("end", () => callback(null, body));
  request.on("error", (error) => callback(error));
}

function handleDocumentsApi(request, response) {
  if (request.method === "GET") {
    fs.readFile(dataFile, "utf8", (error, text) => {
      if (error && error.code === "ENOENT") {
        sendJson(response, 200, { exists: false, data: null });
        return;
      }
      if (error) {
        sendJson(response, 500, { error: "Unable to read documents-data.json." });
        return;
      }
      try {
        sendJson(response, 200, { exists: true, data: JSON.parse(text) });
      } catch (parseError) {
        sendJson(response, 500, { error: "documents-data.json is not valid JSON." });
      }
    });
    return;
  }

  if (request.method === "POST") {
    readRequestBody(request, (readError, body) => {
      if (readError) {
        sendJson(response, 400, { error: "Unable to read request body." });
        return;
      }
      try {
        const parsed = JSON.parse(body);
        const output = JSON.stringify(parsed, null, 2);
        const tempFile = `${dataFile}.tmp`;
        fs.writeFile(tempFile, output, "utf8", (writeError) => {
          if (writeError) {
            sendJson(response, 500, { error: "Unable to write documents-data.json." });
            return;
          }
          fs.rename(tempFile, dataFile, (renameError) => {
            if (renameError) {
              sendJson(response, 500, { error: "Unable to save documents-data.json." });
              return;
            }
            sendJson(response, 200, { ok: true });
          });
        });
      } catch (parseError) {
        sendJson(response, 400, { error: "Invalid JSON payload." });
      }
    });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

function createServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    if (requestUrl.pathname === "/api/documents") {
      handleDocumentsApi(request, response);
      return;
    }

    const cleanPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "") || "index.html";
    const resolved = path.resolve(root, cleanPath);

    if (!isPathInsideRoot(resolved)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.stat(resolved, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const type = mimeTypes[path.extname(resolved).toLowerCase()] || "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-cache"
      });
      fs.createReadStream(resolved).pipe(response);
    });
  });
}

function openBrowser(url) {
  if (process.env.OPEN_BROWSER === "0") return;
  const command = process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
  child.unref();
}

function listen(port, attemptsLeft) {
  const server = createServer();
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(error.message);
    process.exit(1);
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`GhoZTech Document Editor is running at ${url}`);
    console.log("Press Ctrl+C to stop the local server.");
    openBrowser(url);
  });
}

listen(preferredPort, 10);
