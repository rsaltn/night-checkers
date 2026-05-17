import assert from "node:assert/strict";
import {
  analyzePlayedMove,
  analyzePosition,
  chooseAIMove,
  createGame,
  getLegalMoves,
} from "../src/core/index.js";
import { chooseServerAIMove, getAIStatus as getServerAIStatus } from "../server/ai-service.js";
import { getVariantConfig } from "../src/core/variants.js";

function testInitialSetup() {
  const russian = createGame("russian");
  const international = createGame("international");
  const english = createGame("english");

  assert.equal(russian.pieces.length, 24);
  assert.equal(international.pieces.length, 40);
  assert.equal(english.pieces.length, 24);

  assert.ok(getLegalMoves(russian).length > 0);
  assert.ok(getLegalMoves(international).length > 0);
  assert.ok(getLegalMoves(english).length > 0);
}

function testBackwardCaptureDifference() {
  const baseState = {
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 4, col: 3 },
      { id: 2, color: "black", kind: "man", row: 5, col: 4 },
    ],
  };

  const russianMoves = getLegalMoves({ ...baseState, variant: "russian" });
  const englishMoves = getLegalMoves({ ...baseState, variant: "english" });

  assert.ok(
    russianMoves.some((move) => move.isCapture && move.to.row === 6 && move.to.col === 5),
  );
  assert.ok(!englishMoves.some((move) => move.isCapture));
}

function testInternationalMaxCapture() {
  const state = {
    variant: "international",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 6, col: 3 },
      { id: 2, color: "black", kind: "man", row: 5, col: 2 },
      { id: 3, color: "black", kind: "man", row: 3, col: 2 },
      { id: 4, color: "black", kind: "man", row: 5, col: 4 },
    ],
  };

  const moves = getLegalMoves(state);

  assert.equal(moves.length, 1);
  assert.equal(moves[0].captures.length, 2);
  assert.deepEqual(moves[0].to, { row: 2, col: 3 });
}

function testPromotionDifference() {
  const russianState = {
    variant: "russian",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 2, col: 1 },
      { id: 2, color: "black", kind: "man", row: 1, col: 2 },
      { id: 3, color: "black", kind: "man", row: 1, col: 4 },
    ],
  };

  const englishState = {
    ...russianState,
    variant: "english",
  };

  const russianMoves = getLegalMoves(russianState);
  const englishMoves = getLegalMoves(englishState);

  assert.ok(russianMoves.some((move) => move.captures.length === 2 && move.pieceKindAfter === "king"));
  assert.ok(englishMoves.some((move) => move.captures.length === 1 && move.to.row === 0));
}

function testEnglishKingCanCaptureBackward() {
  const state = {
    variant: "english",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "king", row: 3, col: 2 },
      { id: 2, color: "black", kind: "man", row: 4, col: 3 },
    ],
  };

  const moves = getLegalMoves(state);

  assert.ok(
    moves.some(
      (move) =>
        move.isCapture &&
        move.captures.length === 1 &&
        move.to.row === 5 &&
        move.to.col === 4,
    ),
  );
}

function testInternationalDoesNotContinueAsKingAfterPromotionCapture() {
  const continueAsManState = {
    variant: "international",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 2, col: 3 },
      { id: 2, color: "black", kind: "man", row: 1, col: 4 },
      { id: 3, color: "black", kind: "man", row: 1, col: 6 },
    ],
  };

  const continueMoves = getLegalMoves(continueAsManState);

  assert.ok(
    continueMoves.some(
      (move) =>
        move.captures.length === 2 &&
        move.to.row === 2 &&
        move.to.col === 7 &&
        move.pieceKindAfter === "man",
    ),
  );

  const stopForKingState = {
    variant: "international",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 2, col: 3 },
      { id: 2, color: "black", kind: "man", row: 1, col: 4 },
      { id: 3, color: "black", kind: "man", row: 3, col: 8 },
    ],
  };

  const stopMoves = getLegalMoves(stopForKingState);

  assert.ok(
    stopMoves.some(
      (move) =>
        move.captures.length === 1 &&
        move.to.row === 0 &&
        move.to.col === 5 &&
        move.pieceKindAfter === "king",
    ),
  );
  assert.ok(!stopMoves.some((move) => move.captures.length > 1));
}

function testAIChoosesForcedCapture() {
  const state = {
    variant: "russian",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 4, col: 3 },
      { id: 2, color: "black", kind: "man", row: 3, col: 4 },
      { id: 3, color: "black", kind: "man", row: 1, col: 6 },
    ],
  };

  const move = chooseAIMove(state, {
    difficulty: "medium",
    variant: getVariantConfig(state.variant),
  });

  assert.ok(move);
  assert.equal(move.isCapture, true);
  assert.ok(move.captures.length >= 1);
  assert.equal(move.pieceKindAfter, "king");
}

function testCoachFindsBetterMove() {
  const state = {
    variant: "russian",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 5, col: 0 },
      { id: 2, color: "white", kind: "man", row: 5, col: 4 },
      { id: 3, color: "black", kind: "man", row: 4, col: 1 },
      { id: 4, color: "black", kind: "man", row: 2, col: 3 },
      { id: 5, color: "black", kind: "man", row: 4, col: 5 },
    ],
  };

  const position = analyzePosition(state, {
    difficulty: "medium",
    variant: getVariantConfig(state.variant),
  });
  const weakerMove = position.rankedMoves[1]?.move;
  const coach = analyzePlayedMove(state, weakerMove, { difficulty: "medium" });

  assert.ok(coach);
  assert.notEqual(coach.bestMoveText, coach.playedMoveText);
  assert.ok(coach.scoreLoss >= 0);
}

async function testServerAIFallback() {
  const status = await getServerAIStatus();

  assert.equal(status.variants.english.type, "internal");
  assert.equal(status.variants.international.type, "external");

  const state = {
    variant: "english",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 4, col: 3 },
      { id: 2, color: "black", kind: "man", row: 3, col: 4 },
    ],
  };

  const result = await chooseServerAIMove(state, "medium");

  assert.ok(result.move);
  assert.equal(result.source, "internal");
}

async function testServerAIScanInternational() {
  const state = {
    variant: "international",
    currentPlayer: "white",
    turn: 1,
    winner: null,
    lastMove: null,
    pieces: [
      { id: 1, color: "white", kind: "man", row: 6, col: 3 },
      { id: 2, color: "black", kind: "man", row: 5, col: 2 },
      { id: 3, color: "black", kind: "man", row: 5, col: 4 },
    ],
  };

  const result = await chooseServerAIMove(state, "easy");

  assert.ok(result.move);
  assert.equal(result.source, "external");
}

async function main() {
  testInitialSetup();
  testBackwardCaptureDifference();
  testInternationalMaxCapture();
  testPromotionDifference();
  testEnglishKingCanCaptureBackward();
  testInternationalDoesNotContinueAsKingAfterPromotionCapture();
  testAIChoosesForcedCapture();
  testCoachFindsBetterMove();
  await testServerAIFallback();
  await testServerAIScanInternational();

  console.log("smoke-test: ok");
}

await main();
