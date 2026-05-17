import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseServerAIMove, getAIStatus } from "./ai-service.js";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk.toString();
  }

  return body ? JSON.parse(body) : {};
}

function resolveFilePath(urlPath) {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT_DIR, pathname);

  if (!filePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return filePath;
}

async function serveStatic(request, response) {
  const filePath = resolveFilePath(request.url);

  if (!filePath) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    sendJson(response, 500, { error: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/ai/status") {
      sendJson(response, 200, await getAIStatus());
      return;
    }

    if (request.method === "POST" && request.url === "/api/ai/move") {
      const body = await readBody(request);

      if (!body?.state?.variant) {
        sendJson(response, 400, { error: "Missing state.variant" });
        return;
      }

      const result = await chooseServerAIMove(body.state, body.difficulty ?? "medium");
      sendJson(response, 200, result);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`checkers server listening on http://${HOST}:${PORT}`);
});
