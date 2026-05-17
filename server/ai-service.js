import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseAIMove } from "../src/core/ai.js";
import { getLegalMoves } from "../src/core/move-generator.js";
import {
  encodeInternationalHubPosition,
  squareToInternationalNumber,
} from "../src/core/notation.js";
import { getVariantConfig } from "../src/core/variants.js";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const CONFIG_PATH = new URL("../ai.config.json", import.meta.url);

const PROVIDER_LABELS = {
  english: "Internal engine",
  international: "Internal engine",
  russian: "Internal engine",
};

const PROVIDER_POLICY = {
  english: {
    strategy: "internal_preferred",
    rationale: "Linux-first deployment. External English engines are less straightforward to ship reliably here.",
  },
  international: {
    strategy: "external_preferred",
    rationale: "Scan 3.1 is a native Linux engine and the best deployment fit for international draughts.",
  },
  russian: {
    strategy: "internal_preferred",
    rationale: "A stable Linux-native Russian draughts engine is not wired in yet, so the built-in engine is the default path.",
  },
};

function timeoutAfter(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
}

async function readConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const config = JSON.parse(raw);
    return config?.providers ?? {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function resolveMaybeRelativePath(targetPath) {
  if (typeof targetPath !== "string" || targetPath.length === 0) {
    return targetPath;
  }

  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(ROOT_DIR, targetPath);
}

function normalizeCommandProvider(provider, variant) {
  if (!provider || provider.type !== "command" || !Array.isArray(provider.command)) {
    return null;
  }

  if (provider.command.length === 0 || typeof provider.command[0] !== "string") {
    return null;
  }

  return {
    type: "command",
    variant,
    label: provider.label ?? `${variant} external engine`,
    command: provider.command,
    timeoutMs: provider.timeoutMs ?? 5000,
  };
}

function normalizeScanHubProvider(provider, variant) {
  if (!provider || provider.type !== "scan_hub" || typeof provider.binary !== "string") {
    return null;
  }

  return {
    type: "scan_hub",
    variant,
    label: provider.label ?? "Scan Hub",
    binary: resolveMaybeRelativePath(provider.binary),
    cwd: provider.cwd ? resolveMaybeRelativePath(provider.cwd) : null,
    timeoutMs: provider.timeoutMs ?? 8000,
  };
}

async function loadProviders() {
  const configProviders = await readConfig();
  const variants = ["english", "international", "russian"];
  const providers = {};

  for (const variant of variants) {
    providers[variant] =
      normalizeScanHubProvider(configProviders[variant], variant) ??
      normalizeCommandProvider(configProviders[variant], variant);
  }

  return providers;
}

function moveKey(move) {
  return JSON.stringify({
    pieceId: move.pieceId,
    path: move.path,
  });
}

async function runCommandProvider(provider, request) {
  const [command, ...args] = provider.command;

  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitPromise = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Engine exited with code ${code}`));
        return;
      }

      resolve(stdout);
    });
  });

  child.stdin.write(JSON.stringify(request));
  child.stdin.end();

  const rawOutput = await Promise.race([
    exitPromise,
    timeoutAfter(provider.timeoutMs, provider.label),
  ]);

  const payload = JSON.parse(rawOutput);

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
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

function sendLine(child, line) {
  child.stdin.write(`${line}\n`);
}

function selectLegalInternationalMove(state, moveText) {
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

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => moveKey(left).localeCompare(moveKey(right)));
  return candidates[0];
}

async function runScanHubProvider(provider, request) {
  const moveTimeByDifficulty = {
    easy: 0.15,
    medium: 0.5,
    hard: 1.2,
  };

  return new Promise((resolve, reject) => {
    const child = spawn(provider.binary, ["hub"], {
      cwd: provider.cwd ?? undefined,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let phase = "boot";
    let settled = false;

    function finish(result) {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGKILL");
      resolve(result);
    }

    function fail(error) {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${error.message}${stderrBuffer ? ` | ${stderrBuffer.trim()}` : ""}`));
    }

    const timer = setTimeout(() => {
      fail(new Error(`${provider.label} timed out after ${provider.timeoutMs}ms`));
    }, provider.timeoutMs);

    child.on("error", fail);
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (!settled) {
        fail(new Error(`${provider.label} exited before producing a move`));
      }
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
          sendLine(child, `pos pos=${encodeInternationalHubPosition(request.state)}`);
          sendLine(
            child,
            `level move-time=${moveTimeByDifficulty[request.difficulty] ?? moveTimeByDifficulty.medium}`,
          );
          sendLine(child, "go think");
          phase = "search";
          continue;
        }

        if (phase === "search" && line.command === "done") {
          const move = selectLegalInternationalMove(request.state, line.params.move);

          if (!move) {
            fail(new Error(`Scan returned unmapped move: ${line.params.move}`));
            return;
          }

          clearTimeout(timer);
          finish({ move });
          return;
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

function runInternalProvider(state, difficulty) {
  const variant = getVariantConfig(state.variant);
  const move = chooseAIMove(state, {
    difficulty,
    variant,
  });

  return {
    move,
    provider: PROVIDER_LABELS[state.variant] ?? "Internal engine",
    source: "internal",
  };
}

function validateExternalMove(state, candidateMove) {
  if (!candidateMove) {
    return null;
  }

  const legalMoves = getLegalMoves(state);
  return legalMoves.find((entry) => moveKey(entry) === moveKey(candidateMove)) ?? null;
}

export async function getAIStatus() {
  const providers = await loadProviders();
  const statusFor = (variant) => {
    const provider = providers[variant];
    const policy = PROVIDER_POLICY[variant];

    return provider
      ? {
          type: "external",
          provider: provider.label,
          strategy: policy.strategy,
          rationale: policy.rationale,
        }
      : {
          type: "internal",
          provider: PROVIDER_LABELS[variant],
          strategy: policy.strategy,
          rationale: policy.rationale,
        };
  };

  return {
    variants: {
      english: statusFor("english"),
      international: statusFor("international"),
      russian: statusFor("russian"),
    },
  };
}

export async function chooseServerAIMove(state, difficulty = "medium") {
  const providers = await loadProviders();
  const provider = providers[state.variant];

  if (!provider) {
    return runInternalProvider(state, difficulty);
  }

  try {
    const payload =
      provider.type === "scan_hub"
        ? await runScanHubProvider(provider, {
            type: "move",
            variant: state.variant,
            difficulty,
            state,
          })
        : await runCommandProvider(provider, {
            type: "move",
            variant: state.variant,
            difficulty,
            state,
          });
    const legalMove = validateExternalMove(state, payload.move);

    if (!legalMove) {
      throw new Error("External engine returned an illegal move");
    }

    return {
      move: legalMove,
      provider: provider.label,
      source: "external",
    };
  } catch (error) {
    const fallback = runInternalProvider(state, difficulty);
    return {
      ...fallback,
      fallbackReason: error.message,
    };
  }
}
