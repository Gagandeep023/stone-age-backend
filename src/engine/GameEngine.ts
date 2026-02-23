import type {
  GameState, LocationId, ResourceType, ValidationResult,
  RoomPlayer, DiceForItemsChoice,
} from '../types/index.js';
import { RESOURCE_LOCATIONS, VILLAGE_LOCATIONS } from '../types/index.js';
import { createInitialGameState } from './GameSetup.js';
import { validatePlacement, placeWorkers } from './WorkerPlacement.js';
import {
  validateResolveAction,
  resolveResourceLocation,
  resolveToolMaker,
  resolveHut,
  resolveField,
  resolveBuilding,
  resolveCivilizationCard,
  applyToolsToDice,
  confirmResourceGathering,
  skipAction,
  handleDiceForItemsChoice,
} from './ActionResolution.js';
import { validateFeeding, feedWorkers, acceptStarvation } from './Feeding.js';
import { calculateFinalScores, determineWinner } from './Scoring.js';

export type GameAction =
  | { type: 'placeWorkers'; playerId: string; location: LocationId; count: number }
  | { type: 'resolveAction'; playerId: string; location: LocationId }
  | { type: 'rollDice'; playerId: string }
  | { type: 'useTools'; playerId: string; toolIndices: number[] }
  | { type: 'confirmResourceGathering'; playerId: string }
  | { type: 'payForBuilding'; playerId: string; location: LocationId; resources: Partial<Record<ResourceType, number>> }
  | { type: 'payForCard'; playerId: string; location: LocationId; resources: ResourceType[] }
  | { type: 'skipAction'; playerId: string; location: LocationId }
  | { type: 'feedWorkers'; playerId: string; resourcesAsFood?: Partial<Record<ResourceType, number>> }
  | { type: 'acceptStarvation'; playerId: string }
  | { type: 'chooseDiceReward'; playerId: string; choice: DiceForItemsChoice };

/**
 * Main game engine - processes actions and returns new state
 */
export class GameEngine {
  /**
   * Create a new game from a list of room players
   */
  static createGame(gameId: string, players: RoomPlayer[]): GameState {
    return createInitialGameState(gameId, players);
  }

  /**
   * Process a game action and return the new state.
   * Returns { state, error } - if error is set, state is unchanged.
   */
  static processAction(
    state: GameState,
    action: GameAction,
  ): { state: GameState; error?: string } {
    if (state.gameOver) {
      return { state, error: 'Game is already over' };
    }

    // Handle pending dice-for-items choices
    if (state.pendingDiceForItems) {
      if (action.type === 'chooseDiceReward') {
        const newState = handleDiceForItemsChoice(state, action.playerId, action.choice);
        return { state: newState };
      }
      return { state, error: 'Waiting for all players to choose dice rewards' };
    }

    switch (action.type) {
      case 'placeWorkers': {
        const validation = validatePlacement(state, action.playerId, action.location, action.count);
        if (!validation.valid) return { state, error: validation.error };
        const newState = placeWorkers(state, action.playerId, action.location, action.count);
        return { state: newState };
      }

      case 'resolveAction': {
        const validation = validateResolveAction(state, action.playerId, action.location);
        if (!validation.valid) return { state, error: validation.error };
        return this.handleResolveAction(state, action.playerId, action.location);
      }

      case 'rollDice': {
        // This is for resource locations - find what location the player is resolving
        const player = state.players.find(p => p.id === action.playerId);
        if (!player) return { state, error: 'Player not found' };
        // This action is implicit in resolveAction for resource locations
        return { state, error: 'Use resolveAction instead' };
      }

      case 'useTools': {
        const player = state.players.find(p => p.id === action.playerId);
        if (!player || !player.currentDiceRoll || player.currentDiceRoll.resolved) {
          return { state, error: 'No pending dice roll' };
        }
        const newState = applyToolsToDice(state, action.playerId, action.toolIndices);
        return { state: newState };
      }

      case 'confirmResourceGathering': {
        const player = state.players.find(p => p.id === action.playerId);
        if (!player || !player.currentDiceRoll || player.currentDiceRoll.resolved) {
          return { state, error: 'No pending dice roll to confirm' };
        }
        const newState = confirmResourceGathering(state, action.playerId);
        return { state: this.checkGameEnd(newState) };
      }

      case 'payForBuilding': {
        return this.handleBuildingPayment(state, action.playerId, action.location, action.resources);
      }

      case 'payForCard': {
        return this.handleCardPayment(state, action.playerId, action.location, action.resources);
      }

      case 'skipAction': {
        const validation = validateResolveAction(state, action.playerId, action.location);
        if (!validation.valid) return { state, error: validation.error };
        const newState = skipAction(state, action.playerId, action.location);
        return { state: this.checkGameEnd(newState) };
      }

      case 'feedWorkers': {
        const validation = validateFeeding(state, action.playerId);
        if (!validation.valid) return { state, error: validation.error };
        const newState = feedWorkers(state, action.playerId, action.resourcesAsFood);
        return { state: this.checkGameEnd(newState) };
      }

      case 'acceptStarvation': {
        const validation = validateFeeding(state, action.playerId);
        if (!validation.valid) return { state, error: validation.error };
        const newState = acceptStarvation(state, action.playerId);
        return { state: this.checkGameEnd(newState) };
      }

      default:
        return { state, error: 'Unknown action type' };
    }
  }

  /**
   * Handle resolving a location during action phase
   */
  private static handleResolveAction(
    state: GameState,
    playerId: string,
    location: LocationId,
  ): { state: GameState; error?: string } {
    // Resource gathering locations -> roll dice
    if (RESOURCE_LOCATIONS.includes(location as any)) {
      const newState = resolveResourceLocation(state, playerId, location);
      return { state: newState };
    }

    // Village locations -> immediate effect
    if (location === 'toolMaker') {
      const newState = resolveToolMaker(state, playerId);
      return { state: this.checkGameEnd(newState) };
    }
    if (location === 'hut') {
      const newState = resolveHut(state, playerId);
      return { state: this.checkGameEnd(newState) };
    }
    if (location === 'field') {
      const newState = resolveField(state, playerId);
      return { state: this.checkGameEnd(newState) };
    }

    // Building and card locations need player to choose payment
    // Return state with a "pending" marker so the client knows to prompt payment
    if (location.startsWith('building_') || location.startsWith('civCard_')) {
      // The client will follow up with payForBuilding or payForCard
      return { state };
    }

    return { state, error: 'Unknown location' };
  }

  /**
   * Handle building payment
   */
  private static handleBuildingPayment(
    state: GameState,
    playerId: string,
    location: LocationId,
    resources: Partial<Record<ResourceType, number>>,
  ): { state: GameState; error?: string } {
    const validation = validateResolveAction(state, playerId, location);
    if (!validation.valid) return { state, error: validation.error };

    const newState = resolveBuilding(state, playerId, location, resources);
    return { state: this.checkGameEnd(newState) };
  }

  /**
   * Handle card payment
   */
  private static handleCardPayment(
    state: GameState,
    playerId: string,
    location: LocationId,
    resources: ResourceType[],
  ): { state: GameState; error?: string } {
    const validation = validateResolveAction(state, playerId, location);
    if (!validation.valid) return { state, error: validation.error };

    const newState = resolveCivilizationCard(state, playerId, location, resources);
    return { state: this.checkGameEnd(newState) };
  }

  /**
   * Check if the game ended and calculate final scores
   */
  private static checkGameEnd(state: GameState): GameState {
    if (!state.gameOver) return state;

    const finalScores = calculateFinalScores(state);
    const winnerId = determineWinner(finalScores, state);

    state.finalScores = finalScores;
    state.winner = winnerId;

    const winner = state.players.find(p => p.id === winnerId)!;
    state.log.push({
      timestamp: Date.now(),
      message: `${winner.name} wins with ${finalScores.find(s => s.playerId === winnerId)!.totalScore} points!`,
      type: 'system',
    });

    return state;
  }
}
