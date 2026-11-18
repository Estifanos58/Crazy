import { z } from 'zod';
import { RANKS, SUITS } from '../types/game.types';

export const suitSchema = z.enum(SUITS);
export const rankSchema = z.enum(RANKS);
export const rulePresetSchema = z.enum(['standard', 'hardcore', 'beginner', 'chaos', 'classic']);

export const roomIdSchema = z
  .string()
  .trim()
  .min(4, 'Invalid room ID')
  .max(32, 'Invalid room ID')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid room ID format');

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Username is required')
  .max(24, 'Username must be at most 24 characters');

export const avatarSchema = z
  .string()
  .trim()
  .min(1, 'Avatar is required')
  .max(16, 'Invalid avatar');

export const playerIdSchema = z.string().trim().min(1).max(64);
export const playerTokenSchema = z.string().trim().min(1).max(128);

export const cardSchema = z.object({
  suit: suitSchema,
  rank: rankSchema,
  id: z.string().trim().min(1).max(32),
});

export const cardSelectorSchema = z.object({
  rank: rankSchema,
  suit: suitSchema.optional(),
});

export const punishmentConfigSchema = z.object({
  aceSpadeCard: cardSelectorSchema.optional(),
  aceSpadePenalty: z.number().int().min(0).max(20).optional(),
  rank2Cards: z.array(rankSchema).max(4).optional(),
  rank2Penalty: z.number().int().min(0).max(20).optional(),
});

export const specialCardsConfigSchema = z.object({
  reverseCards: z.array(cardSelectorSchema).max(13).optional(),
  skipCards: z.array(cardSelectorSchema).max(13).optional(),
  suitChangeCards: z.array(cardSelectorSchema).max(13).optional(),
  dropCards: cardSelectorSchema.optional(),
});

export const crazyChallengeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  penalty: z.number().int().min(0).max(15).optional(),
  responseTimeMs: z.number().int().min(1000).max(30000).optional(),
});

export const partialRuleConfigSchema = z
  .object({
    punishment: punishmentConfigSchema.optional(),
    specialCards: specialCardsConfigSchema.optional(),
    crazyChallenge: crazyChallengeConfigSchema.optional(),
    illegalTurnPenalty: z.number().int().min(0).max(15).optional(),
    allowDropAllSameSuit: z.boolean().optional(),
    winOnEmpty: z.boolean().optional(),
  })
  .strict();

export const createRoomSchema = z.object({
  username: usernameSchema,
  avatar: avatarSchema,
});

export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  username: usernameSchema,
  avatar: avatarSchema,
});

export const getRoomSchema = roomIdSchema;

export const rejoinRoomSchema = z.object({
  roomId: roomIdSchema,
  playerId: playerIdSchema.optional(),
  playerToken: playerTokenSchema.optional(),
  username: usernameSchema.optional(),
  avatar: avatarSchema.optional(),
});

export const startGameSchema = z.object({
  roomId: roomIdSchema,
  playerId: playerIdSchema.optional(),
  playerToken: playerTokenSchema.optional(),
  cardsPerPlayer: z.number().int().min(1).max(15),
  customRules: z.string().trim().max(500).optional(),
  rulePreset: rulePresetSchema.optional(),
  ruleConfig: partialRuleConfigSchema.optional(),
});

export const playCardSchema = z.object({
  roomId: roomIdSchema,
  playerId: playerIdSchema.optional(),
  playerToken: playerTokenSchema.optional(),
  cards: z.array(cardSchema).min(1, 'At least one card must be played').max(13, 'Too many cards played'),
  chosenSuit: suitSchema.optional(),
});

export const roomActionSchema = z.object({
  roomId: roomIdSchema,
  playerId: playerIdSchema.optional(),
  playerToken: playerTokenSchema.optional(),
});

export const leaveGameSchema = z.object({
  roomId: roomIdSchema,
  playerId: playerIdSchema.optional(),
  playerToken: playerTokenSchema.optional(),
  isCreator: z.boolean().optional(),
});

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'Invalid payload';
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return `${path}${first.message}`;
}
