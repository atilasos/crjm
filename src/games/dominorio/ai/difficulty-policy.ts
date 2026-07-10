import type { Side } from './types';

export function selectDidacticBeginnerMove(moves: number[], side: Side): number | null {
  if (moves.length === 0) return null;
  return [...moves].sort((a, b) => {
    const distance = (move: number) => {
      const row = Math.floor(move / 8) + (side === 0 ? 0.5 : 0);
      const col = move % 8 + (side === 1 ? 0.5 : 0);
      return Math.abs(row - 3.5) + Math.abs(col - 3.5);
    };
    return distance(b) - distance(a) || a - b;
  })[0] ?? null;
}
