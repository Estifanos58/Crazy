import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { RuleService } from '../../services/rule.service';
import type { GameState } from '../../types/game.types';

export class PunishmentHandler {
  static handle(socket: Socket, io: Server): void {
    // Handle taking punishment or drawing a single card
    socket.on('take-punishment', async (data: { roomId: string }, callback) => {
      try {
        const room = await RoomService.getRoom(data.roomId);
        
        if (!room) {
          callback({ success: false, error: 'Room not found' });
          return;
        }

        // Initialize drawCount if not set
        if (room.drawCount === undefined) {
          room.drawCount = 0;
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

        let events;
        let updatedState;
        let shouldAdvanceTurn = false;

        // Check if there's an active punishment chain
        if (gameState.punishmentChain.active && gameState.punishmentChain.amount > 0) {
          // Take punishment cards - turn passes immediately after taking punishment
          const result = RuleService.takePunishmentCards(gameState, socket.id);
          updatedState = result.updatedState;
          events = result.events;
          shouldAdvanceTurn = true;
          room.drawCount = 0; // Reset draw count - turn will pass
          console.log(`📥 ${socket.id} took ${gameState.punishmentChain.amount} punishment cards in room ${data.roomId} - turn advances`);
        } else {
          // Draw a single card
          room.drawCount++;
          
          if (room.drawCount >= 2) {
            // Second draw - advance turn after drawing
            const result = RuleService.drawSingleCard(gameState, socket.id);
            updatedState = result.updatedState;
            events = result.events;
            shouldAdvanceTurn = true;
            room.drawCount = 0; // Reset for next player
            console.log(`🎴 ${socket.id} drew 1 card (2nd draw) - turn advances in room ${data.roomId}`);
          } else {
            // First draw - don't advance turn
            const result = RuleService.drawSingleCardNoAdvance(gameState, socket.id);
            updatedState = result.updatedState;
            events = result.events;
            console.log(`🎴 ${socket.id} drew 1 card (1st draw) - turn stays in room ${data.roomId}`);
          }
        }

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
            players: room.players.map(p => ({
              id: p.id,
              username: p.username,
              avatar: p.avatar,
              cardCount: p.cards.length,
            })),
            currentTurn: room.currentTurn,
            topCard: room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined,
            currentSuit: room.currentSuit,
            yourCards: player.cards,
            punishmentChain: room.punishmentChain,
            drawCount: room.drawCount, // Send draw count to frontend
          });
        });

        callback({ success: true, drawCount: room.drawCount });
      } catch (error) {
        console.error('Error taking punishment/drawing card:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });
  }
}
