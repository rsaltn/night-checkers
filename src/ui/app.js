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
  loginUser,
  logoutUser,
  requestPasswordReset,
  requestRegister,
  resetPassword,
  submitOnlineMove,
} from "./platform-client.js";

const STORAGE_KEYS = {
  authToken: "night-checkers:auth-token",
  renderMode: "night-checkers:render-mode",
  skin: "night-checkers:skin",
};

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
    ornament: "/src/assets/pixel/skin-cathedral-ornament.png",
    backdropLite: "/src/assets/pixel/skin-cathedral-backdrop.png",
    backdrop3d: "/src/assets/pixel/skin-cathedral-row.png",
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
    ornament: "/src/assets/pixel/skin-ember-ornament.png",
    backdropLite: "/src/assets/pixel/skin-ember-backdrop.png",
    backdrop3d: "/src/assets/pixel/skin-ember-row.png",
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
    ornament: "/src/assets/pixel/skin-crypt-ornament.png",
    backdropLite: "/src/assets/pixel/skin-crypt-backdrop.png",
    backdrop3d: "/src/assets/pixel/skin-crypt-row.png",
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
    ornament: "/src/assets/pixel/skin-arcade-ornament.png",
    backdropLite: "/src/assets/pixel/skin-arcade-backdrop.png",
    backdrop3d: "/src/assets/pixel/skin-arcade-row.png",
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

function getPieceAt(state, row, col) {
  return state.pieces.find((piece) => piece.row === row && piece.col === col) ?? null;
}

function renderPiece(piece, skin) {
  return `
    <span class="piece piece--${piece.color} piece--${piece.kind}">
      <img
        class="piece__sprite"
        src="${skin.pieceSprites[piece.color][piece.kind]}"
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
  return Array.from({ length: size }, (_, index) => String.fromCharCode(65 + index));
}

function getRowLabels(size) {
  return Array.from({ length: size }, (_, index) => String(size - index));
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
  let publicMatch = null;
  let replayPly = 0;
  let onlineRoom = null;
  let roomCodeDraft = initialRoomCode;
  let onlineError = "";
  let meta = {
    countries: [authCountryDraft],
  };
  let renderMode = window.localStorage.getItem(STORAGE_KEYS.renderMode) ?? "pseudo3d";
  let skinKey = window.localStorage.getItem(STORAGE_KEYS.skin) ?? "cathedral";
  let aiDifficulty = "medium";
  let aiColor = "black";
  let aiTimer = null;
  let roomSocket = null;
  let aiRequestId = 0;
  let isAIThinking = false;
  let aiStatus = null;
  let aiLastProvider = "internal";
  let aiFallbackReason = null;
  let coachInsight = null;
  let moveHistory = [];

  function formatMove(move) {
    const route = formatMoveForVariant(state.variant, move);
    return move.isCapture ? `${route} | x${move.captures.length}` : route;
  }

  function clearAITimer() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function disconnectRoomSocket() {
    if (roomSocket) {
      roomSocket.close();
      roomSocket = null;
    }
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
        leaderboard = payload;
        render();
      })
      .catch(() => {
        leaderboard = null;
        render();
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
        render();
      })
      .catch(() => {
        matchHistory = [];
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

    getPublicMatch(matchCode)
      .then((payload) => {
        publicMatch = payload;
        replayPly = payload.moveHistory?.length ?? 0;
        render();
      })
      .catch(() => {
        publicMatch = null;
        render();
      });
  }

  function navigateTo(pageKey, { replace = false, search = "" } = {}) {
    currentPage = PAGES[pageKey] ? pageKey : "home";
    const url = `${PAGES[currentPage]}${search}`;

    if (replace) {
      window.history.replaceState({}, "", url);
    } else if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.pushState({}, "", url);
    }

    render();
  }

  function navigateToMatch(code, { replace = false } = {}) {
    currentPage = "match";
    const url = `/match/${normalizeRoomCode(code)}`;

    if (replace) {
      window.history.replaceState({}, "", url);
    } else if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.pushState({}, "", url);
    }

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
    render();
  }

  function syncRoom(room) {
    onlineRoom = room;
    moveHistory = room.moveHistory ?? [];
    selectedPieceId = null;
    pendingMoves = [];
    state = room.state;
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
          joinOnlineRoom(authToken, initialRoomCode)
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
      });
  }

  function isAITurn(nextState = state) {
    return gameMode === "ai" && nextState.currentPlayer === aiColor && !nextState.winner;
  }

  function commitMove(move, actor) {
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
    const nextState = applyMove(state, move);

    moveHistory = [
      {
        turn: previousState.turn,
        actor,
        player: previousState.currentPlayer,
        text: formatMove(move),
      },
      ...moveHistory,
    ].slice(0, 10);

    if (actor === "human") {
      coachInsight = analyzePlayedMove(previousState, move, {
        difficulty: aiDifficulty,
      });
    }

    selectedPieceId = null;
    pendingMoves = [];
    setState(nextState);
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
    const moves = getLegalMoves(state);
    const selectedMoves = selectedPieceId ? getLegalMovesForPiece(state, selectedPieceId) : [];

    if (selectedPieceId && selectedMoves.length === 0) {
      selectedPieceId = null;
    }

    render(moves, selectedMoves);
    scheduleAIMove();
  }

  function onSelectVariant(variantKey) {
    clearAITimer();
    coachInsight = null;
    moveHistory = [];
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
    disconnectRoomSocket();
    gameMode = nextMode;
    coachInsight = null;
    moveHistory = [];
    isAIThinking = false;
    aiFallbackReason = null;
    selectedPieceId = null;
    pendingMoves = [];
    render();
    scheduleAIMove();
  }

  function onDifficultyChange(nextDifficulty) {
    aiDifficulty = nextDifficulty;
    render();
  }

  function onRenderModeChange(nextMode) {
    renderMode = nextMode;
    window.localStorage.setItem(STORAGE_KEYS.renderMode, renderMode);
    render();
  }

  function onSkinChange(nextSkin) {
    skinKey = SKINS[nextSkin] ? nextSkin : "cathedral";
    window.localStorage.setItem(STORAGE_KEYS.skin, skinKey);
    render();
  }

  function onLeaderboardCountryChange(nextCountry) {
    leaderboardCountry = nextCountry;
    loadLeaderboard();
  }

  function leaveOnlineRoom() {
    disconnectRoomSocket();
    onlineRoom = null;
    onlineError = "";
    gameMode = "local";
    state = restartGame(state.variant);
    moveHistory = [];
    render();
  }

  function onSquareClick(row, col) {
    if (state.winner || isAIThinking || isAITurn()) {
      return;
    }

    if (
      gameMode === "online" &&
      (!onlineRoom?.code ||
        onlineRoom.status !== "playing" ||
        onlineRoom.currentColor !== state.currentPlayer)
    ) {
      return;
    }

    const piece = getPieceAt(state, row, col);
    const pieceMoves = piece ? getLegalMovesForPiece(state, piece.id) : [];

    if (piece && piece.color === state.currentPlayer && pieceMoves.length > 0) {
      selectedPieceId = piece.id;
      render(getLegalMoves(state), pieceMoves);
      return;
    }

    if (!selectedPieceId) {
      return;
    }

    const selectedMoves = getLegalMovesForPiece(state, selectedPieceId);
    const targetMoves = selectedMoves.filter((candidate) =>
      sameSquare(candidate.to, { row, col }),
    );

    if (targetMoves.length === 0) {
      return;
    }

    if (targetMoves.length > 1) {
      pendingMoves = targetMoves;
      render(getLegalMoves(state), selectedMoves);
      return;
    }

    commitMove(targetMoves[0], "human");
  }

  function onMoveChoiceClick(index) {
    const move = pendingMoves[index];

    if (!move) {
      return;
    }

    commitMove(move, "human");
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
          <button type="submit" class="route-btn">Send code</button>
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
        </div>
      `;
    }

    if (!onlineRoom) {
      return `
        <div class="panel panel--online">
          <div class="panel__heading">Online Arena</div>
          ${onlineError ? `<div class="coach coach--mistake">${escapeHtml(onlineError)}</div>` : ""}
          <div class="routes__list">
            <button type="button" class="route-btn" id="online-create-room-btn">Create room</button>
            <form id="online-join-form" class="auth-form">
              <label class="field">
                <span>Invite code</span>
                <input class="field__input" name="roomCode" value="${escapeHtml(roomCodeDraft)}" maxlength="6" />
              </label>
              <button type="submit" class="route-btn">Join room</button>
            </form>
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
        <div class="routes__list">
          <div class="move-log"><strong>${escapeHtml(currentUser.displayName)}</strong></div>
          <div class="routes__hint">${escapeHtml(currentUser.email)}</div>
          <div class="routes__hint">${escapeHtml(currentUser.country)}</div>
          <div class="routes__hint">Russian ${currentUser.ratings?.russian ?? 1200}</div>
          <div class="routes__hint">English ${currentUser.ratings?.english ?? 1200}</div>
          <div class="routes__hint">International ${currentUser.ratings?.international ?? 1200}</div>
          <div class="routes__hint">Matches ${stats.total} · W ${stats.wins} · L ${stats.losses} · D ${stats.draws}</div>
        </div>
      </div>
    `;
  }

  function renderHistoryPanel() {
    return `
      <div class="panel">
        <div class="panel__heading">Match history</div>
        <div class="routes__list">
          ${
            matchHistory.length
              ? matchHistory
                  .slice(0, 8)
                  .map(
                    (match) => `
                      <div class="move-log">
                        <strong>${escapeHtml(match.variant)}</strong> · ${escapeHtml(match.result)}<br />
                        vs ${escapeHtml(match.opponent?.displayName ?? "Waiting")} · room ${escapeHtml(match.code)}<br />
                        ${escapeHtml(match.updatedAt)}
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="routes__hint">No completed online matches yet.</div>`
          }
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

  function renderPublicMatchPage(skin) {
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
    const variant = getVariantConfig(match.variant);
    const colLabels = getColumnLabels(variant.boardSize);
    const rowLabels = getRowLabels(variant.boardSize);
    const whitePieces = replayState.pieces.filter((piece) => piece.color === "white").length;
    const blackPieces = replayState.pieces.filter((piece) => piece.color === "black").length;
    const boardMarkup = Array.from({ length: variant.boardSize * variant.boardSize }, (_, index) => {
      const row = Math.floor(index / variant.boardSize);
      const col = index % variant.boardSize;
      const piece = getPieceAt(replayState, row, col);
      const isDark = (row + col) % 2 === 1;

      return `
        <div class="cell ${isDark ? "cell--dark" : "cell--light"}">
          ${piece ? renderPiece(piece, skin) : ""}
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
            <div class="stage-note">Ply ${replayPly} / ${totalPly}</div>
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
          <div class="routes__list">
            ${
              totalPly
                ? [...match.moveHistory]
                    .reverse()
                    .map(
                      (entry, index) => `
                        <button type="button" class="route-btn replay-jump-btn ${index + 1 === replayPly ? "page-nav__btn--active" : ""}" data-replay-ply="${index + 1}">
                          ${index + 1}. ${escapeHtml(entry.text)}
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

  function render(allMoves = getLegalMoves(state), selectedMoves = []) {
    const variant = getVariantConfig(state.variant);
    const skin = SKINS[skinKey] ?? SKINS.cathedral;
    const title = variantDisplayName(variant);
    const isArenaPage = currentPage === "play" || currentPage === "online";
    const moveTargets = new Map(
      selectedMoves.map((move) => [`${move.to.row}:${move.to.col}`, move]),
    );
    const selectablePieces = new Set(allMoves.map((move) => move.pieceId));
    const capturePressure = allMoves.filter((move) => move.isCapture).length;
    const whitePieces = state.pieces.filter((piece) => piece.color === "white").length;
    const blackPieces = state.pieces.filter((piece) => piece.color === "black").length;
    const colLabels = getColumnLabels(variant.boardSize);
    const rowLabels = getRowLabels(variant.boardSize);
    const currentVariantAIStatus = aiStatus?.variants?.[state.variant];
    const modeLabel =
      gameMode === "ai"
        ? `Solo vs ${aiColor}`
        : gameMode === "online"
          ? `Online ${onlineRoom?.code ?? "lobby"}`
          : "Local duel";
    const activeLabel = state.winner
      ? `${playerDisplayName(state.winner)} wins`
      : `${playerDisplayName(state.currentPlayer)} to act`;
    const boardMarkup = Array.from({ length: variant.boardSize * variant.boardSize }, (_, index) => {
      const row = Math.floor(index / variant.boardSize);
      const col = index % variant.boardSize;
      const piece = getPieceAt(state, row, col);
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
        >
          ${piece ? renderPiece(piece, skin) : ""}
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
        const matchPage = renderPublicMatchPage(skin);
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
              <p class="panel__copy">Email registration with confirmation code, password reset, and country-tagged rating profile.</p>
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
        centerMarkup = `
          <section class="stage stage--landing">
            <div class="panel">
              <div class="panel__eyebrow">Pilot Archive</div>
              <h2 class="stage__title">Recent matches</h2>
              <div class="routes__list">
                ${
                  matchHistory.length
                    ? matchHistory
                        .map(
                          (match) => `
                            <button type="button" class="route-btn match-link-btn" data-match-code="${escapeHtml(match.code)}">
                              <strong>${escapeHtml(match.variant)}</strong> · ${escapeHtml(match.result)}<br />
                              vs ${escapeHtml(match.opponent?.displayName ?? "Waiting")} · ${escapeHtml(match.playerColor)}<br />
                              ${escapeHtml(match.updatedAt)}
                            </button>
                          `,
                        )
                        .join("")
                    : `<div class="routes__hint">No online matches recorded yet.</div>`
                }
              </div>
            </div>
          </section>
        `;
        rightMarkup = `
          <div class="panel">
            <div class="panel__heading">Latest ladder snapshot</div>
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
                  : `<div class="routes__hint">Sign in and play to see movement here.</div>`
              }
            </div>
          </div>
        `;
      }

      root.innerHTML = `
        <main
          class="shell shell--${state.variant} shell--${renderMode} shell--skin-${skinKey}"
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
      `;
    } else {

      root.innerHTML = `
      <main
        class="shell shell--${state.variant} shell--${renderMode} shell--skin-${skinKey}"
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
                          entry.key === state.variant ? "selected" : ""
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
              <label class="field">
                <span>Render</span>
                <select id="render-mode-select">
                  <option value="pseudo3d" ${renderMode === "pseudo3d" ? "selected" : ""}>Pseudo-3D</option>
                  <option value="flat2d" ${renderMode === "flat2d" ? "selected" : ""}>2D Lite</option>
                </select>
              </label>
              <label class="field">
                <span>Skin</span>
                <select id="skin-select">
                  ${Object.entries(SKINS)
                    .map(
                      ([key, entry]) =>
                        `<option value="${key}" ${key === skinKey ? "selected" : ""}>${entry.label}</option>`,
                    )
                    .join("")}
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
                <strong class="stat__value">${state.turn}</strong>
              </div>
              <div class="stat">
                <span class="stat__label">Active side</span>
                <strong class="stat__value">${playerDisplayName(state.currentPlayer)}</strong>
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
                  state.winner ? playerDisplayName(state.winner) : "None"
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
                selectedMoves.length > 0
                  ? "Target squares are lit. If several capture routes share one square, choose the route in the right panel."
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
                      selectedMoves.length > 0
                        ? "A route panel appears here when the same landing square hides multiple legal chains."
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

          <div class="panel panel--system">
            <div class="panel__heading">System trace</div>
            <div class="system-list">
              <div><strong>AI status:</strong> ${isAIThinking ? "thinking" : "idle"}</div>
              <div><strong>AI strategy:</strong> ${
                gameMode === "ai"
                  ? currentVariantAIStatus?.strategy ?? "unknown"
                  : gameMode === "online"
                    ? "server_authoritative"
                    : "n/a"
              }</div>
              <div><strong>Provider type:</strong> ${
                gameMode === "ai"
                  ? currentVariantAIStatus?.type ?? "unknown"
                  : gameMode === "online"
                    ? "multiplayer_room"
                    : "n/a"
              }</div>
              <div><strong>Board size:</strong> ${variant.boardSize} x ${variant.boardSize}</div>
              <div><strong>Forced captures:</strong> ${capturePressure > 0 ? "yes" : "no"}</div>
              ${aiFallbackReason ? `<div><strong>Fallback:</strong> ${aiFallbackReason}</div>` : ""}
            </div>
          </div>

          ${renderLeaderboardPanel()}
        </aside>
      </main>
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

    root.querySelector("#render-mode-select")?.addEventListener("change", (event) => {
      onRenderModeChange(event.target.value);
    });

    root.querySelector("#skin-select")?.addEventListener("change", (event) => {
      onSkinChange(event.target.value);
    });

    root.querySelector("#restart-btn")?.addEventListener("click", () => {
      onSelectVariant(state.variant);
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

    root.querySelector("#online-create-room-btn")?.addEventListener("click", () => {
      onlineError = "";
      createOnlineRoom(authToken, {
        variant: state.variant,
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

    root.querySelector("#online-join-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      roomCodeDraft = normalizeRoomCode(formData.get("roomCode"));
      onlineError = "";
      joinOnlineRoom(authToken, roomCodeDraft)
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
  }

  loadAIStatus();
  loadMeta();
  loadCurrentUser();
  loadPublicMatch();
  window.addEventListener("popstate", () => {
    currentPage = pageKeyFromPathname(window.location.pathname);

    if (currentPage === "online") {
      gameMode = "online";
    } else if (currentPage === "match") {
      loadPublicMatch();
    } else if (currentPage === "play" && gameMode === "online") {
      gameMode = "local";
    }

    render();
  });
  render();
}
