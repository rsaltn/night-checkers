import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const SHEET_PATH = path.join(ROOT_DIR, "src/assets/pixel/skin-sheet-generated.png");
const OUTPUT_DIR = path.join(ROOT_DIR, "src/assets/pixel");
const TMP_DIR = path.join(ROOT_DIR, "tmp/generated-piece-pngs");

mkdirSync(TMP_DIR, { recursive: true });

const ROW_Y = {
  cathedral: 30,
  ember: 252,
  crypt: 474,
  arcade: 696,
};

const COL_X = {
  whiteMan: 14,
  blackMan: 192,
  whiteKing: 370,
  blackKing: 548,
};

const OUTPUTS = [
  ["cathedral", "whiteMan", "piece-white-man.svg"],
  ["cathedral", "blackMan", "piece-black-man.svg"],
  ["cathedral", "whiteKing", "piece-white-king.svg"],
  ["cathedral", "blackKing", "piece-black-king.svg"],
  ["ember", "whiteMan", "piece-ember-white-man.svg"],
  ["ember", "blackMan", "piece-ember-black-man.svg"],
  ["ember", "whiteKing", "piece-ember-white-king.svg"],
  ["ember", "blackKing", "piece-ember-black-king.svg"],
  ["crypt", "whiteMan", "piece-crypt-white-man.svg"],
  ["crypt", "blackMan", "piece-crypt-black-man.svg"],
  ["crypt", "whiteKing", "piece-crypt-white-king.svg"],
  ["crypt", "blackKing", "piece-crypt-black-king.svg"],
  ["arcade", "whiteMan", "piece-arcade-white-man.svg"],
  ["arcade", "blackMan", "piece-arcade-black-man.svg"],
  ["arcade", "whiteKing", "piece-arcade-white-king.svg"],
  ["arcade", "blackKing", "piece-arcade-black-king.svg"],
];

function runMagick(args) {
  const result = spawnSync("magick", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `magick failed with status ${result.status}`);
  }

  return result.stdout;
}

function cropPieceToPng(theme, roleKey, destinationPath) {
  const x = COL_X[roleKey];
  const y = ROW_Y[theme];

  execFileSync(
    "magick",
    [
      SHEET_PATH,
      "-crop",
      `150x150+${x}+${y}`,
      "+repage",
      "-alpha",
      "set",
      "-fuzz",
      "22%",
      "-fill",
      "none",
      "-draw",
      "color 0,0 floodfill",
      "-draw",
      "color 149,0 floodfill",
      "-draw",
      "color 0,149 floodfill",
      "-draw",
      "color 149,149 floodfill",
      "-trim",
      "+repage",
      "-background",
      "none",
      "-gravity",
      "center",
      "-extent",
      "128x128",
      destinationPath,
    ],
    {
      stdio: "inherit",
    },
  );
}

function rasterPngToSvg(pngPath) {
  const text = runMagick([pngPath, "txt:-"]);
  const lines = text.trim().split("\n");
  const header = lines.shift();
  const match = header.match(/pixel enumeration:\s*(\d+),(\d+)/i);

  if (!match) {
    throw new Error(`Could not parse image header for ${pngPath}`);
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  const rows = Array.from({ length: height }, () => new Array(width).fill(null));

  for (const line of lines) {
    const pixelMatch = line.match(/^(\d+),(\d+): .* (#(?:[0-9A-F]{8}|[0-9A-F]{6}))/i);

    if (!pixelMatch) {
      continue;
    }

    const x = Number(pixelMatch[1]);
    const y = Number(pixelMatch[2]);
    const hex = pixelMatch[3].toUpperCase();
    const rgba = hex.length === 9 ? hex : `${hex}FF`;

    if (rgba.endsWith("00")) {
      continue;
    }

    rows[y][x] = rgba.slice(0, 7);
  }

  const rects = [];

  for (let y = 0; y < height; y += 1) {
    let x = 0;

    while (x < width) {
      const color = rows[y][x];

      if (!color) {
        x += 1;
        continue;
      }

      let end = x + 1;

      while (end < width && rows[y][end] === color) {
        end += 1;
      }

      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`);
      x = end;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    `  <rect width="${width}" height="${height}" fill="none"/>`,
    ...rects.map((entry) => `  ${entry}`),
    `</svg>`,
  ].join("\n");
}

for (const [theme, roleKey, outputName] of OUTPUTS) {
  const tempPng = path.join(TMP_DIR, outputName.replace(".svg", ".png"));
  const outputSvg = path.join(OUTPUT_DIR, outputName);
  cropPieceToPng(theme, roleKey, tempPng);
  const svg = rasterPngToSvg(tempPng);
  writeFileSync(outputSvg, svg);
  console.log(`generated ${outputName}`);
}
