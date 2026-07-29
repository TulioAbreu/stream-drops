# Subathon Server

Processo local NestJS para sincronizar timer de subathon entre o dashboard (`apps/front`) e o overlay OBS (`apps/subathon-overlay`).

## Desenvolvimento

```bash
bun run --filter @stream-drops/subathon-server dev
```

## Portas e discovery

- Bind em `127.0.0.1`, portas `8080..8090` (primeira livre)
- WebSocket: `ws://127.0.0.1:{porta}/ws`
- Overlay: `http://127.0.0.1:{porta}/overlay`
- Front e overlay descobrem o server automaticamente (handshake `hello` na faixa de portas)

## CORS

Origens permitidas: `localhost` / `127.0.0.1` (qualquer porta) e deploy Vercel do front. Sem auth local.

## SQLite

- macOS: `~/Library/Application Support/StreamDrops/subathon.sqlite`
- Windows: `%APPDATA%/StreamDrops/subathon.sqlite`
- Linux: `~/.local/share/StreamDrops/subathon.sqlite`
- Fallback: `./subathon.sqlite` ao lado do executável

## Compile (spike)

```bash
bun run --filter @stream-drops/subathon-server build
bun run --filter @stream-drops/subathon-overlay build
cd apps/subathon-server && bun build --compile ./dist/main.js --outfile subathon-server
```

Copie a pasta `public/` (com `overlay/` buildado) ao lado do binário. Runtime recomendado: **Node 22+** (usa `node:sqlite` nativo) ou o binário Bun compilado.

Variável opcional para EventSub: `TWITCH_CLIENT_ID` ou `VITE_TWITCH_CLIENT_ID`.
