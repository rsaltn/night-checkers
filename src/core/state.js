import { getVariantConfig } from "./variants.js";
import { isPlayableSquare } from "./helpers.js";

function createPiece(id, color, row, col) {
  return {
    id,
    color,
    kind: "man",
    row,
    col,
  };
}

export function createInitialState(variantKey) {
  const variant = getVariantConfig(variantKey);
  const pieces = [];
  let nextId = 1;

  for (let row = 0; row < variant.boardSize; row += 1) {
    for (let col = 0; col < variant.boardSize; col += 1) {
      if (!isPlayableSquare(row, col)) {
        continue;
      }

      if (row < variant.startingRows) {
        pieces.push(createPiece(nextId, "black", row, col));
        nextId += 1;
      } else if (row >= variant.boardSize - variant.startingRows) {
        pieces.push(createPiece(nextId, "white", row, col));
        nextId += 1;
      }
    }
  }

  return {
    variant: variant.key,
    currentPlayer: "white",
    pieces,
    winner: null,
    turn: 1,
    lastMove: null,
  };
}
