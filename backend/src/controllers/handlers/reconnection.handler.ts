import type { Server, Socket } from 'socket.io';
import { RoomService } from '../../services/room.service';
import { GameOrchestrator } from '../../services/game.orchestrator';

export class ReconnectionHandler {
  static handle(socket: Socket, io: Server): void {
    // Rejoin room after reconnection
    socket.on(
      'rejoin-room',
      async (
        data: {
          roomId: string;
          playerId?: string;
          playerToken?: string;
          username?: string;
          avatar?: string;
        },
        callback
      ) => {
        try {
          if (!data || !data.roomId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid room ID' });
            }
            return;
          }

          const result = await RoomService.rejoinRoom(
            socket.id,
            data.roomId,
            data.playerId,
            data.playerToken,
            data.username,
            data.avatar
          );

          if (!result) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Room not found' });
            }
            return;
          }

          const { room, player, playerId, playerToken } = result;

          socket.join(room.roomId);
          socket.join(`player:${playerId}`);

          const sanitizedPlayers = RoomService.sanitizePlayers(room.players);
          const sanitizedRejoiningPlayer = sanitizedPlayers.find(p => p.id === playerId);

          io.to(room.roomId).emit('player-rejoined', {
            player: sanitizedRejoiningPlayer,
            players: sanitizedPlayers,
          });

          const publicRoom = {
            roomId: room.roomId,
            creatorId: room.creatorId,
            players: sanitizedPlayers,
            finishedPlayers: RoomService.sanitizeRankedPlayers(room.finishedPlayers || []),
            gameStarted: room.gameStarted,
            gameOver: room.gameOver,
            currentTurn: room.currentTurn,
            currentSuit: room.currentSuit,
            turnDirection: room.turnDirection,
            rules: room.rules,
            ruleConfig: room.ruleConfig,
            createdAt: room.createdAt,
          };

          if (typeof callback === 'function') {
            callback({
              success: true,
              room: publicRoom,
              playerId,
              playerToken,
            });
          }
          console.log(`🔄 ${player.username} rejoined room: ${data.roomId} (${playerId})`);
        } catch (error) {
          console.error('Error rejoining room:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );

    // Get current game state
    socket.on(
      'get-game-state',
      async (
        data: { roomId: string; playerId?: string; playerToken?: string },
        callback
      ) => {
        try {
          if (!data || !data.roomId) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Invalid room ID' });
            }
            return;
          }

          const room = await RoomService.getRoom(data.roomId);
          if (!room || !room.gameStarted) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Game not found or not started' });
            }
            return;
          }

          const player = GameOrchestrator.authenticatePlayer(
            room,
            socket.id,
            data.playerId,
            data.playerToken
          );

          if (!player) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Player not in room' });
            }
            return;
          }

          const isFinished = Boolean(room.finishedPlayers?.some(fp => fp.id === player.id));
          const finishedEntry = room.finishedPlayers?.find(fp => fp.id === player.id);

          const sanitizedPlayers = RoomService.sanitizePlayers(room.players);
          const sanitizedFinished = RoomService.sanitizeRankedPlayers(room.finishedPlayers || []);

          let blunderInfo;
          if (room.blunderState && room.blunderState.active) {
            const now = Date.now();
            const elapsed = now - room.blunderState.timestamp;
            const revertWindow = room.blunderState.revertTimeoutMs || 5000;
            const challengeWindow = room.blunderState.challengeTimeoutMs || 8000;

            const isMyBlunder = room.blunderState.playerId === player.id;
            const remaining = isMyBlunder
              ? Math.max(0, Math.ceil((revertWindow - elapsed) / 1000))
              : Math.max(0, Math.ceil((challengeWindow - elapsed) / 1000));

            blunderInfo = {
              active: true,
              playerId: room.blunderState.playerId,
              timeLeft: remaining,
              canRevert: isMyBlunder && elapsed < revertWindow,
            };
          }

          if (typeof callback === 'function') {
            callback({
              success: true,
              gameState: {
                roomId: room.roomId,
                players: sanitizedPlayers,
                finishedPlayers: sanitizedFinished,
                currentTurn: room.currentTurn,
                topCard: room.pile?.[room.pile.length - 1],
                currentSuit: room.currentSuit,
                yourCards: player.cards || [],
                punishmentChain: room.punishmentChain,
                turnDirection: room.turnDirection || 'clockwise',
                gameOver: room.gameOver || (room.players.length <= 1 && room.gameStarted),
                pileCount: room.pile?.length || 0,
                deckCount: room.deck?.length || 0,
                drawCount: room.drawCount || 0,
                isFinished,
                rank: finishedEntry?.rank,
                blunderState: blunderInfo,
              },
            });
          }
        } catch (error) {
          console.error('Error getting game state:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: (error as Error).message });
          }
        }
      }
    );
  }
}
