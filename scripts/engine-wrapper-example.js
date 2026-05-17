import { stdin, stdout } from "node:process";
import { chooseAIMove } from "../src/core/ai.js";
import { getVariantConfig } from "../src/core/variants.js";

let body = "";

for await (const chunk of stdin) {
  body += chunk.toString();
}

const request = JSON.parse(body);
const variant = getVariantConfig(request.state.variant);
const move = chooseAIMove(request.state, {
  difficulty: request.difficulty ?? "medium",
  variant,
});

stdout.write(
  JSON.stringify({
    move,
    note:
      "Replace this wrapper with a real Kingsrow/Scan bridge. Contract: stdin JSON in, stdout JSON out.",
  }),
);
