# Night Checkers

Night Checkers is a stylized web platform for draughts with a serious game core underneath and an indie pixel-art presentation on top.

It is built for players who want more than a plain board:
- three official variants in one product: Russian, English, International 10x10
- AI opponent with multiple difficulty levels
- post-move AI Coach feedback
- route-aware move generation with mandatory captures, promotion, kings, and variant-specific rules
- two render modes: `Pseudo-3D` and lightweight `2D Lite`
- skin system with multiple themed pixel-art sets

## Why this is valuable

Most checkers sites stop at “playable”. Night Checkers is positioned as a more distinctive product:
- a stronger rules core than a demo board
- a recognizable visual identity instead of generic board-game UI
- room for product expansion: multiplayer by link, rankings, accounts, premium skins, coaching

## Current scope

Implemented now:
- full local play for:
  - Russian draughts
  - English checkers
  - International draughts 10x10
- AI play
- AI Coach panel
- move history
- skin switching
- responsive browser UI

AI policy on Linux:
- `international` uses native `Scan 3.1`
- `english` uses the built-in engine
- `russian` uses the built-in engine

## Tech stack

- Vanilla JS
- Node.js HTTP server
- Custom rules engine
- Native `Scan 3.1` integration for international draughts

## Run locally

Requirements:
- Node.js 22+
- Linux for native `Scan` support

Install and run:

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173
```

Smoke test:

```bash
npm run check
```

## Deploy

This project is deployment-ready for Linux hosts that support Docker.

### Docker

Build:

```bash
docker build -t night-checkers .
```

Run:

```bash
docker run --rm -p 4173:4173 night-checkers
```

Then open:

```text
http://localhost:4173
```

### Recommended hosts

- Render
- Railway
- Fly.io
- any Linux VPS with Docker

Use the included `Dockerfile`. The app serves both the frontend and AI API from one Node process.

## Project structure

```text
server/         HTTP server + AI provider layer
src/core/       rules engine, move generation, notation, AI coach
src/ui/         browser app and AI client
src/assets/     pixel-art assets and skins
vendor/scan/    native Scan engine for international draughts
```

## Product pitch

Night Checkers is a modern draughts platform for players who want official rules, AI practice, and a memorable game-like interface. It combines three major variants, coaching feedback, and a themed pixel-art presentation that stands apart from traditional board-game websites.
