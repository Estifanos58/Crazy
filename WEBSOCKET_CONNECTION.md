# WebSocket Connection Management

## Overview

This document describes the robust WebSocket connection system implemented to maintain persistent connections between clients and the server, with automatic reconnection and state restoration capabilities.

## Features

### 1. **Automatic Connection Management**
- Connection is established automatically when the website loads
- Connection persists throughout the user session
- No manual connection required from users

### 2. **Automatic Reconnection**
- Infinite reconnection attempts with exponential backoff
- Initial retry delay: 1 second
- Maximum retry delay: 5 seconds
- Transport fallback from WebSocket to polling if needed

### 3. **State Persistence**
- User state saved to sessionStorage
- State includes: username, avatar, roomId, isCreator, gameStarted
- State persists across page refreshes and reconnections

### 4. **State Restoration**
- Automatic room rejoin after reconnection
- Player socket ID updated on server
- Full game state restoration if game was in progress
- Seamless experience for users

### 5. **Network Resilience**
- Handles network offline/online events
- Detects tab focus/blur and reconnects if needed
- Visual connection status indicator
- Toast notifications for connection status

## Architecture

### Frontend Components

#### ConnectionManager
Location: `frontend/components/ConnectionManager.tsx`

- Manages WebSocket lifecycle
- Displays connection status indicator
- Handles browser events (online/offline, visibility change)
- Shows reconnection toasts

#### Store (Zustand)
Location: `frontend/lib/store.ts`

**Connection Configuration:**
```typescript
{
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  transports: ['websocket', 'polling'],
  upgrade: true,
}
```

**Event Handlers:**
- `connect` - Handles initial connection and state restoration
- `disconnect` - Saves state to sessionStorage
- `reconnect` - Logs reconnection success
- `reconnect_attempt` - Logs retry attempts
- `reconnect_error` - Logs errors
- `reconnect_failed` - Handles complete failure
- `connect_error` - Handles connection errors

**State Persistence:**
- `saveStateToStorage()` - Saves state to sessionStorage
- `restoreStateFromStorage()` - Restores state from sessionStorage

### Backend Components

#### Server Configuration
Location: `backend/src/server.ts`

**Socket.IO Settings:**
```typescript
{
  pingTimeout: 60000,      // 60 seconds
  pingInterval: 25000,     // 25 seconds
  upgradeTimeout: 30000,   // 30 seconds
  maxHttpBufferSize: 1e8,  // 100 MB
  transports: ['websocket', 'polling'],
  allowEIO3: true,
}
```

#### Socket Handlers
Location: `backend/src/controllers/socket.controller.ts`

**New Handlers:**
- `rejoin-room` - Handles player reconnection
- `get-game-state` - Returns current game state for reconnected players

#### Room Service
Location: `backend/src/services/room.service.ts`

**New Method:**
- `rejoinRoom()` - Updates socket ID for reconnected players

## Connection Flow

### Initial Connection
1. User opens website
2. ConnectionManager auto-establishes WebSocket connection
3. User creates/joins room
4. State saved to sessionStorage

### Reconnection Flow
1. Connection lost (network issue, server restart, etc.)
2. Socket.IO begins automatic reconnection attempts
3. State persists in sessionStorage
4. Connection re-established
5. `rejoin-room` event sent with saved credentials
6. Server updates player socket ID
7. If game started, `get-game-state` fetches current state
8. User experience resumes seamlessly

### State Restoration
1. User refreshes page or closes/reopens browser tab
2. ConnectionManager establishes new connection
3. Store retrieves state from sessionStorage
4. Auto-joins previous room if exists
5. Game state fully restored

## User Experience

### Visual Indicators
- **Connected**: No indicator (normal operation)
- **Disconnected**: Red pulsing indicator in top-right corner
- **Reconnecting**: Toast notification "Reconnecting to server..."
- **Reconnected**: Success toast "Connected to server"

### Error Handling
- Network offline: "Network connection lost" toast
- Room not found: Session cleared, user can create new room
- Connection errors: Automatic retry with visual feedback

## Best Practices

### For Users
- Keep browser tab open during games
- Network interruptions are handled automatically
- Page refreshes will restore your game

### For Developers
- Don't manually call `connect()` - ConnectionManager handles it
- State is automatically saved on important events
- Trust the automatic reconnection system
- Use sessionStorage for persistence, not localStorage (clears on session end)

## Debugging

### Connection Issues
Check browser console for:
- `✅ Connected to server` - Successful connection
- `🔄 Reconnection attempt N` - Retry in progress
- `❌ Connection error` - Connection failed
- `🔄 Player reconnected to room` - Rejoin successful

### State Issues
Check sessionStorage:
```javascript
// In browser console
console.log(sessionStorage.getItem('crazy-game-state'));
```

### Server Issues
Check server logs for:
- `✅ Client connected: [socketId]`
- `🔄 Player [username] reconnected to room [roomId]`
- `❌ Client disconnected: [socketId]`

## Configuration

### Timeouts
Adjust in `backend/src/server.ts`:
- `pingTimeout` - How long to wait for pong
- `pingInterval` - How often to ping
- `upgradeTimeout` - How long to wait for upgrade

### Reconnection
Adjust in `frontend/lib/store.ts`:
- `reconnectionDelay` - Initial delay
- `reconnectionDelayMax` - Maximum delay
- `reconnectionAttempts` - Max attempts (currently Infinity)

## Security Considerations

- SessionStorage is origin-specific (secure)
- Socket IDs regenerated on each connection
- No sensitive data stored in sessionStorage
- Server validates all rejoin requests
- Player identity verified by username/avatar match

## Performance

### Optimization
- Single WebSocket connection per client
- Efficient state serialization
- Minimal reconnection overhead
- Fallback to polling only when needed

### Monitoring
- Connection status tracked in real-time
- Event logging for debugging
- Performance metrics available via Socket.IO admin UI

## Future Enhancements

Potential improvements:
- [ ] Add connection quality indicator
- [ ] Implement offline mode with local gameplay
- [ ] Add reconnection history tracking
- [ ] Implement server-side session management
- [ ] Add support for multiple simultaneous connections
