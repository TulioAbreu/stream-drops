# Subathon Server

Processo local NestJS para sincronizar timer de subathon entre o dashboard (`apps/front`) e o overlay OBS (`apps/subathon-overlay`).

## Desenvolvimento

```bash
bun run --filter @stream-drops/subathon-server dev
```

Rode o front em paralelo (`bun run --filter @stream-drops/front dev`).

## Checklist — primeira vez (EventSub / eventos Twitch)

1. Em `apps/front/.env`, configure:
   - `VITE_TWITCH_CLIENT_ID` — Client ID do app no [Twitch Developer Console](https://dev.twitch.tv/console)
   - `VITE_TWITCH_REDIRECT_URL` — ex.: `http://localhost:3000/auth`
2. No Console Twitch, o redirect deve bater com o `.env`. Scopes usados pelo app (OAuth implicit no front):
   - `channel:read:subscriptions`, `bits:read` (EventSub)
   - `chat:read`, `chat:edit` (backup IRC)
   - `user:read:chat`, `user:write:chat`, `channel:manage:redemptions` (outras features)
3. Opcional: copie [`.env.example`](.env.example) para `.env` neste pacote e defina `TWITCH_CLIENT_ID` (mesmo valor do front). Em dev normal **não é obrigatório** — o front envia o Client ID no WebSocket `configureTwitch`.
4. Suba front + este server (`bun dev` em ambos).
5. Faça login Twitch no app. Na sessão Subathon, em **Configurações → Ativar integração Twitch**:
   - Se faltarem scopes, aparece o banner **Reautorizar Twitch** (`force_verify`) — confirme no popup.
   - O status deve ir para **conectado** (não ficar em “Conectando…”).
6. Sem Client ID nem no WS nem no env, o server responde `CLIENT_ID_MISSING`. Sem scopes IRC, o backup de chat falha com `CHAT_LOGIN_FAILED` (EventSub ainda pode funcionar).

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

Copie a pasta `public/` (com `overlay/` buildado) ao lado do binário. Runtime: **Bun** (usa `bun:sqlite`).

Para o binário compilado (sem front enviando Client ID), defina `TWITCH_CLIENT_ID` no ambiente ou em `.env` ao lado do executável.
