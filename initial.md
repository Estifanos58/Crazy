# 🎮 Crazy Multiplayer Card Game – Project Setup Instructions for Claude

You are Claude, an AI engineer assisting in building a full-stack **real-time online multiplayer card game** called **Crazy**.  
Follow all instructions strictly.

---

# 📌 PROJECT OVERVIEW

We are building a **fullstack online multiplayer card game** (“Crazy”) using:

- **Frontend**: Next.js (App Router), TypeScript, TailwindCSS  
- **Backend**: Express.js + TypeScript  
- **WebSockets**: Socket.IO  
- **Database / Cache**: Redis  
- **Extra**: QR code generation, Room join via URL, Telegram Mini App compatibility later

The game must support:

1. Landing page → Game selection (only “Crazy” for now)
2. Modal: Choose mode (only multiplayer active)
3. Modal: Enter username + select avatar
4. Backend: Create room with 6-digit room ID
5. Frontend: Generate QR code → scanning opens URL + room ID
6. Players joining see same username/avatar modal
7. WebSockets broadcast new users joining
8. Creator sets rules + number of cards
9. Backend:
   - Shuffles 52-card deck
   - Deals cards to each user
   - Gives +1 extra card to starting user
   - Stores all game state in Redis
10. Backend sends each user their private card hand
11. Game begins in real-time
12. Future support for single-player vs AI

---

# 📌 CLAUDE RULES (FOLLOW STRICTLY)

### **1. Code Generation Rules**
- Use **Next.js App Router** → `app/` directory
- Use **TailwindCSS** for UI
- Use **TypeScript everywhere**
- Use **Zustand** for frontend state if needed
- Use **Socket.IO** client in Next.js
- Use **Express.js** backend with:
  - Socket.IO server
  - Redis (using ioredis or redis client)
  - TypeScript project structure
- Organize backend in:
