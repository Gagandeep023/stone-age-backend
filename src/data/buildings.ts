import type { BuildingTile } from '../types/index.js';

// 28 building tiles total, 4 stacks of 7
// Type 1: Fixed-cost (specific resources, fixed VP)
// Type 2: Flexible-count (N resources of M different types, VP = resource value sum)
// Type 3: Variable (1-7 resources of any type, VP = resource value sum)

export const ALL_BUILDING_TILES: BuildingTile[] = [
  // === Fixed-cost buildings (11 tiles) ===
  // 3-resource combos
  { id: 'fixed-01', cost: { type: 'fixed', resources: { wood: 1, brick: 1, stone: 1 }, points: 10 } },
  { id: 'fixed-02', cost: { type: 'fixed', resources: { wood: 1, brick: 1, gold: 1 }, points: 12 } },
  { id: 'fixed-03', cost: { type: 'fixed', resources: { wood: 1, stone: 1, gold: 1 }, points: 14 } },
  { id: 'fixed-04', cost: { type: 'fixed', resources: { brick: 1, stone: 1, gold: 1 }, points: 16 } },
  // 2-resource combos (higher quantities)
  { id: 'fixed-05', cost: { type: 'fixed', resources: { wood: 2, brick: 1 }, points: 10 } },
  { id: 'fixed-06', cost: { type: 'fixed', resources: { wood: 1, brick: 2 }, points: 11 } },
  { id: 'fixed-07', cost: { type: 'fixed', resources: { wood: 2, stone: 1 }, points: 11 } },
  { id: 'fixed-08', cost: { type: 'fixed', resources: { brick: 2, stone: 1 }, points: 13 } },
  { id: 'fixed-09', cost: { type: 'fixed', resources: { brick: 1, gold: 1 }, points: 10 } },
  { id: 'fixed-10', cost: { type: 'fixed', resources: { stone: 1, gold: 1 }, points: 11 } },
  { id: 'fixed-11', cost: { type: 'fixed', resources: { wood: 3 }, points: 10 } },

  // === Flexible-count buildings (8 tiles) ===
  // "Exactly N resources of exactly M different types"
  { id: 'flex-01', cost: { type: 'flexible', count: 4, differentTypes: 2 } },
  { id: 'flex-02', cost: { type: 'flexible', count: 4, differentTypes: 2 } },
  { id: 'flex-03', cost: { type: 'flexible', count: 4, differentTypes: 2 } },
  { id: 'flex-04', cost: { type: 'flexible', count: 4, differentTypes: 2 } },
  { id: 'flex-05', cost: { type: 'flexible', count: 4, differentTypes: 3 } },
  { id: 'flex-06', cost: { type: 'flexible', count: 4, differentTypes: 3 } },
  { id: 'flex-07', cost: { type: 'flexible', count: 4, differentTypes: 4 } },
  { id: 'flex-08', cost: { type: 'flexible', count: 5, differentTypes: 2 } },

  // === Variable buildings (9 tiles) ===
  // "1-7 resources of any type(s)"
  { id: 'var-01', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-02', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-03', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-04', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-05', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-06', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-07', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-08', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
  { id: 'var-09', cost: { type: 'variable', minResources: 1, maxResources: 7 } },
];

/**
 * Shuffle an array using Fisher-Yates
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Create building stacks for a given player count
 * 4 players = 4 stacks of 7
 * 3 players = 3 stacks of ~9 (28 / 3)
 * 2 players = 2 stacks of 14
 */
export function createBuildingStacks(playerCount: number): BuildingTile[][] {
  const shuffled = shuffleArray(ALL_BUILDING_TILES);
  const stackCount = playerCount;
  const stacks: BuildingTile[][] = [];

  const perStack = Math.floor(shuffled.length / stackCount);
  for (let i = 0; i < stackCount; i++) {
    const start = i * perStack;
    const end = i === stackCount - 1 ? shuffled.length : start + perStack;
    stacks.push(shuffled.slice(start, end));
  }

  return stacks;
}
