import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { Card, Player, GameRoom, GameState } from '@/types/game.types';

interface GameStore {
  // Socket connection
  socket: Socket | null;
  isConnected: boolean;
  
  // User info
  username: string;
  avatar: string;
  
  // Room info
  roomId: string | null;
  room: GameRoom | null;
  isCreator: boolean;
  
  // Game state
  gameStarted: boolean;
  yourCards: Card[];
  currentTurn: string | null;
  currentSuit: string | null;
  topCard: Card | null;
  punishmentChain: { active: boolean; amount: number; cards: Card[] } | null;
  players: Player[];
  lastPlayerId: string | null;
  activePlayers: Player[];
  finishedPlayers: Player[];
  gameOver: boolean;
  
  // Blunder state
  blunderActive: boolean;
  blunderReason: string | null;
  blunderPlayerId: string | null;
  blunderCards: Card[];
  blunderTimeLeft: number;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  setUserInfo: (username: string, avatar: string) => void;
  createRoom: () => Promise<{ success: boolean; roomId?: string; error?: string }>;
  joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  startGame: (cardsPerPlayer: number, customRules?: string) => Promise<{ success: boolean; error?: string }>;
  playCard: (cards: Card[], chosenSuit?: string) => Promise<{ success: boolean; error?: string }>;
  takePunishment: () => Promise<{ success: boolean; error?: string }>;
  callCrazy: (targetPlayerId: string) => Promise<{ success: boolean; error?: string }>;
  revertBlunder: () => Promise<{ success: boolean; error?: string }>;
  setGameState: (state: Partial<GameStore>) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Helper to save state to sessionStorage
const saveStateToStorage = (state: Partial<GameStore>) => {
  if (typeof window === 'undefined') return;
  try {
    const stateToSave = {
      username: state.username,
      avatar: state.avatar,
      roomId: state.roomId,
      isCreator: state.isCreator,
      gameStarted: state.gameStarted,
      // Save full game state for better reconnection
      yourCards: state.yourCards,
      currentTurn: state.currentTurn,
      currentSuit: state.currentSuit,
      topCard: state.topCard,
      punishmentChain: state.punishmentChain,
      players: state.players,
      activePlayers: state.activePlayers,
      finishedPlayers: state.finishedPlayers,
      gameOver: state.gameOver,
      lastPlayerId: state.lastPlayerId,
    };
    sessionStorage.setItem('crazy-game-state', JSON.stringify(stateToSave));
    console.log('💾 State saved to storage');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

// Helper to restore state from sessionStorage
const restoreStateFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem('crazy-game-state');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to restore state:', error);
    return null;
  }
};

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  isConnected: false,
  username: '',
  avatar: '',
  roomId: null,
  room: null,
  isCreator: false,
  gameStarted: false,
  yourCards: [],
  currentTurn: null,
  currentSuit: null,
  topCard: null,
  punishmentChain: null,
  players: [],
  lastPlayerId: null,
  activePlayers: [],
  finishedPlayers: [],
  gameOver: false,
  
  blunderActive: false,
  blunderReason: null,
  blunderPlayerId: null,
  blunderCards: [],
  blunderTimeLeft: 0,

  connect: () => {
    // Prevent duplicate connections
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.connected) {
      console.log('⚠️ Socket already connected');
      return;
    }

    // Disconnect existing socket if any
    if (existingSocket) {
      existingSocket.disconnect();
    }

    console.log('🔌 Connecting to server...');
    const socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      set({ socket, isConnected: true });
      
      // Restore state after reconnection
      const savedState = restoreStateFromStorage();
      if (savedState && savedState.roomId) {
        console.log('🔄 Attempting to restore session...');
        const { username, avatar, roomId, isCreator } = savedState;
        
        // Immediately restore local state to prevent blank screen
        set({
          username,
          avatar,
          roomId,
          isCreator,
          gameStarted: savedState.gameStarted || false,
          yourCards: savedState.yourCards || [],
          currentTurn: savedState.currentTurn || null,
          currentSuit: savedState.currentSuit || null,
          topCard: savedState.topCard || null,
          punishmentChain: savedState.punishmentChain || null,
          players: savedState.players || [],
          activePlayers: savedState.activePlayers || [],
          finishedPlayers: savedState.finishedPlayers || [],
          gameOver: savedState.gameOver || false,
          lastPlayerId: savedState.lastPlayerId || null,
        });
        console.log('✅ Local state restored from storage');
        
        // Try to rejoin the room
        socket.emit('rejoin-room', { roomId, username, avatar }, (response: any) => {
          if (response.success) {
            console.log('✅ Session restored successfully');
            set({
              username,
              avatar,
              roomId,
              isCreator,
              room: response.room,
              players: response.room.players,
              gameStarted: response.room.gameStarted || false,
            });
            
            // If game was started, request game state
            if (response.room.gameStarted) {
              socket.emit('get-game-state', { roomId }, (stateResponse: any) => {
                if (stateResponse.success) {
                  const data = stateResponse.gameState;
                  console.log('🎮 Game state restored:', data);
                  set({
                    gameStarted: true,
                    yourCards: data.yourCards || [],
                    currentTurn: data.currentTurn,
                    currentSuit: data.currentSuit || null,
                    topCard: data.topCard || null,
                    punishmentChain: data.punishmentChain || null,
                    players: data.players || [],
                    activePlayers: (data.players || []).filter((p: any) => 
                      p.cardCount > 0 && !get().finishedPlayers.some(fp => fp.id === p.id)
                    ),
                    gameOver: data.gameOver || false,
                  });
                  
                  // Save restored state
                  saveStateToStorage(get());
                } else {
                  console.error('Failed to get game state:', stateResponse.error);
                }
              });
            }
          } else {
            console.log('⚠️ Could not restore session:', response.error);
            // Clear invalid session
            sessionStorage.removeItem('crazy-game-state');
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      set({ isConnected: false });
      
      // Save state before disconnect
      const currentState = get();
      saveStateToStorage(currentState);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      console.log('🔄 Attempting to reconnect...');
    });

    socket.on('player-joined', (data: { player: Player; players: Player[] }) => {
      console.log('👤 Player joined:', data.player);
      set({ players: data.players });
    });

    socket.on('player-rejoined', (data: { player: Player; players: Player[] }) => {
      console.log('🔄 Player rejoined:', data.player);
      set({ players: data.players });
      // Save updated players list
      saveStateToStorage(get());
    });

    socket.on('game-started', (data: GameState) => {
      console.log('🎮 Game started!');
      const newState = {
        gameStarted: true,
        yourCards: data.yourCards,
        currentTurn: data.currentTurn,
        currentSuit: data.currentSuit || null,
        topCard: data.topCard || null,
        punishmentChain: data.punishmentChain || null,
        players: data.players,
        activePlayers: data.players.filter(p => p.cardCount > 0),
        finishedPlayers: [],
        gameOver: false,
      };
      set(newState);
      saveStateToStorage(newState);
    });

    socket.on('game-update', (data: GameState) => {
      console.log('🔄 Game state updated:', data);
      const currentActive = get().activePlayers;
      const newActive = data.players.filter(p => 
        p.cardCount > 0 && !get().finishedPlayers.some(fp => fp.id === p.id)
      );
      
      const updatedState = {
        yourCards: data.yourCards,
        currentTurn: data.currentTurn,
        currentSuit: data.currentSuit || null,
        topCard: data.topCard || null,
        punishmentChain: data.punishmentChain || null,
        players: data.players,
        activePlayers: newActive,
      };
      
      set(updatedState);
      
      // Save state after each update
      saveStateToStorage(get());
    });

    socket.on('game-event', (event: any) => {
      console.log('🎯 Game event:', event);
      
      const { toast } = require('sonner');
      const players = get().players;
      const getPlayerName = (id: string) => players.find(p => p.id === id)?.username || 'Unknown';

      switch (event.type) {
        case 'card-played':
          const cardText = event.payload.cards.length === 1 
            ? `${event.payload.cards[0].rank} of ${event.payload.cards[0].suit}`
            : `${event.payload.cards.length} cards`;
          toast.info(`${getPlayerName(event.payload.playerId)} played ${cardText}`);
          set({ lastPlayerId: event.payload.playerId });
          break;
        
        case 'punishment-taken':
          toast.warning(`${getPlayerName(event.payload.playerId)} took ${event.payload.amount} punishment card(s)`);
          break;
        
        case 'punishment-chain-started':
          toast.error(`⚠️ Punishment chain started! ${event.payload.amount} cards`);
          break;
        
        case 'punishment-chain-increased':
          toast.error(`⚠️ Punishment chain increased to ${event.payload.amount} cards!`);
          break;
        
        case 'turn-reversed':
          toast.info('🔄 Turn direction reversed!');
          break;
        
        case 'player-skipped':
          toast.info(`⏭️ ${getPlayerName(event.payload.playerId)} was skipped`);
          break;
        
        case 'suit-changed':
          const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
          toast.info(`Suit changed to ${suitSymbols[event.payload.suit as keyof typeof suitSymbols]} ${event.payload.suit}`);
          break;
        
        case 'crazy-called':
          if (event.payload.success) {
            toast.success(`${getPlayerName(event.payload.callerId)} called CRAZY on ${getPlayerName(event.payload.targetId)}! They take ${event.payload.penalty} cards`);
          } else {
            toast.error(`${getPlayerName(event.payload.callerId)} failed to call CRAZY! They take ${event.payload.penalty} cards`);
          }
          break;
        
        case 'invalid-move':
          const isMyBlunder = event.payload.playerId === get().socket?.id;
          
          if (isMyBlunder && event.payload.canBeChallenged) {
            // Show blunder modal for the player who made the mistake
            set({
              blunderActive: true,
              blunderReason: event.payload.reason,
              blunderPlayerId: event.payload.playerId,
              blunderCards: event.payload.cards || [],
              blunderTimeLeft: 5, // 5 seconds to revert
            });
            
            // Start countdown
            let timeLeft = 5;
            const countdownInterval = setInterval(() => {
              timeLeft--;
              set({ blunderTimeLeft: timeLeft });
              
              if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                // Auto-close modal but keep blunder active for challenges
                const stillActive = get().blunderActive;
                if (stillActive) {
                  // Wait 3 more seconds for challenges
                  setTimeout(() => {
                    if (get().blunderActive && get().blunderPlayerId === event.payload.playerId) {
                      // No one challenged, clear blunder state
                      set({
                        blunderActive: false,
                        blunderReason: null,
                        blunderPlayerId: null,
                        blunderCards: [],
                        blunderTimeLeft: 0,
                      });
                    }
                  }, 3000);
                }
              }
            }, 1000);
          } else if (event.payload.canBeChallenged) {
            // Show toast for other players to challenge
            toast.error(`🚨 ${getPlayerName(event.payload.playerId)} made an invalid move! Click "Call Crazy" to challenge!`, {
              duration: 5000,
              className: 'border-2 border-red-500',
            });
            
            // Store blunder info for challenge
            set({
              blunderActive: true,
              blunderReason: event.payload.reason,
              blunderPlayerId: event.payload.playerId,
              blunderCards: event.payload.cards || [],
              blunderTimeLeft: 8, // 8 seconds total for challenges
            });
            
            // Auto-clear after challenge window
            setTimeout(() => {
              if (get().blunderPlayerId === event.payload.playerId) {
                set({
                  blunderActive: false,
                  blunderReason: null,
                  blunderPlayerId: null,
                  blunderCards: [],
                  blunderTimeLeft: 0,
                });
              }
            }, 8000);
          } else {
            toast.error(`Invalid move: ${event.payload.reason}`);
          }
          break;
        
        case 'blunder-reverted':
          toast.success(`${getPlayerName(event.payload.playerId)} reverted their move`, {
            duration: 3000,
          });
          
          // Clear blunder state for everyone
          set({
            blunderActive: false,
            blunderReason: null,
            blunderPlayerId: null,
            blunderCards: [],
            blunderTimeLeft: 0,
          });
          break;
        
        case 'win':
          const winner = players.find(p => p.id === event.payload.playerId);
          const currentFinished = get().finishedPlayers;
          const rank = currentFinished.length + 1;
          
          if (winner) {
            // Show winner notification
            const winnerName = winner.username;
            const winnerAvatar = winner.avatar;
            const rankText = rank === 1 ? '🏆 Winner!' : `Finished ${rank}${rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}!`;
            
            toast.success(`${winnerAvatar} ${winnerName} - ${rankText}`, {
              duration: 5000,
              className: 'bg-gradient-to-r from-yellow-500/20 to-cyber-primary/20 border-2 border-yellow-500',
            });

            // Update finished and active players
            const newFinished = [...currentFinished, { ...winner, rank, finishedAt: Date.now() }];
            const newActive = get().activePlayers.filter(p => p.id !== winner.id);
            
            set({ 
              finishedPlayers: newFinished,
              activePlayers: newActive,
              gameOver: newActive.length <= 1
            });
          }
          break;
        
        default:
          console.log('Unhandled event:', event);
      }
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setUserInfo: (username: string, avatar: string) => {
    set({ username, avatar });
  },

  createRoom: (): Promise<{ success: boolean; roomId?: string; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, username, avatar } = get();
      
      if (!socket || !username || !avatar) {
        resolve({ success: false, error: 'Missing required information' });
        return;
      }

      socket.emit('create-room', { username, avatar }, (response: any) => {
        if (response.success) {
          const newState = {
            roomId: response.room.roomId,
            room: response.room,
            isCreator: true,
            players: response.room.players,
            username,
            avatar,
          };
          set(newState);
          saveStateToStorage(newState);
          resolve({ success: true, roomId: response.room.roomId });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  joinRoom: (roomId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, username, avatar } = get();
      
      if (!socket || !username || !avatar) {
        resolve({ success: false, error: 'Missing required information' });
        return;
      }

      socket.emit('join-room', { roomId, username, avatar }, (response: any) => {
        if (response.success) {
          const newState = {
            roomId: response.room.roomId,
            room: response.room,
            isCreator: false,
            players: response.room.players,
            username,
            avatar,
          };
          set(newState);
          saveStateToStorage(newState);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  startGame: (cardsPerPlayer: number, customRules?: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('start-game', { roomId, cardsPerPlayer, customRules }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  playCard: (cards: Card[], chosenSuit?: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('play-card', { roomId, cards, chosenSuit }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  takePunishment: (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('take-punishment', { roomId }, (response: any) => {
        if (response.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  callCrazy: (targetPlayerId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('call-crazy', { roomId, targetPlayerId }, (response: any) => {
        if (response.success) {
          // Clear blunder state after challenge
          set({
            blunderActive: false,
            blunderReason: null,
            blunderPlayerId: null,
            blunderCards: [],
            blunderTimeLeft: 0,
          });
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  revertBlunder: (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const { socket, roomId, blunderCards } = get();
      
      if (!socket || !roomId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }

      socket.emit('revert-blunder', { roomId, cards: blunderCards }, (response: any) => {
        if (response.success) {
          // Clear blunder state
          set({
            blunderActive: false,
            blunderReason: null,
            blunderPlayerId: null,
            blunderCards: [],
            blunderTimeLeft: 0,
          });
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      });
    });
  },

  setGameState: (state: Partial<GameStore>) => {
    set(state);
  },
}));
