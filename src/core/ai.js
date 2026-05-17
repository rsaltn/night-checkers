import { applyMove } from "./game.js";
import { countPiecesByColor, opponentOf } from "./helpers.js";
import { getLegalMoves } from "./move-generator.js";
import { getVariantConfig } from "./variants.js";

const DIFFICULTY_PRESETS = {
  easy: {
    depthByVariant: {
      default: 2,
      english: 3,
      russian: 3,
      international: 2,
    },
  },
  medium: {
    depthByVariant: {
      default: 4,
      english: 5,
      russian: 5,
      international: 4,
    },
  },
  hard: {
    depthByVariant: {
      default: 6,
      english: 7,
      russian: 7,
      international: 5,
    },
  },
};

function resolveDepth(difficulty, variant) {
  const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.medium;
  return preset.depthByVariant[variant.key] ?? preset.depthByVariant.default;
}

function stateKey(state) {
  const pieces = state.pieces
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((piece) => `${piece.id}:${piece.color[0]}:${piece.kind[0]}:${piece.row}:${piece.col}`)
    .join("|");
  return `${state.variant}:${state.currentPlayer}:${state.winner ?? "-"}:${pieces}`;
}

function pieceValue(piece) {
  return piece.kind === "king" ? 175 : 100;
}

function advancementValue(piece, variant) {
  const progress =
    piece.color === "white" ? variant.boardSize - 1 - piece.row : piece.row;
  return piece.kind === "man" ? progress * 6 : 0;
}

function mobilityValue(state, color) {
  return getLegalMoves({ ...state, currentPlayer: color }).length;
}

function boardControlValue(piece, variant) {
  const center = (variant.boardSize - 1) / 2;
  const rowOffset = Math.abs(piece.row - center);
  const colOffset = Math.abs(piece.col - center);
  return Math.max(0, 14 - (rowOffset + colOffset) * 4);
}

function evaluateForColor(state, color, variant) {
  if (state.winner) {
    if (state.winner === color) {
      return 100000;
    }

    if (state.winner === opponentOf(color)) {
      return -100000;
    }
  }

  let score = 0;

  for (const piece of state.pieces) {
    const sign = piece.color === color ? 1 : -1;
    score += sign * pieceValue(piece);
    score += sign * advancementValue(piece, variant);
    score += sign * boardControlValue(piece, variant);
  }

  const ownCount = countPiecesByColor(state.pieces, color);
  const oppCount = countPiecesByColor(state.pieces, opponentOf(color));
  score += (ownCount - oppCount) * 20;
  score += (mobilityValue(state, color) - mobilityValue(state, opponentOf(color))) * 4;
  return score;
}

function moveOrderingScore(move) {
  return (
    move.captures.length * 1000 +
    (move.pieceKindAfter === "king" && move.pieceKindBefore !== "king" ? 250 : 0) +
    move.path.length
  );
}

function minimax(state, depth, alpha, beta, maximizingColor, variant, cache) {
  const cacheKey = `${stateKey(state)}:${depth}:${maximizingColor}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  if (depth === 0 || state.winner) {
    const leaf = {
      score: evaluateForColor(state, maximizingColor, variant),
      move: null,
      line: [],
    };
    cache.set(cacheKey, leaf);
    return leaf;
  }

  const legalMoves = getLegalMoves(state)
    .slice()
    .sort((left, right) => moveOrderingScore(right) - moveOrderingScore(left));

  if (legalMoves.length === 0) {
    const terminal = {
      score: evaluateForColor(state, maximizingColor, variant),
      move: null,
      line: [],
    };
    cache.set(cacheKey, terminal);
    return terminal;
  }

  const isMaximizing = state.currentPlayer === maximizingColor;
  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMove = legalMoves[0];
  let bestLine = [];

  for (const move of legalMoves) {
    const nextState = applyMove(state, move);
    const result = minimax(nextState, depth - 1, alpha, beta, maximizingColor, variant, cache);

    if (isMaximizing) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
        bestLine = [move, ...result.line];
      }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
        bestLine = [move, ...result.line];
      }
      beta = Math.min(beta, bestScore);
    }

    if (beta <= alpha) {
      break;
    }
  }

  const resolved = {
    score: bestScore,
    move: bestMove,
    line: bestLine,
  };
  cache.set(cacheKey, resolved);
  return resolved;
}

export function analyzePosition(state, options = {}) {
  const variant = options.variant ?? getVariantConfig(state.variant);
  const depth = resolveDepth(options.difficulty ?? "medium", variant);
  const legalMoves = getLegalMoves(state);
  const cache = new Map();

  if (legalMoves.length === 0) {
    return {
      bestMove: null,
      score: evaluateForColor(state, state.currentPlayer, variant),
      rankedMoves: [],
      principalVariation: [],
    };
  }

  const rankedMoves = legalMoves.map((move) => {
    const nextState = applyMove(state, move);
    const result = minimax(
      nextState,
      Math.max(0, depth - 1),
      -Infinity,
      Infinity,
      state.currentPlayer,
      variant,
      cache,
    );

    return {
      move,
      score: result.score,
      principalVariation: result.line,
    };
  });

  rankedMoves.sort((left, right) => right.score - left.score);

  return {
    bestMove: rankedMoves[0].move,
    score: rankedMoves[0].score,
    depth,
    rankedMoves,
    principalVariation: rankedMoves[0].principalVariation,
  };
}

export function chooseAIMove(state, options = {}) {
  return analyzePosition(state, options).bestMove;
}
