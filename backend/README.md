# Crazy Game Backend

Backend server for the Crazy multiplayer card game built with Express.js, Socket.IO, and Redis.

## Features

- RESTful API with Express.js
- Real-time WebSocket communication with Socket.IO
- Redis for game state management
- TypeScript for type safety
- Card deck management and distribution

## Prerequisites

- Node.js (v16 or higher)
- Redis server running locally or remotely

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

## Running the Server

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files (Redis)
│   ├── controllers/     # Socket.IO event handlers
│   ├── services/        # Business logic (Room, Card services)
│   ├── types/           # TypeScript type definitions
│   └── server.ts        # Main server file
├── dist/                # Compiled JavaScript
├── package.json
└── tsconfig.json
```

## Socket.IO Events

### Client → Server:
- `create-room` - Create a new game room
- `join-room` - Join an existing room
- `start-game` - Start the game (creator only)
- `get-room` - Get room information

### Server → Client:
- `player-joined` - New player joined the room
- `game-started` - Game has started with card distribution

## API Endpoints

- `GET /health` - Health check endpoint

## License

MIT
