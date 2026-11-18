import type { Server } from 'socket.io';
import type {
  BlunderInfo,
  GameRoom,
  GameStartedPayload,
  GameStateResponse,
  GameUpdatePayload,
  Player,
  PublicRoom,
  RankedPlayer,
  ServerPlayer,
} from '../types/game.types';

const EMPTY_PUNISHMENT_CHAIN = {
  active: false,
  amount: 0,
  cards: [],
};

export class GameBroadcaster {
  static sanitizePlayers(players: ServerPlayer[]): Player[] {
    return players.map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      cardCount: p.cards.length,
      isCreator: p.isCreator,
      rank: p.rank,
      finishedAt: p.finishedAt,
      connected: p.connected,
    }));
  }

  static sanitizeRankedPlayers(players: ServerPlayer[]): RankedPlayer[] {
    return players.map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      rank: p.rank || 0,
      finishedAt: p.finishedAt,
    }));
  }

  static buildPublicRoom(room: GameRoom): PublicRoom {
    const topCard = room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined;

    return {
      roomId: room.roomId,
      creatorId: room.creatorId,
      players: this.sanitizePlayers(room.players),
      finishedPlayers: this.sanitizeRankedPlayers(room.finishedPlayers || []),
      gameStarted: room.gameStarted,
      gameOver: Boolean(room.gameOver),
      currentTurn: room.currentTurn,
      currentSuit: room.currentSuit,
      turnDirection: room.turnDirection || 'clockwise',
      rules: room.rules,
      ruleConfig: room.ruleConfig,
      deckCount: room.deck.length,
      pileCount: room.pile?.length || 0,
      topCard,
      createdAt: room.createdAt,
    };
  }

  static buildGameStateResponse(room: GameRoom, player: ServerPlayer): GameStateResponse {
    const finishedEntry = room.finishedPlayers?.find((fp) => fp.id === player.id);
    const isFinished = Boolean(finishedEntry);

    let blunderState: BlunderInfo | undefined;
    if (room.blunderState && room.blunderState.active) {
      const elapsed = Date.now() - room.blunderState.timestamp;
      const revertWindow = room.blunderState.revertTimeoutMs;
      const challengeWindow = room.blunderState.challengeTimeoutMs;
      const isMyBlunder = room.blunderState.playerId === player.id;

      const timeLeft = isMyBlunder
        ? Math.max(0, Math.ceil((revertWindow - elapsed) / 1000))
        : Math.max(0, Math.ceil((challengeWindow - elapsed) / 1000));

      blunderState = {
        active: true,
        playerId: room.blunderState.playerId,
        reason: room.blunderState.reason,
        cards: room.blunderState.cards,
        timeLeft,
        canRevert: isMyBlunder && elapsed < revertWindow,
      };
    }

    const topCard = room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined;

    return {
      roomId: room.roomId,
      creatorId: room.creatorId,
      players: this.sanitizePlayers(room.players),
      finishedPlayers: this.sanitizeRankedPlayers(room.finishedPlayers || []),
      currentTurn: room.currentTurn,
      topCard,
      currentSuit: room.currentSuit,
      yourCards: player.cards || [],
      punishmentChain: room.punishmentChain || EMPTY_PUNISHMENT_CHAIN,
      turnDirection: room.turnDirection || 'clockwise',
      gameStarted: room.gameStarted,
      gameOver: Boolean(room.gameOver),
      pileCount: room.pile?.length || 0,
      deckCount: room.deck?.length || 0,
      drawCount: room.drawCount || 0,
      rules: room.rules,
      ruleConfig: room.ruleConfig,
      isFinished,
      rank: finishedEntry?.rank,
      blunderState,
    };
  }

  static broadcastGameStarted(room: GameRoom, io: Server): void {
    const sanitizedPlayers = this.sanitizePlayers(room.players);

    room.players.forEach((player) => {
      const target = player.socketId || `player:${player.id}`;
      const payload: GameStartedPayload = {
        roomId: room.roomId,
        players: sanitizedPlayers,
        currentTurn: room.currentTurn || '',
        yourCards: player.cards,
        topCard: undefined,
        currentSuit: undefined,
        turnDirection: room.turnDirection || 'clockwise',
        punishmentChain: room.punishmentChain || EMPTY_PUNISHMENT_CHAIN,
        deckCount: room.deck.length,
        pileCount: room.pile?.length || 0,
        rules: room.rules,
        ruleConfig: room.ruleConfig,
      };
      io.to(target).emit('game-started', payload);
    });
  }

  static broadcastGameUpdate(room: GameRoom, io: Server): void {
    const allPlayers = [...room.players, ...(room.finishedPlayers || [])];
    const sanitizedActive = this.sanitizePlayers(room.players);
    const sanitizedFinished = this.sanitizeRankedPlayers(room.finishedPlayers || []);
    const topCard = room.pile && room.pile.length > 0 ? room.pile[room.pile.length - 1] : undefined;

    allPlayers.forEach((player) => {
      const target = player.socketId || `player:${player.id}`;
      const payload: GameUpdatePayload = {
        players: sanitizedActive,
        finishedPlayers: sanitizedFinished,
        currentTurn: room.currentTurn,
        topCard,
        currentSuit: room.currentSuit,
        turnDirection: room.turnDirection || 'clockwise',
        yourCards: player.cards,
        punishmentChain: room.punishmentChain || EMPTY_PUNISHMENT_CHAIN,
        drawCount: room.drawCount || 0,
        deckCount: room.deck.length,
        pileCount: room.pile?.length || 0,
        gameOver: Boolean(room.gameOver),
        gameStarted: room.gameStarted,
        creatorId: room.creatorId,
      };
      io.to(target).emit('game-update', payload);
    });
  }
}
