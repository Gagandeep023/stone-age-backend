import type { CivilizationCard, CultureSymbol } from '../types/index.js';
import { shuffleArray } from './buildings.js';

// 36 total: 16 green (culture) + 20 sand (multiplier)
// Green: 8 symbols x 2 copies
// Sand: 4 categories with varying figure counts and immediate effects

const CULTURE_SYMBOLS: CultureSymbol[] = [
  'writing', 'medicine', 'pottery', 'art',
  'music', 'weaving', 'transport', 'sundial',
];

// Build the 16 green culture cards (2 of each symbol)
// Each has a different immediate effect
function createCultureCards(): CivilizationCard[] {
  const cards: CivilizationCard[] = [];
  let id = 1;

  // Pair 1: Writing - food effects
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'food', amount: 3 }, scoringBottom: { type: 'culture', symbol: 'writing' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'food', amount: 5 }, scoringBottom: { type: 'culture', symbol: 'writing' } });

  // Pair 2: Medicine - food effects
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'food', amount: 4 }, scoringBottom: { type: 'culture', symbol: 'medicine' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'food', amount: 7 }, scoringBottom: { type: 'culture', symbol: 'medicine' } });

  // Pair 3: Pottery - resource effects
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'resource', resource: 'stone', amount: 1 }, scoringBottom: { type: 'culture', symbol: 'pottery' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'resource', resource: 'gold', amount: 1 }, scoringBottom: { type: 'culture', symbol: 'pottery' } });

  // Pair 4: Art - resource effects
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'resource', resource: 'brick', amount: 2 }, scoringBottom: { type: 'culture', symbol: 'art' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'resource', resource: 'stone', amount: 2 }, scoringBottom: { type: 'culture', symbol: 'art' } });

  // Pair 5: Music - points
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'points', amount: 3 }, scoringBottom: { type: 'culture', symbol: 'music' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'points', amount: 3 }, scoringBottom: { type: 'culture', symbol: 'music' } });

  // Pair 6: Weaving - tool / food production
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'tool' }, scoringBottom: { type: 'culture', symbol: 'weaving' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'foodProduction' }, scoringBottom: { type: 'culture', symbol: 'weaving' } });

  // Pair 7: Transport - one-use tools
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'oneUseTool', value: 3 }, scoringBottom: { type: 'culture', symbol: 'transport' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'oneUseTool', value: 4 }, scoringBottom: { type: 'culture', symbol: 'transport' } });

  // Pair 8: Sundial - card draw / flex resources
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'cardDraw' }, scoringBottom: { type: 'culture', symbol: 'sundial' } });
  cards.push({ id: `culture-${id++}`, immediateEffect: { type: 'flexResources', amount: 2 }, scoringBottom: { type: 'culture', symbol: 'sundial' } });

  return cards;
}

// Build the 20 sand multiplier cards
function createMultiplierCards(): CivilizationCard[] {
  const cards: CivilizationCard[] = [];
  let id = 1;

  // Farmers (5 cards, 7 figures total) - multiplied by food production
  cards.push({ id: `mult-farmer-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'farmer', figureCount: 1 } });
  cards.push({ id: `mult-farmer-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'farmer', figureCount: 1 } });
  cards.push({ id: `mult-farmer-${id++}`, immediateEffect: { type: 'food', amount: 2 }, scoringBottom: { type: 'multiplier', category: 'farmer', figureCount: 2 } });
  cards.push({ id: `mult-farmer-${id++}`, immediateEffect: { type: 'foodProduction' }, scoringBottom: { type: 'multiplier', category: 'farmer', figureCount: 1 } });
  cards.push({ id: `mult-farmer-${id++}`, immediateEffect: { type: 'food', amount: 1 }, scoringBottom: { type: 'multiplier', category: 'farmer', figureCount: 2 } });

  id = 1;
  // Tool Makers (5 cards, 8 figures total) - multiplied by total tool value
  cards.push({ id: `mult-toolMaker-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'toolMaker', figureCount: 2 } });
  cards.push({ id: `mult-toolMaker-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'toolMaker', figureCount: 1 } });
  cards.push({ id: `mult-toolMaker-${id++}`, immediateEffect: { type: 'resource', resource: 'brick', amount: 1 }, scoringBottom: { type: 'multiplier', category: 'toolMaker', figureCount: 2 } });
  cards.push({ id: `mult-toolMaker-${id++}`, immediateEffect: { type: 'oneUseTool', value: 2 }, scoringBottom: { type: 'multiplier', category: 'toolMaker', figureCount: 1 } });
  cards.push({ id: `mult-toolMaker-${id++}`, immediateEffect: { type: 'resourceDice', diceCount: 2 }, scoringBottom: { type: 'multiplier', category: 'toolMaker', figureCount: 2 } });

  id = 1;
  // Hut Builders (5 cards, 9 figures total) - multiplied by number of buildings
  cards.push({ id: `mult-hutBuilder-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'hutBuilder', figureCount: 2 } });
  cards.push({ id: `mult-hutBuilder-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'hutBuilder', figureCount: 2 } });
  cards.push({ id: `mult-hutBuilder-${id++}`, immediateEffect: { type: 'resource', resource: 'wood', amount: 1 }, scoringBottom: { type: 'multiplier', category: 'hutBuilder', figureCount: 2 } });
  cards.push({ id: `mult-hutBuilder-${id++}`, immediateEffect: { type: 'resourceDice', diceCount: 2 }, scoringBottom: { type: 'multiplier', category: 'hutBuilder', figureCount: 1 } });
  cards.push({ id: `mult-hutBuilder-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'hutBuilder', figureCount: 2 } });

  id = 1;
  // Shamans (5 cards, 7 figures total) - multiplied by number of workers
  cards.push({ id: `mult-shaman-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'shaman', figureCount: 1 } });
  cards.push({ id: `mult-shaman-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'shaman', figureCount: 2 } });
  cards.push({ id: `mult-shaman-${id++}`, immediateEffect: { type: 'diceForItems' }, scoringBottom: { type: 'multiplier', category: 'shaman', figureCount: 1 } });
  cards.push({ id: `mult-shaman-${id++}`, immediateEffect: { type: 'resource', resource: 'gold', amount: 1 }, scoringBottom: { type: 'multiplier', category: 'shaman', figureCount: 1 } });
  cards.push({ id: `mult-shaman-${id++}`, immediateEffect: { type: 'points', amount: 3 }, scoringBottom: { type: 'multiplier', category: 'shaman', figureCount: 2 } });

  return cards;
}

export const ALL_CIVILIZATION_CARDS: CivilizationCard[] = [
  ...createCultureCards(),
  ...createMultiplierCards(),
];

export function createShuffledDeck(): CivilizationCard[] {
  return shuffleArray(ALL_CIVILIZATION_CARDS);
}

export { CULTURE_SYMBOLS };
