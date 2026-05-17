import {
  isInsideBoard,
  moveKey,
  opponentOf,
  shouldPromote,
} from "./helpers.js";
import { getVariantConfig } from "./variants.js";

const LEGAL_MOVES_CACHE = new WeakMap();

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

function createOccupancyResolver(pieces) {
  const index = new Map();

  for (const piece of pieces) {
    index.set(`${piece.row}:${piece.col}`, piece);
  }

  return {
    get(row, col, capturedIds = new Set(), movingPieceId = null) {
      const piece = index.get(`${row}:${col}`);

      if (!piece || piece.id === movingPieceId || capturedIds.has(piece.id)) {
        return null;
      }

      return piece;
    },
  };
}

function getSimpleMovesForMan(piece, variant, occupancy) {
  const directions = expandDirections(variant.menMoveDirections, piece.color);
  const moves = [];

  for (const [dr, dc] of directions) {
    const row = piece.row + dr;
    const col = piece.col + dc;

    if (!isInsideBoard(variant.boardSize, row, col)) {
      continue;
    }

    if (occupancy.get(row, col)) {
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

    while (isInsideBoard(variant.boardSize, row, col) && !state.occupancy.get(row, col)) {
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
  occupancy,
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
        occupancy,
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

    const jumped = occupancy.get(midRow, midCol, capturedIds, piece.id);
    const landingPiece = occupancy.get(landingRow, landingCol, capturedIds, piece.id);

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
      occupancy,
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
  occupancy,
}) {
  const results = [];
  let extended = false;

  for (const [dr, dc] of DIAGONALS) {
    let scanRow = row + dr;
    let scanCol = col + dc;
    let jumped = null;

    while (isInsideBoard(variant.boardSize, scanRow, scanCol)) {
      const occupant = occupancy.get(scanRow, scanCol, capturedIds, piece.id);

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
            occupancy,
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

function getCaptureMovesForPiece(piece, state, variant, occupancy) {
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
      occupancy,
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
    occupancy,
  });
}

function getSimpleMovesForPiece(piece, state, variant) {
  if (piece.kind === "king") {
    return getSimpleMovesForKing(piece, state, variant);
  }

  return getSimpleMovesForMan(piece, variant, state.occupancy);
}

function computeLegalMovesForColor(state, color) {
  const variant = getVariantConfig(state.variant);
  const occupancy = createOccupancyResolver(state.pieces);
  const activePieces = state.pieces.filter((piece) => piece.color === color);
  const resolvedState = {
    ...state,
    currentPlayer: color,
    occupancy,
  };

  const captureMoves = activePieces.flatMap((piece) =>
    getCaptureMovesForPiece(piece, resolvedState, variant, occupancy),
  );

  if (captureMoves.length > 0) {
    if (!variant.requireMaxCapture) {
      return captureMoves;
    }

    const maxCaptures = Math.max(...captureMoves.map((move) => move.captures.length));
    return captureMoves.filter((move) => move.captures.length === maxCaptures);
  }

  return activePieces.flatMap((piece) => getSimpleMovesForPiece(piece, resolvedState, variant));
}

function getLegalMovesForColor(state, color) {
  let byColor = LEGAL_MOVES_CACHE.get(state);

  if (!byColor) {
    byColor = new Map();
    LEGAL_MOVES_CACHE.set(state, byColor);
  }

  if (!byColor.has(color)) {
    byColor.set(color, computeLegalMovesForColor(state, color));
  }

  return byColor.get(color);
}

export function getLegalMoves(state) {
  return getLegalMovesForColor(state, state.currentPlayer);
}

export function getLegalMovesForPiece(state, pieceId) {
  return getLegalMoves(state).filter((move) => move.pieceId === pieceId);
}

export function hasAnyLegalMove(state, color) {
  return getLegalMovesForColor(state, color).length > 0;
}

export function findLegalMove(state, move) {
  return getLegalMoves(state).find((candidate) => moveKey(candidate) === moveKey(move)) ?? null;
}

export function winnerAfterNoMoves(state) {
  const other = opponentOf(state.currentPlayer);
  return hasAnyLegalMove(state, state.currentPlayer) ? null : other;
}
