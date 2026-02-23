import type { VillageLocation } from '../types/index.js';
import { VILLAGE_LOCATIONS } from '../types/index.js';

/**
 * For 2-3 player games, one of the three village locations
 * (toolMaker, hut, field) is blocked each round.
 * The blocked location rotates each round.
 */
export function getBlockedVillageLocation(
  playerCount: number,
  roundNumber: number,
): VillageLocation | null {
  if (playerCount >= 4) return null;
  // Rotate through the three village locations
  return VILLAGE_LOCATIONS[roundNumber % VILLAGE_LOCATIONS.length];
}

/**
 * Get the number of building stacks for a player count
 */
export function getBuildingStackCount(playerCount: number): number {
  return playerCount; // 2, 3, or 4 stacks
}

/**
 * Check if a location is available for the current player count and round
 */
export function isLocationAvailable(
  location: string,
  playerCount: number,
  blockedVillage: VillageLocation | null,
): boolean {
  // Check if it's a blocked village location
  if (blockedVillage && location === blockedVillage) return false;

  // Check if building stack exists for this player count
  if (location.startsWith('building_')) {
    const stackIndex = parseInt(location.split('_')[1], 10);
    return stackIndex < playerCount;
  }

  return true;
}
