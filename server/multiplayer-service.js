import crypto from "node:crypto";
import { applyMove, createGame, formatMoveForVariant, getVariantConfig } from "../src/core/index.js";
import { mutateStore, readStore } from "./store.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BASE_RATING = 1200;
const K_FACTOR = 24;
const SUPPORTED_SKINS = new Set(["cathedral", "ember", "crypt", "arcade"]);
const SUPPORTED_VISIBILITY = new Set(["private", "public"]);

function nowIso() {
  return new Date().toISOString();
}

function createRoomCode() {
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
  }

  return code;
}

function ensureRating(ratings, variant) {
  if (!ratings[variant]) {
    ratings[variant] = BASE_RATING;
  }

  return ratings[variant];
}

function normalizeSkinKey(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SUPPORTED_SKINS.has(normalized) ? normalized : "cathedral";
}

function normalizeVisibility(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SUPPORTED_VISIBILITY.has(normalized) ? normalized : "private";
}

function expectedScore(selfRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - selfRating) / 400));
}

function applyEloUpdate(whiteUser, blackUser, variant, winner) {
  whiteUser.ratings ||= {};
  blackUser.ratings ||= {};

  const whiteRating = ensureRating(whiteUser.ratings, variant);
  const blackRating = ensureRating(blackUser.ratings, variant);
  const whiteExpected = expectedScore(whiteRating, blackRating);
  const blackExpected = expectedScore(blackRating, whiteRating);

  const whiteScore = winner === "white" ? 1 : winner === "black" ? 0 : 0.5;
  const blackScore = winner === "black" ? 1 : winner === "white" ? 0 : 0.5;

  whiteUser.ratings[variant] = Math.round(whiteRating + K_FACTOR * (whiteScore - whiteExpected));
  blackUser.ratings[variant] = Math.round(blackRating + K_FACTOR * (blackScore - blackExpected));
}

function ratingDeltaSummary(room, whiteUser, blackUser, variant) {
  if (
    !room.ratingAppliedAt ||
    !whiteUser ||
    !blackUser ||
    room.whiteRatingBefore == null ||
    room.blackRatingBefore == null
  ) {
    return null;
  }

  const whiteAfter = whiteUser.ratings?.[variant] ?? BASE_RATING;
  const blackAfter = blackUser.ratings?.[variant] ?? BASE_RATING;

  return {
    white: {
      before: room.whiteRatingBefore,
      after: whiteAfter,
      change: whiteAfter - room.whiteRatingBefore,
    },
    black: {
      before: room.blackRatingBefore,
      after: blackAfter,
      change: blackAfter - room.blackRatingBefore,
    },
  };
}

function serializePlayer(user, color, variant, skinKey) {
  return {
    id: user.id,
    displayName: user.displayName,
    country: user.country,
    color,
    skinKey: normalizeSkinKey(skinKey),
    rating: user.ratings?.[variant] ?? BASE_RATING,
  };
}

function matchRecordForUser(room, store, userId) {
  if (room.whiteUserId !== userId && room.blackUserId !== userId) {
    return null;
  }

  const variant = room.variant;
  const selfColor = room.whiteUserId === userId ? "white" : "black";
  const opponentId = selfColor === "white" ? room.blackUserId : room.whiteUserId;
  const opponent = opponentId ? store.users.find((user) => user.id === opponentId) : null;
  const selfUser = store.users.find((user) => user.id === userId) ?? null;
  const whiteUser = room.whiteUserId ? store.users.find((user) => user.id === room.whiteUserId) : null;
  const blackUser = room.blackUserId ? store.users.find((user) => user.id === room.blackUserId) : null;
  const result =
    !room.state.winner
      ? room.status === "finished"
        ? "draw"
        : "in_progress"
      : room.state.winner === selfColor
        ? "win"
        : "loss";

  return {
    code: room.code,
    variant,
    visibility: room.visibility ?? "private",
    status: room.status,
    result,
    playerColor: selfColor,
    winner: room.state.winner,
    turn: room.state.turn,
    updatedAt: room.updatedAt,
    createdAt: room.createdAt,
    opponent: opponent
      ? {
          displayName: opponent.displayName,
          country: opponent.country,
          skinKey: selfColor === "white" ? room.blackSkinKey : room.whiteSkinKey,
          rating: opponent.ratings?.[variant] ?? BASE_RATING,
        }
      : null,
    ratingDelta: (() => {
      const summary = ratingDeltaSummary(room, whiteUser, blackUser, variant);
      return selfColor && summary ? summary[selfColor] : null;
    })(),
    playerRating: selfUser?.ratings?.[variant] ?? BASE_RATING,
    playerSkinKey: selfColor === "white" ? room.whiteSkinKey : room.blackSkinKey,
    moveHistory: room.moveHistory ?? [],
  };
}

function publicMatchSummary(room, store) {
  const variant = room.variant;
  const whiteUser = room.whiteUserId ? store.users.find((user) => user.id === room.whiteUserId) : null;
  const blackUser = room.blackUserId ? store.users.find((user) => user.id === room.blackUserId) : null;

  return {
    code: room.code,
    variant,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    winner: room.state.winner,
    ratingDelta: ratingDeltaSummary(room, whiteUser, blackUser, variant),
    state: room.state,
    players: {
      white: whiteUser ? serializePlayer(whiteUser, "white", variant, room.whiteSkinKey) : null,
      black: blackUser ? serializePlayer(blackUser, "black", variant, room.blackSkinKey) : null,
    },
    moveHistory: room.moveHistory ?? [],
  };
}

function roomSummary(room, store, currentUserId = null) {
  const variant = room.variant;
  const whiteUser = room.whiteUserId ? store.users.find((user) => user.id === room.whiteUserId) : null;
  const blackUser = room.blackUserId ? store.users.find((user) => user.id === room.blackUserId) : null;
  const currentColor =
    room.whiteUserId === currentUserId ? "white" : room.blackUserId === currentUserId ? "black" : null;

  return {
    code: room.code,
    variant: room.variant,
    visibility: room.visibility ?? "private",
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    winner: room.state.winner,
    currentColor,
    ratingDelta: ratingDeltaSummary(room, whiteUser, blackUser, variant),
    inviteCode: room.code,
    state: room.state,
    players: {
      white: whiteUser ? serializePlayer(whiteUser, "white", variant, room.whiteSkinKey) : null,
      black: blackUser ? serializePlayer(blackUser, "black", variant, room.blackSkinKey) : null,
    },
    moveHistory: room.moveHistory ?? [],
  };
}

function assertVariant(variant) {
  getVariantConfig(variant);
}

export async function createRoom(currentUser, { variant, skinKey, visibility }) {
  assertVariant(variant);
  const normalizedSkinKey = normalizeSkinKey(skinKey);
  const normalizedVisibility = normalizeVisibility(visibility);

  return mutateStore(async (store) => {
    let code = createRoomCode();

    while (store.rooms.some((room) => room.code === code)) {
      code = createRoomCode();
    }

    const room = {
      code,
      variant,
      visibility: normalizedVisibility,
      status: "waiting",
      whiteUserId: currentUser.id,
      blackUserId: null,
      whiteSkinKey: normalizedSkinKey,
      blackSkinKey: null,
      whiteRatingBefore: currentUser.ratings?.[variant] ?? BASE_RATING,
      blackRatingBefore: null,
      state: createGame(variant),
      moveHistory: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ratingAppliedAt: null,
    };

    store.rooms.push(room);
    return roomSummary(room, store, currentUser.id);
  });
}

export async function listPublicRooms() {
  const store = await readStore();

  return store.rooms
    .filter((room) => room.visibility === "public")
    .filter((room) => room.status === "waiting")
    .map((room) => {
      const owner = room.whiteUserId
        ? store.users.find((user) => user.id === room.whiteUserId)
        : null;

      return {
        code: room.code,
        variant: room.variant,
        visibility: room.visibility,
        status: room.status,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        host: owner
          ? {
              displayName: owner.displayName,
              country: owner.country,
              rating: owner.ratings?.[room.variant] ?? BASE_RATING,
              skinKey: room.whiteSkinKey ?? "cathedral",
            }
          : null,
      };
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function joinRoom(currentUser, roomCode, skinKey) {
  const normalizedCode = String(roomCode ?? "").trim().toUpperCase();
  const normalizedSkinKey = normalizeSkinKey(skinKey);

  return mutateStore(async (store) => {
    const room = store.rooms.find((entry) => entry.code === normalizedCode);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.blackUserId && room.blackUserId !== currentUser.id && room.whiteUserId !== currentUser.id) {
      throw new Error("Room is already full");
    }

    if (room.whiteUserId === currentUser.id) {
      room.whiteSkinKey = normalizedSkinKey;
    }

    if (room.blackUserId === currentUser.id) {
      room.blackSkinKey = normalizedSkinKey;
      room.blackRatingBefore ??= currentUser.ratings?.[room.variant] ?? BASE_RATING;
    }

    if (!room.blackUserId && room.whiteUserId !== currentUser.id) {
      room.blackUserId = currentUser.id;
      room.blackSkinKey = normalizedSkinKey;
      room.blackRatingBefore = currentUser.ratings?.[room.variant] ?? BASE_RATING;
      room.status = "playing";
      room.updatedAt = nowIso();
    }

    return roomSummary(room, store, currentUser.id);
  });
}

export async function getRoom(currentUser, roomCode) {
  const normalizedCode = String(roomCode ?? "").trim().toUpperCase();
  const store = await readStore();
  const room = store.rooms.find((entry) => entry.code === normalizedCode);

  if (!room) {
    throw new Error("Room not found");
  }

  if (room.whiteUserId !== currentUser.id && room.blackUserId !== currentUser.id) {
    throw new Error("Access denied");
  }

  return roomSummary(room, store, currentUser.id);
}

export async function submitRoomMove(currentUser, roomCode, move) {
  const normalizedCode = String(roomCode ?? "").trim().toUpperCase();

  return mutateStore(async (store) => {
    const room = store.rooms.find((entry) => entry.code === normalizedCode);

    if (!room) {
      throw new Error("Room not found");
    }

    const currentColor =
      room.whiteUserId === currentUser.id ? "white" : room.blackUserId === currentUser.id ? "black" : null;

    if (!currentColor) {
      throw new Error("Access denied");
    }

    if (room.status !== "playing") {
      throw new Error("Room is not ready for moves");
    }

    if (room.state.currentPlayer !== currentColor) {
      throw new Error("It is not your turn");
    }

    const previousState = room.state;
    const nextState = applyMove(previousState, move);

    if (nextState === previousState) {
      throw new Error("Illegal move");
    }

    room.state = nextState;
    room.updatedAt = nowIso();
    room.moveHistory = [
      {
        turn: previousState.turn,
        player: previousState.currentPlayer,
        actor: "online",
        text: formatMoveForVariant(room.variant, move),
        move,
      },
      ...(room.moveHistory ?? []),
    ];

    if (room.state.winner) {
      room.status = "finished";

      if (!room.ratingAppliedAt && room.whiteUserId && room.blackUserId) {
        const whiteUser = store.users.find((user) => user.id === room.whiteUserId);
        const blackUser = store.users.find((user) => user.id === room.blackUserId);

        if (whiteUser && blackUser) {
          applyEloUpdate(whiteUser, blackUser, room.variant, room.state.winner);
          room.ratingAppliedAt = nowIso();
        }
      }
    }

    return roomSummary(room, store, currentUser.id);
  });
}

export async function getLeaderboard({ variant, country }) {
  const selectedVariant = String(variant ?? "russian");
  assertVariant(selectedVariant);
  const normalizedCountry = country ? String(country).trim() : null;
  const store = await readStore();

  const users = store.users
    .filter((user) => user.verifiedAt)
    .filter((user) => !normalizedCountry || user.country === normalizedCountry)
    .map((user) => ({
      id: user.id,
      displayName: user.displayName,
      country: user.country,
      rating: user.ratings?.[selectedVariant] ?? BASE_RATING,
    }))
    .sort((left, right) => right.rating - left.rating)
    .slice(0, 50);

  const countries = [...new Set(store.users.filter((user) => user.verifiedAt).map((user) => user.country))]
    .sort()
    .map((entryCountry) => {
      const players = store.users.filter((user) => user.verifiedAt && user.country === entryCountry);
      const average =
        players.reduce((sum, user) => sum + (user.ratings?.[selectedVariant] ?? BASE_RATING), 0) /
        Math.max(players.length, 1);

      return {
        country: entryCountry,
        players: players.length,
        averageRating: Math.round(average),
      };
    })
    .sort((left, right) => right.averageRating - left.averageRating);

  return {
    variant: selectedVariant,
    country: normalizedCountry,
    topPlayers: users,
    countries,
  };
}

export async function getUserMatchHistory(currentUser) {
  const store = await readStore();

  return store.rooms
    .map((room) => matchRecordForUser(room, store, currentUser.id))
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function getProfileBundle(currentUser) {
  const matches = await getUserMatchHistory(currentUser);

  return {
    user: currentUser,
    recentMatches: matches.slice(0, 20),
    stats: {
      total: matches.length,
      wins: matches.filter((match) => match.result === "win").length,
      losses: matches.filter((match) => match.result === "loss").length,
      draws: matches.filter((match) => match.result === "draw").length,
    },
  };
}

export async function getPublicMatch(roomCode) {
  const normalizedCode = String(roomCode ?? "").trim().toUpperCase();
  const store = await readStore();
  const room = store.rooms.find((entry) => entry.code === normalizedCode);

  if (!room) {
    throw new Error("Match not found");
  }

  return publicMatchSummary(room, store);
}
