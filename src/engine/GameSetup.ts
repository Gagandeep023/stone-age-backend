import type {
  GameState, PlayerState, BoardState, LocationId, LocationState,
  RoomPlayer, ResourceSupply,
} from '../types/index.js';
import {
  PLAYER_COLORS, LOCATION_MAX_WORKERS,
} from '../types/index.js';
import { INITIAL_WORKERS, INITIAL_FOOD, BUILDING_STACK_SIZE, CARD_DISPLAY_SIZE } from '../data/constants.js';
import { INITIAL_SUPPLY } from '../types/index.js';
import { createBuildingStacks } from '../data/buildings.js';
import { createShuffledDeck } from '../data/civilizationCards.js';
import { getBlockedVillageLocation } from './PlayerCountRules.js';

function createEmptyBoardState(): BoardState {
  const locations: Record<string, LocationState> = {};
  const allLocations: LocationId[] = [
    'huntingGrounds', 'forest', 'clayPit', 'quarry', 'river',
    'toolMaker', 'hut', 'field',
    'building_0', 'building_1', 'building_2', 'building_3',
    'civCard_0', 'civCard_1', 'civCard_2', 'civCard_3',
  ];

  for (const loc of allLocations) {
    locations[loc] = { totalWorkers: 0, workersByPlayer: {} };
  }

  return { locations: locations as Record<LocationId, LocationState> };
}

function createPlayerState(player: RoomPlayer, index: number): PlayerState {
  return {
    id: player.id,
    name: player.name,
    color: PLAYER_COLORS[index],
    connected: player.connected,
    totalWorkers: INITIAL_WORKERS,
    availableWorkers: INITIAL_WORKERS,
    placedWorkers: [],
    resources: { food: INITIAL_FOOD, wood: 0, brick: 0, stone: 0, gold: 0 },
    foodProduction: 0,
    score: 0,
    tools: [],
    oneUseTools: [],
    civilizationCards: [],
    buildings: [],
    placedLocations: [],
    hasFed: false,
    unresolvedLocations: [],
    currentDiceRoll: null,
  };
}

export function createInitialGameState(
  gameId: string,
  players: RoomPlayer[],
): GameState {
  const playerCount = players.length;
  const deck = createShuffledDeck();

  // Deal 4 cards to display
  const display = deck.splice(0, CARD_DISPLAY_SIZE);

  // Create building stacks
  const buildingStacks = createBuildingStacks(playerCount);

  const supply: ResourceSupply = { ...INITIAL_SUPPLY };

  const state: GameState = {
    gameId,
    roundNumber: 1,
    phase: 'workerPlacement',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    players: players.map((p, i) => createPlayerState(p, i)),
    board: createEmptyBoardState(),
    civilizationDeck: deck,
    civilizationDisplay: display.concat(
      Array(CARD_DISPLAY_SIZE - display.length).fill(null)
    ),
    buildingStacks,
    supply,
    supplyFood: 1000, // effectively unlimited
    gameOver: false,
    winner: null,
    finalScores: null,
    blockedVillageLocation: getBlockedVillageLocation(playerCount, 1),
    pendingDiceForItems: null,
    log: [{
      timestamp: Date.now(),
      message: `Game started with ${playerCount} players`,
      type: 'system',
    }],
  };

  return state;
}
