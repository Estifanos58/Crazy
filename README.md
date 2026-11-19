# Crazy — Real-Time Multiplayer Card Game

A hardened, server-authoritative full-stack multiplayer card game built with **TypeScript**, **Next.js 15**, **Express**, **Socket.IO**, and **Redis**.

---

## Features

- **Authoritative Server Engine**: Deck creation, cryptographically secure shuffling (`crypto.randomInt`), move validation, punishment chains, blunder windows, and turn progression are enforced strictly on the backend.
- **Session Security & Privacy**: Timing-safe persistent session tokens (`playerId` + `playerToken`) protect reconnection across lobby, active, and finished games. Private player hands and session tokens are never leaked to other players.
- **Distributed Room Locking**: Per-room local queue serialization paired with Redis `SET NX PX` locks, periodic TTL renewal with loss detection, monotonic fencing tokens (`INCR lock:fence:<roomId>`), and atomic Lua conditional writes that block stale lock owners from overwriting newer state.
- **Durable Blunder Timers**: Blunder expiration deadlines are persisted in a Redis Sorted Set (`blunder:deadlines`) with startup recovery and periodic idempotent sweeping under room locks so active blunders resolve even across backend restarts.
- **Rate Limiting & Abuse Protection**: Redis-backed fixed-window rate limits guard Socket.IO handshakes, room creation, room joining, room discovery (`get-room` anti-enumeration miss throttling), reconnection auth failures, and gameplay events, alongside per-IP concurrent connection caps.
- **Shared Contracts & Runtime Validation**: Shared TypeScript contracts in `shared/` serve as the single source of truth for frontend and backend, backed by Zod runtime schema validation on every Socket.IO event.
- **Responsive Card-Table UI**: Redesigned parlor-inspired interface with custom playing cards, clear turn & suit indicators, QR room sharing, lobby rule presets, and full keyboard/reduced-motion accessibility.

---

## Architecture Overview

```
shared/                     Single source of truth for game & Socket.IO TypeScript contracts
backend/
  src/
    config/                 Redis connection management & health checks
    controllers/            Socket.IO event registration & per-event handlers
    services/
      session-auth.service.ts   Constant-time session token authentication
      lock.service.ts           Distributed Redis locking + local serialization + TTL renewal
      room.service.ts           Locked room lifecycle, join/start/rejoin/reset
      blunder.service.ts        Server-controlled blunder escrow, revert, Crazy challenge, timer expiration
      game-broadcaster.service.ts Public sanitization & per-player private state dispatch
      game.orchestrator.ts      Match flow coordination
      rule.service.ts           Card rules, special effects, punishment chains, turn manager
      card.service.ts           CSPRNG deck shuffle & draw with automatic discard reshuffle
    validation/             Zod runtime schemas for all Socket.IO payloads & custom rules
    utils/                  Structured JSON logger, RuleBuilder/Presets, CardSelector matcher
frontend/
  app/                      Landing (/), Lobby (/room/[roomId]), Table (/game/[roomId]), Rules (/help)
  components/               Playing cards, hand layout, accessible dialogs, connection indicator
  hooks/                    useGameLogic table controller
  lib/store/                Zustand state store, Socket.IO ack-timeout helpers, session reconnection
docs/
  ARCHITECTURE.md           Detailed architecture, locking, security, and Socket.IO protocol reference
  RULES.md                  Complete game rules and rule preset reference
```

---

## Getting Started

### Prerequisites

- **Node.js** `>= 22.0.0`
- **Docker** & **Docker Compose** (recommended for full stack + Redis)

### Run with Docker Compose (Recommended)

1. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
2. Build and start all services (Redis runs strictly on the internal Docker network without exposing a public host port):
   ```bash
   docker compose up --build
   ```
3. Open the app:
   - **Frontend**: `http://localhost:3000`
   - **Backend Health (Liveness)**: `http://localhost:3001/health/live`
   - **Backend Health (Readiness)**: `http://localhost:3001/health/ready`

### Run Locally for Development

1. Start a local Redis instance (optional in dev; backend can fall back to explicit in-memory mode when `REDIS_REQUIRED=false`):
   ```bash
   docker run -d --name crazy-redis -p 127.0.0.1:6379:6379 redis:7-alpine
   ```
2. Start the backend:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run dev
   ```
3. Start the frontend:
   ```bash
   cd frontend
   cp .env.local.example .env.local
   npm install
   npm run dev
   ```

---

## Environment Variables

### Backend (`backend/.env` or Compose environment)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | HTTP and Socket.IO listen port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL (`redis://` or `rediss://`) for local runs |
| `DOCKER_REDIS_URL` | `redis://redis:6379` | Optional Redis URL override for Docker Compose |
| `ALLOW_MEMORY_STORE` | *(unset)* | Non-production **only**: set `true` to explicitly opt into in-memory fallback without Redis (forbidden in `NODE_ENV=production`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin(s), comma-separated for multiple origins |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so rate limits read `X-Forwarded-For` |
| `MAX_CONNECTIONS_PER_IP` | `25` | Maximum concurrent Socket.IO connections allowed per client IP |
| `METRICS_TOKEN` | *(unset)* | Optional Bearer token protecting `GET /metrics` |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Structured logger threshold (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`; Redis is strictly mandatory in `production`) |

### Frontend (`frontend/.env.local` or Docker build args)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Backend Socket.IO endpoint URL |
| `NEXT_PUBLIC_SITE_URL` | Current browser origin / `http://localhost:3000` | Public base URL used for invite links and QR codes |

---

## Testing & Quality Checks

### Backend (Lint, Build, Unit, Security & Integration Tests)

```bash
cd backend
npm run lint
npm run build
NODE_ENV=test npm test
```

To run the test suite against a live Redis server:

```bash
TEST_REDIS_URL=redis://127.0.0.1:6379 NODE_ENV=test npm test
```

### Frontend (Lint, Unit/Component Tests, Build & E2E)

```bash
cd frontend
npm run lint
npm test
npm run build
npm run test:e2e   # Runs Playwright multiplayer E2E tests against http://127.0.0.1:3000
```

---

## Documentation

- [Game Rules & Presets](docs/RULES.md)
- [Architecture, Security & Socket.IO Protocol](docs/ARCHITECTURE.md)

## License

MIT
