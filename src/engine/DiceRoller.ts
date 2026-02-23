import { DICE_SIDES } from '../data/constants.js';

/**
 * Roll N dice, returning individual results
 */
export function rollDice(count: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * DICE_SIDES) + 1);
  }
  return results;
}

/**
 * Calculate resources earned from dice total + divisor
 */
export function calculateResources(diceTotal: number, divisor: number): number {
  return Math.floor(diceTotal / divisor);
}

/**
 * Apply tool values to a dice total
 */
export function applyTools(diceTotal: number, toolValues: number[]): number {
  return diceTotal + toolValues.reduce((sum, v) => sum + v, 0);
}
