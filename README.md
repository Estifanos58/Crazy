# 🎮 Crazy - Multiplayer Card Game

A full-stack real-time multiplayer card game built with Next.js, Express.js, Socket.IO, and Redis.

## 🚀 Features

- **Real-time Multiplayer**: Play with friends in real-time using WebSockets
- **Room System**: Create or join game rooms with unique 6-digit codes
- **QR Code Sharing**: Share room links via QR code for easy joining
- **Avatar Selection**: Choose from 12 fun avatars
- **Customizable Rules**: Host can set cards per player and custom rules
- **Responsive Design**: Works on desktop and mobile devices
- **State Persistence**: Game state stored in Redis for reliability

## 📁 Project Structure

```
Crazy/
├── backend/              # Express.js + Socket.IO backend
│   ├── src/
│   │   ├── config/      # Redis configuration
│   │   ├── controllers/ # Socket.IO event handlers
│   │   ├── services/    # Business logic (Room, Card services)
│   │   ├── types/       # TypeScript types
│   │   └── server.ts    # Main server file
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/            # Next.js frontend
│   ├── app/            # App Router pages
│   │   ├── game/       # Game play page
│   │   ├── room/       # Room lobby
│   │   └── page.tsx    # Landing page
│   ├── components/     # React components
│   ├── lib/            # Utilities and state management
│   ├── types/          # TypeScript types
│   └── package.json
│
└── README.md           # This file
```

## 🛠️ Prerequisites

- **Node.js** (v16 or higher)
- **Redis** server (local or remote)
- **npm** or **yarn**

## 📦 Installation

### 1. Clone the repository

```bash
cd Crazy
```

### 2. Setup Backend

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration
# PORT=3001
# REDIS_HOST=localhost
# REDIS_PORT=6379
# CORS_ORIGIN=http://localhost:3000
```

### 3. Setup Frontend

```bash
cd ../frontend
npm install

# Create .env.local file
cp .env.local.example .env.local

# Edit .env.local with your configuration
# NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
# NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Start Redis

Make sure Redis is running:

```bash
# Windows (if installed via Chocolatey or MSI)
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

## 🚀 Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:3001`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:3000`

## 🎯 How to Play

1. **Open the app** at `http://localhost:3000`
2. **Click "Play Now"**
3. **Select "Crazy Card Game"**
4. **Choose "Multiplayer" mode**
5. **Enter your username** and **select an avatar**
6. **Share the room link** or **QR code** with friends
7. **Wait for players** to join
8. **Host configures settings** (cards per player)
9. **Host starts the game**
10. **Play your cards** when it's your turn!

## 🔧 Technology Stack

### Backend
- **Express.js** - Web framework
- **Socket.IO** - Real-time WebSocket communication
- **Redis** - Game state storage
- **TypeScript** - Type safety
- **Nanoid** - Room ID generation

### Frontend
- **Next.js 14** - React framework with App Router
- **Socket.IO Client** - WebSocket client
- **Zustand** - State management
- **TailwindCSS** - Styling
- **QRCode.react** - QR code generation
- **Lucide React** - Icons

## 📡 WebSocket Events

### Client → Server
- `create-room` - Create a new game room
- `join-room` - Join an existing room
- `start-game` - Start the game (host only)
- `get-room` - Get room information

### Server → Client
- `player-joined` - Broadcast when a new player joins
- `game-started` - Game has started with card distribution

## 🔐 Environment Variables

### Backend (.env)
```env
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🐛 Troubleshooting

### Redis Connection Error
- Make sure Redis is running on the configured port
- Check Redis credentials in `.env`

### CORS Error
- Verify `CORS_ORIGIN` in backend `.env` matches frontend URL
- Ensure both servers are running

### WebSocket Connection Failed
- Check `NEXT_PUBLIC_BACKEND_URL` in frontend `.env.local`
- Verify backend server is running

## 🚀 Production Deployment

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm start
```

## 📝 Future Enhancements

- [ ] Single-player mode with AI
- [ ] Game replay and history
- [ ] Player rankings and statistics
- [ ] Chat system
- [ ] Multiple game rooms per server
- [ ] Telegram Mini App integration
- [ ] Sound effects and animations
- [ ] Mobile app (React Native)

## 📄 License

MIT

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🎮 Game Rules

The "Crazy" card game follows traditional card game rules where:
- Each player receives a set number of cards (configurable by host)
- The starting player receives one extra card
- Players take turns playing cards
- Custom rules can be set by the host

---

**Enjoy playing Crazy! 🎴🎉**
