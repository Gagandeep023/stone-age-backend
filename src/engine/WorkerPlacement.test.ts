import { describe, it, expect, beforeEach } from 'vitest';
import { validatePlacement, placeWorkers } from './WorkerPlacement.js';
import { createInitialGameState } from './GameSetup.js';
import type { GameState } from '../types/index.js';

function createTestGame(playerCount = 2): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    connected: true,
  }));
  return createInitialGameState('test-game', players);
}

describe('WorkerPlacement', () => {
  describe('validatePlacement', () => {
    let state: GameState;

    beforeEach(() => {
      state = createTestGame(2);
    });

    it('returns valid for a legal placement', () => {
      const result = validatePlacement(state, 'player-0', 'forest', 2);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns error when not in workerPlacement phase', () => {
      state.phase = 'actionResolution';
      const result = validatePlacement(state, 'player-0', 'forest', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when it is not the player\'s turn', () => {
      // currentPlayerIndex is 0, so player-1 cannot act
      const result = validatePlacement(state, 'player-1', 'forest', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when count is less than 1', () => {
      const result = validatePlacement(state, 'player-0', 'forest', 0);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when count exceeds availableWorkers', () => {
      const result = validatePlacement(state, 'player-0', 'forest', 6);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when placing at the same location twice', () => {
      // Place workers at forest first
      state = placeWorkers(state, 'player-0', 'forest', 2);
      // Now it should be player-1's turn; advance back to player-0
      state = placeWorkers(state, 'player-1', 'huntingGrounds', 2);
      // player-0 tries forest again
      const result = validatePlacement(state, 'player-0', 'forest', 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when location is full', () => {
      // toolMaker has max capacity of 1
      // Player 0 places 1 worker at toolMaker
      state = placeWorkers(state, 'player-0', 'toolMaker', 1);
      // Now it's player-1's turn; try to place at already full toolMaker
      const result = validatePlacement(state, 'player-1', 'toolMaker', 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when hut does not receive exactly 2 workers', () => {
      // hut requires exactly 2 workers; try placing 1
      // First make sure hut is not blocked for this game
      // For 2 players, round 1: blockedVillageLocation = VILLAGE_LOCATIONS[1 % 3] = 'hut'
      // So we need a 4-player game where hut is never blocked
      const state4 = createTestGame(4);
      const result = validatePlacement(state4, 'player-0', 'hut', 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when toolMaker does not receive exactly 1 worker', () => {
      // toolMaker requires exactly 1 worker; try placing 2
      // For 2 players round 1, blockedVillageLocation = VILLAGE_LOCATIONS[1 % 3] = 'hut'
      // So toolMaker should be available
      const result = validatePlacement(state, 'player-0', 'toolMaker', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('placeWorkers', () => {
    let state: GameState;

    beforeEach(() => {
      state = createTestGame(2);
    });

    it('reduces availableWorkers by the count placed', () => {
      const newState = placeWorkers(state, 'player-0', 'forest', 3);
      const player = newState.players.find(p => p.id === 'player-0')!;
      expect(player.availableWorkers).toBe(5 - 3);
    });

    it('updates board location state', () => {
      const newState = placeWorkers(state, 'player-0', 'forest', 3);
      const loc = newState.board.locations['forest'];
      expect(loc.totalWorkers).toBe(3);
      expect(loc.workersByPlayer['player-0']).toBe(3);
    });

    it('adds location to placedLocations', () => {
      const newState = placeWorkers(state, 'player-0', 'forest', 2);
      const player = newState.players.find(p => p.id === 'player-0')!;
      expect(player.placedLocations).toContain('forest');
    });

    it('advances to the next player after placement', () => {
      const newState = placeWorkers(state, 'player-0', 'forest', 2);
      expect(newState.currentPlayerIndex).toBe(1);
    });

    it('transitions to actionResolution when all workers are placed', () => {
      // 2 players, each with 5 workers
      // Player 0: place 5 at forest (max 7, ok)
      let s = placeWorkers(state, 'player-0', 'forest', 5);
      // Now it's player-1's turn
      expect(s.currentPlayerIndex).toBe(1);
      expect(s.phase).toBe('workerPlacement');

      // Player 1: place 5 at huntingGrounds (max 40, ok)
      s = placeWorkers(s, 'player-1', 'huntingGrounds', 5);

      // All workers placed, phase should transition
      expect(s.phase).toBe('actionResolution');
    });
  });
});
