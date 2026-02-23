import type {
  GameState, LocationId, ResourceType, ValidationResult,
  DiceRollState, DiceForItemsState, DiceForItemsChoice, CivilizationCard,
} from '../types/index.js';
import {
  RESOURCE_DIVISORS, RESOURCE_VALUES, LOCATION_RESOURCE_MAP,
  RESOURCE_LOCATIONS, CARD_POSITION_COST,
} from '../types/index.js';
import { MAX_TOOL_SLOTS, MAX_TOOL_LEVEL, MAX_FOOD_PRODUCTION, MAX_WORKERS } from '../data/constants.js';
import { rollDice, calculateResources } from './DiceRoller.js';
import { formatLocation } from './WorkerPlacement.js';

/**
 * Validate that a player can resolve a specific location
 */
export function validateResolveAction(
  state: GameState,
  playerId: string,
  location: LocationId,
): ValidationResult {
  if (state.phase !== 'actionResolution') {
    return { valid: false, error: 'Not in action resolution phase' };
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) return { valid: false, error: 'Player not found' };

  const playerIndex = state.players.indexOf(player);
  if (playerIndex !== state.currentPlayerIndex) {
    return { valid: false, error: 'Not your turn' };
  }

  if (player.currentDiceRoll && !player.currentDiceRoll.resolved) {
    return { valid: false, error: 'Must resolve current dice roll first' };
  }

  if (!player.unresolvedLocations.includes(location)) {
    return { valid: false, error: 'No workers at this location to resolve' };
  }

  return { valid: true };
}

/**
 * Start resolving a resource gathering location.
 * This rolls dice and creates a pending dice state.
 */
export function resolveResourceLocation(
  state: GameState,
  playerId: string,
  location: LocationId,
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;
  const workerCount = newState.board.locations[location].workersByPlayer[playerId] || 0;

  const dice = rollDice(workerCount);
  const total = dice.reduce((s, d) => s + d, 0);

  const resourceKey = LOCATION_RESOURCE_MAP[location as keyof typeof LOCATION_RESOURCE_MAP];
  const divisor = RESOURCE_DIVISORS[resourceKey];
  const earned = calculateResources(total, divisor);

  player.currentDiceRoll = {
    location,
    dice,
    total,
    toolsApplied: [],
    finalTotal: total,
    resourcesEarned: earned,
    resolved: false,
  };

  newState.log.push({
    timestamp: Date.now(),
    playerId,
    message: `${player.name} rolled [${dice.join(', ')}] = ${total} at ${formatLocation(location)}`,
    type: 'dice',
  });

  return newState;
}

/**
 * Apply tools to the current dice roll
 */
export function applyToolsToDice(
  state: GameState,
  playerId: string,
  toolIndices: number[],
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;
  const roll = player.currentDiceRoll;

  if (!roll || roll.resolved) {
    return newState; // no-op
  }

  let addedValue = 0;

  for (const idx of toolIndices) {
    // Check permanent tools
    if (idx < player.tools.length) {
      const tool = player.tools[idx];
      if (!tool.usedThisRound) {
        tool.usedThisRound = true;
        addedValue += tool.level;
        roll.toolsApplied.push(idx);
      }
    } else {
      // One-use tools (indices after permanent tools)
      const oneUseIdx = idx - player.tools.length;
      if (oneUseIdx >= 0 && oneUseIdx < player.oneUseTools.length) {
        addedValue += player.oneUseTools[oneUseIdx];
        roll.toolsApplied.push(idx);
        player.oneUseTools.splice(oneUseIdx, 1);
      }
    }
  }

  roll.finalTotal = roll.total + addedValue;

  // Recalculate resources
  const resourceKey = LOCATION_RESOURCE_MAP[roll.location as keyof typeof LOCATION_RESOURCE_MAP];
  const divisor = RESOURCE_DIVISORS[resourceKey];
  roll.resourcesEarned = calculateResources(roll.finalTotal, divisor);

  if (addedValue > 0) {
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} used tools (+${addedValue}) for total ${roll.finalTotal}`,
      type: 'resource',
    });
  }

  return newState;
}

/**
 * Confirm resource gathering from a dice roll (food or resources)
 */
export function confirmResourceGathering(
  state: GameState,
  playerId: string,
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;
  const roll = player.currentDiceRoll;

  if (!roll || roll.resolved) return newState;

  const location = roll.location;
  const resourceKey = LOCATION_RESOURCE_MAP[location as keyof typeof LOCATION_RESOURCE_MAP];
  let earned = roll.resourcesEarned;

  if (resourceKey === 'food') {
    player.resources.food += earned;
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} gathered ${earned} food`,
      type: 'resource',
    });
  } else {
    // Cap by supply
    const available = newState.supply[resourceKey as ResourceType];
    earned = Math.min(earned, available);
    player.resources[resourceKey as ResourceType] += earned;
    newState.supply[resourceKey as ResourceType] -= earned;
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} gathered ${earned} ${resourceKey}`,
      type: 'resource',
    });
  }

  roll.resolved = true;

  // Remove from unresolved and return workers
  finishLocationResolution(newState, playerId, location);

  return newState;
}

/**
 * Resolve Tool Maker location: gain/upgrade 1 tool
 */
export function resolveToolMaker(state: GameState, playerId: string): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;

  if (player.tools.length < MAX_TOOL_SLOTS) {
    // Add new tool at level 1
    player.tools.push({ level: 1, usedThisRound: false });
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} gained a new tool (level 1)`,
      type: 'resource',
    });
  } else {
    // Upgrade the lowest tool that isn't maxed
    const upgradeable = player.tools
      .map((t, i) => ({ tool: t, index: i }))
      .filter(t => t.tool.level < MAX_TOOL_LEVEL)
      .sort((a, b) => a.tool.level - b.tool.level);

    if (upgradeable.length > 0) {
      const target = upgradeable[0];
      player.tools[target.index].level++;
      newState.log.push({
        timestamp: Date.now(),
        playerId,
        message: `${player.name} upgraded tool to level ${player.tools[target.index].level}`,
        type: 'resource',
      });
    }
  }

  finishLocationResolution(newState, playerId, 'toolMaker');
  return newState;
}

/**
 * Resolve Hut location: gain 1 worker
 */
export function resolveHut(state: GameState, playerId: string): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;

  if (player.totalWorkers < MAX_WORKERS) {
    player.totalWorkers++;
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} gained a new worker (total: ${player.totalWorkers})`,
      type: 'resource',
    });
  }

  finishLocationResolution(newState, playerId, 'hut');
  return newState;
}

/**
 * Resolve Field location: advance food production by 1
 */
export function resolveField(state: GameState, playerId: string): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;

  if (player.foodProduction < MAX_FOOD_PRODUCTION) {
    player.foodProduction++;
    newState.log.push({
      timestamp: Date.now(),
      playerId,
      message: `${player.name} increased food production to ${player.foodProduction}`,
      type: 'resource',
    });
  }

  finishLocationResolution(newState, playerId, 'field');
  return newState;
}

/**
 * Resolve building: player pays resources and scores VP
 */
export function resolveBuilding(
  state: GameState,
  playerId: string,
  location: LocationId,
  paidResources: Partial<Record<ResourceType, number>>,
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;
  const stackIndex = parseInt(location.split('_')[1], 10);
  const stack = newState.buildingStacks[stackIndex];

  if (!stack || stack.length === 0) return newState;

  const tile = stack[0]; // top tile

  // Validate payment
  const validation = validateBuildingPayment(tile, paidResources, player);
  if (!validation.valid) return newState;

  // Deduct resources
  for (const [res, amount] of Object.entries(paidResources)) {
    if (amount && amount > 0) {
      player.resources[res as ResourceType] -= amount;
      newState.supply[res as ResourceType] += amount;
    }
  }

  // Calculate and award points
  let points = 0;
  if (tile.cost.type === 'fixed') {
    points = tile.cost.points;
  } else {
    // flexible and variable: sum of resource values
    for (const [res, amount] of Object.entries(paidResources)) {
      if (amount && amount > 0) {
        points += amount * RESOURCE_VALUES[res as ResourceType];
      }
    }
  }

  player.score += points;
  player.buildings.push(tile);
  stack.shift(); // remove top tile

  newState.log.push({
    timestamp: Date.now(),
    playerId,
    message: `${player.name} built a building for ${points} VP`,
    type: 'building',
  });

  finishLocationResolution(newState, playerId, location);
  return newState;
}

function validateBuildingPayment(
  tile: { cost: import('../types/index.js').BuildingCost },
  paid: Partial<Record<ResourceType, number>>,
  player: { resources: Record<string, number> },
): ValidationResult {
  const totalPaid = Object.values(paid).reduce((s, v) => s + (v || 0), 0);
  const typesUsed = Object.entries(paid).filter(([, v]) => v && v > 0).length;

  // Check player has enough
  for (const [res, amount] of Object.entries(paid)) {
    if (amount && amount > player.resources[res]) {
      return { valid: false, error: `Not enough ${res}` };
    }
  }

  switch (tile.cost.type) {
    case 'fixed': {
      for (const [res, needed] of Object.entries(tile.cost.resources)) {
        if ((paid[res as ResourceType] || 0) !== needed) {
          return { valid: false, error: `Must pay exactly ${needed} ${res}` };
        }
      }
      return { valid: true };
    }
    case 'flexible': {
      if (totalPaid !== tile.cost.count) {
        return { valid: false, error: `Must pay exactly ${tile.cost.count} resources` };
      }
      if (typesUsed !== tile.cost.differentTypes) {
        return { valid: false, error: `Must use exactly ${tile.cost.differentTypes} different resource types` };
      }
      return { valid: true };
    }
    case 'variable': {
      if (totalPaid < tile.cost.minResources || totalPaid > tile.cost.maxResources) {
        return { valid: false, error: `Must pay ${tile.cost.minResources}-${tile.cost.maxResources} resources` };
      }
      if (totalPaid === 0) {
        return { valid: false, error: 'Must pay at least 1 resource' };
      }
      return { valid: true };
    }
  }
}

/**
 * Resolve civilization card: player pays resources and gets card
 */
export function resolveCivilizationCard(
  state: GameState,
  playerId: string,
  location: LocationId,
  paidResources: ResourceType[],
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find(p => p.id === playerId)!;
  const cardIndex = parseInt(location.split('_')[1], 10);
  const card = newState.civilizationDisplay[cardIndex];

  if (!card) return newState;

  const requiredCost = CARD_POSITION_COST[location as keyof typeof CARD_POSITION_COST];
  if (paidResources.length !== requiredCost) return newState;

  // Validate player has the resources
  const resCounts: Partial<Record<ResourceType, number>> = {};
  for (const r of paidResources) {
    resCounts[r] = (resCounts[r] || 0) + 1;
  }
  for (const [res, count] of Object.entries(resCounts)) {
    if (count! > player.resources[res as ResourceType]) return newState;
  }

  // Deduct resources
  for (const [res, count] of Object.entries(resCounts)) {
    player.resources[res as ResourceType] -= count!;
    newState.supply[res as ResourceType] += count!;
  }

  // Give card to player
  player.civilizationCards.push(card);

  // Apply immediate effect
  applyImmediateEffect(newState, player, card);

  // Slide cards left and draw new one
  newState.civilizationDisplay[cardIndex] = null;
  slideCardsLeft(newState);

  newState.log.push({
    timestamp: Date.now(),
    playerId,
    message: `${player.name} acquired a civilization card`,
    type: 'card',
  });

  finishLocationResolution(newState, playerId, location);
  return newState;
}

/**
 * Apply the immediate effect of a civilization card
 */
function applyImmediateEffect(
  state: GameState,
  player: import('../types/index.js').PlayerState,
  card: CivilizationCard,
): void {
  const effect = card.immediateEffect;

  switch (effect.type) {
    case 'food':
      player.resources.food += effect.amount;
      break;

    case 'resource':
      const available = state.supply[effect.resource];
      const toGain = Math.min(effect.amount, available);
      player.resources[effect.resource] += toGain;
      state.supply[effect.resource] -= toGain;
      break;

    case 'points':
      player.score += effect.amount;
      break;

    case 'tool':
      // Same logic as tool maker
      if (player.tools.length < MAX_TOOL_SLOTS) {
        player.tools.push({ level: 1, usedThisRound: false });
      } else {
        const upgradeable = player.tools
          .filter(t => t.level < MAX_TOOL_LEVEL)
          .sort((a, b) => a.level - b.level);
        if (upgradeable.length > 0) upgradeable[0].level++;
      }
      break;

    case 'foodProduction':
      if (player.foodProduction < MAX_FOOD_PRODUCTION) {
        player.foodProduction++;
      }
      break;

    case 'cardDraw':
      // Draw top card from deck (scoring only, no immediate effect applied)
      if (state.civilizationDeck.length > 0) {
        const drawn = state.civilizationDeck.shift()!;
        player.civilizationCards.push(drawn);
      }
      break;

    case 'oneUseTool':
      player.oneUseTools.push(effect.value);
      break;

    case 'flexResources':
      // Player gets to choose resources - for simplicity, grant wood by default
      // In real implementation this would need player interaction
      const flexAmount = Math.min(effect.amount, state.supply.wood);
      player.resources.wood += flexAmount;
      state.supply.wood -= flexAmount;
      break;

    case 'resourceDice': {
      // Roll dice and convert to resources
      const dice = [];
      for (let i = 0; i < effect.diceCount; i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
      }
      const total = dice.reduce((s, d) => s + d, 0);
      // Player gets to choose which resource - default to highest value affordable
      const resourcesFromDice = calculateResources(total, RESOURCE_DIVISORS.wood);
      const gained = Math.min(resourcesFromDice, state.supply.wood);
      player.resources.wood += gained;
      state.supply.wood -= gained;
      break;
    }

    case 'diceForItems': {
      // All players roll one die each and pick a reward
      // This is handled via pendingDiceForItems state
      const diceResults: number[] = [];
      for (let i = 0; i < state.players.length; i++) {
        diceResults.push(Math.floor(Math.random() * 6) + 1);
      }
      state.pendingDiceForItems = {
        cardPlayerId: player.id,
        dice: diceResults,
        playerChoices: {},
      };
      // Choices will be resolved when all players respond
      break;
    }
  }
}

/**
 * Slide civilization cards left to fill gaps, draw new cards for empty right slots
 */
function slideCardsLeft(state: GameState): void {
  // Remove nulls and compact
  const cards = state.civilizationDisplay.filter(c => c !== null) as CivilizationCard[];

  // Fill display from left
  state.civilizationDisplay = [];
  for (let i = 0; i < 4; i++) {
    if (i < cards.length) {
      state.civilizationDisplay.push(cards[i]);
    } else if (state.civilizationDeck.length > 0) {
      state.civilizationDisplay.push(state.civilizationDeck.shift()!);
    } else {
      state.civilizationDisplay.push(null);
    }
  }
}

/**
 * Skip a building or card action (return worker without buying)
 */
export function skipAction(
  state: GameState,
  playerId: string,
  location: LocationId,
): GameState {
  const newState = structuredClone(state);
  finishLocationResolution(newState, playerId, location);
  return newState;
}

/**
 * Handle dice-for-items choice from a player
 */
export function handleDiceForItemsChoice(
  state: GameState,
  playerId: string,
  choice: DiceForItemsChoice,
): GameState {
  const newState = structuredClone(state);
  const pending = newState.pendingDiceForItems;
  if (!pending) return newState;

  pending.playerChoices[playerId] = choice;

  // Check if all players have chosen
  if (Object.keys(pending.playerChoices).length === newState.players.length) {
    // Apply all choices
    for (const player of newState.players) {
      const playerChoice = pending.playerChoices[player.id];
      if (!playerChoice) continue;

      const playerIdx = newState.players.indexOf(player);
      const dieValue = pending.dice[playerIdx];

      switch (playerChoice.type) {
        case 'resource': {
          // Die value 1-3: wood/brick/stone based on value
          // Die value 4: gold, 5: tool upgrade, 6: food production
          const resAmount = 1;
          const available = newState.supply[playerChoice.resource];
          const gained = Math.min(resAmount, available);
          player.resources[playerChoice.resource] += gained;
          newState.supply[playerChoice.resource] -= gained;
          break;
        }
        case 'tool': {
          if (player.tools.length < MAX_TOOL_SLOTS) {
            player.tools.push({ level: 1, usedThisRound: false });
          } else {
            const upgradeable = player.tools
              .filter(t => t.level < MAX_TOOL_LEVEL)
              .sort((a, b) => a.level - b.level);
            if (upgradeable.length > 0) upgradeable[0].level++;
          }
          break;
        }
        case 'foodProduction': {
          if (player.foodProduction < MAX_FOOD_PRODUCTION) {
            player.foodProduction++;
          }
          break;
        }
      }
    }

    newState.pendingDiceForItems = null;
  }

  return newState;
}

/**
 * Finish resolving a location: remove from unresolved, return workers
 */
function finishLocationResolution(
  state: GameState,
  playerId: string,
  location: LocationId,
): void {
  const player = state.players.find(p => p.id === playerId)!;

  // Remove from unresolved
  const idx = player.unresolvedLocations.indexOf(location);
  if (idx !== -1) {
    player.unresolvedLocations.splice(idx, 1);
  }

  // Clear dice state
  player.currentDiceRoll = null;

  // Return workers from this location to the board state
  const locState = state.board.locations[location];
  const workerCount = locState.workersByPlayer[playerId] || 0;
  locState.totalWorkers -= workerCount;
  delete locState.workersByPlayer[playerId];

  // Check if this player has finished all resolutions
  if (player.unresolvedLocations.length === 0) {
    advanceToNextResolverOrFeeding(state);
  }
}

/**
 * Find the next player who has locations to resolve, or transition to feeding
 */
function advanceToNextResolverOrFeeding(state: GameState): void {
  const playerCount = state.players.length;
  let nextIndex = (state.currentPlayerIndex + 1) % playerCount;
  let checked = 0;

  while (checked < playerCount) {
    if (state.players[nextIndex].unresolvedLocations.length > 0) {
      state.currentPlayerIndex = nextIndex;
      return;
    }
    nextIndex = (nextIndex + 1) % playerCount;
    checked++;
  }

  // All players done - transition to feeding
  transitionToFeeding(state);
}

function transitionToFeeding(state: GameState): void {
  state.phase = 'feeding';
  state.currentPlayerIndex = state.firstPlayerIndex;

  // Reset fed status
  for (const player of state.players) {
    player.hasFed = false;
  }

  // Apply food production to all players
  for (const player of state.players) {
    player.resources.food += player.foodProduction;
  }

  state.log.push({
    timestamp: Date.now(),
    message: 'Action resolution complete. Feeding phase begins.',
    type: 'phase',
  });
}

export { validateBuildingPayment };
