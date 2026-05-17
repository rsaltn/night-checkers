import { applyMove } from "./game.js";
import { formatMoveForVariant } from "./notation.js";
import { moveKey, opponentOf } from "./helpers.js";
import { getLegalMoves } from "./move-generator.js";
import { getVariantConfig } from "./variants.js";
import { analyzePosition } from "./ai.js";

function classifyDelta(delta) {
  if (delta >= 180) {
    return "blunder";
  }
  if (delta >= 90) {
    return "mistake";
  }
  if (delta >= 35) {
    return "inaccuracy";
  }
  return "good";
}

function generateReasons({ previousState, playedMove, bestMove }) {
  const reasons = [];
  const beforeOpponentMoves = getLegalMoves({
    ...previousState,
    currentPlayer: opponentOf(previousState.currentPlayer),
  });
  const nextState = applyMove(previousState, playedMove);
  const afterOpponentMoves = getLegalMoves(nextState);

  if (playedMove.captures.length < bestMove.captures.length) {
    reasons.push("You chose a route with fewer captures than the best tactical sequence.");
  }

  if (playedMove.pieceKindAfter !== "king" && bestMove.pieceKindAfter === "king") {
    reasons.push("The stronger line promoted immediately and improved long-term mobility.");
  }

  const beforeCaptures = beforeOpponentMoves.filter((move) => move.isCapture).length;
  const afterCaptures = afterOpponentMoves.filter((move) => move.isCapture).length;

  if (afterCaptures > beforeCaptures) {
    reasons.push("This move opened extra capture chances for the opponent.");
  }

  if (!playedMove.isCapture && bestMove.isCapture) {
    reasons.push("A forcing capture was available and kept the initiative.");
  }

  if (reasons.length === 0) {
    reasons.push("This move stays close to the engine's main plan.");
  }

  return reasons;
}

export function analyzePlayedMove(previousState, playedMove, options = {}) {
  const variant = getVariantConfig(previousState.variant);
  const analysis = analyzePosition(previousState, {
    difficulty: options.difficulty ?? "medium",
    variant,
  });

  if (!analysis.bestMove) {
    return null;
  }

  const played = analysis.rankedMoves.find((entry) => moveKey(entry.move) === moveKey(playedMove));
  const playedScore = played?.score ?? analysis.score;
  const scoreLoss = Math.max(0, analysis.score - playedScore);
  const verdict = classifyDelta(scoreLoss);

  return {
    verdict,
    scoreLoss,
    playedMoveText: formatMoveForVariant(previousState.variant, playedMove),
    bestMoveText: formatMoveForVariant(previousState.variant, analysis.bestMove),
    bestMove: analysis.bestMove,
    reasons: generateReasons({
      previousState,
      playedMove,
      bestMove: analysis.bestMove,
    }),
    principalVariation: analysis.principalVariation.map((move) =>
      formatMoveForVariant(previousState.variant, move),
    ),
  };
}
