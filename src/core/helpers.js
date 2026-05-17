export function cloneState(state) {
  return {
    ...state,
    pieces: state.pieces.map((piece) => ({ ...piece })),
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          from: { ...state.lastMove.from },
          to: { ...state.lastMove.to },
          path: state.lastMove.path.map((square) => ({ ...square })),
          captures: [...state.lastMove.captures],
        }
      : null,
  };
}

export function isInsideBoard(size, row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

export function isPlayableSquare(row, col) {
  return (row + col) % 2 === 1;
}

export function opponentOf(color) {
  return color === "white" ? "black" : "white";
}

export function promotionRowFor(color, boardSize) {
  return color === "white" ? 0 : boardSize - 1;
}

export function shouldPromote(piece, row, boardSize) {
  return piece.kind === "man" && row === promotionRowFor(piece.color, boardSize);
}

export function pieceAt(pieces, row, col, capturedIds = new Set(), movingPieceId = null) {
  return (
    pieces.find(
      (piece) =>
        piece.id !== movingPieceId &&
        !capturedIds.has(piece.id) &&
        piece.row === row &&
        piece.col === col,
    ) ?? null
  );
}

export function countPiecesByColor(pieces, color) {
  return pieces.filter((piece) => piece.color === color).length;
}

export function moveKey(move) {
  return JSON.stringify({
    pieceId: move.pieceId,
    path: move.path,
  });
}
