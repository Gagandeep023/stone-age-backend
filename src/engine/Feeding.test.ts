import { describe, it, expect, beforeEach } from 'vitest';
import { validateFeeding, feedWorkers, acceptStarvation } from './Feeding.js';
import { createInitialGameState } from './GameSetup.js';
import type { GameState } from '../types/index.js';

// --- Helper ---

function createTestGame(playerCount = 2): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    connected: true,
  }));
  const state = createInitialGameState('test-game', players);
  // Move to feeding phase
  state.phase = 'feeding';
  for (const p of state.players) {
    p.hasFed = false;
    p.availableWorkers = 0;
    p.placedWorkers = [];
  }
  return state;
}

// --- Tests ---

describe('validateFeeding', () => {
  it('returns valid in feeding phase for unfed player', () => {
    const state = createTestGame();
    const result = validateFeeding(state, 'player-0');
    expect(result).toEqual({ valid: true });
  });

  it('returns error when not in feeding phase', () => {
    const state = createTestGame();
    state.phase = 'workerPlacement';
    const result = validateFeeding(state, 'player-0');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Not in feeding phase');
  });

  it('returns error when player already fed', () => {
    const state = createTestGame();
    state.players[0].hasFed = true;
    const result = validateFeeding(state, 'player-0');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Already fed this round');
  });
});

describe('feedWorkers', () => {
  it('deducts food equal to worker count', () => {
    const state = createTestGame();
    // 5 workers, 12 food initially
    expect(state.players[0].totalWorkers).toBe(5);
    expect(state.players[0].resources.food).toBe(12);

    const newState = feedWorkers(state, 'player-0');
    const player = newState.players.find(p => p.id === 'player-0')!;
    expect(player.resources.food).toBe(7); // 12 - 5
  });

  it('can use resources as food substitute', () => {
    const state = createTestGame();
    const player = state.players[0];
    player.resources.food = 2;
    player.resources.wood = 5;
    // Needs 5 food total. Has 2 food + offers 3 wood as food = 5. Enough.

    const newState = feedWorkers(state, 'player-0', { wood: 3 });
    const updated = newState.players.find(p => p.id === 'player-0')!;
    expect(updated.resources.food).toBe(0); // 2 food used first
    expect(updated.resources.wood).toBe(2); // 5 - 3 used as food
  });

  it('applies starvation penalty when total food is insufficient', () => {
    const state = createTestGame();
    const player = state.players[0];
    player.resources.food = 2;
    player.score = 20;
    // 5 workers needed, only 2 food, no resources offered

    const newState = feedWorkers(state, 'player-0');
    const updated = newState.players.find(p => p.id === 'player-0')!;
    expect(updated.resources.food).toBe(0);
    expect(updated.score).toBe(10); // 20 + (-10) penalty
  });

  it('sets hasFed to true after feeding', () => {
    const state = createTestGame();
    const newState = feedWorkers(state, 'player-0');
    const player = newState.players.find(p => p.id === 'player-0')!;
    expect(player.hasFed).toBe(true);
  });

  it('ends round when all players have fed', () => {
    let state = createTestGame(2);
    // Feed player 0 first
    state = feedWorkers(state, 'player-0');
    expect(state.players[1].hasFed).toBe(false);

    // Feed player 1 to complete the round
    state = feedWorkers(state, 'player-1');

    // Round should have ended: phase back to workerPlacement, roundNumber incremented
    expect(state.phase).toBe('workerPlacement');
    expect(state.roundNumber).toBe(2);
  });

  it('advances to next unfed player after feeding', () => {
    const state = createTestGame(3);
    state.currentPlayerIndex = 0;

    const newState = feedWorkers(state, 'player-0');
    // player-0 is now fed, should advance to player-1
    expect(newState.currentPlayerIndex).toBe(1);
  });
});

describe('acceptStarvation', () => {
  it('sets food to 0', () => {
    const state = createTestGame();
    state.players[0].resources.food = 4;

    const newState = acceptStarvation(state, 'player-0');
    const player = newState.players.find(p => p.id === 'player-0')!;
    expect(player.resources.food).toBe(0);
  });

  it('applies -10 VP penalty', () => {
    const state = createTestGame();
    state.players[0].score = 25;

    const newState = acceptStarvation(state, 'player-0');
    const player = newState.players.find(p => p.id === 'player-0')!;
    expect(player.score).toBe(15); // 25 + (-10)
  });

  it('sets hasFed to true', () => {
    const state = createTestGame();

    const newState = acceptStarvation(state, 'player-0');
    const player = newState.players.find(p => p.id === 'player-0')!;
    expect(player.hasFed).toBe(true);
  });

  it('returns food to supplyFood', () => {
    const state = createTestGame();
    state.players[0].resources.food = 4;
    const initialSupply = state.supplyFood;

    const newState = acceptStarvation(state, 'player-0');
    expect(newState.supplyFood).toBe(initialSupply + 4);
  });
});

describe('food return to supply', () => {
  it('feedWorkers returns spent food to supplyFood', () => {
    const state = createTestGame();
    // Player has 12 food, 5 workers, will spend 5 food
    const initialSupply = state.supplyFood;
    const newState = feedWorkers(state, 'player-0');
    // 5 food spent should return to supply
    expect(newState.supplyFood).toBe(initialSupply + 5);
  });

  it('feedWorkers starvation returns all food to supply', () => {
    const state = createTestGame();
    state.players[0].resources.food = 3; // not enough for 5 workers
    const initialSupply = state.supplyFood;

    const newState = feedWorkers(state, 'player-0');
    // All 3 food returned to supply
    expect(newState.supplyFood).toBe(initialSupply + 3);
  });
});
