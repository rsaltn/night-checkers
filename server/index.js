import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseServerAIMove, getAIStatus } from "./ai-service.js";
import {
  getPublicMeta,
  login,
  logout,
  requestPasswordReset,
  requestRegistration,
  requireUserByToken,
  resetPassword,
  verifyRegistration,
} from "./auth-service.js";
import {
  createRoom,
  getLeaderboard,
  getPublicMatch,
  getProfileBundle,
  getRoom,
  getUserMatchHistory,
  joinRoom,
  submitRoomMove,
} from "./multiplayer-service.js";
import { attachRealtimeServer, broadcastRoomUpdate } from "./realtime.js";

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

function getBearerToken(request) {
  const value = request.headers.authorization ?? "";

  if (!value.startsWith("Bearer ")) {
    return null;
  }

  return value.slice("Bearer ".length).trim();
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
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const filePath = resolveFilePath(url.pathname);

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
      if (!path.extname(url.pathname)) {
        const fallback = await readFile(path.join(ROOT_DIR, "index.html"));
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
        });
        response.end(fallback);
        return;
      }

      sendJson(response, 404, { error: "Not found" });
      return;
    }

    sendJson(response, 500, { error: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && request.url === "/healthz") {
      sendJson(response, 200, {
        ok: true,
        service: "night-checkers",
      });
      return;
    }

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

    if (request.method === "GET" && url.pathname === "/api/meta") {
      sendJson(response, 200, await getPublicMeta());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register/request") {
      sendJson(response, 200, await requestRegistration(await readBody(request)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register/verify") {
      sendJson(response, 200, await verifyRegistration(await readBody(request)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      sendJson(response, 200, await login(await readBody(request)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      sendJson(response, 200, await logout(getBearerToken(request)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/password/request") {
      sendJson(response, 200, await requestPasswordReset(await readBody(request)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/password/reset") {
      sendJson(response, 200, await resetPassword(await readBody(request)));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/me") {
      sendJson(response, 200, {
        ok: true,
        user: await requireUserByToken(getBearerToken(request)),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/profile") {
      const user = await requireUserByToken(getBearerToken(request));
      sendJson(response, 200, await getProfileBundle(user));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/matches") {
      const user = await requireUserByToken(getBearerToken(request));
      sendJson(response, 200, {
        matches: await getUserMatchHistory(user),
      });
      return;
    }

    const publicMatch = url.pathname.match(/^\/api\/matches\/([A-Z0-9]+)$/);

    if (request.method === "GET" && publicMatch) {
      sendJson(response, 200, await getPublicMatch(publicMatch[1]));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      sendJson(
        response,
        200,
        await getLeaderboard({
          variant: url.searchParams.get("variant"),
          country: url.searchParams.get("country"),
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/multiplayer/rooms") {
      const user = await requireUserByToken(getBearerToken(request));
      const room = await createRoom(user, await readBody(request));
      broadcastRoomUpdate(room);
      sendJson(response, 200, room);
      return;
    }

    const roomMatch = url.pathname.match(/^\/api\/multiplayer\/rooms\/([A-Z0-9]+)$/);

    if (roomMatch) {
      const roomCode = roomMatch[1];
      const user = await requireUserByToken(getBearerToken(request));

      if (request.method === "GET") {
        sendJson(response, 200, await getRoom(user, roomCode));
        return;
      }

      if (request.method === "POST") {
        const body = await readBody(request);
        const action = body?.action ?? "move";

        if (action === "join") {
          const room = await joinRoom(user, roomCode);
          broadcastRoomUpdate(room);
          sendJson(response, 200, room);
          return;
        }

        if (action === "move") {
          const room = await submitRoomMove(user, roomCode, body.move);
          broadcastRoomUpdate(room);
          sendJson(response, 200, room);
          return;
        }
      }
    }

    await serveStatic(request, response);
  } catch (error) {
    const statusCode =
      /required|expired|invalid|denied/i.test(error.message) ? 400 : 500;
    sendJson(response, statusCode, { error: error.message });
  }
});

attachRealtimeServer(server);

server.listen(PORT, HOST, () => {
  console.log(`checkers server listening on http://${HOST}:${PORT}`);
});
