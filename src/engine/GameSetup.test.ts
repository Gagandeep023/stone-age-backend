import { describe, it, expect } from 'vitest';
import { createInitialGameState } from './GameSetup.js';
import type { RoomPlayer } from '../types/index.js';

function makePlayers(count: number): RoomPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    connected: true,
  }));
}

describe('GameSetup', () => {
  describe('createInitialGameState', () => {
    it('returns state with the correct gameId', () => {
      const state = createInitialGameState('my-game-123', makePlayers(2));
      expect(state.gameId).toBe('my-game-123');
    });

    it('starts at round 1, workerPlacement phase, currentPlayerIndex 0', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.roundNumber).toBe(1);
      expect(state.phase).toBe('workerPlacement');
      expect(state.currentPlayerIndex).toBe(0);
    });

    it('creates the correct number of players for 2 players', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.players).toHaveLength(2);
    });

    it('creates the correct number of players for 3 players', () => {
      const state = createInitialGameState('test', makePlayers(3));
      expect(state.players).toHaveLength(3);
    });

    it('creates the correct number of players for 4 players', () => {
      const state = createInitialGameState('test', makePlayers(4));
      expect(state.players).toHaveLength(4);
    });

    it('gives each player the correct starting stats', () => {
      const state = createInitialGameState('test', makePlayers(3));
      for (const player of state.players) {
        expect(player.totalWorkers).toBe(5);
        expect(player.availableWorkers).toBe(5);
        expect(player.resources.food).toBe(12);
        expect(player.score).toBe(0);
        expect(player.tools).toHaveLength(0);
        expect(player.buildings).toHaveLength(0);
        expect(player.civilizationCards).toHaveLength(0);
      }
    });

    it('assigns player colors in order: red, blue, green, yellow', () => {
      const state = createInitialGameState('test', makePlayers(4));
      expect(state.players[0].color).toBe('red');
      expect(state.players[1].color).toBe('blue');
      expect(state.players[2].color).toBe('green');
      expect(state.players[3].color).toBe('yellow');
    });

    it('civilizationDisplay has 4 items', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.civilizationDisplay).toHaveLength(4);
    });

    it('buildingStacks count matches player count', () => {
      for (const count of [2, 3, 4]) {
        const state = createInitialGameState('test', makePlayers(count));
        expect(state.buildingStacks).toHaveLength(count);
      }
    });

    it('initializes supply with correct resource amounts', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.supply.wood).toBe(28);
      expect(state.supply.brick).toBe(18);
      expect(state.supply.stone).toBe(12);
      expect(state.supply.gold).toBe(10);
    });

    it('initializes all 16 board locations with 0 workers', () => {
      const state = createInitialGameState('test', makePlayers(2));
      const allLocations = [
        'huntingGrounds', 'forest', 'clayPit', 'quarry', 'river',
        'toolMaker', 'hut', 'field',
        'building_0', 'building_1', 'building_2', 'building_3',
        'civCard_0', 'civCard_1', 'civCard_2', 'civCard_3',
      ];
      for (const loc of allLocations) {
        const locationState = state.board.locations[loc as keyof typeof state.board.locations];
        expect(locationState).toBeDefined();
        expect(locationState.totalWorkers).toBe(0);
      }
    });

    it('blockedVillageLocation is not null for 2 players', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.blockedVillageLocation).not.toBeNull();
    });

    it('blockedVillageLocation is not null for 3 players', () => {
      const state = createInitialGameState('test', makePlayers(3));
      expect(state.blockedVillageLocation).not.toBeNull();
    });

    it('blockedVillageLocation is null for 4 players', () => {
      const state = createInitialGameState('test', makePlayers(4));
      expect(state.blockedVillageLocation).toBeNull();
    });

    it('gameOver is false and winner is null', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.gameOver).toBe(false);
      expect(state.winner).toBeNull();
    });

    it('log has at least one entry', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.log.length).toBeGreaterThanOrEqual(1);
    });

    it('initializes supplyFood to 58', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.supplyFood).toBe(58);
    });

    it('initializes pendingFlexResources as null', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.pendingFlexResources).toBeNull();
    });

    it('initializes pendingResourceDice as null', () => {
      const state = createInitialGameState('test', makePlayers(2));
      expect(state.pendingResourceDice).toBeNull();
    });
  });
});
