import {
  isInsideBoard,
  moveKey,
  opponentOf,
  pieceAt,
  shouldPromote,
} from "./helpers.js";
import { getVariantConfig } from "./variants.js";

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function expandDirections(moveDirections, color) {
  return moveDirections.flatMap((rowStep) => [
    [color === "white" ? rowStep : -rowStep, -1],
    [color === "white" ? rowStep : -rowStep, 1],
  ]);
}

function getShortCaptureDirections(piece, kind, variant) {
  if (kind === "king") {
    return DIAGONALS;
  }

  if (variant.menCaptureBackward) {
    return DIAGONALS;
  }

  return expandDirections(variant.menMoveDirections, piece.color);
}

function createMove(piece, path, captures, kind, promotes) {
  return {
    pieceId: piece.id,
    from: { row: piece.row, col: piece.col },
    to: path[path.length - 1],
    path,
    captures,
    isCapture: captures.length > 0,
    pieceKindBefore: piece.kind,
    pieceKindAfter: kind,
    promotes,
  };
}

function getSimpleMovesForMan(piece, state, variant) {
  const directions = expandDirections(variant.menMoveDirections, piece.color);
  const moves = [];

  for (const [dr, dc] of directions) {
    const row = piece.row + dr;
    const col = piece.col + dc;

    if (!isInsideBoard(variant.boardSize, row, col)) {
      continue;
    }

    if (pieceAt(state.pieces, row, col)) {
      continue;
    }

    const promotes = shouldPromote(piece, row, variant.boardSize);
    moves.push(
      createMove(piece, [{ row, col }], [], promotes ? "king" : piece.kind, promotes),
    );
  }

  return moves;
}

function getSimpleMovesForKing(piece, state, variant) {
  const moves = [];

  for (const [dr, dc] of DIAGONALS) {
    let row = piece.row + dr;
    let col = piece.col + dc;

    while (isInsideBoard(variant.boardSize, row, col) && !pieceAt(state.pieces, row, col)) {
      moves.push(createMove(piece, [{ row, col }], [], piece.kind, false));

      if (variant.kingsMoveRange === "short") {
        break;
      }

      row += dr;
      col += dc;
    }
  }

  return moves;
}

function exploreManCaptures({
  variant,
  state,
  piece,
  row,
  col,
  kind,
  capturedIds,
  path,
  captures,
}) {
  const results = [];
  let extended = false;

  if (kind === "king") {
    if (variant.kingsCaptureRange === "long") {
      return exploreFlyingKingCaptures({
        variant,
        state,
        piece,
        row,
        col,
        capturedIds,
        path,
        captures,
      });
    }
  }

  const directions = getShortCaptureDirections(piece, kind, variant);

  for (const [dr, dc] of directions) {
    const midRow = row + dr;
    const midCol = col + dc;
    const landingRow = row + dr * 2;
    const landingCol = col + dc * 2;

    if (!isInsideBoard(variant.boardSize, landingRow, landingCol)) {
      continue;
    }

    const jumped = pieceAt(state.pieces, midRow, midCol, capturedIds, piece.id);
    const landingPiece = pieceAt(state.pieces, landingRow, landingCol, capturedIds, piece.id);

    if (!jumped || jumped.color === piece.color || landingPiece) {
      continue;
    }

    extended = true;
    const nextCapturedIds = new Set(capturedIds);
    nextCapturedIds.add(jumped.id);

    const promotes = shouldPromote({ ...piece, kind }, landingRow, variant.boardSize);
    const nextKind =
      promotes && variant.continueAsKingAfterPromotionCapture ? "king" : kind;

    if (promotes && variant.stopAfterPromotionOnCapture) {
      results.push(
        createMove(
          piece,
          [...path, { row: landingRow, col: landingCol }],
          [...captures, jumped.id],
          "king",
          true,
        ),
      );
      continue;
    }

    const childMoves = exploreManCaptures({
      variant,
      state,
      piece,
      row: landingRow,
      col: landingCol,
      kind: nextKind,
      capturedIds: nextCapturedIds,
      path: [...path, { row: landingRow, col: landingCol }],
      captures: [...captures, jumped.id],
    });

    if (childMoves.length > 0) {
      results.push(...childMoves);
    } else {
      results.push(
        createMove(
          piece,
          [...path, { row: landingRow, col: landingCol }],
          [...captures, jumped.id],
          promotes ? "king" : nextKind,
          promotes,
        ),
      );
    }
  }

  if (!extended) {
    return [];
  }

  return results;
}

function exploreFlyingKingCaptures({
  variant,
  state,
  piece,
  row,
  col,
  capturedIds,
  path,
  captures,
}) {
  const results = [];
  let extended = false;

  for (const [dr, dc] of DIAGONALS) {
    let scanRow = row + dr;
    let scanCol = col + dc;
    let jumped = null;

    while (isInsideBoard(variant.boardSize, scanRow, scanCol)) {
      const occupant = pieceAt(state.pieces, scanRow, scanCol, capturedIds, piece.id);

      if (!occupant) {
        if (jumped) {
          extended = true;
          const nextCapturedIds = new Set(capturedIds);
          nextCapturedIds.add(jumped.id);

          const childMoves = exploreFlyingKingCaptures({
            variant,
            state,
            piece,
            row: scanRow,
            col: scanCol,
            capturedIds: nextCapturedIds,
            path: [...path, { row: scanRow, col: scanCol }],
            captures: [...captures, jumped.id],
          });

          if (childMoves.length > 0) {
            results.push(...childMoves);
          } else {
            results.push(
              createMove(
                piece,
                [...path, { row: scanRow, col: scanCol }],
                [...captures, jumped.id],
                "king",
                false,
              ),
            );
          }
        }

        scanRow += dr;
        scanCol += dc;
        continue;
      }

      if (occupant.color === piece.color || jumped) {
        break;
      }

      jumped = occupant;
      scanRow += dr;
      scanCol += dc;
    }
  }

  if (!extended) {
    return [];
  }

  return results;
}

function getCaptureMovesForPiece(piece, state, variant) {
  if (piece.kind === "king" && variant.kingsCaptureRange === "long") {
    return exploreFlyingKingCaptures({
      variant,
      state,
      piece,
      row: piece.row,
      col: piece.col,
      capturedIds: new Set(),
      path: [],
      captures: [],
    });
  }

  return exploreManCaptures({
    variant,
    state,
    piece,
    row: piece.row,
    col: piece.col,
    kind: piece.kind,
    capturedIds: new Set(),
    path: [],
    captures: [],
  });
}

function getSimpleMovesForPiece(piece, state, variant) {
  if (piece.kind === "king") {
    return getSimpleMovesForKing(piece, state, variant);
  }

  return getSimpleMovesForMan(piece, state, variant);
}

export function getLegalMoves(state) {
  const variant = getVariantConfig(state.variant);
  const activePieces = state.pieces.filter((piece) => piece.color === state.currentPlayer);

  const captureMoves = activePieces.flatMap((piece) =>
    getCaptureMovesForPiece(piece, state, variant),
  );

  if (captureMoves.length > 0) {
    if (!variant.requireMaxCapture) {
      return captureMoves;
    }

    const maxCaptures = Math.max(...captureMoves.map((move) => move.captures.length));
    return captureMoves.filter((move) => move.captures.length === maxCaptures);
  }

  return activePieces.flatMap((piece) => getSimpleMovesForPiece(piece, state, variant));
}

export function getLegalMovesForPiece(state, pieceId) {
  return getLegalMoves(state).filter((move) => move.pieceId === pieceId);
}

export function hasAnyLegalMove(state, color) {
  return getLegalMoves({ ...state, currentPlayer: color }).length > 0;
}

export function findLegalMove(state, move) {
  return getLegalMoves(state).find((candidate) => moveKey(candidate) === moveKey(move)) ?? null;
}

export function winnerAfterNoMoves(state) {
  const other = opponentOf(state.currentPlayer);
  return hasAnyLegalMove(state, state.currentPlayer) ? null : other;
}
