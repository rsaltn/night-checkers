import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLegalMoves } from "../src/core/move-generator.js";
import {
  encodeInternationalHubPosition,
  squareToInternationalNumber,
} from "../src/core/notation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scanDir = path.resolve(__dirname, "../vendor/scan/scan_31");
const scanBinary = path.resolve(scanDir, "scan_linux");
const moveTimeByDifficulty = {
  easy: 0.15,
  medium: 0.5,
  hard: 1.2,
};

function moveKey(move) {
  return JSON.stringify({
    pieceId: move.pieceId,
    path: move.path,
  });
}

function parseArgs(raw) {
  const parsed = {};

  for (let index = 0; index < raw.length; index += 1) {
    const token = raw[index];
    const next = raw[index + 1];

    if (!token.startsWith("--")) {
      continue;
    }

    parsed[token.slice(2)] = next;
    index += 1;
  }

  return parsed;
}

function sendLine(child, line) {
  child.stdin.write(`${line}\n`);
}

function parseHubLine(line) {
  const tokens = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  const [command, ...args] = tokens;
  const params = {};
  const flags = new Set();

  for (const token of args) {
    const eqIndex = token.indexOf("=");

    if (eqIndex === -1) {
      flags.add(token);
      continue;
    }

    params[token.slice(0, eqIndex)] = token.slice(eqIndex + 1);
  }

  return { command, params, flags };
}

function selectLegalMoveFromScan(state, moveText) {
  const legalMoves = getLegalMoves(state);
  const isCapture = moveText.includes("x");
  const parts = moveText.split(/[x-]/).map((part) => Number(part));

  if (parts.length < 2 || parts.some(Number.isNaN)) {
    return null;
  }

  const from = parts[0];
  const to = parts[1];
  const captured = new Set(parts.slice(2));

  const candidates = legalMoves.filter((move) => {
    const moveFrom = squareToInternationalNumber(state.variant, move.from.row, move.from.col);
    const moveTo = squareToInternationalNumber(state.variant, move.to.row, move.to.col);

    if (moveFrom !== from || moveTo !== to || move.isCapture !== isCapture) {
      return false;
    }

    if (!isCapture) {
      return true;
    }

    if (captured.size !== move.captures.length) {
      return false;
    }

    const captureSquares = new Set(
      move.captures.map((capturedId) => {
        const piece = state.pieces.find((entry) => entry.id === capturedId);
        return squareToInternationalNumber(state.variant, piece.row, piece.col);
      }),
    );

    if (captureSquares.size !== captured.size) {
      return false;
    }

    for (const square of captured) {
      if (!captureSquares.has(square)) {
        return false;
      }
    }

    return true;
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    candidates.sort((left, right) => moveKey(left).localeCompare(moveKey(right)));
    return candidates[0];
  }

  return null;
}

async function chooseMoveWithScan(state, difficulty) {
  const moveTime = moveTimeByDifficulty[difficulty] ?? moveTimeByDifficulty.medium;

  return new Promise((resolve, reject) => {
    const child = spawn(scanBinary, ["hub"], {
      cwd: scanDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let phase = "boot";
    let timeout = null;

    function fail(error) {
      clearTimeout(timeout);
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      reject(new Error(`${error.message}${stderrBuffer ? ` | ${stderrBuffer.trim()}` : ""}`));
    }

    function finish(move) {
      clearTimeout(timeout);
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      resolve(move);
    }

    timeout = setTimeout(() => {
      fail(new Error("Scan wrapper timed out"));
    }, 8000);

    child.on("error", fail);

    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();

      while (stdoutBuffer.includes("\n")) {
        const newlineIndex = stdoutBuffer.indexOf("\n");
        const rawLine = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

        if (!rawLine) {
          continue;
        }

        const line = parseHubLine(rawLine);

        if (phase === "boot" && line.command === "wait") {
          sendLine(child, "set-param name=variant value=normal");
          sendLine(child, "set-param name=book value=false");
          sendLine(child, "set-param name=bb-size value=0");
          sendLine(child, "set-param name=threads value=1");
          sendLine(child, "init");
          phase = "init";
          continue;
        }

        if (phase === "init" && line.command === "ready") {
          sendLine(child, "new-game");
          sendLine(child, `pos pos=${encodeInternationalHubPosition(state)}`);
          sendLine(child, `level move-time=${moveTime}`);
          sendLine(child, "go think");
          phase = "search";
          continue;
        }

        if (phase === "search" && line.command === "done") {
          const legalMove = selectLegalMoveFromScan(state, line.params.move);

          if (!legalMove) {
            fail(new Error(`Scan returned unmapped move: ${line.params.move}`));
            return;
          }

          finish(legalMove);
        }

        if (line.command === "error") {
          fail(new Error(line.params.message ?? "Scan returned an error"));
          return;
        }
      }
    });

    sendLine(child, "hub");
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const body = readFileSync(0, "utf8");

  const request = JSON.parse(body);

  if (request.variant !== "international") {
    throw new Error("Scan wrapper supports only international draughts");
  }

  const move = await chooseMoveWithScan(request.state, request.difficulty ?? "medium");

  await new Promise((resolve, reject) => {
    process.stdout.write(JSON.stringify({ move }), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  process.exit(0);
}

await main();
