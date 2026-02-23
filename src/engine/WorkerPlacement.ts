import type { GameState, LocationId, ValidationResult } from '../types/index.js';
import { LOCATION_MAX_WORKERS, VILLAGE_LOCATIONS } from '../types/index.js';
import { isLocationAvailable } from './PlayerCountRules.js';

/**
 * Validate a worker placement action
 */
export function validatePlacement(
  state: GameState,
  playerId: string,
  location: LocationId,
  count: number,
): ValidationResult {
  if (state.phase !== 'workerPlacement') {
    return { valid: false, error: 'Not in worker placement phase' };
  }

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { valid: false, error: 'Player not found' };
  }

  if (playerIndex !== state.currentPlayerIndex) {
    return { valid: false, error: 'Not your turn' };
  }

  const player = state.players[playerIndex];

  if (count < 1) {
    return { valid: false, error: 'Must place at least 1 worker' };
  }

  if (count > player.availableWorkers) {
    return { valid: false, error: 'Not enough available workers' };
  }

  // Check location availability (player count rules, blocked village)
  if (!isLocationAvailable(location, state.players.length, state.blockedVillageLocation)) {
    return { valid: false, error: 'Location is not available this round' };
  }

  // Check if building stack exists and has tiles
  if (location.startsWith('building_')) {
    const stackIndex = parseInt(location.split('_')[1], 10);
    if (stackIndex >= state.buildingStacks.length || state.buildingStacks[stackIndex].length === 0) {
      return { valid: false, error: 'No building tiles in this stack' };
    }
  }

  // Check if card slot has a card
  if (location.startsWith('civCard_')) {
    const cardIndex = parseInt(location.split('_')[1], 10);
    if (!state.civilizationDisplay[cardIndex]) {
      return { valid: false, error: 'No card in this slot' };
    }
  }

  // Player can only place at each location once per round
  if (player.placedLocations.includes(location)) {
    return { valid: false, error: 'Already placed workers at this location this round' };
  }

  // Check location capacity
  const locationState = state.board.locations[location];
  const currentWorkers = locationState.totalWorkers;
  const maxWorkers = LOCATION_MAX_WORKERS[location];

  if (currentWorkers + count > maxWorkers) {
    return { valid: false, error: 'Location is full' };
  }

  // Special rules for village locations
  if (location === 'hut' && count !== 2) {
    return { valid: false, error: 'Hut requires exactly 2 workers' };
  }

  if ((location === 'toolMaker' || location === 'field') && count !== 1) {
    return { valid: false, error: 'This location requires exactly 1 worker' };
  }

  // Building and card locations require exactly 1 worker
  if ((location.startsWith('building_') || location.startsWith('civCard_')) && count !== 1) {
    return { valid: false, error: 'This location requires exactly 1 worker' };
  }

  return { valid: true };
}

/**
 * Execute a worker placement
 */
export function placeWorkers(
  state: GameState,
  playerId: string,
  location: LocationId,
  count: number,
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;
  const locationState = newState.board.locations[location];

  // Place workers
  player.availableWorkers -= count;
  player.placedWorkers.push({ location, count });
  player.placedLocations.push(location);

  locationState.totalWorkers += count;
  locationState.workersByPlayer[playerId] = (locationState.workersByPlayer[playerId] || 0) + count;

  newState.log.push({
    timestamp: Date.now(),
    playerId,
    message: `${player.name} placed ${count} worker${count > 1 ? 's' : ''} at ${formatLocation(location)}`,
    type: 'placement',
  });

  // Advance to next player who still has workers
  advanceToNextPlayer(newState);

  return newState;
}

/**
 * Advance to the next player who has workers to place.
 * If all workers are placed, transition to action resolution phase.
 */
function advanceToNextPlayer(state: GameState): void {
  const playerCount = state.players.length;

  // Check if all players have placed all workers
  const allPlaced = state.players.every(p => p.availableWorkers === 0);
  if (allPlaced) {
    transitionToActionResolution(state);
    return;
  }

  // Find next player with available workers (round-robin from current)
  let nextIndex = (state.currentPlayerIndex + 1) % playerCount;
  let checked = 0;
  while (checked < playerCount) {
    if (state.players[nextIndex].availableWorkers > 0) {
      state.currentPlayerIndex = nextIndex;
      return;
    }
    nextIndex = (nextIndex + 1) % playerCount;
    checked++;
  }

  // Should not reach here if allPlaced check works
  transitionToActionResolution(state);
}

/**
 * Transition from placement to action resolution
 */
function transitionToActionResolution(state: GameState): void {
  state.phase = 'actionResolution';
  state.currentPlayerIndex = state.firstPlayerIndex;

  // Set up unresolved locations for each player
  for (const player of state.players) {
    player.unresolvedLocations = player.placedWorkers.map(pw => pw.location);
  }

  state.log.push({
    timestamp: Date.now(),
    message: 'Worker placement complete. Action resolution begins.',
    type: 'phase',
  });
}

function formatLocation(location: LocationId): string {
  const names: Record<string, string> = {
    huntingGrounds: 'Hunting Grounds',
    forest: 'Forest',
    clayPit: 'Clay Pit',
    quarry: 'Quarry',
    river: 'River',
    toolMaker: 'Tool Maker',
    hut: 'Hut',
    field: 'Field',
  };
  if (location.startsWith('building_')) {
    return `Building Stack ${parseInt(location.split('_')[1]) + 1}`;
  }
  if (location.startsWith('civCard_')) {
    return `Civilization Card ${parseInt(location.split('_')[1]) + 1}`;
  }
  return names[location] || location;
}

export { formatLocation };
