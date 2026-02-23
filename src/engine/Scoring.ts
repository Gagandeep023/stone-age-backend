import type {
  GameState, PlayerState, FinalScore, MultiplierBreakdown,
  CultureSymbol, MultiplierCategory,
} from '../types/index.js';
import { RESOURCE_VALUES } from '../types/index.js';
import { CULTURE_SYMBOLS } from '../data/civilizationCards.js';

/**
 * Calculate final scores for all players at game end
 */
export function calculateFinalScores(state: GameState): FinalScore[] {
  return state.players.map(player => {
    const cultureSetScore = calculateCultureSetScore(player);
    const multiplierScore = calculateMultiplierScore(player);
    const resourceScore = calculateResourceScore(player);

    const totalScore = player.score + cultureSetScore + multiplierScore.total + resourceScore;

    return {
      playerId: player.id,
      playerName: player.name,
      inGameScore: player.score,
      cultureSetScore,
      multiplierScore,
      resourceScore,
      totalScore,
    };
  });
}

/**
 * Culture set scoring: for each set of unique symbols, score = uniqueCount^2
 * Duplicates form additional sets
 */
function calculateCultureSetScore(player: PlayerState): number {
  // Count how many of each symbol the player has
  const symbolCounts: Partial<Record<CultureSymbol, number>> = {};

  for (const card of player.civilizationCards) {
    if (card.scoringBottom.type === 'culture') {
      const sym = card.scoringBottom.symbol;
      symbolCounts[sym] = (symbolCounts[sym] || 0) + 1;
    }
  }

  // Build sets: first set uses one of each unique symbol, second set uses remaining
  let totalScore = 0;
  const remaining = { ...symbolCounts };
  let hasMore = true;

  while (hasMore) {
    let uniqueInSet = 0;
    hasMore = false;

    for (const sym of CULTURE_SYMBOLS) {
      if ((remaining[sym] || 0) > 0) {
        uniqueInSet++;
        remaining[sym]!--;
        if (remaining[sym]! > 0) hasMore = true;
      }
    }

    if (uniqueInSet > 0) {
      totalScore += uniqueInSet * uniqueInSet;
    }

    if (uniqueInSet === 0) break;
  }

  return totalScore;
}

/**
 * Multiplier scoring:
 * - Farmers: figures x food production
 * - Tool Makers: figures x total tool value
 * - Hut Builders: figures x number of buildings
 * - Shamans: figures x number of workers
 */
function calculateMultiplierScore(player: PlayerState): MultiplierBreakdown {
  const figureCounts: Record<MultiplierCategory, number> = {
    farmer: 0,
    toolMaker: 0,
    hutBuilder: 0,
    shaman: 0,
  };

  for (const card of player.civilizationCards) {
    if (card.scoringBottom.type === 'multiplier') {
      figureCounts[card.scoringBottom.category] += card.scoringBottom.figureCount;
    }
  }

  const totalToolValue = player.tools.reduce((sum, t) => sum + t.level, 0);

  const farmer = {
    figures: figureCounts.farmer,
    value: player.foodProduction,
    score: figureCounts.farmer * player.foodProduction,
  };

  const toolMaker = {
    figures: figureCounts.toolMaker,
    value: totalToolValue,
    score: figureCounts.toolMaker * totalToolValue,
  };

  const hutBuilder = {
    figures: figureCounts.hutBuilder,
    value: player.buildings.length,
    score: figureCounts.hutBuilder * player.buildings.length,
  };

  const shaman = {
    figures: figureCounts.shaman,
    value: player.totalWorkers,
    score: figureCounts.shaman * player.totalWorkers,
  };

  return {
    farmer,
    toolMaker,
    hutBuilder,
    shaman,
    total: farmer.score + toolMaker.score + hutBuilder.score + shaman.score,
  };
}

/**
 * Remaining resources: 1 VP per resource (any type) + 1 VP per food
 */
function calculateResourceScore(player: PlayerState): number {
  let total = player.resources.food;
  for (const res of ['wood', 'brick', 'stone', 'gold'] as const) {
    total += player.resources[res];
  }
  return total;
}

/**
 * Determine winner: highest total score.
 * Tiebreaker: food production, then tool value, then worker count.
 */
export function determineWinner(scores: FinalScore[], state: GameState): string {
  const sorted = [...scores].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;

    const playerA = state.players.find(p => p.id === a.playerId)!;
    const playerB = state.players.find(p => p.id === b.playerId)!;

    // Tiebreaker 1: food production
    if (playerB.foodProduction !== playerA.foodProduction) {
      return playerB.foodProduction - playerA.foodProduction;
    }

    // Tiebreaker 2: total tool value
    const toolA = playerA.tools.reduce((s, t) => s + t.level, 0);
    const toolB = playerB.tools.reduce((s, t) => s + t.level, 0);
    if (toolB !== toolA) return toolB - toolA;

    // Tiebreaker 3: worker count
    return playerB.totalWorkers - playerA.totalWorkers;
  });

  return sorted[0].playerId;
}
