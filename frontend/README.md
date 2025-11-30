# Crazy Game Frontend

Frontend application for the Crazy multiplayer card game built with Next.js, TypeScript, and TailwindCSS.

## Features

- Next.js 14 with App Router
- Real-time WebSocket connection with Socket.IO
- State management with Zustand
- TailwindCSS for styling
- QR code generation for easy room joining
- Responsive design for mobile and desktop

## Prerequisites

- Node.js (v16 or higher)
- Backend server running (see backend README)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Running the Application

### Development mode:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production mode:
```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── game/[roomId]/    # Game play page
│   ├── room/[roomId]/    # Room lobby page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   └── globals.css       # Global styles
├── components/
│   ├── Card.tsx          # Card component
│   ├── CardHand.tsx      # Card hand component
│   ├── Modal.tsx         # Modal component
│   ├── PlayerList.tsx    # Player list component
│   └── UserInfoModal.tsx # User info input modal
├── lib/
│   └── store.ts          # Zustand state management
├── types/
│   └── game.types.ts     # TypeScript type definitions
└── public/               # Static assets
```

## Game Flow

1. **Landing Page** (`/`)
   - Select game (Crazy)
   - Choose mode (Multiplayer)
   - Enter username and avatar

2. **Room Lobby** (`/room/[roomId]`)
   - View players in the room
   - Share QR code for joining
   - Host can configure game settings
   - Host starts the game

3. **Game Page** (`/game/[roomId]`)
   - View your cards
   - Play cards on your turn
   - See other players' status

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS framework
- **Socket.IO Client** - Real-time WebSocket communication
- **Zustand** - State management
- **qrcode.react** - QR code generation
- **Lucide React** - Icon library

## License

MIT
