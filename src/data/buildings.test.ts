import { describe, it, expect } from 'vitest';
import { ALL_BUILDING_TILES, shuffleArray, createBuildingStacks } from './buildings.js';

describe('ALL_BUILDING_TILES', () => {
  it('has exactly 28 tiles', () => {
    expect(ALL_BUILDING_TILES).toHaveLength(28);
  });

  it('has 11 fixed-cost tiles', () => {
    const fixed = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'fixed');
    expect(fixed).toHaveLength(11);
  });

  it('has 8 flexible-count tiles', () => {
    const flexible = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'flexible');
    expect(flexible).toHaveLength(8);
  });

  it('has 9 variable tiles', () => {
    const variable = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'variable');
    expect(variable).toHaveLength(9);
  });

  it('all tiles have unique ids', () => {
    const ids = ALL_BUILDING_TILES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('fixed tiles have resources and points fields', () => {
    const fixed = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'fixed');
    for (const tile of fixed) {
      if (tile.cost.type === 'fixed') {
        expect(tile.cost.resources).toBeDefined();
        expect(tile.cost.points).toBeDefined();
      }
    }
  });

  it('each fixed tile has points > 0', () => {
    const fixed = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'fixed');
    for (const tile of fixed) {
      if (tile.cost.type === 'fixed') {
        expect(tile.cost.points).toBeGreaterThan(0);
      }
    }
  });

  it('each fixed tile has at least 1 resource type', () => {
    const fixed = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'fixed');
    for (const tile of fixed) {
      if (tile.cost.type === 'fixed') {
        const resourceKeys = Object.keys(tile.cost.resources);
        expect(resourceKeys.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('flexible tiles have count and differentTypes fields', () => {
    const flexible = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'flexible');
    for (const tile of flexible) {
      if (tile.cost.type === 'flexible') {
        expect(tile.cost.count).toBeDefined();
        expect(tile.cost.differentTypes).toBeDefined();
      }
    }
  });

  it('variable tiles have minResources and maxResources fields', () => {
    const variable = ALL_BUILDING_TILES.filter((t) => t.cost.type === 'variable');
    for (const tile of variable) {
      if (tile.cost.type === 'variable') {
        expect(tile.cost.minResources).toBeDefined();
        expect(tile.cost.maxResources).toBeDefined();
      }
    }
  });
});

describe('shuffleArray', () => {
  it('returns an array of the same length', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);
    expect(result).toHaveLength(input.length);
  });

  it('contains all the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);
    expect(result.sort()).toEqual(input.sort());
  });

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });
});

describe('createBuildingStacks', () => {
  it('returns 4 stacks for 4 players', () => {
    const stacks = createBuildingStacks(4);
    expect(stacks).toHaveLength(4);
  });

  it('returns 2 stacks for 2 players', () => {
    const stacks = createBuildingStacks(2);
    expect(stacks).toHaveLength(2);
  });

  it('returns 3 stacks for 3 players', () => {
    const stacks = createBuildingStacks(3);
    expect(stacks).toHaveLength(3);
  });

  it('total tiles across all stacks equals 28', () => {
    for (const playerCount of [2, 3, 4]) {
      const stacks = createBuildingStacks(playerCount);
      const totalTiles = stacks.reduce((sum, stack) => sum + stack.length, 0);
      expect(totalTiles).toBe(28);
    }
  });

  it('each stack is non-empty', () => {
    for (const playerCount of [2, 3, 4]) {
      const stacks = createBuildingStacks(playerCount);
      for (const stack of stacks) {
        expect(stack.length).toBeGreaterThan(0);
      }
    }
  });
});
