# Crazy — Architecture, Security & Protocol Reference

## 1. Authoritative Server Model

All match state lives in Redis under `room:<roomId>` with a 4-hour TTL. Clients never mutate decks, hands, or turns directly; they emit intents over Socket.IO and receive sanitized broadcasts.

### Service Decomposition

- **`SessionAuthService`**: Verifies persistent credentials (`playerId`, `playerToken`) using `crypto.timingSafeEqual`. Never falls back to `socket.id` if explicit credentials are supplied and invalid.
- **`RoomLockService`**: Protects every room mutation (`joinRoom`, `startGame`, `rejoinRoom`, `playCard`, `takePunishment`, `revertBlunder`, `callCrazy`, `handleBlunderTimeout`, `leaveGame`, `playAgain`, `markPlayerDisconnected`).
  - Chains in-process promises per `roomId` and cleans up finished queue entries immediately.
  - Acquires Redis distributed locks via `SET lock:room:<roomId> <token> NX PX <ttl>` and mints a monotonic fencing token (`INCR lock:fence:<roomId>`).
  - Extends TTL periodically via Lua `pexpire` while a task executes; if renewal fails, marks the lock context lost (`LockLostError`).
  - Enforces atomic Lua conditional writes (`SAVE_ROOM_FENCED` / `DELETE_ROOM_FENCED`) verifying both lock ownership AND monotonic fencing token before persisting room mutations so stale owners cannot overwrite newer state.
  - Releases safely via Lua compare-and-delete.
  - Throws `LockAcquisitionError` on contention timeout or Redis error — tasks **never** execute without a valid lock.
- **`RoomService`**: Enforces strict lifecycle transitions (`lobby` → `playing` → `finished`), allocates 6-character unambiguous room IDs atomically with `SET NX EX` (preventing collisions and overwrites), and prevents username-based session takeover on reconnection.
- **`BlunderService`**: Holds illegal plays in server escrow (`room.blunderState`) to prevent card duplication. Persists blunder deadlines in a Redis Sorted Set (`blunder:deadlines`) with startup recovery and periodic idempotent sweeping under room lock so blunder timeouts survive backend restarts. Client `no-revert` events are unconditionally rejected.
- **`RateLimitService`**: Redis-backed atomic Lua fixed-window rate limits protecting Socket.IO handshakes, per-IP concurrent connections (`MAX_CONNECTIONS_PER_IP`), room creation/joining, anti-enumeration `get-room` miss throttling, failed `rejoin-room` auth throttling, and gameplay events.
- **`GameBroadcaster`**: Single sanitizer responsible for building public room views (`PublicRoom`), player-specific authoritative states (`GameStateResponse`), and per-player broadcasts (`game-started`, `game-update`), ensuring opponent hands and session tokens are never exposed.
- **`GameOrchestrator`**: Coordinates core turn actions (`playCard`, `takePunishment`, `leaveGame`, `playAgain`).

---

## 2. Health Checks & Observability

- `GET /health` & `GET /health/live`: Process liveness probe (`200 OK`).
- `GET /health/ready`: Readiness probe actively executing `PING` against Redis (`200 OK` with store mode, active connections, and pending blunder timers when ready; `503 Service Unavailable` when required Redis is unreachable).
- `GET /metrics`: Operational metrics in Prometheus exposition format (`Accept: application/json` returns JSON; optionally protected with `Authorization: Bearer <METRICS_TOKEN>`).
- **Structured Logging**: JSON log lines via `utils/logger.ts` with `pid` metadata and automatic redaction of sensitive keys (`playerToken`, `token`, `lockToken`, `cards`, `yourCards`, `password`).

---

## 3. Socket.IO Event Contract (`shared/types/socket.types.ts`)

All incoming payloads are validated at runtime with Zod (`backend/src/validation/socket.schemas.ts`).

### Client → Server

| Event | Request Payload | Notes |
| :--- | :--- | :--- |
| `create-room` | `{ username, avatar }` | Creates room and returns `{ roomId, room, playerId, playerToken }` |
| `join-room` | `{ roomId, username, avatar }` | Lobby-only; locked against duplicate usernames and max 8 players |
| `get-room` | `roomId: string` | Returns sanitized `PublicRoom` |
| `rejoin-room` | `{ roomId, playerId, playerToken }` | Requires valid credentials for existing players in lobby, active, or finished games |
| `get-game-state` | `{ roomId, playerId, playerToken }` | Returns authoritative `GameStateResponse` for active or finished matches |
| `start-game` | `{ roomId, playerId, playerToken, cardsPerPlayer, rulePreset?, customRules?, ruleConfig? }` | Host-only, lobby-only, min 2 players, validates deck capacity and custom rule schema |
| `play-card` | `{ roomId, playerId, playerToken, cards, chosenSuit? }` | Active turn only; validates hand ownership & triggers blunder escrow on illegal play |
| `take-punishment` | `{ roomId, playerId, playerToken }` | Takes active punishment stack, draws 1 card, or passes turn after drawing |
| `revert-blunder` | `{ roomId, playerId, playerToken }` | Blunderer only, within revert window |
| `call-crazy` | `{ roomId, playerId, playerToken }` | Active opponents only, within challenge window |
| `no-revert` | `{ roomId }` | Always rejected; server timer resolves expired blunders |
| `leave-game` | `{ roomId, playerId, playerToken, isCreator? }` | Terminates room only if authenticated caller is actual `room.creatorId` |
| `play-again` | `{ roomId, playerId, playerToken }` | Host-only, requires `gameOver === true` and at least 2 players |

### Server → Client

| Event | Payload | Scope |
| :--- | :--- | :--- |
| `player-joined` | `{ player, players }` | Room |
| `player-rejoined` | `{ player, players }` | Room |
| `player-disconnected` | `{ playerId, players }` | Room |
| `player-left` | `{ username, avatar, players, creatorId }` | Room |
| `game-started` | `GameStartedPayload` | Per-player private socket |
| `game-update` | `GameUpdatePayload` | Per-player private socket |
| `game-event` | `GameEvent` | Room |
| `game-terminated` | `{ message }` | Room |
