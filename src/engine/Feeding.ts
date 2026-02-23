import type { GameState, ResourceType, ValidationResult } from '../types/index.js';
import { STARVATION_PENALTY } from '../data/constants.js';
import { getBlockedVillageLocation } from './PlayerCountRules.js';

/**
 * Validate feeding action
 */
export function validateFeeding(
  state: GameState,
  playerId: string,
): ValidationResult {
  if (state.phase !== 'feeding') {
    return { valid: false, error: 'Not in feeding phase' };
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) return { valid: false, error: 'Player not found' };

  if (player.hasFed) {
    return { valid: false, error: 'Already fed this round' };
  }

  return { valid: true };
}

/**
 * Feed workers: pay food equal to worker count.
 * Food production is already added in the action resolution -> feeding transition.
 * Player can substitute resources for food at 1:1.
 */
export function feedWorkers(
  state: GameState,
  playerId: string,
  resourcesAsFood?: Partial<Record<ResourceType, number>>,
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;

  const foodNeeded = player.totalWorkers;
  let foodAvailable = player.resources.food;

  // Add any resources the player wants to use as food (1 resource = 1 food)
  let resourceFoodValue = 0;
  if (resourcesAsFood) {
    for (const [res, amount] of Object.entries(resourcesAsFood)) {
      if (amount && amount > 0) {
        const available = player.resources[res as ResourceType];
        const toUse = Math.min(amount, available);
        resourceFoodValue += toUse;
      }
    }
  }

  const totalFood = foodAvailable + resourceFoodValue;

  if (totalFood >= foodNeeded) {
    // Pay food first, then resources
    let remaining = foodNeeded;

    const foodUsed = Math.min(remaining, player.resources.food);
    player.resources.food -= foodUsed;
    remaining -= foodUsed;

    // Use resources as food
    if (remaining > 0 && resourcesAsFood) {
      for (const [res, amount] of Object.entries(resourcesAsFood)) {
        if (remaining <= 0) break;
        if (amount && amount > 0) {
          const toUse = Math.min(amount, remaining, player.resources[res as ResourceType]);
          player.resources[res as ResourceType] -= toUse;
          newState.supply[res as ResourceType] += toUse;
          remaining -= toUse;
        }
      }
    }

    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} fed ${player.totalWorkers} workers`,
      type: 'feeding',
    });
  } else {
    // Starvation: lose all food and chosen resources, take -10 VP
    player.resources.food = 0;

    if (resourcesAsFood) {
      for (const [res, amount] of Object.entries(resourcesAsFood)) {
        if (amount && amount > 0) {
          const toUse = Math.min(amount, player.resources[res as ResourceType]);
          player.resources[res as ResourceType] -= toUse;
          newState.supply[res as ResourceType] += toUse;
        }
      }
    }

    player.score += STARVATION_PENALTY;
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} could not feed all workers! ${STARVATION_PENALTY} VP penalty`,
      type: 'feeding',
    });
  }

  player.hasFed = true;

  // Check if all players have fed
  const allFed = newState.players.every(p => p.hasFed);
  if (allFed) {
    endRound(newState);
  } else {
    // Advance to next player who hasn't fed
    advanceToNextFeeder(newState);
  }

  return newState;
}

/**
 * Accept starvation penalty without spending resources
 */
export function acceptStarvation(
  state: GameState,
  playerId: string,
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;

  // Return all food
  player.resources.food = 0;

  // Apply penalty
  player.score += STARVATION_PENALTY;
  player.hasFed = true;

  newState.log.push({
    timestamp: Date.now(),
    playerId,
    message: `${player.name} accepted starvation penalty (${STARVATION_PENALTY} VP)`,
    type: 'feeding',
  });

  const allFed = newState.players.every(p => p.hasFed);
  if (allFed) {
    endRound(newState);
  } else {
    advanceToNextFeeder(newState);
  }

  return newState;
}

function advanceToNextFeeder(state: GameState): void {
  const playerCount = state.players.length;
  let nextIndex = (state.currentPlayerIndex + 1) % playerCount;
  let checked = 0;

  while (checked < playerCount) {
    if (!state.players[nextIndex].hasFed) {
      state.currentPlayerIndex = nextIndex;
      return;
    }
    nextIndex = (nextIndex + 1) % playerCount;
    checked++;
  }
}

/**
 * End the current round and start a new one (or end the game)
 */
function endRound(state: GameState): void {
  // Check game end conditions
  const gameEnds = checkGameEndConditions(state);

  if (gameEnds) {
    state.gameOver = true;
    state.log.push({
      timestamp: Date.now(),
      message: 'Game over!',
      type: 'system',
    });
    return;
  }

  // Start new round
  state.roundNumber++;

  // Rotate first player
  state.firstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;
  state.currentPlayerIndex = state.firstPlayerIndex;

  // Reset round state
  state.phase = 'workerPlacement';
  for (const player of state.players) {
    player.availableWorkers = player.totalWorkers;
    player.placedWorkers = [];
    player.placedLocations = [];
    player.hasFed = false;
    player.unresolvedLocations = [];
    player.currentDiceRoll = null;

    // Reset tool usage
    for (const tool of player.tools) {
      tool.usedThisRound = false;
    }
  }

  // Update blocked village location for 2-3 players
  if (state.players.length < 4) {
    state.blockedVillageLocation = getBlockedVillageLocation(
      state.players.length,
      state.roundNumber,
    );
  }

  // Refill card display
  refillCardDisplay(state);

  state.log.push({
    timestamp: Date.now(),
    message: `Round ${state.roundNumber} begins. ${state.players[state.firstPlayerIndex].name} goes first.`,
    type: 'phase',
  });
}

function refillCardDisplay(state: GameState): void {
  // Slide existing cards left
  const existing = state.civilizationDisplay.filter(c => c !== null);
  state.civilizationDisplay = [];

  for (let i = 0; i < 4; i++) {
    if (i < existing.length) {
      state.civilizationDisplay.push(existing[i]);
    } else if (state.civilizationDeck.length > 0) {
      state.civilizationDisplay.push(state.civilizationDeck.shift()!);
    } else {
      state.civilizationDisplay.push(null);
    }
  }
}

function checkGameEndConditions(state: GameState): boolean {
  // Condition 1: Not enough cards to fill display at start of next round
  const cardsInDisplay = state.civilizationDisplay.filter(c => c !== null).length;
  const cardsNeeded = 4 - cardsInDisplay;
  if (cardsNeeded > 0 && state.civilizationDeck.length < cardsNeeded) {
    return true;
  }

  // Condition 2: Any building stack is completely empty
  for (const stack of state.buildingStacks) {
    if (stack.length === 0) {
      return true;
    }
  }

  return false;
}

export { checkGameEndConditions };
