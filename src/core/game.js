import { cloneState, countPiecesByColor, opponentOf } from "./helpers.js";
import { findLegalMove, winnerAfterNoMoves } from "./move-generator.js";
import { createInitialState } from "./state.js";

export function createGame(variantKey) {
  return createInitialState(variantKey);
}

function applyMoveToPieces(pieces, move) {
  return pieces
    .filter((piece) => !move.captures.includes(piece.id))
    .map((piece) => {
      if (piece.id !== move.pieceId) {
        return piece;
      }

      return {
        ...piece,
        row: move.to.row,
        col: move.to.col,
        kind: move.pieceKindAfter,
      };
    });
}

function resolveWinner(state) {
  const whiteCount = countPiecesByColor(state.pieces, "white");
  const blackCount = countPiecesByColor(state.pieces, "black");

  if (whiteCount === 0) {
    return "black";
  }

  if (blackCount === 0) {
    return "white";
  }

  return winnerAfterNoMoves(state);
}

export function applyMove(state, move) {
  const legalMove = findLegalMove(state, move);

  if (!legalMove) {
    return state;
  }

  const nextState = cloneState(state);
  nextState.pieces = applyMoveToPieces(nextState.pieces, legalMove);
  nextState.currentPlayer = opponentOf(state.currentPlayer);
  nextState.turn += 1;
  nextState.lastMove = legalMove;
  nextState.winner = resolveWinner(nextState);
  return nextState;
}

export function restartGame(variantKey) {
  return createInitialState(variantKey);
}
