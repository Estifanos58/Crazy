import type { Card, CardSelector } from '../types/game.types';

/**
 * Checks whether a card matches a CardSelector (rank must match; suit must match if specified).
 */
export function matchesCardSelector(card: Card, selector: CardSelector): boolean {
  if (card.rank !== selector.rank) {
    return false;
  }
  if (selector.suit !== undefined && card.suit !== selector.suit) {
    return false;
  }
  return true;
}

/**
 * Checks whether a card matches any selector in a list.
 */
export function matchesAnyCardSelector(card: Card, selectors: CardSelector[]): boolean {
  return selectors.some((selector) => matchesCardSelector(card, selector));
}
