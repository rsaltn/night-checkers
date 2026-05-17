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

const STORAGE_KEYS = {
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

export function createApp(root) {
  let state = createGame("russian");
  let selectedPieceId = null;
  let pendingMoves = [];
  let gameMode = "local";
  let renderMode = window.localStorage.getItem(STORAGE_KEYS.renderMode) ?? "pseudo3d";
  let skinKey = window.localStorage.getItem(STORAGE_KEYS.skin) ?? "cathedral";
  let aiDifficulty = "medium";
  let aiColor = "black";
  let aiTimer = null;
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

  function isAITurn(nextState = state) {
    return gameMode === "ai" && nextState.currentPlayer === aiColor && !nextState.winner;
  }

  function commitMove(move, actor) {
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
    setState(restartGame(variantKey));
  }

  function onModeChange(nextMode) {
    clearAITimer();
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

  function onSquareClick(row, col) {
    if (state.winner || isAIThinking || isAITurn()) {
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

  function render(allMoves = getLegalMoves(state), selectedMoves = []) {
    const variant = getVariantConfig(state.variant);
    const skin = SKINS[skinKey] ?? SKINS.cathedral;
    const title = variantDisplayName(variant);
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
    const modeLabel = gameMode === "ai" ? `Solo vs ${aiColor}` : "Local duel";
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

        <section class="hud hud--left">
          <div class="panel panel--hero">
            <div class="panel__eyebrow">Arcade Boardroom</div>
            <h1 class="panel__title">Night Checkers</h1>
            <p class="panel__copy">
              Competitive draughts in a moody pixel shell. Tournament logic underneath,
              indie tactics framing on top.
            </p>
          </div>

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
                gameMode === "ai" ? currentVariantAIStatus?.strategy ?? "unknown" : "n/a"
              }</div>
              <div><strong>Provider type:</strong> ${
                gameMode === "ai" ? currentVariantAIStatus?.type ?? "unknown" : "n/a"
              }</div>
              <div><strong>Board size:</strong> ${variant.boardSize} x ${variant.boardSize}</div>
              <div><strong>Forced captures:</strong> ${capturePressure > 0 ? "yes" : "no"}</div>
              ${aiFallbackReason ? `<div><strong>Fallback:</strong> ${aiFallbackReason}</div>` : ""}
            </div>
          </div>
        </aside>
      </main>
    `;

    root.querySelector("#variant-select").addEventListener("change", (event) => {
      onSelectVariant(event.target.value);
    });

    root.querySelector("#mode-select").addEventListener("change", (event) => {
      onModeChange(event.target.value);
    });

    root.querySelector("#difficulty-select").addEventListener("change", (event) => {
      onDifficultyChange(event.target.value);
    });

    root.querySelector("#render-mode-select").addEventListener("change", (event) => {
      onRenderModeChange(event.target.value);
    });

    root.querySelector("#skin-select").addEventListener("change", (event) => {
      onSkinChange(event.target.value);
    });

    root.querySelector("#restart-btn").addEventListener("click", () => {
      onSelectVariant(state.variant);
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
  render();
}
