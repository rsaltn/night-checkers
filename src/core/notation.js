import { getVariantConfig } from "./variants.js";

function assertInternational(variantKey) {
  const variant = getVariantConfig(variantKey);

  if (variant.boardSize !== 10) {
    throw new Error(`Notation helper only supports 10x10 variants, got ${variantKey}`);
  }

  return variant;
}

export function squareToInternationalNumber(variantKey, row, col) {
  assertInternational(variantKey);

  if ((row + col) % 2 !== 1) {
    throw new Error(`Square ${row}:${col} is not playable`);
  }

  return row * 5 + Math.floor(col / 2) + 1;
}

export function internationalNumberToSquare(variantKey, number) {
  assertInternational(variantKey);

  if (!Number.isInteger(number) || number < 1 || number > 50) {
    throw new Error(`Invalid international square number: ${number}`);
  }

  const zeroBased = number - 1;
  const row = Math.floor(zeroBased / 5);
  const indexInRow = zeroBased % 5;
  const col = row % 2 === 0 ? indexInRow * 2 + 1 : indexInRow * 2;

  return { row, col };
}

export function encodeInternationalHubPosition(state) {
  assertInternational(state.variant);

  const squares = Array.from({ length: 50 }, () => "e");

  for (const piece of state.pieces) {
    const number = squareToInternationalNumber(state.variant, piece.row, piece.col);
    const symbol =
      piece.color === "white"
        ? piece.kind === "king"
          ? "W"
          : "w"
        : piece.kind === "king"
          ? "B"
          : "b";
    squares[number - 1] = symbol;
  }

  const sideToMove = state.currentPlayer === "white" ? "W" : "B";
  return `${sideToMove}${squares.join("")}`;
}

export function squareToAlgebraic(variantKey, row, col) {
  const variant = getVariantConfig(variantKey);
  const file = String.fromCharCode(97 + col);
  const rank = String(variant.boardSize - row);
  return `${file}${rank}`;
}

export function formatMoveForVariant(variantKey, move) {
  const path = [move.from, ...move.path];
  const separator = move.isCapture ? "x" : "-";

  if (getVariantConfig(variantKey).boardSize === 10) {
    return path
      .map((square) => squareToInternationalNumber(variantKey, square.row, square.col))
      .join(separator);
  }

  return path
    .map((square) => squareToAlgebraic(variantKey, square.row, square.col))
    .join(separator);
}
