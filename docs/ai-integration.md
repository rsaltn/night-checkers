# AI integration

The browser UI now requests AI moves from `POST /api/ai/move`.

## Current behavior

- If no external provider is configured, the server uses the internal minimax engine.
- If an external provider is configured but fails or returns an illegal move, the server falls back to the internal engine.
- `GET /api/ai/status` reports which provider is active per variant.

## Config file

`ai.config.json` is now present in the project root with a Linux `Scan 3.1` provider enabled for `international`.
You can use `ai.config.example.json` as a template for other setups.

Example shape:

```json
{
  "providers": {
    "english": {
      "type": "command",
      "label": "Kingsrow English wrapper",
      "command": ["node", "./scripts/engine-wrapper-example.js", "--engine", "kingsrow-english"],
      "timeoutMs": 5000
    },
    "international": {
      "type": "command",
      "label": "Scan wrapper",
      "command": ["node", "./scripts/engine-wrapper-example.js", "--engine", "scan"],
      "timeoutMs": 5000
    },
    "russian": null
  }
}
```

## Wrapper contract

Your wrapper must:

1. Read one JSON request from stdin.
2. Return one JSON object to stdout.
3. Exit with code `0` on success.

Request shape:

```json
{
  "type": "move",
  "variant": "english",
  "difficulty": "medium",
  "state": {}
}
```

Response shape:

```json
{
  "move": {
    "pieceId": 1,
    "path": [{ "row": 3, "col": 4 }]
  }
}
```

The server validates the returned move against the local rules engine before applying it.

## Current Linux recommendation

- `international`: use native `Scan 3.1` through the server-side `scan_hub` provider
- `english`: use the built-in engine as the default production path on Linux
- `russian`: use the built-in engine as the default production path on Linux

This is the current project policy because it gives one clean Linux deployment story without requiring `Wine` or Windows-only binaries for the whole stack.

## Why this is the chosen default

- `Scan` is a native Linux fit for international draughts, so external is the right choice there.
- `English` can be revisited later if you decide to run `Kingsrow` or `Cake` in a separate service, but that is optional rather than required for the first serious product version.
- `Russian` does not yet have a vetted Linux-native external engine integrated into this codebase, so reliability beats premature complexity.

## Important constraint

Based on the official project pages:

- `Kingsrow` has official builds for English checkers and International draughts.
- `Scan` supports International draughts.
- Neither source currently gives you a direct Russian draughts engine path.

Sources:

- https://edgilbert.org/Checkers/KingsRow.htm
- https://edgilbert.org/InternationalDraughts/download_links.htm
- https://hjetten.home.xs4all.nl/scan/scan.html
