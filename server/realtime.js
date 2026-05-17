import crypto from "node:crypto";
import { requireUserByToken } from "./auth-service.js";
import { getRoom } from "./multiplayer-service.js";

const roomSockets = new Map();

function createAcceptValue(secWebSocketKey) {
  return crypto
    .createHash("sha1")
    .update(`${secWebSocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function encodeTextFrame(payload) {
  const data = Buffer.from(payload, "utf8");
  const length = data.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), data]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let payloadLength = second & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) {
        break;
      }

      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) {
        break;
      }

      payloadLength = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;

    if (offset + frameLength > buffer.length) {
      break;
    }

    const payloadStart = offset + headerLength + maskLength;
    let payload = buffer.subarray(payloadStart, payloadStart + payloadLength);

    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      const unmasked = Buffer.alloc(payload.length);

      for (let index = 0; index < payload.length; index += 1) {
        unmasked[index] = payload[index] ^ mask[index % 4];
      }

      payload = unmasked;
    }

    messages.push({
      opcode,
      payload,
    });

    offset += frameLength;
  }

  return {
    messages,
    remaining: buffer.subarray(offset),
  };
}

function removeSocket(roomCode, socket) {
  const sockets = roomSockets.get(roomCode);

  if (!sockets) {
    return;
  }

  sockets.delete(socket);

  if (sockets.size === 0) {
    roomSockets.delete(roomCode);
  }
}

function attachRoomSocket(roomCode, socket) {
  const sockets = roomSockets.get(roomCode) ?? new Set();
  sockets.add(socket);
  roomSockets.set(roomCode, sockets);
}

function sendJson(socket, payload) {
  try {
    socket.write(encodeTextFrame(JSON.stringify(payload)));
  } catch {}
}

export function broadcastRoomUpdate(roomSummary) {
  const sockets = roomSockets.get(roomSummary.code);

  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    sendJson(socket, {
      type: "room:update",
      room: roomSummary,
    });
  }
}

export function attachRealtimeServer(server) {
  server.on("upgrade", async (request, socket) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get("token");
      const roomCode = String(url.searchParams.get("room") ?? "").trim().toUpperCase();
      const secWebSocketKey = request.headers["sec-websocket-key"];

      if (!token || !roomCode || typeof secWebSocketKey !== "string") {
        socket.destroy();
        return;
      }

      const user = await requireUserByToken(token);
      const room = await getRoom(user, roomCode);

      const acceptValue = createAcceptValue(secWebSocketKey);
      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${acceptValue}`,
          "",
          "",
        ].join("\r\n"),
      );

      attachRoomSocket(roomCode, socket);
      sendJson(socket, {
        type: "room:update",
        room,
      });

      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const decoded = decodeFrames(buffer);
        buffer = decoded.remaining;

        for (const message of decoded.messages) {
          if (message.opcode === 0x8) {
            socket.end();
            removeSocket(roomCode, socket);
            return;
          }

          if (message.opcode === 0x9) {
            socket.write(Buffer.concat([Buffer.from([0x8a, message.payload.length]), message.payload]));
          }
        }
      });

      socket.on("close", () => {
        removeSocket(roomCode, socket);
      });

      socket.on("error", () => {
        removeSocket(roomCode, socket);
      });
    } catch {
      socket.destroy();
    }
  });
}
