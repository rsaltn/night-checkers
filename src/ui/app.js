import {
  applyMove,
  analyzePlayedMove,
  createGame,
  formatMoveForVariant,
  getLegalMoves,
  getLegalMovesForPiece,
  getVariantConfig,
  listVariants,
  restartGame,
} from "../core/index.js";
import { getAIStatus, requestAIMove } from "./ai-client.js";
import {
  connectRoomSocket,
  createOnlineRoom,
  getCurrentUser,
  getLeaderboard,
  getMyMatches,
  getMeta,
  getOnlineRoom,
  getProfile,
  getPublicMatch,
  joinOnlineRoom,
  listPublicOnlineRooms,
  loginUser,
  logoutUser,
  requestPasswordReset,
  requestRegister,
  resetPassword,
  submitOnlineMove,
} from "./platform-client.js";

const STORAGE_KEYS = {
  authToken: "night-checkers:auth-token",
  skin: "night-checkers:skin",
};

const MOTION = {
  moveMs: 320,
  captureMs: 280,
  pulseMs: 420,
};

const BOARD_LABELS_CACHE = new Map();

const SKINS = {
  cathedral: {
    label: "Cathedral",
    pieceSprites: {
      white: {
        man: "/src/assets/pixel/piece-white-man.svg",
        king: "/src/assets/pixel/piece-white-king.svg",
      },
      black: {
        man: "/src/assets/pixel/piece-black-man.svg",
        king: "/src/assets/pixel/piece-black-king.svg",
      },
    },
    ornament: "/src/assets/pixel/panel-ornament.svg",
    backdropLite: "/src/assets/pixel/stage-backdrop.svg",
    backdrop3d: "/src/assets/pixel/stage-backdrop.svg",
    tiles: {
      light: "/src/assets/pixel/new/classic_tile_light.svg",
      dark: "/src/assets/pixel/new/classic_tile_dark.svg",
    },
    palette: {
      panelBorder: "rgba(180, 150, 97, 0.24)",
      ink: "#edf8e8",
      muted: "#b8c4b0",
      hot: "#d9c287",
      hotSoft: "rgba(217, 194, 135, 0.16)",
      warning: "#f6d28f",
      woodMid: "#6b4b35",
      boardDark: "#18392d",
      boardLight: "#2d624a",
      bodyGlowA: "rgba(146, 128, 87, 0.18)",
      bodyGlowB: "rgba(73, 110, 88, 0.16)",
    },
  },
  ember: {
    label: "Ember Shrine",
    pieceSprites: {
      white: {
        man: "/src/assets/pixel/piece-ember-white-man.svg",
        king: "/src/assets/pixel/piece-ember-white-king.svg",
      },
      black: {
        man: "/src/assets/pixel/piece-ember-black-man.svg",
        king: "/src/assets/pixel/piece-ember-black-king.svg",
      },
    },
    ornament: "/src/assets/pixel/panel-ornament.svg",
    backdropLite: "/src/assets/pixel/stage-backdrop.svg",
    backdrop3d: "/src/assets/pixel/stage-backdrop.svg",
    tiles: {
      light: "/src/assets/pixel/new/lava_tile_light.svg",
      dark: "/src/assets/pixel/new/lava_tile_dark.svg",
    },
    palette: {
      panelBorder: "rgba(255, 136, 61, 0.26)",
      ink: "#fff0d8",
      muted: "#d0a78e",
      hot: "#ff8e38",
      hotSoft: "rgba(255, 142, 56, 0.18)",
      warning: "#ffd27a",
      woodMid: "#6d3320",
      boardDark: "#3b1d15",
      boardLight: "#6c3220",
      bodyGlowA: "rgba(255, 116, 55, 0.2)",
      bodyGlowB: "rgba(146, 44, 9, 0.18)",
    },
  },
  crypt: {
    label: "Crypt Glass",
    pieceSprites: {
      white: {
        man: "/src/assets/pixel/piece-crypt-white-man.svg",
        king: "/src/assets/pixel/piece-crypt-white-king.svg",
      },
      black: {
        man: "/src/assets/pixel/piece-crypt-black-man.svg",
        king: "/src/assets/pixel/piece-crypt-black-king.svg",
      },
    },
    ornament: "/src/assets/pixel/panel-ornament.svg",
    backdropLite: "/src/assets/pixel/stage-backdrop.svg",
    backdrop3d: "/src/assets/pixel/stage-backdrop.svg",
    tiles: {
      light: "/src/assets/pixel/new/ice_tile_light.svg",
      dark: "/src/assets/pixel/new/ice_tile_dark.svg",
    },
    palette: {
      panelBorder: "rgba(84, 229, 255, 0.24)",
      ink: "#eaffff",
      muted: "#9fcad1",
      hot: "#69efff",
      hotSoft: "rgba(105, 239, 255, 0.16)",
      warning: "#a8fbff",
      woodMid: "#22434a",
      boardDark: "#0f2a2f",
      boardLight: "#1d5058",
      bodyGlowA: "rgba(72, 224, 255, 0.18)",
      bodyGlowB: "rgba(13, 80, 95, 0.18)",
    },
  },
  arcade: {
    label: "Neon Arcade",
    pieceSprites: {
      white: {
        man: "/src/assets/pixel/piece-arcade-white-man.svg",
        king: "/src/assets/pixel/piece-arcade-white-king.svg",
      },
      black: {
        man: "/src/assets/pixel/piece-arcade-black-man.svg",
        king: "/src/assets/pixel/piece-arcade-black-king.svg",
      },
    },
    ornament: "/src/assets/pixel/panel-ornament.svg",
    backdropLite: "/src/assets/pixel/stage-backdrop.svg",
    backdrop3d: "/src/assets/pixel/stage-backdrop.svg",
    tiles: {
      light: "/src/assets/pixel/new/cyber_tile_light.svg",
      dark: "/src/assets/pixel/new/cyber_tile_dark.svg",
    },
    palette: {
      panelBorder: "rgba(255, 93, 211, 0.28)",
      ink: "#f2f3ff",
      muted: "#b9bbd9",
      hot: "#ff58cc",
      hotSoft: "rgba(255, 88, 204, 0.16)",
      warning: "#59d3ff",
      woodMid: "#3f2469",
      boardDark: "#15193f",
      boardLight: "#283272",
      bodyGlowA: "rgba(255, 73, 194, 0.2)",
      bodyGlowB: "rgba(33, 123, 255, 0.18)",
    },
  },
};

function getSkinConfig(key) {
  return SKINS[key] ?? SKINS.cathedral;
}

function normalizeSkinKey(value) {
  return SKINS[value] ? value : "cathedral";
}

function skinKeyForBoardSide(color, skinContext) {
  return normalizeSkinKey(skinContext?.[color] ?? "cathedral");
}

function getPieceAt(state, row, col) {
  return state.pieces.find((piece) => piece.row === row && piece.col === col) ?? null;
}

function renderPiece(piece, skinContext) {
  const pieceSkin = getSkinConfig(skinKeyForBoardSide(piece.color, skinContext));
  const dataAttrs = piece.id ? ` data-piece-id="${escapeHtml(piece.id)}"` : "";

  return `
    <span class="piece piece--${piece.color} piece--${piece.kind}"${dataAttrs}>
      <img
        class="piece__sprite"
        src="${pieceSkin.pieceSprites[piece.color][piece.kind]}"
        alt=""
        draggable="false"
      />
    </span>
  `;
}

function sameSquare(a, b) {
  return a && b && a.row === b.row && a.col === b.col;
}

function variantDisplayName(variant) {
  const labels = {
    russian: "Russian Draughts",
    english: "English Checkers",
    international: "International 10x10",
  };

  return labels[variant.key] ?? variant.label;
}

function playerDisplayName(color) {
  return color === "white" ? "Ivory" : "Obsidian";
}

function getColumnLabels(size) {
  const cacheKey = `cols:${size}`;

  if (!BOARD_LABELS_CACHE.has(cacheKey)) {
    BOARD_LABELS_CACHE.set(
      cacheKey,
      Array.from({ length: size }, (_, index) => String.fromCharCode(65 + index)),
    );
  }

  return BOARD_LABELS_CACHE.get(cacheKey);
}

function getRowLabels(size) {
  const cacheKey = `rows:${size}`;

  if (!BOARD_LABELS_CACHE.has(cacheKey)) {
    BOARD_LABELS_CACHE.set(
      cacheKey,
      Array.from({ length: size }, (_, index) => String(size - index)),
    );
  }

  return BOARD_LABELS_CACHE.get(cacheKey);
}

function createBoardIndex(state) {
  const bySquare = new Map();
  let whitePieces = 0;
  let blackPieces = 0;

  for (const piece of state.pieces) {
    bySquare.set(`${piece.row}:${piece.col}`, piece);

    if (piece.color === "white") {
      whitePieces += 1;
    } else {
      blackPieces += 1;
    }
  }

  return {
    get(row, col) {
      return bySquare.get(`${row}:${col}`) ?? null;
    },
    whitePieces,
    blackPieces,
  };
}

function normalizeRoomCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const PAGES = {
  home: "/",
  play: "/play",
  online: "/online",
  leaderboard: "/leaderboard",
  profile: "/profile",
  auth: "/auth",
};

function pageKeyFromPathname(pathname) {
  if (/^\/match\/[A-Z0-9]+$/i.test(pathname)) {
    return "match";
  }

  const found = Object.entries(PAGES).find(([, value]) => value === pathname);
  return found?.[0] ?? "home";
}

export function createApp(root) {
  const currentUrl = new URL(window.location.href);
  const initialRoomCode = normalizeRoomCode(currentUrl.searchParams.get("room"));
  const initialMatchCode = normalizeRoomCode(currentUrl.pathname.match(/^\/match\/([A-Z0-9]+)$/i)?.[1]);
  let currentPage = pageKeyFromPathname(window.location.pathname);
  let state = createGame("russian");
  let selectedPieceId = null;
  let pendingMoves = [];
  let gameMode = currentPage === "online" ? "online" : "local";
  let authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) ?? "";
  let currentUser = null;
  let authMode = "login";
  let authError = "";
  let authMessage = "";
  let authEmailDraft = "";
  let authCountryDraft = "Kazakhstan";
  let leaderboardCountry = "";
  let leaderboard = null;
  let profileBundle = null;
  let matchHistory = [];
  let profileView = "history";
  let historyVerdictFilter = "all";
  let selectedHistoryCode = "";
  let publicMatch = null;
  let publicMatchAnalysis = [];
  const matchAnalysisCache = new Map();
  const pendingMatchAnalysis = new Set();
  let ephemeralMatch = null;
  let pendingReplayPly = null;
  let replayPly = 0;
  let onlineRoom = null;
  let roomCodeDraft = initialRoomCode;
  let roomVisibilityDraft = "private";
  let publicRooms = [];
  let publicRoomsTimer = null;
  let onlineError = "";
  let meta = {
    countries: [authCountryDraft],
  };
  const renderMode = "pseudo3d";
  let skinKey = window.localStorage.getItem(STORAGE_KEYS.skin) ?? "cathedral";
  let aiDifficulty = "medium";
  let aiColor = "black";
  let aiTimer = null;
  let roomSocket = null;
  let aiRequestId = 0;
  let coachRequestId = 0;
  let isAIThinking = false;
  let aiStatus = null;
  let aiLastProvider = "internal";
  let aiFallbackReason = null;
  let coachInsight = null;
  let moveHistory = [];
  let postMatchSummary = null;
  let postMatchTab = "summary";
  let dismissedPostMatchKey = "";
  let pendingBoardAnimation = null;
  let captureSequence = null;

  function formatMove(move) {
    const route = formatMoveForVariant(state.variant, move);
    return move.isCapture ? `${route} | x${move.captures.length}` : route;
  }

  function escapeSelector(value) {
    const stringValue = String(value ?? "");
    return window.CSS?.escape ? window.CSS.escape(stringValue) : stringValue.replace(/"/g, '\\"');
  }

  function spriteSrcForPiece(piece, skinContext) {
    const pieceSkin = getSkinConfig(skinKeyForBoardSide(piece.color, skinContext));
    return pieceSkin.pieceSprites[piece.color][piece.kind];
  }

  function captureBoardSnapshot(stateSnapshot, skinContext) {
    const boardElement = root.querySelector(".board");

    if (!boardElement || !stateSnapshot?.pieces?.length) {
      return null;
    }

    const pieces = new Map();

    for (const piece of stateSnapshot.pieces) {
      const element = root.querySelector(`[data-piece-id="${escapeSelector(piece.id)}"]`);

      if (!element) {
        continue;
      }

      pieces.set(piece.id, {
        ...piece,
        rect: element.getBoundingClientRect(),
        spriteSrc: spriteSrcForPiece(piece, skinContext),
      });
    }

    return {
      boardRect: boardElement.getBoundingClientRect(),
      pieces,
    };
  }

  function queueBoardAnimation({ beforeState, afterState, move, beforeSkinContext, afterSkinContext }) {
    if (!move) {
      return;
    }

    const snapshot = captureBoardSnapshot(beforeState, beforeSkinContext);

    if (!snapshot) {
      return;
    }

    pendingBoardAnimation = {
      snapshot,
      move,
      afterState,
      afterSkinContext,
    };
  }

  function spawnCapturedGhost(pieceSnapshot) {
    if (!pieceSnapshot?.rect) {
      return;
    }

    const ghost = document.createElement("div");
    ghost.className = `piece piece-ghost piece-ghost--captured piece--${pieceSnapshot.color} piece--${pieceSnapshot.kind}`;
    ghost.style.left = `${pieceSnapshot.rect.left}px`;
    ghost.style.top = `${pieceSnapshot.rect.top}px`;
    ghost.style.width = `${pieceSnapshot.rect.width}px`;
    ghost.style.height = `${pieceSnapshot.rect.height}px`;
    ghost.innerHTML = `<img class="piece__sprite" src="${pieceSnapshot.spriteSrc}" alt="" draggable="false" />`;
    document.body.appendChild(ghost);

    ghost.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1, filter: "brightness(1)" },
        { transform: "translate3d(0, -10px, 0) scale(1.08)", opacity: 0.9, filter: "brightness(1.45)" },
        { transform: "translate3d(0, 12px, 0) scale(0.18)", opacity: 0, filter: "brightness(0.7)" },
      ],
      {
        duration: MOTION.captureMs,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "forwards",
      },
    ).finished.finally(() => ghost.remove());
  }

  function playPendingBoardAnimation() {
    const animation = pendingBoardAnimation;

    if (!animation) {
      return;
    }

    pendingBoardAnimation = null;

    requestAnimationFrame(() => {
      const movedPiece = root.querySelector(`[data-piece-id="${escapeSelector(animation.move.pieceId)}"]`);
      const previousPiece = animation.snapshot.pieces.get(animation.move.pieceId);

      if (movedPiece && previousPiece?.rect) {
        const nextRect = movedPiece.getBoundingClientRect();
        const dx = previousPiece.rect.left - nextRect.left;
        const dy = previousPiece.rect.top - nextRect.top;

        movedPiece.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(1.04)`, opacity: 0.96 },
            { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
          ],
          {
            duration: MOTION.moveMs,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          },
        );
      }

      for (const capturedId of animation.move.captures ?? []) {
        spawnCapturedGhost(animation.snapshot.pieces.get(capturedId));
      }

      if (movedPiece && (animation.move.promotes || animation.move.pieceKindBefore !== animation.move.pieceKindAfter)) {
        movedPiece.animate(
          [
            { transform: "scale(0.84)", filter: "brightness(1.15)" },
            { transform: "scale(1.14)", filter: "brightness(1.65)" },
            { transform: "scale(1)", filter: "brightness(1)" },
          ],
          {
            duration: MOTION.pulseMs,
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          },
        );
      }

      const targetCell = root.querySelector(`[data-row="${animation.move.to.row}"][data-col="${animation.move.to.col}"]`);

      if (targetCell) {
        targetCell.animate(
          [
            { boxShadow: "inset 0 0 0 0 rgba(255,255,255,0)" },
            { boxShadow: "inset 0 0 0 3px rgba(255, 236, 170, 0.95), 0 0 24px rgba(255, 236, 170, 0.22)" },
            { boxShadow: "inset 0 0 0 0 rgba(255,255,255,0)" },
          ],
          {
            duration: MOTION.pulseMs,
            easing: "ease-out",
          },
        );
      }

      if (animation.afterState?.winner) {
        const board = root.querySelector(".board");

        board?.animate(
          [
            { filter: "brightness(1)", transform: "translateZ(12px) scale(1)" },
            { filter: "brightness(1.12)", transform: "translateZ(12px) scale(1.01)" },
            { filter: "brightness(1)", transform: "translateZ(12px) scale(1)" },
          ],
          {
            duration: MOTION.pulseMs + 120,
            easing: "ease-out",
          },
        );
      }
    });
  }

  function clearAITimer() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function clearPublicRoomsTimer() {
    if (publicRoomsTimer) {
      clearInterval(publicRoomsTimer);
      publicRoomsTimer = null;
    }
  }

  function disconnectRoomSocket() {
    if (roomSocket) {
      roomSocket.close();
      roomSocket = null;
    }
  }

  function loadPublicRooms() {
    listPublicOnlineRooms()
      .then((payload) => {
        const nextRooms = payload.rooms ?? [];
        const nextSignature = JSON.stringify(
          nextRooms.map((room) => [room.code, room.status, room.visibility, room.variant, room.players?.white?.id ?? "", room.players?.black?.id ?? ""]),
        );
        const prevSignature = JSON.stringify(
          publicRooms.map((room) => [room.code, room.status, room.visibility, room.variant, room.players?.white?.id ?? "", room.players?.black?.id ?? ""]),
        );

        if (nextSignature !== prevSignature) {
          publicRooms = nextRooms;
          render();
        }
      })
      .catch(() => {
        if (publicRooms.length > 0) {
          publicRooms = [];
          render();
        }
      });
  }

  function syncPublicRoomPolling() {
    clearPublicRoomsTimer();

    if (currentPage !== "online") {
      return;
    }

    loadPublicRooms();
    publicRoomsTimer = setInterval(() => {
      if (currentPage === "online") {
        loadPublicRooms();
      }
    }, 8000);
  }

  function loadAIStatus() {
    getAIStatus()
      .then((status) => {
        aiStatus = status;
        render();
      })
      .catch(() => {
        aiStatus = null;
        render();
      });
  }

  function loadMeta() {
    getMeta()
      .then((payload) => {
        meta = payload;
        if (!meta.countries.includes(authCountryDraft)) {
          authCountryDraft = meta.countries[0] ?? authCountryDraft;
        }
        render();
      })
      .catch(() => {
        render();
      });
  }

  function loadLeaderboard() {
    getLeaderboard(state.variant, leaderboardCountry || undefined)
      .then((payload) => {
        const prevSignature = leaderboard
          ? JSON.stringify([leaderboard.variant, leaderboard.country ?? "", leaderboard.topPlayers?.slice(0, 8), leaderboard.countries?.slice(0, 8)])
          : "";
        const nextSignature = JSON.stringify([payload.variant, payload.country ?? "", payload.topPlayers?.slice(0, 8), payload.countries?.slice(0, 8)]);

        if (prevSignature !== nextSignature) {
          leaderboard = payload;
          render();
        }
      })
      .catch(() => {
        if (leaderboard !== null) {
          leaderboard = null;
          render();
        }
      });
  }

  function loadProfileData() {
    if (!authToken) {
      profileBundle = null;
      matchHistory = [];
      render();
      return;
    }

    getProfile(authToken)
      .then((payload) => {
        profileBundle = payload;
        render();
      })
      .catch(() => {
        profileBundle = null;
        render();
      });

    getMyMatches(authToken)
      .then((payload) => {
        matchHistory = payload.matches ?? [];
        ensureSelectedHistoryCode();
        render();
      })
      .catch(() => {
        matchHistory = [];
        selectedHistoryCode = "";
        render();
      });
  }

  function replayStateForMatch(match, ply) {
    if (!match) {
      return createGame("russian");
    }

    let replayState = createGame(match.variant);
    const chronologicalMoves = [...(match.moveHistory ?? [])].reverse();

    for (let index = 0; index < Math.min(ply, chronologicalMoves.length); index += 1) {
      const move = chronologicalMoves[index]?.move;

      if (move) {
        replayState = applyMove(replayState, move);
      }
    }

    return replayState;
  }

  function analyzeMatchMoves(match) {
    if (!match?.moveHistory?.length) {
      return [];
    }

    const chronologicalMoves = [...match.moveHistory].reverse();
    let analysisState = createGame(match.variant);

    return chronologicalMoves.map((entry, index) => {
      const move = entry?.move;
      const insight = move
        ? analyzePlayedMove(analysisState, move, {
            difficulty: "medium",
          })
        : null;

      if (move) {
        analysisState = applyMove(analysisState, move);
      }

      return {
        ...entry,
        ply: index + 1,
        insight,
      };
    });
  }

  function analysisCacheKey(match) {
    if (!match) {
      return "";
    }

    return [
      match.code ?? "match",
      match.updatedAt ?? "",
      match.moveHistory?.length ?? 0,
      match.winner ?? "",
    ].join(":");
  }

  function getCachedMatchAnalysis(match) {
    const key = analysisCacheKey(match);
    return key ? matchAnalysisCache.get(key) ?? null : null;
  }

  function warmMatchAnalysis(match, onReady = null) {
    const key = analysisCacheKey(match);

    if (!key) {
      return null;
    }

    const cached = matchAnalysisCache.get(key);

    if (cached) {
      onReady?.(cached);
      return cached;
    }

    if (pendingMatchAnalysis.has(key)) {
      return null;
    }

    pendingMatchAnalysis.add(key);
    window.setTimeout(() => {
      const analysis = analyzeMatchMoves(match);
      matchAnalysisCache.set(key, analysis);
      pendingMatchAnalysis.delete(key);
      onReady?.(analysis);
    }, 0);

    return null;
  }

  function summarizeMatchAnalysis(entries) {
    return entries.reduce(
      (summary, entry) => {
        const verdict = entry?.insight?.verdict;

        if (verdict && summary[verdict] !== undefined) {
          summary[verdict] += 1;
        }

        return summary;
      },
      {
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
      },
    );
  }

  function matchByCode(code) {
    return matchHistory.find((match) => match.code === code) ?? null;
  }

  function resultHeadline(result, winnerLabel = "") {
    if (result === "win") {
      return "Victory";
    }

    if (result === "loss") {
      return "Defeat";
    }

    if (result === "draw") {
      return "Draw";
    }

    return winnerLabel ? `${winnerLabel} wins` : "Match finished";
  }

  function onlineResultForCurrentUser(room) {
    if (!room) {
      return "draw";
    }

    if (!room.winner) {
      return room.status === "finished" ? "draw" : "in_progress";
    }

    return room.currentColor === room.winner ? "win" : "loss";
  }

  function buildEphemeralMatch({
    code,
    variant,
    whitePlayer,
    blackPlayer,
    winner,
    finalState,
    moveHistory: reviewMoves,
    status = "finished",
  }) {
    return {
      code,
      variant,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      winner,
      state: finalState,
      players: {
        white: whitePlayer,
        black: blackPlayer,
      },
      moveHistory: reviewMoves,
      ratingDelta: null,
    };
  }

  function buildOnlineReviewMatch(room) {
    return {
      code: room.code,
      variant: room.variant,
      status: room.status,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      winner: room.winner,
      state: room.state,
      players: room.players,
      moveHistory: room.moveHistory ?? [],
      ratingDelta: room.ratingDelta ?? null,
    };
  }

  function analysisStatsByColor(entries) {
    const base = {
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      total: 0,
      accuracy: 0,
    };

    const stats = {
      white: { ...base },
      black: { ...base },
    };

    for (const entry of entries) {
      const color = entry?.player;
      const verdict = entry?.insight?.verdict ?? "good";

      if (!stats[color]) {
        continue;
      }

      if (stats[color][verdict] !== undefined) {
        stats[color][verdict] += 1;
      }

      stats[color].total += 1;
    }

    for (const color of ["white", "black"]) {
      const side = stats[color];
      const score =
        side.good * 1 +
        side.inaccuracy * 0.7 +
        side.mistake * 0.35 +
        side.blunder * 0;

      side.accuracy = side.total ? Math.round((score / side.total) * 100) : 0;
    }

    return stats;
  }

  function openMatchReview(match, ply = null) {
    ephemeralMatch = null;
    pendingReplayPly = ply;
    navigateToMatch(match.code);
  }

  function openTemporaryReview(match, ply = null) {
    clearCaptureSequence();
    selectedPieceId = null;
    pendingMoves = [];
    ephemeralMatch = match;
    publicMatch = match;
    publicMatchAnalysis = getCachedMatchAnalysis(match) ?? [];
    warmMatchAnalysis(match, (analysis) => {
      if (publicMatch?.code === match.code) {
        publicMatchAnalysis = analysis;
        render();
      }
    });
    replayPly = ply ?? (match.moveHistory?.length ?? 0);
    currentPage = "match";
    window.history.pushState({}, "", `/match/${match.code}`);
    render();
  }

  function hidePostMatchSummary() {
    if (postMatchSummary?.key) {
      dismissedPostMatchKey = postMatchSummary.key;
    }

    postMatchSummary = null;
    render();
  }

  function restartFromPostMatch() {
    if (postMatchSummary?.mode === "online" && authToken) {
      onlineError = "";
      createOnlineRoom(authToken, {
        variant: state.variant,
        skinKey,
        visibility: roomVisibilityDraft,
      })
        .then((room) => {
          dismissedPostMatchKey = "";
          postMatchSummary = null;
          gameMode = "online";
          syncRoom(room);
          connectRoomRealtime(room.code);
          loadPublicRooms();
        })
        .catch((error) => {
          onlineError = error.message;
          render();
        });
      return;
    }

    onSelectVariant(state.variant);
  }

  function setPostMatchSummary(nextSummary) {
    if (!nextSummary) {
      postMatchSummary = null;
      return;
    }

    if (dismissedPostMatchKey === nextSummary.key) {
      postMatchSummary = nextSummary;
      return;
    }

    postMatchSummary = nextSummary;
    postMatchTab = "summary";
    warmMatchAnalysis(nextSummary.match, () => {
      if (postMatchSummary?.key === nextSummary.key) {
        render();
      }
    });
  }

  function ensureSelectedHistoryCode() {
    if (!matchHistory.length) {
      selectedHistoryCode = "";
      return null;
    }

    if (!selectedHistoryCode || !matchByCode(selectedHistoryCode)) {
      selectedHistoryCode = matchHistory[0].code;
    }

    return matchByCode(selectedHistoryCode);
  }

  function verdictLabel(verdict) {
    const labels = {
      all: "All verdicts",
      good: "Good",
      inaccuracy: "Inaccuracy",
      mistake: "Mistake",
      blunder: "Blunder",
    };

    return labels[verdict] ?? verdict;
  }

  function boardSkinContextForPlayers(players) {
    return {
      white: normalizeSkinKey(players?.white?.skinKey ?? skinKey),
      black: normalizeSkinKey(players?.black?.skinKey ?? skinKey),
    };
  }

  function boardSkinContextForCurrentView() {
    if (gameMode === "online" && onlineRoom?.players) {
      return boardSkinContextForPlayers(onlineRoom.players);
    }

    if (currentPage === "match" && publicMatch?.players) {
      return boardSkinContextForPlayers(publicMatch.players);
    }

    return {
      white: normalizeSkinKey(skinKey),
      black: normalizeSkinKey(skinKey),
    };
  }

  function tileAssetForSquare(row, col, boardSize, skinContext) {
    const sideColor = row < boardSize / 2 ? "black" : "white";
    const tileSkin = getSkinConfig(skinKeyForBoardSide(sideColor, skinContext));
    const isDark = (row + col) % 2 === 1;

    return isDark ? tileSkin.tiles.dark : tileSkin.tiles.light;
  }

  function getActiveState() {
    return captureSequence?.displayState ?? state;
  }

  function promotionOutcomeForStep(piece, landingRow, variant) {
    const promotionRow = piece.color === "white" ? 0 : variant.boardSize - 1;
    const promotes = piece.kind === "man" && landingRow === promotionRow;

    if (!promotes) {
      return {
        promotes: false,
        nextKind: piece.kind,
        deferredPromotion: false,
      };
    }

    if (variant.stopAfterPromotionOnCapture || variant.continueAsKingAfterPromotionCapture) {
      return {
        promotes: true,
        nextKind: "king",
        deferredPromotion: false,
      };
    }

    return {
      promotes: true,
      nextKind: piece.kind,
      deferredPromotion: true,
    };
  }

  function buildDisplayMoveOptions(candidateMoves, prefixLength, displayState) {
    if (!candidateMoves?.length) {
      return [];
    }

    const groups = new Map();

    for (const move of candidateMoves) {
      const nextSquare = move.path[prefixLength];

      if (!nextSquare) {
        continue;
      }

      const nextCaptureId = move.captures[prefixLength] ?? null;
      const key = `${move.pieceId}:${nextSquare.row}:${nextSquare.col}:${nextCaptureId ?? ""}`;
      const group = groups.get(key) ?? {
        pieceId: move.pieceId,
        to: nextSquare,
        captures: nextCaptureId ? [nextCaptureId] : [],
        isCapture: Boolean(nextCaptureId),
        candidateMoves: [],
      };
      group.candidateMoves.push(move);
      groups.set(key, group);
    }

    return Array.from(groups.values()).map((group) => {
      const piece = displayState.pieces.find((entry) => entry.id === group.pieceId);
      return {
        ...group,
        from: piece ? { row: piece.row, col: piece.col } : null,
        pieceKindBefore: piece?.kind ?? "man",
        path: [group.to],
      };
    });
  }

  function getDisplayMoves(activeState = getActiveState()) {
    if (captureSequence) {
      return buildDisplayMoveOptions(
        captureSequence.candidateMoves,
        captureSequence.prefixLength,
        captureSequence.displayState,
      );
    }

    return buildDisplayMoveOptions(getLegalMoves(activeState), 0, activeState);
  }

  function createDisplayStateAfterStep(displayState, option, variant) {
    const movingPiece = displayState.pieces.find((piece) => piece.id === option.pieceId);

    if (!movingPiece) {
      return null;
    }

    const promotion = promotionOutcomeForStep(movingPiece, option.to.row, variant);
    const nextPieces = displayState.pieces
      .filter((piece) => !option.captures.includes(piece.id))
      .map((piece) => {
        if (piece.id !== option.pieceId) {
          return { ...piece };
        }

        return {
          ...piece,
          row: option.to.row,
          col: option.to.col,
          kind: promotion.nextKind,
        };
      });

    return {
      ...displayState,
      pieces: nextPieces,
      lastMove: {
        pieceId: option.pieceId,
        from: option.from,
        to: option.to,
        path: [option.to],
        captures: [...option.captures],
        isCapture: option.isCapture,
        pieceKindBefore: movingPiece.kind,
        pieceKindAfter: promotion.nextKind,
        promotes: promotion.promotes,
      },
    };
  }

  function clearCaptureSequence() {
    captureSequence = null;
  }

  function loadPublicMatch() {
    if (!initialMatchCode && currentPage !== "match") {
      return;
    }

    const matchCode = normalizeRoomCode(window.location.pathname.match(/^\/match\/([A-Z0-9]+)$/i)?.[1] ?? initialMatchCode);

    if (!matchCode) {
      publicMatch = null;
      render();
      return;
    }

    if (ephemeralMatch && matchCode === ephemeralMatch.code) {
      publicMatch = ephemeralMatch;
      publicMatchAnalysis = getCachedMatchAnalysis(ephemeralMatch) ?? [];
      warmMatchAnalysis(ephemeralMatch, (analysis) => {
        if (publicMatch?.code === ephemeralMatch.code) {
          publicMatchAnalysis = analysis;
          render();
        }
      });
      replayPly = pendingReplayPly ?? (ephemeralMatch.moveHistory?.length ?? 0);
      pendingReplayPly = null;
      render();
      return;
    }

    getPublicMatch(matchCode)
      .then((payload) => {
        publicMatch = payload;
        publicMatchAnalysis = getCachedMatchAnalysis(payload) ?? [];
        warmMatchAnalysis(payload, (analysis) => {
          if (publicMatch?.code === payload.code) {
            publicMatchAnalysis = analysis;
            render();
          }
        });
        replayPly = pendingReplayPly ?? (payload.moveHistory?.length ?? 0);
        pendingReplayPly = null;
        render();
      })
      .catch(() => {
        publicMatch = null;
        publicMatchAnalysis = [];
        pendingReplayPly = null;
        render();
      });
  }

  function navigateTo(pageKey, { replace = false, search = "" } = {}) {
    currentPage = PAGES[pageKey] ? pageKey : "home";
    if (currentPage !== "play" && currentPage !== "online") {
      clearCaptureSequence();
      selectedPieceId = null;
      pendingMoves = [];
    }
    const url = `${PAGES[currentPage]}${search}`;

    if (replace) {
      window.history.replaceState({}, "", url);
    } else if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.pushState({}, "", url);
    }

    syncPublicRoomPolling();
    render();
  }

  function navigateToMatch(code, { replace = false } = {}) {
    currentPage = "match";
    clearCaptureSequence();
    selectedPieceId = null;
    pendingMoves = [];
    const url = `/match/${normalizeRoomCode(code)}`;

    if (replace) {
      window.history.replaceState({}, "", url);
    } else if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.pushState({}, "", url);
    }

    syncPublicRoomPolling();
    loadPublicMatch();
  }

  function setAuthenticated(nextToken, nextUser) {
    authToken = nextToken;
    currentUser = nextUser;
    authError = "";
    authMessage = "";

    if (authToken) {
      window.localStorage.setItem(STORAGE_KEYS.authToken, authToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.authToken);
    }

    loadLeaderboard();
    loadProfileData();
    loadPublicRooms();
    render();
  }

  function syncRoom(room) {
    const previousState = state;
    const previousPlayers = onlineRoom?.players ?? room.players;

    if (
      onlineRoom &&
      room.state?.lastMove &&
      (room.moveHistory?.length ?? 0) > (onlineRoom.moveHistory?.length ?? 0)
    ) {
      queueBoardAnimation({
        beforeState: previousState,
        afterState: room.state,
        move: room.state.lastMove,
        beforeSkinContext: boardSkinContextForPlayers(previousPlayers),
        afterSkinContext: boardSkinContextForPlayers(room.players),
      });
    }

    onlineRoom = room;
    clearCaptureSequence();
    moveHistory = room.moveHistory ?? [];
    selectedPieceId = null;
    pendingMoves = [];
    state = room.state;

    if (room.status === "finished") {
      const selfColor = room.currentColor;
      const selfPlayer = selfColor ? room.players?.[selfColor] : null;
      const opponentColor = selfColor === "white" ? "black" : "white";
      const opponentPlayer = selfColor ? room.players?.[opponentColor] : null;
      const result = onlineResultForCurrentUser(room);

      setPostMatchSummary({
        key: `online:${room.code}:${room.updatedAt}`,
        mode: "online",
        result,
        headline: resultHeadline(result),
        opponentName: opponentPlayer?.displayName ?? "Opponent",
        opponentSubtitle: opponentPlayer ? `${opponentPlayer.country} · ${variantDisplayName(getVariantConfig(room.variant))}` : variantDisplayName(getVariantConfig(room.variant)),
        ratingDelta: selfColor ? room.ratingDelta?.[selfColor] ?? null : null,
        match: buildOnlineReviewMatch(room),
        reviewLabel: "Open game review",
        onReview: () => openMatchReview({
          code: room.code,
        }, room.moveHistory?.length ?? 0),
      });
    } else if (postMatchSummary?.mode === "online" && postMatchSummary.key.startsWith(`online:${room.code}:`)) {
      postMatchSummary = null;
    }

    loadPublicRooms();
    render();
  }

  function connectRoomRealtime(roomCode) {
    disconnectRoomSocket();

    if (!authToken || !roomCode) {
      return;
    }

    roomSocket = connectRoomSocket(authToken, roomCode, {
      onRoomUpdate(room) {
        onlineError = "";
        syncRoom(room);
        loadLeaderboard();
        loadProfileData();
      },
      onRoomRefresh(code) {
        getOnlineRoom(authToken, code)
          .then((room) => {
            onlineError = "";
            syncRoom(room);
            loadLeaderboard();
            loadProfileData();
          })
          .catch((error) => {
            onlineError = error.message;
            render();
          });
      },
      onClose() {
        roomSocket = null;
      },
      onError() {
        onlineError = "Realtime channel interrupted";
        render();
      },
    });
  }

  function loadCurrentUser() {
    if (!authToken) {
      loadLeaderboard();
      render();
      return;
    }

    getCurrentUser(authToken)
      .then(({ user }) => {
        currentUser = user;
        authError = "";
        render();
        loadLeaderboard();
        loadProfileData();

        if (initialRoomCode) {
          roomCodeDraft = initialRoomCode;
          joinOnlineRoom(authToken, initialRoomCode, {
            skinKey,
          })
            .then((room) => {
              gameMode = "online";
              syncRoom(room);
              connectRoomRealtime(room.code);
            })
            .catch(() => {
              render();
            });
        }
      })
      .catch(() => {
        authToken = "";
        currentUser = null;
        window.localStorage.removeItem(STORAGE_KEYS.authToken);
        profileBundle = null;
        matchHistory = [];
        render();
        loadLeaderboard();
        loadPublicRooms();
      });
  }

  function isAITurn(nextState = state) {
    return gameMode === "ai" && nextState.currentPlayer === aiColor && !nextState.winner;
  }

  function scheduleCoachInsight(previousState, move) {
    const requestId = ++coachRequestId;

    window.setTimeout(() => {
      const insight = analyzePlayedMove(previousState, move, {
        difficulty: aiDifficulty,
      });

      if (requestId !== coachRequestId) {
        return;
      }

      coachInsight = insight;
      render();
    }, 0);
  }

  function commitMove(move, actor, options = {}) {
    const { skipAnimation = false } = options;

    if (gameMode === "online" && onlineRoom?.code) {
      isAIThinking = true;
      render();

      submitOnlineMove(authToken, onlineRoom.code, move)
        .then((room) => {
          isAIThinking = false;
          onlineError = "";
          syncRoom(room);
          connectRoomRealtime(room.code);
          loadLeaderboard();
          loadProfileData();
        })
        .catch((error) => {
          isAIThinking = false;
          onlineError = error.message;
          render();
        });
      return;
    }

    const previousState = state;
    const previousSkinContext = boardSkinContextForCurrentView();
    const nextState = applyMove(state, move);

    if (!skipAnimation) {
      queueBoardAnimation({
        beforeState: previousState,
        afterState: nextState,
        move,
        beforeSkinContext: previousSkinContext,
        afterSkinContext: previousSkinContext,
      });
    }

    moveHistory = [
      {
        turn: previousState.turn,
        actor,
        player: previousState.currentPlayer,
        text: formatMove(move),
        move,
      },
      ...moveHistory,
    ];

    if (actor === "human") {
      scheduleCoachInsight(previousState, move);
    }

    selectedPieceId = null;
    pendingMoves = [];
    setState(nextState);

    if (nextState.winner) {
      const humanColor = aiColor === "white" ? "black" : "white";
      const isAIMatch = gameMode === "ai";
      const result = isAIMatch
        ? nextState.winner === humanColor
          ? "win"
          : "loss"
        : null;
      const winnerLabel = playerDisplayName(nextState.winner);
      const variantLabel = variantDisplayName(getVariantConfig(nextState.variant));
      const opponentName = isAIMatch
        ? `AI ${aiDifficulty}`
        : nextState.winner === "white"
          ? "Obsidian"
          : "Ivory";
      const reviewMatch = buildEphemeralMatch({
        code: "LOCALREVIEW",
        variant: nextState.variant,
        whitePlayer: {
          id: "local-white",
          displayName: isAIMatch && humanColor === "black" ? `AI ${aiDifficulty}` : "Ivory",
          country: "Local",
          color: "white",
          skinKey: boardSkinContextForCurrentView().white,
          rating: null,
        },
        blackPlayer: {
          id: "local-black",
          displayName: isAIMatch && humanColor === "white" ? `AI ${aiDifficulty}` : "Obsidian",
          country: "Local",
          color: "black",
          skinKey: boardSkinContextForCurrentView().black,
          rating: null,
        },
        winner: nextState.winner,
        finalState: nextState,
        moveHistory,
      });

      setPostMatchSummary({
        key: `${gameMode}:${nextState.variant}:${moveHistory.length}:${nextState.winner}`,
        mode: gameMode,
        result,
        headline: isAIMatch ? resultHeadline(result) : resultHeadline("", winnerLabel),
        opponentName,
        opponentSubtitle: variantLabel,
        ratingDelta: null,
        match: reviewMatch,
        reviewLabel: "Open game review",
        onReview: () => openTemporaryReview(reviewMatch),
      });
      render();
    }
  }

  function advanceCaptureSequence(option, actor) {
    const activeState = getActiveState();
    const variant = getVariantConfig(activeState.variant);
    const nextDisplayState = createDisplayStateAfterStep(activeState, option, variant);

    if (!nextDisplayState) {
      return;
    }

    const skinContext = boardSkinContextForCurrentView();

    queueBoardAnimation({
      beforeState: activeState,
      afterState: nextDisplayState,
      move: nextDisplayState.lastMove,
      beforeSkinContext: skinContext,
      afterSkinContext: skinContext,
    });

    const previousSequence = captureSequence;
    const nextPrefixLength = (previousSequence?.prefixLength ?? 0) + 1;
    const nextCandidateMoves = option.candidateMoves;
    const shouldContinue = nextCandidateMoves.some((move) => move.path.length > nextPrefixLength);

    if (shouldContinue) {
      captureSequence = {
        baseState: previousSequence?.baseState ?? state,
        displayState: nextDisplayState,
        candidateMoves: nextCandidateMoves,
        prefixLength: nextPrefixLength,
        pieceId: option.pieceId,
      };
      selectedPieceId = option.pieceId;
      pendingMoves = [];
      render();
      return;
    }

    clearCaptureSequence();
    selectedPieceId = null;
    pendingMoves = [];
    commitMove(nextCandidateMoves[0], actor, {
      skipAnimation: true,
    });
  }

  function scheduleAIMove() {
    clearAITimer();

    if (!isAITurn()) {
      isAIThinking = false;
      render();
      return;
    }

    isAIThinking = true;
    render();

    aiTimer = setTimeout(() => {
      const requestId = ++aiRequestId;
      const requestState = state;

      requestAIMove(requestState, aiDifficulty)
        .then((result) => {
          if (requestId !== aiRequestId) {
            return;
          }

          isAIThinking = false;
          aiTimer = null;
          aiLastProvider = result.provider ?? "internal";
          aiFallbackReason = result.fallbackReason ?? null;

          if (!result.move) {
            render();
            return;
          }

          commitMove(result.move, "ai");
        })
        .catch(() => {
          if (requestId !== aiRequestId) {
            return;
          }

          isAIThinking = false;
          aiTimer = null;
          aiFallbackReason = "AI request failed";
          render();
        });
    }, 120);
  }

  function setState(nextState) {
    state = nextState;
    pendingMoves = [];
    const moves = getDisplayMoves(state);
    const selectedMoves = selectedPieceId ? moves.filter((move) => move.pieceId === selectedPieceId) : [];

    if (selectedPieceId && selectedMoves.length === 0) {
      selectedPieceId = null;
    }

    render(moves, selectedMoves);
    scheduleAIMove();
  }

  function onSelectVariant(variantKey) {
    clearAITimer();
    coachRequestId += 1;
    clearCaptureSequence();
    coachInsight = null;
    moveHistory = [];
    postMatchSummary = null;
    dismissedPostMatchKey = "";
    ephemeralMatch = null;
    isAIThinking = false;
    aiFallbackReason = null;
    selectedPieceId = null;
    onlineRoom = null;
    disconnectRoomSocket();
    setState(restartGame(variantKey));
    loadLeaderboard();
  }

  function onModeChange(nextMode) {
    clearAITimer();
    coachRequestId += 1;
    clearCaptureSequence();
    disconnectRoomSocket();
    if (nextMode !== "online") {
      onlineRoom = null;
    }
    gameMode = nextMode;
    coachInsight = null;
    moveHistory = [];
    postMatchSummary = null;
    dismissedPostMatchKey = "";
    isAIThinking = false;
    aiFallbackReason = null;
    selectedPieceId = null;
    pendingMoves = [];
    render();
    syncPublicRoomPolling();
    scheduleAIMove();
  }

  function onDifficultyChange(nextDifficulty) {
    aiDifficulty = nextDifficulty;
    render();
  }

  function onSkinChange(nextSkin) {
    skinKey = normalizeSkinKey(nextSkin);
    window.localStorage.setItem(STORAGE_KEYS.skin, skinKey);

    if (gameMode === "online" && authToken && onlineRoom?.code) {
      joinOnlineRoom(authToken, onlineRoom.code, {
        skinKey,
      })
        .then((room) => {
          syncRoom(room);
          connectRoomRealtime(room.code);
        })
        .catch(() => {
          render();
        });
      return;
    }

    render();
  }

  function onLeaderboardCountryChange(nextCountry) {
    leaderboardCountry = nextCountry;
    loadLeaderboard();
  }

  function leaveOnlineRoom() {
    disconnectRoomSocket();
    coachRequestId += 1;
    clearCaptureSequence();
    onlineRoom = null;
    onlineError = "";
    gameMode = "local";
    state = restartGame(state.variant);
    moveHistory = [];
    postMatchSummary = null;
    dismissedPostMatchKey = "";
    loadPublicRooms();
    render();
  }

  function onSquareClick(row, col) {
    const activeState = getActiveState();
    const activeMoves = getDisplayMoves(activeState);

    if (state.winner || isAIThinking || isAITurn()) {
      return;
    }

    if (
      gameMode === "online" &&
      (!onlineRoom?.code ||
        onlineRoom.status !== "playing" ||
        onlineRoom.currentColor !== activeState.currentPlayer)
    ) {
      return;
    }

    const piece = getPieceAt(activeState, row, col);
    const pieceMoves = piece ? activeMoves.filter((move) => move.pieceId === piece.id) : [];

    if (piece && piece.color === activeState.currentPlayer && pieceMoves.length > 0) {
      selectedPieceId = piece.id;
      render(activeMoves, pieceMoves);
      return;
    }

    if (!selectedPieceId) {
      return;
    }

    const selectedMoves = activeMoves.filter((move) => move.pieceId === selectedPieceId);
    const targetMoves = selectedMoves.filter((candidate) =>
      sameSquare(candidate.to, { row, col }),
    );

    if (targetMoves.length === 0) {
      return;
    }

    const chosenMove = targetMoves[0];
    const requiresSequence = captureSequence || (chosenMove.isCapture && chosenMove.candidateMoves.some((move) => move.path.length > 1));

    if (requiresSequence) {
      advanceCaptureSequence(chosenMove, "human");
      return;
    }

    commitMove(chosenMove.candidateMoves[0], "human");
  }

  function onMoveChoiceClick(index) {
    const move = pendingMoves[index];

    if (!move) {
      return;
    }

    if (captureSequence || (move.isCapture && move.candidateMoves?.some((candidate) => candidate.path.length > 1))) {
      advanceCaptureSequence(move, "human");
      return;
    }

    commitMove(move.candidateMoves?.[0] ?? move, "human");
  }

  function renderAuthPanel() {
    if (currentUser) {
      return `
        <div class="panel panel--auth">
          <div class="panel__heading">Pilot ID</div>
          <div class="routes__list">
            <div class="move-log"><strong>${escapeHtml(currentUser.displayName)}</strong></div>
            <div class="routes__hint">${escapeHtml(currentUser.email)}</div>
            <div class="routes__hint">Country: ${escapeHtml(currentUser.country)}</div>
            <div class="routes__hint">RUS ${currentUser.ratings?.russian ?? 1200} | ENG ${currentUser.ratings?.english ?? 1200} | INT ${currentUser.ratings?.international ?? 1200}</div>
            <button type="button" class="route-btn" id="auth-logout-btn">Logout</button>
          </div>
        </div>
      `;
    }

    const countryOptions = (meta.countries ?? [])
      .map(
        (country) =>
          `<option value="${escapeHtml(country)}" ${country === authCountryDraft ? "selected" : ""}>${escapeHtml(country)}</option>`,
      )
      .join("");

    const switcher = `
      <div class="auth-switches">
        <button type="button" class="route-btn auth-switch-btn" data-auth-mode="login">Login</button>
        <button type="button" class="route-btn auth-switch-btn" data-auth-mode="register">Register</button>
        <button type="button" class="route-btn auth-switch-btn" data-auth-mode="resetRequest">Reset</button>
      </div>
    `;

    let formMarkup = "";

    if (authMode === "login") {
      formMarkup = `
        <form id="auth-login-form" class="auth-form">
          <label class="field"><span>Email</span><input class="field__input" name="email" type="email" required /></label>
          <label class="field"><span>Password</span><input class="field__input" name="password" type="password" required /></label>
          <button type="submit" class="route-btn">Enter Arena</button>
        </form>
      `;
    } else if (authMode === "register") {
      formMarkup = `
        <form id="auth-register-form" class="auth-form">
          <label class="field"><span>Display name</span><input class="field__input" name="displayName" required /></label>
          <label class="field"><span>Email</span><input class="field__input" name="email" type="email" required /></label>
          <label class="field"><span>Country</span><select name="country">${countryOptions}</select></label>
          <label class="field"><span>Password</span><input class="field__input" name="password" type="password" required /></label>
          <button type="submit" class="route-btn">Create account</button>
        </form>
      `;
    } else if (authMode === "resetRequest") {
      formMarkup = `
        <form id="auth-reset-request-form" class="auth-form">
          <label class="field"><span>Email</span><input class="field__input" name="email" type="email" required /></label>
          <button type="submit" class="route-btn">Send reset code</button>
        </form>
      `;
    } else if (authMode === "resetVerify") {
      formMarkup = `
        <form id="auth-reset-verify-form" class="auth-form">
          <div class="routes__hint">Reset code sent to ${escapeHtml(authEmailDraft)}</div>
          <label class="field"><span>Reset code</span><input class="field__input" name="code" inputmode="numeric" required /></label>
          <label class="field"><span>New password</span><input class="field__input" name="newPassword" type="password" required /></label>
          <button type="submit" class="route-btn">Apply new password</button>
        </form>
      `;
    }

    return `
      <div class="panel panel--auth">
        <div class="panel__heading">Pilot ID</div>
        ${switcher}
        ${authError ? `<div class="coach coach--mistake">${escapeHtml(authError)}</div>` : ""}
        ${authMessage ? `<div class="coach coach--good">${escapeHtml(authMessage)}</div>` : ""}
        ${formMarkup}
      </div>
    `;
  }

  function renderOnlinePanel() {
    if (currentPage !== "online") {
      return "";
    }

    if (!currentUser) {
      return `
        <div class="panel panel--online">
          <div class="panel__heading">Online Arena</div>
          <div class="routes__hint">Sign in first to create or join multiplayer rooms.</div>
          <div class="panel panel--lobby">
            <div class="panel__heading">Public rooms</div>
            <div class="routes__list">
              ${
                publicRooms.length
                  ? publicRooms
                      .map(
                        (room) => `
                          <div class="move-log">
                            <strong>${escapeHtml(variantDisplayName(getVariantConfig(room.variant)))}</strong><br />
                            Host ${escapeHtml(room.host?.displayName ?? "Unknown")} · ${escapeHtml(room.host?.country ?? "Unknown")}<br />
                            Code ${escapeHtml(room.code)}
                          </div>
                        `,
                      )
                      .join("")
                  : `<div class="routes__hint">No public waiting rooms right now.</div>`
              }
            </div>
          </div>
        </div>
      `;
    }

    if (!onlineRoom) {
      return `
        <div class="panel panel--online">
          <div class="panel__heading">Online Arena</div>
          ${onlineError ? `<div class="coach coach--mistake">${escapeHtml(onlineError)}</div>` : ""}
          <div class="routes__list">
            <form id="online-create-room-form" class="auth-form">
              <label class="field">
                <span>Create room</span>
                <select name="visibility">
                  <option value="private" ${roomVisibilityDraft === "private" ? "selected" : ""}>Private</option>
                  <option value="public" ${roomVisibilityDraft === "public" ? "selected" : ""}>Public</option>
                </select>
              </label>
              <button type="submit" class="route-btn">Open room</button>
            </form>
            <form id="online-join-form" class="auth-form">
              <label class="field">
                <span>Invite code</span>
                <input class="field__input" name="roomCode" value="${escapeHtml(roomCodeDraft)}" maxlength="6" />
              </label>
              <button type="submit" class="route-btn">Join room</button>
            </form>
            <div class="panel panel--lobby">
              <div class="panel__heading">Public rooms</div>
              <div class="routes__list">
                ${
                  publicRooms.length
                    ? publicRooms
                        .map(
                          (room) => `
                            <button
                              type="button"
                              class="route-btn public-room-btn"
                              data-public-room-code="${escapeHtml(room.code)}"
                            >
                              <strong>${escapeHtml(variantDisplayName(getVariantConfig(room.variant)))}</strong><br />
                              Host ${escapeHtml(room.host?.displayName ?? "Unknown")} · ${escapeHtml(room.host?.country ?? "Unknown")}<br />
                              Code ${escapeHtml(room.code)}
                            </button>
                          `,
                        )
                        .join("")
                    : `<div class="routes__hint">No public waiting rooms right now.</div>`
                }
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${onlineRoom.code}`;

    return `
      <div class="panel panel--online">
        <div class="panel__heading">Online Arena</div>
        ${onlineError ? `<div class="coach coach--mistake">${escapeHtml(onlineError)}</div>` : ""}
        <div class="routes__list">
          <div class="move-log"><strong>Room:</strong> ${onlineRoom.code}</div>
          <div class="routes__hint">Visibility: ${escapeHtml(onlineRoom.visibility ?? "private")}</div>
          <div class="routes__hint">Invite link: ${escapeHtml(roomUrl)}</div>
          <div class="routes__hint">Status: ${escapeHtml(onlineRoom.status)}</div>
          <div class="routes__hint">Your side: ${escapeHtml(onlineRoom.currentColor ?? "spectator")}</div>
          <button type="button" class="route-btn" id="online-leave-room-btn">Exit room</button>
        </div>
      </div>
    `;
  }

  function renderLeaderboardPanel() {
    const countryOptions = [`<option value="">All countries</option>`]
      .concat(
        (meta.countries ?? []).map(
          (country) =>
            `<option value="${escapeHtml(country)}" ${country === leaderboardCountry ? "selected" : ""}>${escapeHtml(country)}</option>`,
        ),
      )
      .join("");

    return `
      <div class="panel panel--leaderboard">
        <div class="panel__heading">Country ladder</div>
        <label class="field">
          <span>Filter country</span>
          <select id="leaderboard-country-select">${countryOptions}</select>
        </label>
        <div class="routes__list">
          ${
            leaderboard?.topPlayers?.length
              ? leaderboard.topPlayers
                  .slice(0, 5)
                  .map(
                    (entry, index) => `
                      <div class="move-log">
                        <strong>#${index + 1} ${escapeHtml(entry.displayName)}</strong><br />
                        ${escapeHtml(entry.country)} · ${entry.rating}
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="routes__hint">Leaderboard will populate as players register and finish online matches.</div>`
          }
        </div>
      </div>
    `;
  }

  function renderProfilePanel() {
    if (!currentUser) {
      return `
        <div class="panel">
          <div class="panel__heading">Profile</div>
          <div class="routes__hint">Sign in to see your rating graph, recent matches, and country standing.</div>
        </div>
      `;
    }

    const stats = profileBundle?.stats ?? { total: 0, wins: 0, losses: 0, draws: 0 };

    return `
      <div class="panel">
        <div class="panel__heading">Profile</div>
        <div class="auth-switches auth-switches--wide">
          <button type="button" class="route-btn profile-view-btn ${profileView === "history" ? "page-nav__btn--active" : ""}" data-profile-view="history">History</button>
          <button type="button" class="route-btn profile-view-btn ${profileView === "skins" ? "page-nav__btn--active" : ""}" data-profile-view="skins">Skins</button>
        </div>
        <div class="routes__list">
          <div class="move-log"><strong>${escapeHtml(currentUser.displayName)}</strong></div>
          <div class="routes__hint">${escapeHtml(currentUser.email)}</div>
          <div class="routes__hint">${escapeHtml(currentUser.country)}</div>
          <div class="routes__hint">Russian ${currentUser.ratings?.russian ?? 1200}</div>
          <div class="routes__hint">English ${currentUser.ratings?.english ?? 1200}</div>
          <div class="routes__hint">International ${currentUser.ratings?.international ?? 1200}</div>
          <div class="routes__hint">Matches ${stats.total} · W ${stats.wins} · L ${stats.losses} · D ${stats.draws}</div>
          <div class="routes__hint">Active skin ${escapeHtml(getSkinConfig(skinKey).label)}</div>
        </div>
      </div>
    `;
  }

  function renderSkinLibraryPanel() {
    return `
      <div class="panel">
        <div class="panel__eyebrow">Profile Cosmetics</div>
        <h2 class="stage__title">Skin Bay</h2>
        <div class="skin-grid">
          ${Object.entries(SKINS)
            .map(([key, entry]) => {
              const selected = key === skinKey;
              const previewContext = {
                white: key,
                black: key,
              };

              return `
                <button
                  type="button"
                  class="skin-card route-btn ${selected ? "page-nav__btn--active" : ""}"
                  data-skin-card="${key}"
                >
                  <div class="skin-card__header">
                    <strong>${escapeHtml(entry.label)}</strong>
                    <span>${selected ? "Active" : "Apply"}</span>
                  </div>
                  <div class="skin-card__preview">
                    <div class="skin-card__tile" style="--skin-preview-tile: url('${entry.tiles.light}');">
                      ${renderPiece({ color: "white", kind: "man" }, previewContext)}
                    </div>
                    <div class="skin-card__tile" style="--skin-preview-tile: url('${entry.tiles.dark}');">
                      ${renderPiece({ color: "black", kind: "man" }, previewContext)}
                    </div>
                    <div class="skin-card__tile" style="--skin-preview-tile: url('${entry.tiles.light}');">
                      ${renderPiece({ color: "white", kind: "king" }, previewContext)}
                    </div>
                    <div class="skin-card__tile" style="--skin-preview-tile: url('${entry.tiles.dark}');">
                      ${renderPiece({ color: "black", kind: "king" }, previewContext)}
                    </div>
                  </div>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderHistoryPanel() {
    const selectedMatch = ensureSelectedHistoryCode();
    const selectedAnalysis = selectedMatch ? getCachedMatchAnalysis(selectedMatch) ?? [] : [];

    if (selectedMatch && !selectedAnalysis.length && selectedMatch.moveHistory?.length) {
      warmMatchAnalysis(selectedMatch, () => {
        if (selectedHistoryCode === selectedMatch.code && currentPage === "profile") {
          render();
        }
      });
    }

    const filteredEntries = selectedAnalysis.filter((entry) =>
      historyVerdictFilter === "all" ? true : entry.insight?.verdict === historyVerdictFilter,
    );
    const summary = summarizeMatchAnalysis(selectedAnalysis);
    const maxScoreLoss = Math.max(
      1,
      ...selectedAnalysis.map((entry) => Math.max(1, entry.insight?.scoreLoss ?? 0)),
    );

    return `
      <div class="panel">
        <div class="panel__eyebrow">Profile History</div>
        <h2 class="stage__title">Game Review</h2>
        ${
          matchHistory.length
            ? `
              <label class="field">
                <span>Filter verdict</span>
                <select id="history-verdict-filter">
                  ${["all", "good", "inaccuracy", "mistake", "blunder"]
                    .map(
                      (verdict) =>
                        `<option value="${verdict}" ${verdict === historyVerdictFilter ? "selected" : ""}>${verdictLabel(verdict)}</option>`,
                    )
                    .join("")}
                </select>
              </label>
              <div class="history-layout">
                <div class="routes__list">
                  ${matchHistory
                    .map((match) => {
                      const isSelected = selectedMatch?.code === match.code;
                      const matchAnalysis = getCachedMatchAnalysis(match) ?? [];

                      if (!matchAnalysis.length && match.moveHistory?.length) {
                        warmMatchAnalysis(match, () => {
                          if (currentPage === "profile") {
                            render();
                          }
                        });
                      }

                      const matchSummary = summarizeMatchAnalysis(matchAnalysis);

                      return `
                        <button
                          type="button"
                          class="route-btn history-match-btn ${isSelected ? "page-nav__btn--active" : ""}"
                          data-history-code="${escapeHtml(match.code)}"
                        >
                          <strong>${escapeHtml(match.variant)}</strong> · ${escapeHtml(match.result)}<br />
                          vs ${escapeHtml(match.opponent?.displayName ?? "Waiting")} · ${escapeHtml(match.playerColor)}<br />
                          G ${matchSummary.good} · I ${matchSummary.inaccuracy} · M ${matchSummary.mistake} · B ${matchSummary.blunder}
                        </button>
                      `;
                    })
                    .join("")}
                </div>
                ${
                  selectedMatch
                    ? `
                      <div class="panel panel--review">
                        <div class="panel__heading">${escapeHtml(selectedMatch.code)} · ${escapeHtml(selectedMatch.variant)}</div>
                        <div class="routes__hint">vs ${escapeHtml(selectedMatch.opponent?.displayName ?? "Waiting")} · ${escapeHtml(selectedMatch.updatedAt)}</div>
                        <div class="review-summary">
                          <div class="review-stat review-stat--good"><strong>Good</strong><span>${summary.good}</span></div>
                          <div class="review-stat review-stat--inaccuracy"><strong>Inacc</strong><span>${summary.inaccuracy}</span></div>
                          <div class="review-stat review-stat--mistake"><strong>Mist</strong><span>${summary.mistake}</span></div>
                          <div class="review-stat review-stat--blunder"><strong>Blunder</strong><span>${summary.blunder}</span></div>
                        </div>
                        <div class="review-chart">
                          ${selectedAnalysis
                            .map((entry) => {
                              const verdict = entry.insight?.verdict ?? "good";
                              const loss = Math.max(4, Math.round(((entry.insight?.scoreLoss ?? 0) / maxScoreLoss) * 100));

                              return `
                                <button
                                  type="button"
                                  class="review-bar review-bar--${verdict} ${entry.ply === replayPly ? "review-bar--active" : ""}"
                                  data-history-ply="${entry.ply}"
                                  title="${escapeHtml(`${entry.ply}. ${entry.text} · ${verdict}`)}"
                                  style="height:${loss}%"
                                ></button>
                              `;
                            })
                            .join("")}
                        </div>
                        <div class="routes__list">
                          ${
                            filteredEntries.length
                              ? filteredEntries
                                  .map(
                                    (entry) => `
                                      <button
                                        type="button"
                                        class="route-btn replay-jump-btn replay-jump-btn--${entry.insight?.verdict ?? "good"}"
                                        data-history-ply="${entry.ply}"
                                      >
                                        ${entry.ply}. ${escapeHtml(entry.text)} · ${escapeHtml(entry.insight?.verdict ?? "good")} · ${(entry.insight?.scoreLoss ?? 0).toFixed(1)}
                                      </button>
                                    `,
                                  )
                                  .join("")
                              : `<div class="routes__hint">No moves match the selected verdict filter.</div>`
                          }
                        </div>
                      </div>
                    `
                    : `<div class="routes__hint">Pick a match to open its review.</div>`
                }
              </div>
            `
            : `<div class="routes__hint">No completed online matches yet.</div>`
        }
      </div>
    `;
  }

  function renderPostMatchOverlay() {
    if (!postMatchSummary || dismissedPostMatchKey === postMatchSummary.key) {
      return "";
    }

    const delta = postMatchSummary.ratingDelta;
    const deltaText = delta ? `${delta.change >= 0 ? "+" : ""}${delta.change} ELO` : null;
    const ratingText = delta ? `${delta.before} -> ${delta.after}` : null;
    const reviewMatch = postMatchSummary.match ?? null;
    const summaryKey = postMatchSummary.key;
    const reviewAnalysis = reviewMatch ? getCachedMatchAnalysis(reviewMatch) ?? [] : [];
    const isAnalysisLoading = Boolean(reviewMatch?.moveHistory?.length) && reviewAnalysis.length === 0;

    if (reviewMatch && isAnalysisLoading) {
      warmMatchAnalysis(reviewMatch, () => {
        if (postMatchSummary?.key === summaryKey) {
          render();
        }
      });
    }

    const colorStats = analysisStatsByColor(reviewAnalysis);
    const currentSide = gameMode === "online" ? onlineRoom?.currentColor ?? "white" : aiColor === "white" ? "black" : "white";
    const opponentSide = currentSide === "white" ? "black" : "white";
    const currentLabel =
      gameMode === "online"
        ? `You (${playerDisplayName(currentSide)})`
        : gameMode === "ai"
          ? "You"
          : playerDisplayName(currentSide);
    const opponentLabel =
      gameMode === "online"
        ? postMatchSummary.opponentName
        : gameMode === "ai"
          ? postMatchSummary.opponentName
          : playerDisplayName(opponentSide);
    const activeMoves = reviewAnalysis;
    const maxLoss = Math.max(1, ...reviewAnalysis.map((entry) => entry.insight?.scoreLoss ?? 0));

    return `
      <div class="match-end-screen">
        <div class="panel panel--match-end">
          <button type="button" class="post-match-close" id="post-match-close-btn" aria-label="Close">x</button>
          <div class="panel__eyebrow">Game Review</div>
          <h2 class="stage__title">${escapeHtml(postMatchSummary.headline)}</h2>
          <div class="routes__hint">vs ${escapeHtml(postMatchSummary.opponentName)} · ${escapeHtml(postMatchSummary.opponentSubtitle ?? "")}</div>
          <div class="post-match-tabs">
            <button type="button" class="route-btn post-match-tab ${postMatchTab === "summary" ? "page-nav__btn--active" : ""}" data-post-match-tab="summary">Summary</button>
            <button type="button" class="route-btn post-match-tab ${postMatchTab === "moves" ? "page-nav__btn--active" : ""}" data-post-match-tab="moves">Moves</button>
            <button type="button" class="route-btn post-match-tab ${postMatchTab === "advantage" ? "page-nav__btn--active" : ""}" data-post-match-tab="advantage">Advantage</button>
          </div>
          ${
            isAnalysisLoading
              ? `
                <div class="routes__hint">
                  Analyzing the finished game. The review will fill in automatically in a moment.
                </div>
                <div class="review-chart post-match-chart post-match-chart--loading">
                  ${Array.from({ length: 18 }, () => `<div class="review-bar review-bar--loading"></div>`).join("")}
                </div>
              `
              : postMatchTab === "summary"
              ? `
                <div class="post-match-summary">
                  <div class="post-match-side">
                    <div class="post-match-side__title">${escapeHtml(currentLabel)}</div>
                    <div class="accuracy-ring" style="--accuracy:${colorStats[currentSide].accuracy};">
                      <div class="accuracy-ring__inner">
                        <strong>${colorStats[currentSide].accuracy}%</strong>
                        <span>accuracy</span>
                      </div>
                    </div>
                    ${deltaText ? `<div class="token">${escapeHtml(deltaText)}</div>` : ""}
                  </div>
                  <div class="post-match-side">
                    <div class="post-match-side__title">${escapeHtml(opponentLabel)}</div>
                    <div class="accuracy-ring accuracy-ring--muted" style="--accuracy:${colorStats[opponentSide].accuracy};">
                      <div class="accuracy-ring__inner">
                        <strong>${colorStats[opponentSide].accuracy}%</strong>
                        <span>accuracy</span>
                      </div>
                    </div>
                    ${ratingText ? `<div class="routes__hint">${escapeHtml(ratingText)}</div>` : ""}
                  </div>
                </div>
                <div class="post-match-table">
                  <div class="post-match-table__head">Move type</div>
                  <div class="post-match-table__head">You</div>
                  <div class="post-match-table__head">Opp</div>
                  ${["good", "inaccuracy", "mistake", "blunder"]
                    .map(
                      (verdict) => `
                        <div class="post-match-table__cell">${escapeHtml(verdictLabel(verdict))}</div>
                        <div class="post-match-table__cell">${colorStats[currentSide][verdict]}</div>
                        <div class="post-match-table__cell">${colorStats[opponentSide][verdict]}</div>
                      `,
                    )
                    .join("")}
                </div>
              `
              : postMatchTab === "moves"
                ? `
                  <div class="routes__list">
                    ${activeMoves.length
                      ? activeMoves
                          .map(
                            (entry) => `
                              <div class="move-log">
                                <strong>${entry.ply}. ${escapeHtml(entry.text)}</strong><br />
                                ${escapeHtml(entry.player)} · ${escapeHtml(entry.insight?.verdict ?? "good")} · loss ${(entry.insight?.scoreLoss ?? 0).toFixed(1)}
                              </div>
                            `,
                          )
                          .join("")
                      : `<div class="routes__hint">No analyzed moves yet.</div>`}
                  </div>
                `
                : `
                  <div class="review-chart post-match-chart">
                    ${reviewAnalysis
                      .map((entry) => {
                        const verdict = entry.insight?.verdict ?? "good";
                        const loss = Math.max(6, Math.round(((entry.insight?.scoreLoss ?? 0) / maxLoss) * 100));
                        return `<div class="review-bar review-bar--${verdict}" style="height:${loss}%"></div>`;
                      })
                      .join("")}
                  </div>
                  <div class="routes__hint">Each bar shows the score loss of one move. Bigger bars indicate larger mistakes.</div>
                `
          }
          <div class="auth-switches auth-switches--wide">
            <button type="button" class="route-btn" id="post-match-review-btn">${escapeHtml(postMatchSummary.reviewLabel ?? "Open review")}</button>
            <button type="button" class="route-btn" id="post-match-restart-btn">Play again</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderProfileStage() {
    if (profileView === "skins") {
      return `
        <section class="stage stage--landing">
          ${renderSkinLibraryPanel()}
        </section>
      `;
    }

    return `
      <section class="stage stage--landing">
        ${renderHistoryPanel()}
      </section>
    `;
  }

  function renderProfileSidebar() {
    if (profileView === "skins") {
      const activeSkin = getSkinConfig(skinKey);

      return `
        <div class="panel">
          <div class="panel__heading">Selected skin</div>
          <div class="routes__list">
            <div class="move-log"><strong>${escapeHtml(activeSkin.label)}</strong></div>
            <div class="routes__hint">Your games, profile previews, and online side now share this skin.</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="panel">
        <div class="panel__heading">Review guide</div>
        <div class="routes__list">
          <div class="routes__hint">Use the verdict filter to isolate mistakes and blunders.</div>
          <div class="routes__hint">Click any bar in the chart to jump to that move on the public replay page.</div>
          <div class="routes__hint">Open a full board replay from the selected match if you need move-by-move navigation.</div>
        </div>
      </div>
    `;
  }

  function renderPageNavigation() {
    const entries = [
      ["home", "Home"],
      ["play", "Play"],
      ["online", "Online"],
      ["leaderboard", "Leaderboard"],
      ["profile", "Profile"],
      ["auth", "Auth"],
    ];

    return `
      <nav class="page-nav">
        ${entries
          .map(
            ([key, label]) => `
              <button
                type="button"
                class="route-btn page-nav__btn ${currentPage === key ? "page-nav__btn--active" : ""}"
                data-page="${key}"
              >
                ${label}
              </button>
            `,
          )
          .join("")}
      </nav>
    `;
  }

  function renderHomeContent(title) {
    return `
      <section class="stage stage--landing">
        <div class="stage__backdrop" aria-hidden="true"></div>
        <div class="panel panel--hero page-hero">
          <div class="panel__eyebrow">Indie Draughts Platform</div>
          <h2 class="stage__title">Night Checkers</h2>
          <p class="panel__copy">
            A competitive draughts platform with three rule sets, AI coach, online rooms, country ladder,
            and a pixel-art identity instead of a generic board-game shell.
          </p>
          <div class="auth-switches auth-switches--wide">
            <button type="button" class="route-btn" data-page="play">Play vs AI</button>
            <button type="button" class="route-btn" data-page="online">Play online</button>
            <button type="button" class="route-btn" data-page="leaderboard">See ladder</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderPublicMatchPage() {
    const match = publicMatch;

    if (!match) {
      return {
        left: `
          <div class="panel">
            <div class="panel__heading">Match Replay</div>
            <div class="routes__hint">Replay is loading or the match was not found.</div>
          </div>
        `,
        center: `
          <section class="stage stage--landing">
            <div class="panel page-hero">
              <div class="panel__eyebrow">Share Link</div>
              <h2 class="stage__title">Match unavailable</h2>
            </div>
          </section>
        `,
        right: renderLeaderboardPanel(),
      };
    }

    const replayState = replayStateForMatch(match, replayPly);
    const boardSkinContext = boardSkinContextForPlayers(match.players);
    const analysisSummary = summarizeMatchAnalysis(publicMatchAnalysis);
    const activeAnalysis = replayPly > 0 ? publicMatchAnalysis[replayPly - 1] ?? null : null;
    const variant = getVariantConfig(match.variant);
    const replayBoardIndex = createBoardIndex(replayState);
    const colLabels = getColumnLabels(variant.boardSize);
    const rowLabels = getRowLabels(variant.boardSize);
    const whitePieces = replayBoardIndex.whitePieces;
    const blackPieces = replayBoardIndex.blackPieces;
    const boardMarkup = Array.from({ length: variant.boardSize * variant.boardSize }, (_, index) => {
      const row = Math.floor(index / variant.boardSize);
      const col = index % variant.boardSize;
      const piece = replayBoardIndex.get(row, col);
      const isDark = (row + col) % 2 === 1;

      return `
        <div class="cell ${isDark ? "cell--dark" : "cell--light"}" style="--cell-tile-image: url('${tileAssetForSquare(row, col, variant.boardSize, boardSkinContext)}');">
          ${piece ? renderPiece(piece, boardSkinContext) : ""}
        </div>
      `;
    }).join("");

    const shareUrl = `${window.location.origin}/match/${match.code}`;
    const totalPly = match.moveHistory?.length ?? 0;

    return {
      left: `
        <div class="panel">
          <div class="panel__heading">Match replay</div>
          <div class="routes__list">
            <div class="move-log"><strong>${escapeHtml(match.code)}</strong></div>
            <div class="routes__hint">${escapeHtml(match.variant)}</div>
            <div class="routes__hint">${escapeHtml(match.players.white?.displayName ?? "White")} vs ${escapeHtml(match.players.black?.displayName ?? "Black")}</div>
            <div class="routes__hint">Winner: ${escapeHtml(match.winner ?? "none")}</div>
            <div class="routes__hint">Share: ${escapeHtml(shareUrl)}</div>
            <div class="routes__hint">Good ${analysisSummary.good} · Inacc ${analysisSummary.inaccuracy} · Mist ${analysisSummary.mistake} · Blunder ${analysisSummary.blunder}</div>
          </div>
        </div>
      `,
      center: `
        <section class="stage">
          <div class="stage__backdrop" aria-hidden="true"></div>
          <div class="stage__header">
            <div>
              <div class="panel__eyebrow">Replay Chamber</div>
              <h2 class="stage__title">${variantDisplayName(variant)} · ${escapeHtml(match.code)}</h2>
            </div>
            <div class="stage__tokens">
              <div class="token token--white">IVORY ${whitePieces}</div>
              <div class="token token--black">OBSIDIAN ${blackPieces}</div>
            </div>
          </div>
          <div class="board-shell">
            <div class="board-shell__glow"></div>
            <div class="board-frame" style="--board-size: ${variant.boardSize};">
              <div class="board-axis board-axis--top">${colLabels.map((label) => `<span>${label}</span>`).join("")}</div>
              <div class="board-body">
                <div class="board-axis board-axis--left">${rowLabels.map((label) => `<span>${label}</span>`).join("")}</div>
                <div class="board" style="grid-template-columns: repeat(${variant.boardSize}, minmax(0, 1fr));">${boardMarkup}</div>
                <div class="board-axis board-axis--right">${rowLabels.map((label) => `<span>${label}</span>`).join("")}</div>
              </div>
              <div class="board-axis board-axis--bottom">${colLabels.map((label) => `<span>${label}</span>`).join("")}</div>
            </div>
          </div>
          <div class="stage__footer">
            <div class="stage-note">
              ${
                activeAnalysis?.insight
                  ? `${playerDisplayName(activeAnalysis.player)} ${escapeHtml(activeAnalysis.text)} · ${activeAnalysis.insight.verdict} · loss ${activeAnalysis.insight.scoreLoss.toFixed(1)}`
                  : `Ply ${replayPly} / ${totalPly}`
              }
            </div>
            <div class="auth-switches auth-switches--wide">
              <button type="button" class="route-btn" id="replay-start-btn">Start</button>
              <button type="button" class="route-btn" id="replay-prev-btn">Prev</button>
              <button type="button" class="route-btn" id="replay-next-btn">Next</button>
              <button type="button" class="route-btn" id="replay-end-btn">End</button>
            </div>
          </div>
        </section>
      `,
      right: `
        <div class="panel">
          <div class="panel__heading">Move stack</div>
          ${
            activeAnalysis?.insight
              ? `
                <div class="coach coach--${activeAnalysis.insight.verdict}">
                  <div><strong>Verdict:</strong> ${activeAnalysis.insight.verdict}</div>
                  <div><strong>Move:</strong> ${escapeHtml(activeAnalysis.text)}</div>
                  <div><strong>Engine choice:</strong> ${escapeHtml(activeAnalysis.insight.bestMoveText)}</div>
                  <div><strong>Score loss:</strong> ${activeAnalysis.insight.scoreLoss.toFixed(1)}</div>
                  <div class="coach__reasons">
                    ${activeAnalysis.insight.reasons.map((reason) => `<div>${escapeHtml(reason)}</div>`).join("")}
                  </div>
                  ${
                    activeAnalysis.insight.principalVariation.length > 0
                      ? `<div><strong>Main line:</strong> ${activeAnalysis.insight.principalVariation.map((moveText) => escapeHtml(moveText)).join(" | ")}</div>`
                      : ""
                  }
                </div>
              `
              : `<div class="routes__hint">Jump to any ply to inspect engine judgement for that move.</div>`
          }
          <div class="routes__list">
            ${
              totalPly
                ? publicMatchAnalysis
                    .map(
                      (entry) => `
                        <button type="button" class="route-btn replay-jump-btn replay-jump-btn--${entry.insight?.verdict ?? "good"} ${entry.ply === replayPly ? "page-nav__btn--active" : ""}" data-replay-ply="${entry.ply}">
                          ${entry.ply}. ${escapeHtml(entry.text)}${entry.insight ? ` · ${entry.insight.verdict}` : ""}
                        </button>
                      `,
                    )
                    .join("")
                : `<div class="routes__hint">No moves recorded.</div>`
            }
          </div>
        </div>
      `,
    };
  }

  function render(allMoves = null, selectedMoves = null) {
    const activeState = getActiveState();
    const resolvedAllMoves = allMoves ?? getDisplayMoves(activeState);
    const resolvedSelectedMoves =
      selectedMoves ?? (selectedPieceId ? resolvedAllMoves.filter((move) => move.pieceId === selectedPieceId) : []);
    const variant = getVariantConfig(activeState.variant);
    const skin = getSkinConfig(skinKey);
    const boardSkinContext = boardSkinContextForCurrentView();
    const boardIndex = createBoardIndex(activeState);
    const title = variantDisplayName(variant);
    const isArenaPage = currentPage === "play" || currentPage === "online";
    const moveTargets = new Map(
      resolvedSelectedMoves.map((move) => [`${move.to.row}:${move.to.col}`, move]),
    );
    const selectablePieces = new Set(resolvedAllMoves.map((move) => move.pieceId));
    const capturePressure = resolvedAllMoves.filter((move) => move.isCapture).length;
    const whitePieces = boardIndex.whitePieces;
    const blackPieces = boardIndex.blackPieces;
    const colLabels = getColumnLabels(variant.boardSize);
    const rowLabels = getRowLabels(variant.boardSize);
    const currentVariantAIStatus = aiStatus?.variants?.[state.variant];
    const modeLabel =
      gameMode === "ai"
        ? `Solo vs ${aiColor}`
        : gameMode === "online"
          ? `Online ${onlineRoom?.code ?? "lobby"}`
          : "Local duel";
    const activeLabel = activeState.winner
      ? `${playerDisplayName(activeState.winner)} wins`
      : `${playerDisplayName(activeState.currentPlayer)} to act`;
    const boardMarkup = Array.from({ length: variant.boardSize * variant.boardSize }, (_, index) => {
      const row = Math.floor(index / variant.boardSize);
      const col = index % variant.boardSize;
      const piece = boardIndex.get(row, col);
      const isDark = (row + col) % 2 === 1;
      const isSelected = piece && piece.id === selectedPieceId;
      const isTarget = moveTargets.has(`${row}:${col}`);
      const isSelectable = piece && selectablePieces.has(piece.id);

      return `
        <button
          type="button"
          class="cell ${isDark ? "cell--dark" : "cell--light"} ${
            isSelected ? "cell--selected" : ""
          } ${isTarget ? "cell--target" : ""} ${
            isSelectable ? "cell--selectable" : ""
          }"
          data-row="${row}"
          data-col="${col}"
          style="--cell-tile-image: url('${tileAssetForSquare(row, col, variant.boardSize, boardSkinContext)}');"
        >
          ${piece ? renderPiece(piece, boardSkinContext) : ""}
        </button>
      `;
    }).join("");

    if (!isArenaPage) {
      const leaderboardCountryOptions = [`<option value="">All countries</option>`]
        .concat(
          (meta.countries ?? []).map(
            (country) =>
              `<option value="${escapeHtml(country)}" ${country === leaderboardCountry ? "selected" : ""}>${escapeHtml(country)}</option>`,
          ),
        )
        .join("");

      let centerMarkup = renderHomeContent(title);
      let leftMarkup = `
        <div class="panel panel--hero">
          <div class="panel__eyebrow">Arcade Boardroom</div>
          <h1 class="panel__title">Night Checkers</h1>
          <p class="panel__copy">Three draughts variants, AI coach, online ladder, pixel-art skins.</p>
        </div>
      `;
      let rightMarkup = `${renderLeaderboardPanel()}`;

      if (currentPage === "match") {
        const matchPage = renderPublicMatchPage();
        leftMarkup = matchPage.left;
        centerMarkup = matchPage.center;
        rightMarkup = matchPage.right;
      } else if (currentPage === "auth") {
        leftMarkup = renderAuthPanel();
        centerMarkup = `
          <section class="stage stage--landing">
            <div class="stage__backdrop" aria-hidden="true"></div>
            <div class="panel page-hero">
              <div class="panel__eyebrow">Access Gate</div>
              <h2 class="stage__title">Account access</h2>
              <p class="panel__copy">Email registration, password reset, country-tagged rating, and persistent online match history.</p>
            </div>
          </section>
        `;
        rightMarkup = renderProfilePanel();
      } else if (currentPage === "leaderboard") {
        centerMarkup = `
          <section class="stage stage--landing">
            <div class="panel">
              <div class="panel__eyebrow">Country Ladder</div>
              <h2 class="stage__title">Leaderboard</h2>
              <label class="field">
                <span>Filter country</span>
                <select id="leaderboard-country-select">${leaderboardCountryOptions}</select>
              </label>
              <div class="routes__list">
                ${
                  leaderboard?.topPlayers?.length
                    ? leaderboard.topPlayers
                        .map(
                          (entry, index) => `
                            <div class="move-log">
                              <strong>#${index + 1} ${escapeHtml(entry.displayName)}</strong><br />
                              ${escapeHtml(entry.country)} · ${entry.rating}
                            </div>
                          `,
                        )
                        .join("")
                    : `<div class="routes__hint">No ladder data yet.</div>`
                }
              </div>
            </div>
          </section>
        `;
        leftMarkup = renderProfilePanel();
        rightMarkup = `
          <div class="panel">
            <div class="panel__heading">Top countries</div>
            <div class="routes__list">
              ${
                leaderboard?.countries?.length
                  ? leaderboard.countries
                      .slice(0, 8)
                      .map(
                        (entry, index) => `
                          <div class="move-log">
                            <strong>#${index + 1} ${escapeHtml(entry.country)}</strong><br />
                            Avg ${entry.averageRating} · ${entry.players} players
                          </div>
                        `,
                      )
                      .join("")
                  : `<div class="routes__hint">Country stats will appear here.</div>`
              }
            </div>
          </div>
        `;
      } else if (currentPage === "profile") {
        leftMarkup = renderProfilePanel();
        centerMarkup = renderProfileStage();
        rightMarkup = renderProfileSidebar();
      }

      root.innerHTML = `
        <main
          class="shell shell--${activeState.variant} shell--${renderMode} shell--skin-${skinKey}"
          style="--skin-ornament-image: url('${skin.ornament}'); --skin-backdrop-lite: url('${skin.backdropLite}'); --skin-backdrop-3d: url('${skin.backdrop3d}'); --panel-border: ${skin.palette?.panelBorder ?? "rgba(104, 232, 174, 0.18)"}; --ink: ${skin.palette?.ink ?? "#d8ffd8"}; --muted: ${skin.palette?.muted ?? "#90b3a2"}; --hot: ${skin.palette?.hot ?? "#67f5ad"}; --hot-soft: ${skin.palette?.hotSoft ?? "rgba(103, 245, 173, 0.14)"}; --warning: ${skin.palette?.warning ?? "#ffcb6b"}; --wood-mid: ${skin.palette?.woodMid ?? "#4f3424"}; --board-dark: ${skin.palette?.boardDark ?? "#103728"}; --board-light: ${skin.palette?.boardLight ?? "#1a5a40"}; --body-glow-a: ${skin.palette?.bodyGlowA ?? "rgba(63, 171, 133, 0.22)"}; --body-glow-b: ${skin.palette?.bodyGlowB ?? "rgba(194, 122, 61, 0.14)"};"
        >
          <div class="marquee">
            <div class="marquee__inner">
              <span>NEON DRAUGHTS PROTOCOL</span>
              <span>${title}</span>
              <span>${modeLabel}</span>
              <span>${activeLabel}</span>
            </div>
          </div>
          <div class="shell__nav">${renderPageNavigation()}</div>
          <section class="hud hud--left">${leftMarkup}</section>
          ${centerMarkup}
          <aside class="hud hud--right">${rightMarkup}</aside>
        </main>
        ${renderPostMatchOverlay()}
      `;
    } else {

      root.innerHTML = `
      <main
        class="shell shell--${activeState.variant} shell--${renderMode} shell--skin-${skinKey}"
        style="--skin-ornament-image: url('${skin.ornament}'); --skin-backdrop-lite: url('${skin.backdropLite}'); --skin-backdrop-3d: url('${skin.backdrop3d}'); --panel-border: ${skin.palette?.panelBorder ?? "rgba(104, 232, 174, 0.18)"}; --ink: ${skin.palette?.ink ?? "#d8ffd8"}; --muted: ${skin.palette?.muted ?? "#90b3a2"}; --hot: ${skin.palette?.hot ?? "#67f5ad"}; --hot-soft: ${skin.palette?.hotSoft ?? "rgba(103, 245, 173, 0.14)"}; --warning: ${skin.palette?.warning ?? "#ffcb6b"}; --wood-mid: ${skin.palette?.woodMid ?? "#4f3424"}; --board-dark: ${skin.palette?.boardDark ?? "#103728"}; --board-light: ${skin.palette?.boardLight ?? "#1a5a40"}; --body-glow-a: ${skin.palette?.bodyGlowA ?? "rgba(63, 171, 133, 0.22)"}; --body-glow-b: ${skin.palette?.bodyGlowB ?? "rgba(194, 122, 61, 0.14)"};"
      >
        <div class="marquee">
          <div class="marquee__inner">
            <span>NEON DRAUGHTS PROTOCOL</span>
            <span>${title}</span>
            <span>${modeLabel}</span>
            <span>${activeLabel}</span>
          </div>
        </div>
        <div class="shell__nav">${renderPageNavigation()}</div>

        <section class="hud hud--left">
          <div class="panel panel--hero">
            <div class="panel__eyebrow">Arcade Boardroom</div>
            <h1 class="panel__title">Night Checkers</h1>
            <p class="panel__copy">
              Competitive draughts in a moody pixel shell. Tournament logic underneath,
              indie tactics framing on top.
            </p>
          </div>

          ${renderAuthPanel()}

          <div class="panel panel--controls">
            <div class="toolbar">
              <label class="field">
                <span>Rule set</span>
                <select id="variant-select">
                  ${listVariants()
                    .map(
                      (entry) =>
                        `<option value="${entry.key}" ${
                          entry.key === activeState.variant ? "selected" : ""
                        }>${variantDisplayName(entry)}</option>`,
                    )
                    .join("")}
                </select>
              </label>
              <label class="field">
                <span>Mode</span>
                <select id="mode-select">
                  <option value="local" ${gameMode === "local" ? "selected" : ""}>Local</option>
                  <option value="ai" ${gameMode === "ai" ? "selected" : ""}>Vs AI</option>
                  <option value="online" ${gameMode === "online" ? "selected" : ""}>Online</option>
                </select>
              </label>
              <label class="field">
                <span>Threat</span>
                <select id="difficulty-select">
                  <option value="easy" ${aiDifficulty === "easy" ? "selected" : ""}>Scout</option>
                  <option value="medium" ${aiDifficulty === "medium" ? "selected" : ""}>Arena</option>
                  <option value="hard" ${aiDifficulty === "hard" ? "selected" : ""}>Boss</option>
                </select>
              </label>
              <button id="restart-btn" type="button">Reboot match</button>
            </div>
          </div>

          ${renderOnlinePanel()}

          <div class="panel panel--status">
            <div class="status-grid">
              <div class="stat">
                <span class="stat__label">Turn</span>
                <strong class="stat__value">${activeState.turn}</strong>
              </div>
              <div class="stat">
                <span class="stat__label">Active side</span>
                <strong class="stat__value">${playerDisplayName(activeState.currentPlayer)}</strong>
              </div>
              <div class="stat">
                <span class="stat__label">Match mode</span>
                <strong class="stat__value">${modeLabel}</strong>
              </div>
              <div class="stat">
                <span class="stat__label">Capture pressure</span>
                <strong class="stat__value">${capturePressure > 0 ? "Forced" : "Calm"}</strong>
              </div>
              <div class="stat">
                <span class="stat__label">Engine</span>
                <strong class="stat__value">${
                  gameMode === "ai"
                    ? currentVariantAIStatus?.provider ?? aiLastProvider
                    : gameMode === "online"
                      ? onlineRoom?.status ?? "Lobby"
                    : "Off"
                }</strong>
              </div>
              <div class="stat">
                <span class="stat__label">Winner</span>
                <strong class="stat__value">${
                  activeState.winner ? playerDisplayName(activeState.winner) : "None"
                }</strong>
              </div>
            </div>
          </div>

          <div class="panel panel--coach">
            <div class="panel__heading">Coach feed</div>
            ${
              coachInsight
                ? `
                  <div class="coach coach--${coachInsight.verdict}">
                    <div><strong>Verdict:</strong> ${coachInsight.verdict}</div>
                    <div><strong>Your move:</strong> ${coachInsight.playedMoveText}</div>
                    <div><strong>Engine choice:</strong> ${coachInsight.bestMoveText}</div>
                    <div><strong>Score loss:</strong> ${coachInsight.scoreLoss.toFixed(1)}</div>
                    <div class="coach__reasons">
                      ${coachInsight.reasons.map((reason) => `<div>${reason}</div>`).join("")}
                    </div>
                    ${
                      coachInsight.principalVariation.length > 0
                        ? `<div><strong>Main line:</strong> ${coachInsight.principalVariation.join(" | ")}</div>`
                        : ""
                    }
                  </div>
                `
                : `
                  <div class="routes__hint">
                    Make a move to trigger an engine note and surface tactical alternatives.
                  </div>
                `
            }
          </div>
        </section>

        <section class="stage">
          <div class="stage__backdrop" aria-hidden="true"></div>
          <div class="stage__header">
            <div>
              <div class="panel__eyebrow">Main Arena</div>
              <h2 class="stage__title">${title}</h2>
            </div>
            <div class="stage__tokens">
              <div class="token token--white">IVORY ${whitePieces}</div>
              <div class="token token--black">OBSIDIAN ${blackPieces}</div>
            </div>
          </div>

          <div class="board-shell">
            <div class="board-shell__glow"></div>
            <div class="board-frame" style="--board-size: ${variant.boardSize};">
              <div class="board-axis board-axis--top">
                ${colLabels.map((label) => `<span>${label}</span>`).join("")}
              </div>
              <div class="board-body">
                <div class="board-axis board-axis--left">
                  ${rowLabels.map((label) => `<span>${label}</span>`).join("")}
                </div>
                <div
                  class="board"
                  style="grid-template-columns: repeat(${variant.boardSize}, minmax(0, 1fr));"
                >
                  ${boardMarkup}
                </div>
                <div class="board-axis board-axis--right">
                  ${rowLabels.map((label) => `<span>${label}</span>`).join("")}
                </div>
              </div>
              <div class="board-axis board-axis--bottom">
                ${colLabels.map((label) => `<span>${label}</span>`).join("")}
              </div>
            </div>
          </div>

          <div class="stage__footer">
            <div class="stage-note">
              ${
                resolvedSelectedMoves.length > 0
                  ? captureSequence
                    ? "Capture chain in progress. Continue with the same piece until the sequence is complete."
                    : "Target squares are lit. Continue the capture chain one jump at a time."
                  : "Select a highlighted piece to inspect legal routes."
              }
            </div>
            <div class="stage-note">
              ${
                gameMode === "ai" && currentVariantAIStatus?.rationale
                  ? currentVariantAIStatus.rationale
                  : gameMode === "online"
                    ? onlineRoom
                      ? `Room ${onlineRoom.code} · ${onlineRoom.players.white?.displayName ?? "White"} vs ${onlineRoom.players.black?.displayName ?? "Waiting"}`
                      : "Create a room or enter an invite code to start a rated online match."
                  : "Local duel keeps every decision on one board."
              }
            </div>
          </div>
        </section>

        <aside class="hud hud--right">
          <div class="panel panel--routes">
            <div class="panel__heading">Route matrix</div>
            ${
              pendingMoves.length > 0
                ? `
                  <div class="routes__hint">Several capture paths converge on one square. Pick the exact sequence.</div>
                  <div class="routes__list">
                    ${pendingMoves
                      .map(
                        (move, index) => `
                          <button type="button" class="route-btn" data-route-index="${index}">
                            ${formatMove(move)}
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                `
                : `
                  <div class="routes__hint">
                    ${
                      resolvedSelectedMoves.length > 0
                        ? captureSequence
                          ? "Chain options are shown directly on the board. Keep capturing with the selected piece."
                          : "Capture choices are shown directly on the board. Multi-captures continue step by step."
                        : "No forked routes yet. The next tactical branch will surface here."
                    }
                  </div>
                `
            }
          </div>

          <div class="panel panel--moves">
            <div class="panel__heading">Combat log</div>
            ${
              moveHistory.length > 0
                ? `
                  <div class="routes__list">
                    ${moveHistory
                      .slice(0, 10)
                      .map(
                        (entry) => `
                          <div class="move-log">
                            <strong>${entry.turn}. ${entry.player}</strong> (${entry.actor}) ${entry.text}
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                `
                : `<div class="routes__hint">The board is fresh. First move will be logged here.</div>`
            }
          </div>

          ${renderLeaderboardPanel()}
        </aside>
      </main>
      ${renderPostMatchOverlay()}
    `;
    }

    root.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const page = button.dataset.page;

        if (page === "online") {
          gameMode = "online";
        } else if (page === "play" && gameMode === "online") {
          gameMode = "local";
        }

        navigateTo(page);
      });
    });

    root.querySelectorAll(".match-link-btn").forEach((button) => {
      button.addEventListener("click", () => {
        navigateToMatch(button.dataset.matchCode);
      });
    });

    root.querySelector("#variant-select")?.addEventListener("change", (event) => {
      onSelectVariant(event.target.value);
    });

    root.querySelector("#mode-select")?.addEventListener("change", (event) => {
      onModeChange(event.target.value);
    });

    root.querySelector("#difficulty-select")?.addEventListener("change", (event) => {
      onDifficultyChange(event.target.value);
    });

    root.querySelector("#restart-btn")?.addEventListener("click", () => {
      onSelectVariant(state.variant);
    });

    root.querySelector("#post-match-review-btn")?.addEventListener("click", () => {
      const action = postMatchSummary?.onReview;

      if (action) {
        dismissedPostMatchKey = postMatchSummary.key;
        action();
      }
    });

    root.querySelector("#post-match-restart-btn")?.addEventListener("click", () => {
      restartFromPostMatch();
    });

    root.querySelector("#post-match-close-btn")?.addEventListener("click", () => {
      hidePostMatchSummary();
    });

    root.querySelectorAll("[data-post-match-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        postMatchTab = button.dataset.postMatchTab ?? "summary";
        render();
      });
    });

    root.querySelectorAll(".profile-view-btn").forEach((button) => {
      button.addEventListener("click", () => {
        profileView = button.dataset.profileView ?? "history";
        render();
      });
    });

    root.querySelector("#history-verdict-filter")?.addEventListener("change", (event) => {
      historyVerdictFilter = event.target.value;
      render();
    });

    root.querySelectorAll(".history-match-btn").forEach((button) => {
      button.addEventListener("click", () => {
        selectedHistoryCode = button.dataset.historyCode ?? "";
        render();
      });
    });

    root.querySelectorAll("[data-history-ply]").forEach((button) => {
      button.addEventListener("click", () => {
        const match = matchByCode(selectedHistoryCode);

        if (!match) {
          return;
        }

        pendingReplayPly = Number(button.dataset.historyPly ?? 0);
        navigateToMatch(match.code);
      });
    });

    root.querySelectorAll("[data-skin-card]").forEach((button) => {
      button.addEventListener("click", () => {
        onSkinChange(button.dataset.skinCard);
      });
    });

    root.querySelectorAll(".auth-switch-btn").forEach((button) => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode;
        authError = "";
        authMessage = "";
        render();
      });
    });

    root.querySelector("#auth-login-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      authError = "";
      authMessage = "";
      loginUser({
        email: formData.get("email"),
        password: formData.get("password"),
      })
        .then(({ token, user }) => {
          setAuthenticated(token, user);

          if (initialRoomCode) {
            roomCodeDraft = initialRoomCode;
          }
        })
        .catch((error) => {
          authError = error.message;
          render();
        });
    });

    root.querySelector("#auth-register-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      authError = "";
      authMessage = "";
      authEmailDraft = String(formData.get("email") ?? "");
      authCountryDraft = String(formData.get("country") ?? authCountryDraft);
      requestRegister({
        displayName: formData.get("displayName"),
        email: authEmailDraft,
        password: formData.get("password"),
        country: authCountryDraft,
      })
        .then(({ token, user }) => {
          authMessage = "Account created.";
          setAuthenticated(token, user);
          authMode = "login";
          navigateTo("profile");
        })
        .catch((error) => {
          authError = error.message;
          render();
        });
    });

    root.querySelector("#auth-reset-request-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      authError = "";
      authMessage = "";
      authEmailDraft = String(formData.get("email") ?? "");
      requestPasswordReset({
        email: authEmailDraft,
      })
        .then(() => {
          authMode = "resetVerify";
          authMessage = "Reset code sent.";
          render();
        })
        .catch((error) => {
          authError = error.message;
          render();
        });
    });

    root.querySelector("#auth-reset-verify-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      authError = "";
      authMessage = "";
      resetPassword({
        email: authEmailDraft,
        code: formData.get("code"),
        newPassword: formData.get("newPassword"),
      })
        .then(({ token, user }) => {
          setAuthenticated(token, user);
          authMode = "login";
        })
        .catch((error) => {
          authError = error.message;
          render();
        });
    });

    root.querySelector("#auth-logout-btn")?.addEventListener("click", () => {
      logoutUser(authToken).finally(() => {
        currentUser = null;
        authToken = "";
        window.localStorage.removeItem(STORAGE_KEYS.authToken);
        leaveOnlineRoom();
        loadLeaderboard();
      });
    });

    root.querySelector("#online-create-room-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      roomVisibilityDraft = String(formData.get("visibility") ?? roomVisibilityDraft);
      onlineError = "";
      createOnlineRoom(authToken, {
        variant: state.variant,
        skinKey,
        visibility: roomVisibilityDraft,
      })
        .then((room) => {
          gameMode = "online";
          syncRoom(room);
          connectRoomRealtime(room.code);
          loadPublicRooms();
        })
        .catch((error) => {
          onlineError = error.message;
          render();
        });
    });

    root.querySelector("#online-join-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      roomCodeDraft = normalizeRoomCode(formData.get("roomCode"));
      onlineError = "";
      joinOnlineRoom(authToken, roomCodeDraft, {
        skinKey,
      })
        .then((room) => {
          gameMode = "online";
          syncRoom(room);
          connectRoomRealtime(room.code);
        })
        .catch((error) => {
          onlineError = error.message;
          render();
        });
    });

    root.querySelector("#online-leave-room-btn")?.addEventListener("click", () => {
      leaveOnlineRoom();
    });

    root.querySelectorAll(".public-room-btn").forEach((button) => {
      button.addEventListener("click", () => {
        roomCodeDraft = normalizeRoomCode(button.dataset.publicRoomCode);
        onlineError = "";
        joinOnlineRoom(authToken, roomCodeDraft, {
          skinKey,
        })
          .then((room) => {
            gameMode = "online";
            syncRoom(room);
            connectRoomRealtime(room.code);
          })
          .catch((error) => {
            onlineError = error.message;
            render();
          });
      });
    });

    root.querySelector("#leaderboard-country-select")?.addEventListener("change", (event) => {
      onLeaderboardCountryChange(event.target.value);
    });

    root.querySelector("#replay-start-btn")?.addEventListener("click", () => {
      replayPly = 0;
      render();
    });

    root.querySelector("#replay-prev-btn")?.addEventListener("click", () => {
      replayPly = Math.max(0, replayPly - 1);
      render();
    });

    root.querySelector("#replay-next-btn")?.addEventListener("click", () => {
      replayPly = Math.min(publicMatch?.moveHistory?.length ?? 0, replayPly + 1);
      render();
    });

    root.querySelector("#replay-end-btn")?.addEventListener("click", () => {
      replayPly = publicMatch?.moveHistory?.length ?? 0;
      render();
    });

    root.querySelectorAll(".replay-jump-btn").forEach((button) => {
      button.addEventListener("click", () => {
        replayPly = Number(button.dataset.replayPly);
        render();
      });
    });

    root.querySelectorAll(".cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        onSquareClick(Number(cell.dataset.row), Number(cell.dataset.col));
      });
    });

    root.querySelectorAll(".route-btn").forEach((button) => {
      button.addEventListener("click", () => {
        onMoveChoiceClick(Number(button.dataset.routeIndex));
      });
    });

    playPendingBoardAnimation();
  }

  loadAIStatus();
  loadMeta();
  syncPublicRoomPolling();
  loadCurrentUser();
  loadPublicMatch();
  window.addEventListener("popstate", () => {
    currentPage = pageKeyFromPathname(window.location.pathname);

    if (currentPage !== "play" && currentPage !== "online") {
      clearCaptureSequence();
      selectedPieceId = null;
      pendingMoves = [];
    }

    if (currentPage === "online") {
      gameMode = "online";
    } else if (currentPage === "match") {
      loadPublicMatch();
    } else if (currentPage === "play" && gameMode === "online") {
      gameMode = "local";
    }

    syncPublicRoomPolling();
    render();
  });
  render();
}
