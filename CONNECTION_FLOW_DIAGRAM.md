# WebSocket Connection Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER OPENS WEBSITE                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ConnectionManager Loads                          │
│  • Auto-calls connect()                                             │
│  • Sets up event listeners                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 Socket.IO Client Initialization                     │
│  • reconnection: true (infinite attempts)                           │
│  • reconnectionDelay: 1000ms                                        │
│  • transports: ['websocket', 'polling']                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  CONNECTED?     │
                    └─────────────────┘
                      │           │
                  YES │           │ NO
                      │           │
                      │           └──────────┐
                      │                      │
                      ▼                      ▼
        ┌──────────────────────┐   ┌──────────────────────┐
        │  Check sessionStorage│   │  Auto-Reconnect Loop │
        │  for saved state     │   │  • Exponential backoff│
        └──────────────────────┘   │  • Show "Reconnecting"│
                      │             │  • Red indicator      │
                      │             └──────────────────────┘
          ┌───────────┴───────────┐           │
          │                       │           │
     FOUND│                  NONE │           │
          │                       │           │
          ▼                       ▼           │
┌──────────────────┐    ┌──────────────────┐ │
│  REJOIN ROOM     │    │  Normal Flow     │ │
│  • emit rejoin   │    │  • User creates/ │ │
│  • Server updates│    │    joins room    │ │
│    socket ID     │    └──────────────────┘ │
│  • Get game state│                         │
└──────────────────┘                         │
          │                                  │
          │                                  │
          └──────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │      IN GAME / ROOM LOBBY      │
        │  • State saved to storage      │
        │  • Connection monitored        │
        └────────────────────────────────┘
                         │
                         │
        ┌────────────────┴─────────────────┐
        │                                  │
        ▼                                  ▼
┌──────────────────┐          ┌──────────────────────┐
│  DISCONNECTED    │          │   USER ACTION        │
│  • Save state    │          │   • Create room      │
│  • Show indicator│          │   • Join room        │
│  • Auto-reconnect│          │   • Start game       │
└──────────────────┘          │   • Play card        │
        │                     └──────────────────────┘
        │                                 │
        │                                 ▼
        │                     ┌──────────────────────┐
        │                     │   Save to Storage    │
        │                     │   • username         │
        │                     │   • avatar           │
        │                     │   • roomId           │
        └─────────────────────│   • isCreator        │
                              │   • gameStarted      │
                              └──────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────────┐
                              │  Connection Active   │
                              │  Monitoring:         │
                              │  • Network events    │
                              │  • Tab visibility    │
                              │  • Ping/Pong         │
                              └──────────────────────┘


═══════════════════════════════════════════════════════════════════════
                        RECONNECTION SCENARIOS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│  SCENARIO 1: PAGE REFRESH                                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. User refreshes page                                             │
│  2. New socket connection created                                   │
│  3. sessionStorage persists                                         │
│  4. connect event → check storage → rejoin-room                     │
│  5. Server updates socket ID                                        │
│  6. get-game-state fetches current state                            │
│  7. Game continues seamlessly                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SCENARIO 2: NETWORK DISCONNECT                                     │
├─────────────────────────────────────────────────────────────────────┤
│  1. Network drops (WiFi off, cable unplugged)                       │
│  2. disconnect event fires → save state                             │
│  3. Show "Reconnecting..." toast                                    │
│  4. Red pulsing indicator appears                                   │
│  5. Socket.IO retries (1s, 2s, 3s, 4s, 5s, 5s...)                  │
│  6. Network restored                                                │
│  7. reconnect event → rejoin flow                                   │
│  8. Success toast shown                                             │
│  9. Indicator disappears                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SCENARIO 3: SERVER RESTART                                         │
├─────────────────────────────────────────────────────────────────────┤
│  1. Backend server stops                                            │
│  2. All clients disconnect                                          │
│  3. State saved locally                                             │
│  4. Reconnection attempts continue                                  │
│  5. Server starts up                                                │
│  6. Redis has preserved room data                                   │
│  7. Clients reconnect                                               │
│  8. rejoin-room updates all socket IDs                              │
│  9. Game state restored from Redis                                  │
│  10. Gameplay resumes                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SCENARIO 4: TAB INACTIVE                                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. User switches to another tab                                    │
│  2. Browser may throttle connection                                 │
│  3. Ping/pong keeps connection alive (25s interval)                 │
│  4. If disconnected, state saved                                    │
│  5. User returns to tab                                             │
│  6. visibilitychange event fires                                    │
│  7. Check connection status                                         │
│  8. Reconnect if needed                                             │
└─────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════
                          BACKEND FLOW
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│                    Socket.IO Server (Backend)                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐   ┌──────────────┐
│  connection  │    │   rejoin-room    │   │ get-game-    │
│              │    │                  │   │  state       │
│ New client   │    │ 1. Find room     │   │              │
│ connects     │    │ 2. Match username│   │ Return full  │
│              │    │ 3. Update socketID│   │ game state  │
│              │    │ 4. Notify others │   │ for player   │
└──────────────┘    │ 5. Return room   │   └──────────────┘
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Room Service   │
                    │                  │
                    │  rejoinRoom():   │
                    │  • Find by roomId│
                    │  • Find player   │
                    │    by username   │
                    │  • Update id     │
                    │  • Save to Redis │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │      Redis       │
                    │                  │
                    │  Persistent      │
                    │  game state      │
                    │  (4 hour TTL)    │
                    └──────────────────┘


═══════════════════════════════════════════════════════════════════════
                      CONNECTION MONITORING
═══════════════════════════════════════════════════════════════════════

Browser Events Monitored:
┌──────────────────────────────────────────────────────────────────────┐
│  online         →  Network restored    →  Reconnect                  │
│  offline        →  Network lost        →  Show warning               │
│  visibilitychange → Tab focused       →  Check connection            │
└──────────────────────────────────────────────────────────────────────┘

Socket.IO Events:
┌──────────────────────────────────────────────────────────────────────┐
│  connect              →  Connection established                       │
│  disconnect           →  Connection lost                              │
│  reconnect            →  Reconnection successful                      │
│  reconnect_attempt    →  Retry in progress                            │
│  reconnect_error      →  Retry failed                                 │
│  connect_error        →  Connection failed                            │
└──────────────────────────────────────────────────────────────────────┘

Server Heartbeat:
┌──────────────────────────────────────────────────────────────────────┐
│  Ping   →  Every 25 seconds                                          │
│  Pong   →  Client responds                                           │
│  Timeout → 60 seconds (disconnect if no pong)                        │
└──────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════
                        VISUAL INDICATORS
═══════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────┐
│  CONNECTED STATE                                                   │
│  • No indicator shown                                              │
│  • Normal operation                                                │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  DISCONNECTED STATE                                                │
│                                                                    │
│  ┌──────────────────────────────────────┐  ← Top Right Corner     │
│  │  🔴 Reconnecting...                  │    (Animated Pulse)     │
│  └──────────────────────────────────────┘                         │
│                                                                    │
│  + Toast: "Reconnecting to server..." (loading spinner)           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  RECONNECTED STATE                                                 │
│  • Toast: "Connected to server" (success, 3 seconds)              │
│  • Indicator disappears                                            │
└────────────────────────────────────────────────────────────────────┘
```
