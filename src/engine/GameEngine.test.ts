import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from './GameEngine.js';
import type { GameAction } from './GameEngine.js';
import type { GameState } from '../types/index.js';

function create2PlayerGame(): GameState {
  return GameEngine.createGame('test', [
    { id: 'p0', name: 'Alice', connected: true },
    { id: 'p1', name: 'Bob', connected: true },
  ]);
}

describe('GameEngine', () => {
  describe('createGame', () => {
    it('creates a valid initial state', () => {
      const state = create2PlayerGame();
      expect(state.gameId).toBe('test');
      expect(state.players).toHaveLength(2);
      expect(state.phase).toBe('workerPlacement');
      expect(state.roundNumber).toBe(1);
      expect(state.gameOver).toBe(false);
      expect(state.players[0].name).toBe('Alice');
      expect(state.players[1].name).toBe('Bob');
    });
  });

  describe('processAction', () => {
    it('returns error when game is over', () => {
      const state = create2PlayerGame();
      state.gameOver = true;
      const action: GameAction = { type: 'placeWorkers', playerId: 'p0', location: 'forest', count: 2 };
      const result = GameEngine.processAction(state, action);
      expect(result.error).toBe('Game is already over');
    });

    it('placeWorkers validates and executes correctly', () => {
      const state = create2PlayerGame();
      // Player 0 places 3 workers at forest
      const action: GameAction = { type: 'placeWorkers', playerId: 'p0', location: 'forest', count: 3 };
      const result = GameEngine.processAction(state, action);
      expect(result.error).toBeUndefined();
      expect(result.state.board.locations['forest'].totalWorkers).toBe(3);
      expect(result.state.players[0].availableWorkers).toBe(2);
    });

    it('feedWorkers validates and executes correctly', () => {
      const state = create2PlayerGame();
      state.phase = 'feeding';
      state.currentPlayerIndex = 0;
      state.players[0].hasFed = false;
      state.players[1].hasFed = false;
      // Player has 12 food and 5 workers, should succeed
      const action: GameAction = { type: 'feedWorkers', playerId: 'p0' };
      const result = GameEngine.processAction(state, action);
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].hasFed).toBe(true);
      // Started with 12 food, needed 5 for 5 workers => 7 left
      expect(result.state.players[0].resources.food).toBe(7);
    });

    it('acceptStarvation works', () => {
      const state = create2PlayerGame();
      state.phase = 'feeding';
      state.currentPlayerIndex = 0;
      state.players[0].hasFed = false;
      state.players[1].hasFed = false;
      state.players[0].resources.food = 0; // no food at all

      const action: GameAction = { type: 'acceptStarvation', playerId: 'p0' };
      const result = GameEngine.processAction(state, action);
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].hasFed).toBe(true);
      expect(result.state.players[0].score).toBe(-10); // starvation penalty
    });

    it('resolveAction on resource location starts dice roll', () => {
      const state = create2PlayerGame();
      state.phase = 'actionResolution';
      state.currentPlayerIndex = 0;
      const p0 = state.players[0];
      p0.availableWorkers = 0;
      p0.unresolvedLocations = ['forest'];
      p0.placedWorkers = [{ location: 'forest', count: 3 }];
      state.board.locations['forest'].totalWorkers = 3;
      state.board.locations['forest'].workersByPlayer = { p0: 3 };
      const p1 = state.players[1];
      p1.availableWorkers = 0;
      p1.unresolvedLocations = [];
      p1.placedWorkers = [];

      const action: GameAction = { type: 'resolveAction', playerId: 'p0', location: 'forest' };
      const result = GameEngine.processAction(state, action);
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].currentDiceRoll).not.toBeNull();
      expect(result.state.players[0].currentDiceRoll!.dice).toHaveLength(3);
    });

    it('useTools applies tools to current dice roll', () => {
      const state = create2PlayerGame();
      state.phase = 'actionResolution';
      state.currentPlayerIndex = 0;
      const p0 = state.players[0];
      p0.availableWorkers = 0;
      p0.unresolvedLocations = ['forest'];
      p0.placedWorkers = [{ location: 'forest', count: 2 }];
      p0.tools = [{ level: 2, usedThisRound: false }];
      state.board.locations['forest'].totalWorkers = 2;
      state.board.locations['forest'].workersByPlayer = { p0: 2 };
      const p1 = state.players[1];
      p1.availableWorkers = 0;
      p1.unresolvedLocations = [];
      p1.placedWorkers = [];

      // First resolve to get a dice roll
      const resolveResult = GameEngine.processAction(state, {
        type: 'resolveAction',
        playerId: 'p0',
        location: 'forest',
      });
      const originalTotal = resolveResult.state.players[0].currentDiceRoll!.total;

      // Then use tools
      const toolResult = GameEngine.processAction(resolveResult.state, {
        type: 'useTools',
        playerId: 'p0',
        toolIndices: [0],
      });
      expect(toolResult.error).toBeUndefined();
      expect(toolResult.state.players[0].currentDiceRoll!.finalTotal).toBe(originalTotal + 2);
    });

    it('confirmResourceGathering collects resources', () => {
      const state = create2PlayerGame();
      state.phase = 'actionResolution';
      state.currentPlayerIndex = 0;
      const p0 = state.players[0];
      p0.availableWorkers = 0;
      p0.unresolvedLocations = ['forest'];
      p0.placedWorkers = [{ location: 'forest', count: 3 }];
      state.board.locations['forest'].totalWorkers = 3;
      state.board.locations['forest'].workersByPlayer = { p0: 3 };
      const p1 = state.players[1];
      p1.availableWorkers = 0;
      p1.unresolvedLocations = [];
      p1.placedWorkers = [];

      // Resolve to get dice
      const resolved = GameEngine.processAction(state, {
        type: 'resolveAction',
        playerId: 'p0',
        location: 'forest',
      });
      const earned = resolved.state.players[0].currentDiceRoll!.resourcesEarned;

      // Confirm gathering
      const confirmed = GameEngine.processAction(resolved.state, {
        type: 'confirmResourceGathering',
        playerId: 'p0',
      });
      expect(confirmed.error).toBeUndefined();
      expect(confirmed.state.players[0].resources.wood).toBe(earned);
      expect(confirmed.state.players[0].currentDiceRoll).toBeNull();
    });

    it('skipAction removes location from unresolved', () => {
      const state = create2PlayerGame();
      state.phase = 'actionResolution';
      state.currentPlayerIndex = 0;
      const p0 = state.players[0];
      p0.availableWorkers = 0;
      p0.unresolvedLocations = ['forest', 'huntingGrounds'];
      p0.placedWorkers = [
        { location: 'forest', count: 3 },
        { location: 'huntingGrounds', count: 2 },
      ];
      state.board.locations['forest'].totalWorkers = 3;
      state.board.locations['forest'].workersByPlayer = { p0: 3 };
      state.board.locations['huntingGrounds'].totalWorkers = 2;
      state.board.locations['huntingGrounds'].workersByPlayer = { p0: 2 };
      const p1 = state.players[1];
      p1.availableWorkers = 0;
      p1.unresolvedLocations = [];
      p1.placedWorkers = [];

      const result = GameEngine.processAction(state, {
        type: 'skipAction',
        playerId: 'p0',
        location: 'forest',
      });
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].unresolvedLocations).not.toContain('forest');
      expect(result.state.players[0].unresolvedLocations).toContain('huntingGrounds');
    });

    it('returns error for unknown action type', () => {
      const state = create2PlayerGame();
      const action = { type: 'doSomethingWeird', playerId: 'p0' } as any;
      const result = GameEngine.processAction(state, action);
      expect(result.error).toBe('Unknown action type');
    });
  });

  describe('full mini-game flow', () => {
    it('place workers -> resolve -> feed -> new round', () => {
      const state = create2PlayerGame();

      // Step 1: Player 0 places 5 workers at huntingGrounds
      let result = GameEngine.processAction(state, {
        type: 'placeWorkers',
        playerId: 'p0',
        location: 'huntingGrounds',
        count: 5,
      });
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].availableWorkers).toBe(0);

      // Step 2: Player 1 places 5 workers at huntingGrounds
      result = GameEngine.processAction(result.state, {
        type: 'placeWorkers',
        playerId: 'p1',
        location: 'huntingGrounds',
        count: 5,
      });
      expect(result.error).toBeUndefined();
      expect(result.state.players[1].availableWorkers).toBe(0);
      // All workers placed, should transition to actionResolution
      expect(result.state.phase).toBe('actionResolution');

      // Step 3: Player 0 resolves huntingGrounds (first player resolves first)
      result = GameEngine.processAction(result.state, {
        type: 'resolveAction',
        playerId: 'p0',
        location: 'huntingGrounds',
      });
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].currentDiceRoll).not.toBeNull();
      expect(result.state.players[0].currentDiceRoll!.dice).toHaveLength(5);

      // Step 4: Player 0 confirms gathering
      const p0Food = result.state.players[0].currentDiceRoll!.resourcesEarned;
      result = GameEngine.processAction(result.state, {
        type: 'confirmResourceGathering',
        playerId: 'p0',
      });
      expect(result.error).toBeUndefined();
      // Food starts at 12, hunting adds p0Food
      expect(result.state.players[0].resources.food).toBe(12 + p0Food);

      // After player-0 finishes all locations, turn passes to player-1
      expect(result.state.currentPlayerIndex).toBe(1);

      // Step 5: Player 1 resolves huntingGrounds
      result = GameEngine.processAction(result.state, {
        type: 'resolveAction',
        playerId: 'p1',
        location: 'huntingGrounds',
      });
      expect(result.error).toBeUndefined();
      expect(result.state.players[1].currentDiceRoll).not.toBeNull();

      // Step 6: Player 1 confirms gathering
      const p1Food = result.state.players[1].currentDiceRoll!.resourcesEarned;
      result = GameEngine.processAction(result.state, {
        type: 'confirmResourceGathering',
        playerId: 'p1',
      });
      expect(result.error).toBeUndefined();
      // Both players done resolving, should transition to feeding
      expect(result.state.phase).toBe('feeding');

      // Step 7: Feed player 0 (has 12 + p0Food food, needs 5)
      // currentPlayerIndex is firstPlayerIndex (0)
      result = GameEngine.processAction(result.state, {
        type: 'feedWorkers',
        playerId: 'p0',
      });
      expect(result.error).toBeUndefined();
      expect(result.state.players[0].hasFed).toBe(true);

      // Step 8: Feed player 1 (both fed => endRound triggers, round resets hasFed)
      result = GameEngine.processAction(result.state, {
        type: 'feedWorkers',
        playerId: 'p1',
      });
      expect(result.error).toBeUndefined();

      // After all players fed, round increments and phase resets
      // (endRound resets hasFed to false for the new round)
      expect(result.state.roundNumber).toBe(2);
      expect(result.state.phase).toBe('workerPlacement');
      expect(result.state.players[0].hasFed).toBe(false);
      expect(result.state.players[1].hasFed).toBe(false);
    });
  });
});
