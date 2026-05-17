async function parseJson(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return payload;
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseJson(response);
}

export function getMeta() {
  return request("/api/meta");
}

export function requestRegister(payload) {
  return request("/api/auth/register/request", {
    method: "POST",
    body: payload,
  });
}

export function loginUser(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function logoutUser(token) {
  return request("/api/auth/logout", {
    method: "POST",
    token,
  });
}

export function requestPasswordReset(payload) {
  return request("/api/auth/password/request", {
    method: "POST",
    body: payload,
  });
}

export function resetPassword(payload) {
  return request("/api/auth/password/reset", {
    method: "POST",
    body: payload,
  });
}

export function getCurrentUser(token) {
  return request("/api/auth/me", {
    token,
  });
}

export function getProfile(token) {
  return request("/api/profile", {
    token,
  });
}

export function getMyMatches(token) {
  return request("/api/matches", {
    token,
  });
}

export function getPublicMatch(code) {
  return request(`/api/matches/${encodeURIComponent(code)}`);
}

export function createOnlineRoom(token, payload) {
  return request("/api/multiplayer/rooms", {
    method: "POST",
    token,
    body: payload,
  });
}

export function getOnlineRoom(token, code) {
  return request(`/api/multiplayer/rooms/${encodeURIComponent(code)}`, {
    token,
  });
}

export function connectRoomSocket(token, code, handlers) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  url.searchParams.set("token", token);
  url.searchParams.set("room", code);

  const socket = new WebSocket(url);

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload.type === "room:update") {
        handlers?.onRoomUpdate?.(payload.room);
      } else if (payload.type === "room:refresh") {
        handlers?.onRoomRefresh?.(payload.code);
      }
    } catch {}
  });

  socket.addEventListener("open", () => {
    handlers?.onOpen?.();
  });

  socket.addEventListener("close", () => {
    handlers?.onClose?.();
  });

  socket.addEventListener("error", () => {
    handlers?.onError?.();
  });

  return socket;
}

export function joinOnlineRoom(token, code) {
  return request(`/api/multiplayer/rooms/${encodeURIComponent(code)}`, {
    method: "POST",
    token,
    body: {
      action: "join",
    },
  });
}

export function submitOnlineMove(token, code, move) {
  return request(`/api/multiplayer/rooms/${encodeURIComponent(code)}`, {
    method: "POST",
    token,
    body: {
      action: "move",
      move,
    },
  });
}

export function getLeaderboard(variant, country) {
  const url = new URL("/api/leaderboard", window.location.origin);
  url.searchParams.set("variant", variant);

  if (country) {
    url.searchParams.set("country", country);
  }

  return request(`${url.pathname}${url.search}`);
}
