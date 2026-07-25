# StreamDrops

Monorepo (Turborepo + Bun) para ferramentas de sorteio Twitch.

## Pré-requisitos

- [Bun](https://bun.sh) `>= 1.3`
- Node.js 20+ (usado indiretamente por Vite/tooling)

## Estrutura

```text
apps/front          # SPA Vite + React (@stream-drops/front)
packages/
  typescript-config # tsconfig compartilhado
  eslint-config     # ESLint flat config compartilhado
```

## Comandos

Na raiz do repositório:

```bash
bun install
bun run dev      # sobe o front em http://localhost:3000
bun run build
bun run lint
bun run preview
```

Filtrar um workspace:

```bash
bun run --filter @stream-drops/front dev
```

## Front (`apps/front`)

SPA client-only. Variáveis em `apps/front/.env`:

- `VITE_TWITCH_CLIENT_ID`
- `VITE_TWITCH_REDIRECT_URL` (ex.: `http://localhost:3000/auth`)

## Deploy (Vercel)

Configure **Root Directory** = `apps/front` (usa `apps/front/vercel.json` com rewrite SPA).

Alternativa pela raiz do monorepo:

- Build: `bunx turbo run build --filter=@stream-drops/front`
- Output: `apps/front/dist`

## Bun `--compile` / `.exe`

Futuros apps CLI no monorepo podem gerar binário standalone:

```bash
bun build ./apps/<cli>/src/index.ts --compile --outfile myapp
# Windows:
bun build ./cli.ts --compile --target=bun-windows-x64 --outfile myapp.exe
```

Isso **não** se aplica ao SPA em `apps/front` (build estático via Vite).
