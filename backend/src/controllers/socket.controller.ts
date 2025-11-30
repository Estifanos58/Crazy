import type { Server, Socket } from 'socket.io';
import { RoomService } from '../services/room.service';
import { RuleService } from '../services/rule.service';
import type { JoinRoomData, StartGameData, Card, Suit, GameState } from '../types/game.types';

export class SocketController {
  static setupSocketHandlers(io: Server): void {
    io.on('connection', (socket: Socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Create new room
      socket.on('create-room', async (data: { username: string; avatar: string }, callback) => {
        try {
          const room = await RoomService.createRoom(socket.id, data.username, data.avatar);
          
          // Join socket room
          socket.join(room.roomId);
          
          callback({ success: true, room });
          console.log(`🎮 Room created: ${room.roomId} by ${data.username}`);
        } catch (error) {
          console.error('Error creating room:', error);
          callback({ success: false, error: 'Failed to create room' });
        }
      });

      // Join existing room
      socket.on('join-room', async (data: JoinRoomData, callback) => {
        try {
          const room = await RoomService.joinRoom(socket.id, data);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          // Join socket room
          socket.join(room.roomId);
          
          // Notify all players in the room
          io.to(room.roomId).emit('player-joined', {
            player: room.players.find(p => p.id === socket.id),
            players: room.players,
          });

          callback({ success: true, room });
          console.log(`👤 ${data.username} joined room: ${data.roomId}`);
        } catch (error) {
          console.error('Error joining room:', error);
          callback({ success: false, error: (error as Error).message });
        }
      });

      // Start game
      socket.on('start-game', async (data: StartGameData, callback) => {
        try {
          const room = await RoomService.getRoom(data.roomId);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          if (room.creatorId !== socket.id) {
            callback({ success: false, error: 'Only creator can start the game' });
            return;
          }

          const updatedRoom = await RoomService.startGame(data);
          
          if (!updatedRoom) {
            callback({ success: false, error: 'Failed to start game' });
            return;
          }

          // Send private cards to each player
          updatedRoom.players.forEach(player => {
            io.to(player.id).emit('game-started', {
              yourCards: player.cards,
              currentTurn: updatedRoom.currentTurn,
              rules: updatedRoom.rules,
              players: updatedRoom.players.map(p => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
                cardCount: p.cards.length,
                isCreator: p.isCreator,
              })),
            });
          });

          callback({ success: true });
          console.log(`🎮 Game started in room: ${data.roomId}`);
        } catch (error) {
          console.error('Error starting game:', error);
          callback({ success: false, error: (error as Error).message });
        }
      });

      // Get room info
      socket.on('get-room', async (roomId: string, callback) => {
        try {
          const room = await RoomService.getRoom(roomId);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          callback({ success: true, room });
        } catch (error) {
          console.error('Error getting room:', error);
          callback({ success: false, error: 'Failed to get room' });
        }
      });

      // Play card(s)
      socket.on('play-card', async (data: { roomId: string; cards: Card[]; chosenSuit?: Suit }, callback) => {
        try {
          const room = await RoomService.getRoom(data.roomId);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          // Convert room to game state
          const gameState: GameState = {
            roomId: room.roomId,
            players: room.players,
            deck: room.deck,
            pile: room.pile || [],
            currentTurn: room.currentTurn!,
            currentSuit: room.currentSuit || data.cards[0].suit,
            turnDirection: room.turnDirection || 'clockwise',
            punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
            ruleConfig: room.ruleConfig,
            gameStarted: room.gameStarted,
            gameEnded: false,
          };

          // Validate move (but allow blunders)
          const validation = RuleService.validateMove(gameState, socket.id, data.cards);
          
          const isBlunder = !validation.valid && validation.canChallengeCrazy;

          // Apply card effects
          const { updatedState, events } = RuleService.applyCardEffects(
            gameState,
            socket.id,
            data.cards,
            data.chosenSuit
          );

          // Add blunder event if invalid move
          if (isBlunder) {
            events.push({
              type: 'invalid-move',
              payload: {
                playerId: socket.id,
                reason: validation.errors?.join(', ') || 'Invalid move',
                canBeChallenged: true,
              },
            });
          }

          // Update room with new state
          room.players = updatedState.players;
          room.deck = updatedState.deck;
          room.pile = updatedState.pile;
          room.currentTurn = updatedState.currentTurn;
          room.currentSuit = updatedState.currentSuit;
          room.turnDirection = updatedState.turnDirection;
          room.punishmentChain = updatedState.punishmentChain;

          await RoomService.saveRoom(room);

          // Broadcast events to all players
          events.forEach(event => {
            io.to(room.roomId).emit('game-event', event);
          });

          // Notify all players of game state update
          room.players.forEach(player => {
            io.to(player.id).emit('game-update', {
              yourCards: player.cards,
              currentTurn: room.currentTurn,
              currentSuit: room.currentSuit,
              topCard: room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : null,
              punishmentChain: room.punishmentChain,
              players: room.players.map(p => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
                cardCount: p.cards.length,
                isCreator: p.isCreator,
              })),
            });
          });

          callback({ success: true });
          console.log(`🎴 ${socket.id} played ${data.cards.length} card(s) in room ${data.roomId}`);
        } catch (error) {
          console.error('Error playing card:', error);
          callback({ success: false, error: (error as Error).message });
        }
      });

      // Take punishment cards
      socket.on('take-punishment', async (data: { roomId: string }, callback) => {
        try {
          const room = await RoomService.getRoom(data.roomId);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          const gameState: GameState = {
            roomId: room.roomId,
            players: room.players,
            deck: room.deck,
            pile: room.pile || [],
            currentTurn: room.currentTurn!,
            currentSuit: room.currentSuit!,
            turnDirection: room.turnDirection || 'clockwise',
            punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
            ruleConfig: room.ruleConfig,
            gameStarted: room.gameStarted,
            gameEnded: false,
          };

          const { updatedState, events } = RuleService.takePunishmentCards(gameState, socket.id);

          room.players = updatedState.players;
          room.deck = updatedState.deck;
          room.currentTurn = updatedState.currentTurn;
          room.punishmentChain = updatedState.punishmentChain;

          await RoomService.saveRoom(room);

          events.forEach(event => {
            io.to(room.roomId).emit('game-event', event);
          });

          room.players.forEach(player => {
            io.to(player.id).emit('game-update', {
              yourCards: player.cards,
              currentTurn: room.currentTurn,
              currentSuit: room.currentSuit,
              topCard: room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : null,
              punishmentChain: room.punishmentChain,
              players: room.players.map(p => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
                cardCount: p.cards.length,
                isCreator: p.isCreator,
              })),
            });
          });

          callback({ success: true });
          console.log(`📥 ${socket.id} took punishment cards in room ${data.roomId}`);
        } catch (error) {
          console.error('Error taking punishment:', error);
          callback({ success: false, error: (error as Error).message });
        }
      });

      // Call "Crazy" on illegal turn
      socket.on('call-crazy', async (data: { roomId: string; targetPlayerId: string }, callback) => {
        try {
          const room = await RoomService.getRoom(data.roomId);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          const gameState: GameState = {
            roomId: room.roomId,
            players: room.players,
            deck: room.deck,
            pile: room.pile || [],
            currentTurn: room.currentTurn!,
            currentSuit: room.currentSuit!,
            turnDirection: room.turnDirection || 'clockwise',
            punishmentChain: room.punishmentChain || { active: false, amount: 0, cards: [] },
            ruleConfig: room.ruleConfig,
            gameStarted: room.gameStarted,
            gameEnded: false,
          };

          const { updatedState, events } = RuleService.applyIllegalTurnPenalty(
            gameState,
            data.targetPlayerId,
            socket.id
          );

          room.players = updatedState.players;
          room.deck = updatedState.deck;

          await RoomService.saveRoom(room);

          events.forEach(event => {
            io.to(room.roomId).emit('game-event', event);
          });

          callback({ success: true });
          console.log(`🚨 ${socket.id} called crazy on ${data.targetPlayerId}`);
        } catch (error) {
          console.error('Error calling crazy:', error);
          callback({ success: false, error: (error as Error).message });
        }
      });

      // Rejoin room after reconnection
      socket.on('rejoin-room', async (data: { roomId: string; username: string; avatar: string }, callback) => {
        try {
          const room = await RoomService.rejoinRoom(socket.id, data.roomId, data.username, data.avatar);
          
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          // Join socket room
          socket.join(room.roomId);
          
          // Notify all players about the reconnection
          io.to(room.roomId).emit('player-rejoined', {
            player: room.players.find(p => p.id === socket.id),
            players: room.players,
          });

          callback({ success: true, room });
          console.log(`🔄 ${data.username} rejoined room: ${data.roomId}`);
        } catch (error) {
          console.error('Error rejoining room:', error);
          callback({ success: false, error: (error as Error).message });
        }
      });

      // Get current game state
      socket.on('get-game-state', async (data: { roomId: string }, callback) => {
        try {
          const room = await RoomService.getRoom(data.roomId);
          
          if (!room || !room.gameStarted) {
            callback({ success: false, error: 'Game not found or not started' });
            return;
          }

          const player = room.players.find(p => p.id === socket.id);
          
          if (!player) {
            callback({ success: false, error: 'Player not in game' });
            return;
          }

          const gameState = {
            yourCards: player.cards,
            currentTurn: room.currentTurn || null,
            currentSuit: room.currentSuit || null,
            topCard: room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : null,
            punishmentChain: room.punishmentChain || null,
            players: room.players.map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              cardCount: p.cards.length,
              isCreator: p.isCreator,
              cards: [], // Don't send other players' cards
            })),
          };

          callback({ success: true, state: gameState });
        } catch (error) {
          console.error('Error getting game state:', error);
          callback({ success: false, error: 'Failed to get game state' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        // Player data is preserved in Redis for reconnection
      });
    });
  }
}
