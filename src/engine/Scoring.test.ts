import { describe, it, expect, beforeEach } from 'vitest';
import { calculateFinalScores, determineWinner } from './Scoring.js';
import type {
  GameState, PlayerState, CivilizationCard, CultureSymbol, MultiplierCategory,
} from '../types/index.js';

// --- Helpers ---

function createMinimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: 'test',
    roundNumber: 1,
    phase: 'feeding',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    players: [],
    board: { locations: {} as any },
    civilizationDeck: [],
    civilizationDisplay: [null, null, null, null],
    buildingStacks: [],
    supply: { wood: 28, brick: 18, stone: 12, gold: 10 },
    supplyFood: 1000,
    gameOver: true,
    winner: null,
    finalScores: null,
    blockedVillageLocation: null,
    pendingDiceForItems: null,
    log: [],
    ...overrides,
  };
}

function createPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    name: 'Player 1',
    color: 'red',
    connected: true,
    totalWorkers: 5,
    availableWorkers: 0,
    placedWorkers: [],
    resources: { food: 0, wood: 0, brick: 0, stone: 0, gold: 0 },
    foodProduction: 0,
    score: 0,
    tools: [],
    oneUseTools: [],
    civilizationCards: [],
    buildings: [],
    placedLocations: [],
    hasFed: true,
    unresolvedLocations: [],
    currentDiceRoll: null,
    ...overrides,
  };
}

const cultureCard = (symbol: CultureSymbol): CivilizationCard => ({
  id: `test-${symbol}`,
  immediateEffect: { type: 'food', amount: 1 },
  scoringBottom: { type: 'culture', symbol },
});

const multiplierCard = (category: MultiplierCategory, figureCount: number): CivilizationCard => ({
  id: `test-mult-${category}`,
  immediateEffect: { type: 'food', amount: 1 },
  scoringBottom: { type: 'multiplier', category, figureCount },
});

// --- Tests ---

describe('calculateFinalScores', () => {
  it('returns one score per player', () => {
    const state = createMinimalState({
      players: [
        createPlayer({ id: 'p1', name: 'Alice' }),
        createPlayer({ id: 'p2', name: 'Bob' }),
        createPlayer({ id: 'p3', name: 'Carol' }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores).toHaveLength(3);
    expect(scores.map(s => s.playerId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('preserves in-game score', () => {
    const state = createMinimalState({
      players: [createPlayer({ score: 42 })],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].inGameScore).toBe(42);
  });

  it('scores 1 VP per resource and 1 VP per food', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          resources: { food: 2, wood: 3, brick: 0, stone: 0, gold: 0 },
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].resourceScore).toBe(5); // 3 wood + 2 food
  });

  it('scores culture sets: 1 unique symbol = 1 (1^2)', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          civilizationCards: [cultureCard('writing')],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].cultureSetScore).toBe(1);
  });

  it('scores culture sets: 3 unique symbols = 9 (3^2)', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          civilizationCards: [
            cultureCard('writing'),
            cultureCard('medicine'),
            cultureCard('pottery'),
          ],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].cultureSetScore).toBe(9);
  });

  it('scores culture sets: 8 unique symbols = 64 (8^2)', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          civilizationCards: [
            cultureCard('writing'),
            cultureCard('medicine'),
            cultureCard('pottery'),
            cultureCard('art'),
            cultureCard('music'),
            cultureCard('weaving'),
            cultureCard('transport'),
            cultureCard('sundial'),
          ],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].cultureSetScore).toBe(64);
  });

  it('scores culture sets with duplicates across multiple sets', () => {
    // 2 writing + 2 medicine
    // Set 1: writing + medicine = 2 unique = 4
    // Set 2: writing + medicine = 2 unique = 4
    // Total = 8
    const state = createMinimalState({
      players: [
        createPlayer({
          civilizationCards: [
            cultureCard('writing'),
            cultureCard('writing'),
            cultureCard('medicine'),
            cultureCard('medicine'),
          ],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].cultureSetScore).toBe(8);
  });

  it('scores farmer multiplier: figures * foodProduction', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          foodProduction: 5,
          civilizationCards: [
            multiplierCard('farmer', 1),
            multiplierCard('farmer', 1),
          ],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].multiplierScore.farmer.score).toBe(10); // 2 figures * 5 foodProd
  });

  it('scores toolMaker multiplier: figures * total tool value', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          tools: [
            { level: 3, usedThisRound: false },
            { level: 2, usedThisRound: false },
          ],
          civilizationCards: [multiplierCard('toolMaker', 1)],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].multiplierScore.toolMaker.score).toBe(5); // 1 figure * (3+2)
  });

  it('scores hutBuilder multiplier: figures * building count', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          buildings: [
            { id: 'b1', cost: { type: 'fixed', resources: { wood: 1 }, points: 5 } },
            { id: 'b2', cost: { type: 'fixed', resources: { wood: 1 }, points: 5 } },
            { id: 'b3', cost: { type: 'fixed', resources: { wood: 1 }, points: 5 } },
          ],
          civilizationCards: [multiplierCard('hutBuilder', 2)],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].multiplierScore.hutBuilder.score).toBe(6); // 2 figures * 3 buildings
  });

  it('scores shaman multiplier: figures * total workers', () => {
    const state = createMinimalState({
      players: [
        createPlayer({
          totalWorkers: 8,
          civilizationCards: [multiplierCard('shaman', 1)],
        }),
      ],
    });

    const scores = calculateFinalScores(state);
    expect(scores[0].multiplierScore.shaman.score).toBe(8); // 1 figure * 8 workers
  });
});

describe('determineWinner', () => {
  it('returns the player with the highest total score', () => {
    const p1 = createPlayer({ id: 'p1', name: 'Alice', score: 30 });
    const p2 = createPlayer({ id: 'p2', name: 'Bob', score: 50 });
    const state = createMinimalState({ players: [p1, p2] });

    const scores = calculateFinalScores(state);
    const winnerId = determineWinner(scores, state);
    expect(winnerId).toBe('p2');
  });

  it('breaks ties by food production (higher wins)', () => {
    const p1 = createPlayer({ id: 'p1', name: 'Alice', score: 40, foodProduction: 3 });
    const p2 = createPlayer({ id: 'p2', name: 'Bob', score: 40, foodProduction: 7 });
    const state = createMinimalState({ players: [p1, p2] });

    const scores = calculateFinalScores(state);
    const winnerId = determineWinner(scores, state);
    expect(winnerId).toBe('p2');
  });

  it('breaks ties by tool value when food production is also tied', () => {
    const p1 = createPlayer({
      id: 'p1',
      name: 'Alice',
      score: 40,
      foodProduction: 5,
      tools: [{ level: 2, usedThisRound: false }],
    });
    const p2 = createPlayer({
      id: 'p2',
      name: 'Bob',
      score: 40,
      foodProduction: 5,
      tools: [
        { level: 3, usedThisRound: false },
        { level: 1, usedThisRound: false },
      ],
    });
    const state = createMinimalState({ players: [p1, p2] });

    const scores = calculateFinalScores(state);
    const winnerId = determineWinner(scores, state);
    expect(winnerId).toBe('p2'); // p2 tool value = 4, p1 tool value = 2
  });
});
