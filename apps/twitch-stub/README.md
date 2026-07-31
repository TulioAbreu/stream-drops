# Twitch API Stub (dev)

NestJS mock da Helix/OAuth usado pelo `@stream-drops/front` para testar Channel Points (e o resto) **como Partner**, sem Twitch real.

## Subir

Na raiz do monorepo:

```bash
bun install
bun run dev
```

- Front: `http://localhost:3000` (ou outra porta se 3000 estiver ocupada)
- Stub: `http://localhost:4010`

CORS do stub aceita qualquer origem `localhost` / `127.0.0.1` em dev.

Ou só o stub:

```bash
bun run --filter @stream-drops/twitch-stub dev
```

## Front em modo stub

Em `apps/front/.env`:

```
VITE_TWITCH_STUB=true
VITE_TWITCH_CLIENT_ID=your_twitch_client_id
```

O `VITE_TWITCH_CLIENT_ID` precisa bater com `STUB_TWITCH_CLIENT_ID` do stub (veja `apps/twitch-stub/.env.example`).

Com stub ativo:

1. Login usa token fake (`stub-access-token`) — sem popup OAuth
2. Helix → `http://localhost:4010/helix`
3. Validate → `http://localhost:4010/oauth2/validate`
4. Broadcaster retorna `broadcaster_type: partner` + scopes de Channel Points

Para voltar à Twitch real: `VITE_TWITCH_STUB=false` (ou remova a var) e reinicie o Vite.

## Rotas mockadas

| Method | Path |
|--------|------|
| GET | `/oauth2/validate` |
| GET | `/helix/users` |
| GET | `/helix/subscriptions` |
| POST | `/helix/chat/messages` |
| POST | `/helix/channel_points/custom_rewards` |
| PATCH | `/helix/channel_points/custom_rewards` |
| DELETE | `/helix/channel_points/custom_rewards` |
| GET | `/helix/channel_points/custom_rewards/redemptions` |
| PATCH | `/helix/channel_points/custom_rewards/redemptions` |

## Channel Points

1. Login stub → Partner
2. Criar sorteio (cria reward no store in-memory)
3. **Pausar e coletar** → na 1ª busca `UNFULFILLED` o stub gera **80–200** resgates aleatórios (users + tiers estáveis)
4. Sortear / encerrar normalmente

Dados do stub são **só em memória** (somem ao reiniciar o Nest).

## Env do stub

Ver [`.env.example`](.env.example):

- `STUB_PORT` (default `4010`)
- `STUB_TWITCH_CLIENT_ID`
- `STUB_BROADCASTER_ID` / `LOGIN` / `DISPLAY_NAME`
