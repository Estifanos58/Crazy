# 🎮 Crazy - Real-Time Multiplayer Card Game

A secure, authoritative full-stack multiplayer card game built with **TypeScript**, **Next.js 14**, **Express.js**, **Socket.IO**, and **Redis**.

Featuring real-time card gameplay, server-side blunder enforcement, custom action cards, atomic concurrency control, session-token security, and zero card-duplication guarantees.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Game Rules & Mechanics](#-game-rules--mechanics)
  - [Card Matching](#card-matching)
  - [Special & Action Cards](#special--action-cards)
  - [Blunder & "Crazy" Challenge Mechanism](#blunder--crazy-challenge-mechanism)
- [Architecture & Security](#-architecture--security)
  - [Authoritative Backend](#authoritative-backend)
  - [Session Tokens & Reconnection](#session-tokens--reconnection)
  - [Concurrency Control & Distributed Locks](#concurrency-control--distributed-locks)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Running with Docker Compose](#running-with-docker-compose-recommended)
  - [Running Locally](#running-locally)
- [Environment Variables](#-environment-variables)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [WebSocket API Reference](#-websocket-api-reference)

---

## 🌟 Overview

"Crazy" is an interactive multiplayer card game where players race to empty their hands. Players must match the rank or suit of the current top card, unleash special action cards (skips, reverses, draw penalties, and suit declarations), and call out blunders when opponents play illegal moves.

Key highlights of this implementation:
- **Authoritative Server**: All card validations, draw operations, blunder timers, and state transitions execute strictly on the backend.
- **Cheating & Forgery Prevention**: Cards are validated against server-held player hands. Out-of-turn plays, forged card IDs, and duplicate card submissions are unconditionally rejected.
- **Zero Card Duplication**: Robust transactional blunder state tracking ensures cards cannot be cloned through rapid calls, timeouts, or reconnections.
- **Resilient Reconnection**: Players can disconnect and rejoin seamlessly using private cryptographic session tokens without losing hand state or room status.
- **Race Condition Immunity**: Distributed Redis locks and in-memory queue serialization guarantee that simultaneous card plays or challenges never corrupt room state.

---

## 🃏 Game Rules & Mechanics

### Card Matching
- Players take turns matching either the **suit** or the **rank** of the active top card on the discard pile.
- When an active punishment chain is in effect (e.g. Draw 2 / Draw 3), players must either stack matching punishment cards or accept the penalty.

### Special & Action Cards

| Card | Action / Effect | Description |
| :--- | :--- | :--- |
| **Ace (A)** | Suit Match / Reset | Standard matching; can be played on matching suit or rank. |
| **2 & 3** | Punishment Attack | Inflicts draw penalties (+2 or +3 cards). Can be countered/stacked with another matching penalty card. |
| **5** | Reverse Direction | Inverts the turn order (clockwise ↔ counter-clockwise). In 2-player games, acts as a skip. |
| **7** | Skip / Multi-Drop | Skips the next player's turn. Allows multi-card drops of identical rank (all 7s). |
| **8 & Jack (J)** | Wild / Suit Change | Allows the player to change the active suit to Hearts, Diamonds, Clubs, or Spades. |

> **Consecutive Suit Change Rule**: A player cannot play back-to-back suit-change cards (e.g. Jack following an 8) to repeatedly change suits without an intervening card from another player.

### Blunder & "Crazy" Challenge Mechanism

If an illegal move is played (e.g. mismatched suit/rank when no special card applies):
1. The play enters a **Blunder State** and initiates a server-enforced countdown (default: 5 seconds).
2. The offending cards are temporarily held in escrow by the server.
3. **Revert Blunder**: The active player can acknowledge the blunder and retrieve their cards before the countdown expires.
4. **Call "Crazy"**: Any opponent can challenge the blunder by calling "Crazy".
   - If the challenge is valid (a blunder occurred), the offending player must take back their cards **plus draw 2 penalty cards**.
   - If challenged falsely on a legal move, the challenger takes 2 penalty cards.
5. **Timeout**: If the timer expires with no action, the blunder is accepted and play proceeds to the next turn without duplicating cards.

---

## 🏗️ Architecture & Security

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
│  - Zustand State Store  - QR Code Generation  - Sonner      │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket (Socket.IO)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express + Socket.IO Backend                │
│  - Auth Middleware & Session Token Verification             │
│  - GameOrchestrator (State Transitions & Deck Logic)        │
│  - MoveValidator & PunishmentChainManager                   │
│  - BlunderTimerService                                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Lock Acquisition & State Cache
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Redis Store                           │
│  - Distributed Mutex Lock (SET NX PX + Lua release)         │
│  - Room & Game State Persistence                            │
└─────────────────────────────────────────────────────────────┘
```

### Authoritative Backend
- Card decks are generated, shuffled, and dealt exclusively on the server.
- The server emits sanitized game states to clients, ensuring opponent hand cards remain completely private (`cardCount` visible, actual card values hidden).

### Session Tokens & Reconnection
- On room creation or join, each player receives a unique `playerId` and an unguessable `playerToken`.
- All subsequent socket actions (`play-card`, `call-crazy`, `leave-game`, etc.) require valid credentials.
- Reconnection checks both active players and finished/spectating players, seamlessly re-authenticating the user.
- Host termination actions verify that only the actual room creator can end or modify the lobby.

### Concurrency Control & Distributed Locks
- Critical state mutations are guarded by `LockService`, which acquires an atomic distributed lock via Redis `SET key value NX PX <ttl>` and releases safely using a Lua script.
- A local per-room Promise queue provides fast serialized execution within the Node.js process, preventing interleaved state updates.

---

## 💻 Tech Stack

- **Backend**: Node.js, Express, Socket.IO, TypeScript, Redis (ioredis), Nanoid
- **Frontend**: Next.js 14 (App Router), React 18, Zustand, Tailwind CSS, Framer Motion, Lucide Icons, Sonner
- **Testing**: Node.js Test Runner (`node:test`), Node Assert
- **DevOps**: Docker, Docker Compose, GitHub Actions CI

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or v20
- [Docker](https://www.docker.com/) & Docker Compose (optional, for containerized run)
- [Redis](https://redis.io/) (if running locally without Docker)

### Running with Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd Crazy
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Build and launch the containers:
   ```bash
   docker compose up --build
   ```

4. Open your browser:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:3001](http://localhost:3001)

### Running Locally

#### 1. Start Redis
```bash
docker run -d -p 6379:6379 --name crazy-redis redis:7-alpine
```

#### 2. Run Backend
```bash
cd backend
cp .env.example .env
npm install
npm run build
npm run dev
```

#### 3. Run Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | HTTP and WebSocket server port |
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | *(empty)* | Optional Redis authentication password |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origin for CORS & WebSockets |
| `NODE_ENV` | `development` | Node environment (`development` / `production`) |

### Frontend Configuration (`frontend/.env.local`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Backend Socket.IO endpoint URL |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Base URL for QR codes and room links |

---

## 🧪 Testing & Quality Assurance

The backend includes a comprehensive automated test suite covering game rules, authorization, blunder integrity, and concurrency:

```bash
cd backend
npm test
```

### Test Coverage Highlights:
- **Game Rules** (`rules.test.ts`):
  - Single card matching (rank & suit).
  - Wild suit changes (Jack & 8).
  - Multi-card 7 drops and turn skips.
  - Direction reversal (5) in multi-player and 2-player settings.
  - Consecutive suit change prevention.
  - Punishment chain accumulation and stacking.
- **Security & Authorization** (`security-and-auth.test.ts`):
  - Out-of-turn card play rejection.
  - Duplicate card ID rejection.
  - Card forgery rejection (cards not in player's server hand).
  - Room termination permission enforcement (only creator can terminate).
  - Token-based player authentication.
- **Blunders & Reconnection** (`blunder-and-reconnection.test.ts`):
  - Blunder detection and zero-card-duplication recovery on revert and crazy calls.
  - Disconnect and reconnect flow for active and finished players.
  - Play-again game reset preserving player rosters.
- **Concurrency** (`concurrency.test.ts`):
  - Serialized atomic execution under simulated concurrent load.

---

## 📡 WebSocket API Reference

### Client → Server Events

| Event | Payload | Description |
| :--- | :--- | :--- |
| `create-room` | `{ username, avatar, settings }` | Creates a new game room |
| `join-room` | `{ roomId, username, avatar }` | Joins an existing room |
| `start-game` | `{ roomId, playerId, playerToken }` | Starts the game (host only) |
| `play-card` | `{ roomId, playerId, playerToken, cardId, chosenSuit, targetPlayerId, additionalCardIds }` | Plays one or more cards |
| `revert-blunder` | `{ roomId, playerId, playerToken }` | Cancels a blunder during countdown |
| `no-revert` | `{ roomId, playerId, playerToken }` | Accepts the blunder without reverting |
| `call-crazy` | `{ roomId, playerId, playerToken }` | Challenges an opponent's blunder |
| `take-punishment` | `{ roomId, playerId, playerToken }` | Accepts accumulated penalty cards |
| `leave-game` | `{ roomId, playerId, playerToken, isCreator }` | Leaves or terminates a room |
| `play-again` | `{ roomId, playerId, playerToken }` | Restarts the game after completion |
| `reconnect` | `{ roomId, playerId, playerToken }` | Reconnects to an in-progress game |

### Server → Client Events

| Event | Payload | Description |
| :--- | :--- | :--- |
| `game-state-updated` | `GameStateResponse` | Authoritative public game state broadcast |
| `room-created` | `{ room, playerId, playerToken }` | Emitted to room creator on creation |
| `room-joined` | `{ room, playerId, playerToken }` | Emitted to player upon joining |
| `game-started` | `GameStateResponse` | Emitted when the game begins |
| `game-ended` | `{ winner, leaderboard }` | Emitted when the game finishes |
| `error` | `{ message, code }` | Emitted when an action is rejected |
