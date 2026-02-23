import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateResolveAction,
  resolveResourceLocation,
  applyToolsToDice,
  confirmResourceGathering,
  resolveToolMaker,
  resolveHut,
  resolveField,
  resolveBuilding,
  skipAction,
} from './ActionResolution.js';
import { createInitialGameState } from './GameSetup.js';
import type { GameState } from '../types/index.js';

function createActionPhaseGame(playerCount = 2): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    connected: true,
  }));
  const state = createInitialGameState('test-game', players);

  // Simulate placement: put player-0's workers at forest (3 workers) and huntingGrounds (2 workers)
  state.phase = 'actionResolution';
  state.currentPlayerIndex = 0;

  const p0 = state.players[0];
  p0.availableWorkers = 0;
  p0.placedWorkers = [
    { location: 'forest', count: 3 },
    { location: 'huntingGrounds', count: 2 },
  ];
  p0.placedLocations = ['forest', 'huntingGrounds'];
  p0.unresolvedLocations = ['forest', 'huntingGrounds'];
  state.board.locations['forest'].totalWorkers = 3;
  state.board.locations['forest'].workersByPlayer = { 'player-0': 3 };
  state.board.locations['huntingGrounds'].totalWorkers = 2;
  state.board.locations['huntingGrounds'].workersByPlayer = { 'player-0': 2 };

  const p1 = state.players[1];
  p1.availableWorkers = 0;
  p1.placedWorkers = [
    { location: 'clayPit', count: 3 },
    { location: 'quarry', count: 2 },
  ];
  p1.placedLocations = ['clayPit', 'quarry'];
  p1.unresolvedLocations = ['clayPit', 'quarry'];
  state.board.locations['clayPit'].totalWorkers = 3;
  state.board.locations['clayPit'].workersByPlayer = { 'player-1': 3 };
  state.board.locations['quarry'].totalWorkers = 2;
  state.board.locations['quarry'].workersByPlayer = { 'player-1': 2 };

  return state;
}

function createVillagePhaseGame(): GameState {
  const players = Array.from({ length: 2 }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    connected: true,
  }));
  const state = createInitialGameState('test-game', players);
  state.phase = 'actionResolution';
  state.currentPlayerIndex = 0;
  // Ensure toolMaker is NOT blocked for this game
  state.blockedVillageLocation = 'field'; // block field, not toolMaker

  const p0 = state.players[0];
  p0.availableWorkers = 0;
  p0.unresolvedLocations = ['toolMaker'];
  p0.placedWorkers = [{ location: 'toolMaker', count: 1 }];
  state.board.locations['toolMaker'].totalWorkers = 1;
  state.board.locations['toolMaker'].workersByPlayer = { 'player-0': 1 };

  const p1 = state.players[1];
  p1.availableWorkers = 0;
  p1.unresolvedLocations = [];
  p1.placedWorkers = [];

  return state;
}

describe('ActionResolution', () => {
  describe('validateResolveAction', () => {
    it('returns valid when player has workers at location', () => {
      const state = createActionPhaseGame();
      const result = validateResolveAction(state, 'player-0', 'forest');
      expect(result.valid).toBe(true);
    });

    it('returns error when not in actionResolution phase', () => {
      const state = createActionPhaseGame();
      state.phase = 'workerPlacement';
      const result = validateResolveAction(state, 'player-0', 'forest');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Not in action resolution phase');
    });

    it("returns error when it's not the player's turn", () => {
      const state = createActionPhaseGame();
      // currentPlayerIndex is 0, so player-1 should not be able to act
      const result = validateResolveAction(state, 'player-1', 'clayPit');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Not your turn');
    });

    it('returns error when player has no workers at that location', () => {
      const state = createActionPhaseGame();
      const result = validateResolveAction(state, 'player-0', 'river');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No workers at this location');
    });
  });

  describe('resolveResourceLocation', () => {
    it('creates a dice roll for the player', () => {
      const state = createActionPhaseGame();
      const newState = resolveResourceLocation(state, 'player-0', 'forest');
      const player = newState.players[0];
      expect(player.currentDiceRoll).not.toBeNull();
      expect(player.currentDiceRoll!.dice).toBeDefined();
      expect(Array.isArray(player.currentDiceRoll!.dice)).toBe(true);
    });

    it('dice count matches worker count at location', () => {
      const state = createActionPhaseGame();
      // player-0 has 3 workers at forest
      const newState = resolveResourceLocation(state, 'player-0', 'forest');
      expect(newState.players[0].currentDiceRoll!.dice).toHaveLength(3);

      // player-0 has 2 workers at huntingGrounds
      const state2 = createActionPhaseGame();
      const newState2 = resolveResourceLocation(state2, 'player-0', 'huntingGrounds');
      expect(newState2.players[0].currentDiceRoll!.dice).toHaveLength(2);
    });

    it('resourcesEarned is calculated based on dice total and divisor', () => {
      const state = createActionPhaseGame();
      const newState = resolveResourceLocation(state, 'player-0', 'forest');
      const roll = newState.players[0].currentDiceRoll!;
      // Forest -> wood -> divisor 3
      const expectedTotal = roll.dice.reduce((s, d) => s + d, 0);
      expect(roll.total).toBe(expectedTotal);
      expect(roll.resourcesEarned).toBe(Math.floor(expectedTotal / 3));
    });
  });

  describe('applyToolsToDice', () => {
    it('increases finalTotal by tool levels', () => {
      const state = createActionPhaseGame();
      // Give player-0 two tools
      state.players[0].tools = [
        { level: 2, usedThisRound: false },
        { level: 3, usedThisRound: false },
      ];
      // Roll dice at forest first
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      const originalTotal = newState.players[0].currentDiceRoll!.total;

      // Apply both tools (indices 0 and 1)
      newState = applyToolsToDice(newState, 'player-0', [0, 1]);
      expect(newState.players[0].currentDiceRoll!.finalTotal).toBe(originalTotal + 2 + 3);
    });

    it('marks tools as used', () => {
      const state = createActionPhaseGame();
      state.players[0].tools = [
        { level: 1, usedThisRound: false },
        { level: 2, usedThisRound: false },
      ];
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      newState = applyToolsToDice(newState, 'player-0', [0]);
      expect(newState.players[0].tools[0].usedThisRound).toBe(true);
      expect(newState.players[0].tools[1].usedThisRound).toBe(false);
    });

    it('recalculates resourcesEarned', () => {
      const state = createActionPhaseGame();
      state.players[0].tools = [{ level: 3, usedThisRound: false }];
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      const rollBefore = newState.players[0].currentDiceRoll!;
      const earnedBefore = rollBefore.resourcesEarned;

      newState = applyToolsToDice(newState, 'player-0', [0]);
      const rollAfter = newState.players[0].currentDiceRoll!;
      // With +3 from tool, the earned could be different (wood divisor is 3)
      expect(rollAfter.resourcesEarned).toBe(Math.floor(rollAfter.finalTotal / 3));
      expect(rollAfter.finalTotal).toBe(rollBefore.total + 3);
    });
  });

  describe('confirmResourceGathering', () => {
    it('adds resources to player', () => {
      const state = createActionPhaseGame();
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      const earned = newState.players[0].currentDiceRoll!.resourcesEarned;
      newState = confirmResourceGathering(newState, 'player-0');
      // forest -> wood
      expect(newState.players[0].resources.wood).toBe(earned);
    });

    it('removes from supply for non-food resources', () => {
      const state = createActionPhaseGame();
      const initialWood = state.supply.wood;
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      const earned = newState.players[0].currentDiceRoll!.resourcesEarned;
      newState = confirmResourceGathering(newState, 'player-0');
      expect(newState.supply.wood).toBe(initialWood - earned);
    });

    it('marks dice roll as resolved', () => {
      const state = createActionPhaseGame();
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      newState = confirmResourceGathering(newState, 'player-0');
      // After confirmation, currentDiceRoll is cleared by finishLocationResolution
      expect(newState.players[0].currentDiceRoll).toBeNull();
    });

    it('removes location from unresolvedLocations', () => {
      const state = createActionPhaseGame();
      let newState = resolveResourceLocation(state, 'player-0', 'forest');
      expect(newState.players[0].unresolvedLocations).toContain('forest');
      newState = confirmResourceGathering(newState, 'player-0');
      expect(newState.players[0].unresolvedLocations).not.toContain('forest');
    });
  });

  describe('resolveToolMaker', () => {
    it('first time: adds a new tool at level 1', () => {
      const state = createVillagePhaseGame();
      expect(state.players[0].tools).toHaveLength(0);
      const newState = resolveToolMaker(state, 'player-0');
      expect(newState.players[0].tools).toHaveLength(1);
      expect(newState.players[0].tools[0].level).toBe(1);
    });

    it('when 3 tools exist: upgrades lowest level tool', () => {
      const state = createVillagePhaseGame();
      state.players[0].tools = [
        { level: 2, usedThisRound: false },
        { level: 1, usedThisRound: false },
        { level: 3, usedThisRound: false },
      ];
      const newState = resolveToolMaker(state, 'player-0');
      // Should still have 3 tools (no new one added)
      expect(newState.players[0].tools).toHaveLength(3);
      // The lowest (level 1 at index 1) should have been upgraded to 2
      expect(newState.players[0].tools[1].level).toBe(2);
    });
  });

  describe('resolveHut', () => {
    let state: GameState;

    beforeEach(() => {
      const players = Array.from({ length: 2 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        connected: true,
      }));
      state = createInitialGameState('test-game', players);
      state.phase = 'actionResolution';
      state.currentPlayerIndex = 0;

      const p0 = state.players[0];
      p0.availableWorkers = 0;
      p0.unresolvedLocations = ['hut'];
      p0.placedWorkers = [{ location: 'hut', count: 2 }];
      state.board.locations['hut'].totalWorkers = 2;
      state.board.locations['hut'].workersByPlayer = { 'player-0': 2 };

      const p1 = state.players[1];
      p1.availableWorkers = 0;
      p1.unresolvedLocations = [];
      p1.placedWorkers = [];
    });

    it('increases totalWorkers by 1', () => {
      const initialWorkers = state.players[0].totalWorkers;
      const newState = resolveHut(state, 'player-0');
      expect(newState.players[0].totalWorkers).toBe(initialWorkers + 1);
    });

    it('does not exceed MAX_WORKERS (10)', () => {
      state.players[0].totalWorkers = 10;
      const newState = resolveHut(state, 'player-0');
      expect(newState.players[0].totalWorkers).toBe(10);
    });
  });

  describe('resolveField', () => {
    let state: GameState;

    beforeEach(() => {
      const players = Array.from({ length: 2 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        connected: true,
      }));
      state = createInitialGameState('test-game', players);
      state.phase = 'actionResolution';
      state.currentPlayerIndex = 0;

      const p0 = state.players[0];
      p0.availableWorkers = 0;
      p0.unresolvedLocations = ['field'];
      p0.placedWorkers = [{ location: 'field', count: 1 }];
      state.board.locations['field'].totalWorkers = 1;
      state.board.locations['field'].workersByPlayer = { 'player-0': 1 };

      const p1 = state.players[1];
      p1.availableWorkers = 0;
      p1.unresolvedLocations = [];
      p1.placedWorkers = [];
    });

    it('increases foodProduction by 1', () => {
      const initialProduction = state.players[0].foodProduction;
      const newState = resolveField(state, 'player-0');
      expect(newState.players[0].foodProduction).toBe(initialProduction + 1);
    });

    it('does not exceed MAX_FOOD_PRODUCTION (10)', () => {
      state.players[0].foodProduction = 10;
      const newState = resolveField(state, 'player-0');
      expect(newState.players[0].foodProduction).toBe(10);
    });
  });

  describe('skipAction', () => {
    it('removes location from unresolved without gaining anything', () => {
      const state = createActionPhaseGame();
      const p0 = state.players[0];
      const initialFood = p0.resources.food;
      const initialWood = p0.resources.wood;

      expect(p0.unresolvedLocations).toContain('forest');
      const newState = skipAction(state, 'player-0', 'forest');
      expect(newState.players[0].unresolvedLocations).not.toContain('forest');
      expect(newState.players[0].resources.food).toBe(initialFood);
      expect(newState.players[0].resources.wood).toBe(initialWood);
    });
  });
});
