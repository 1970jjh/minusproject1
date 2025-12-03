import { Team, MIN_CARD, MAX_CARD } from '../types';

/**
 * Calculates the Net Profit (Score) based on Minus Auction rules.
 * Rule: Sum of projects. In a sequence (-30, -31, -32), only the head (-30) counts.
 * Resources add +1 (1억) each.
 */
export const calculateScore = (cards: number[], chips: number): number => {
  if (cards.length === 0) return chips;

  // Sort ascending (e.g. -50, -49, -30)
  const sorted = [...cards].sort((a, b) => a - b);
  
  let projectLossSum = 0;
  let currentSequenceHead = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    // If current project is consecutive to the previous one
    if (sorted[i] === sorted[i - 1] + 1) {
      // Continue sequence
    } else {
      // Sequence break. Add the previous sequence head to sum.
      projectLossSum += currentSequenceHead;
      // Start new sequence
      currentSequenceHead = sorted[i];
    }
  }
  // Add the last sequence head
  projectLossSum += currentSequenceHead;

  // Final Score = Project Losses + Resources
  return projectLossSum + chips;
};

/**
 * Initializes the deck with numbers from -50 to -26.
 */
export const createDeck = (): number[] => {
  const deck: number[] = [];
  for (let i = MIN_CARD; i <= MAX_CARD; i++) {
    deck.push(i);
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

export const generateId = () => Math.random().toString(36).substr(2, 9);