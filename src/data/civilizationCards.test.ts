import { describe, it, expect } from 'vitest';
import { ALL_CIVILIZATION_CARDS, createShuffledDeck, CULTURE_SYMBOLS } from './civilizationCards.js';

describe('ALL_CIVILIZATION_CARDS', () => {
  it('has exactly 36 cards', () => {
    expect(ALL_CIVILIZATION_CARDS).toHaveLength(36);
  });

  it('has 16 culture cards', () => {
    const culture = ALL_CIVILIZATION_CARDS.filter((c) => c.scoringBottom.type === 'culture');
    expect(culture).toHaveLength(16);
  });

  it('has 20 multiplier cards', () => {
    const multiplier = ALL_CIVILIZATION_CARDS.filter((c) => c.scoringBottom.type === 'multiplier');
    expect(multiplier).toHaveLength(20);
  });

  it('all cards have unique ids', () => {
    const ids = ALL_CIVILIZATION_CARDS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all cards have an immediateEffect', () => {
    for (const card of ALL_CIVILIZATION_CARDS) {
      expect(card.immediateEffect).toBeDefined();
    }
  });
});

describe('culture cards', () => {
  const cultureCards = ALL_CIVILIZATION_CARDS.filter(
    (c) => c.scoringBottom.type === 'culture'
  );

  it('each of the 8 culture symbols appears exactly 2 times', () => {
    const symbolCounts = new Map<string, number>();
    for (const card of cultureCards) {
      if (card.scoringBottom.type === 'culture') {
        const sym = card.scoringBottom.symbol;
        symbolCounts.set(sym, (symbolCounts.get(sym) ?? 0) + 1);
      }
    }
    expect(symbolCounts.size).toBe(8);
    for (const [symbol, count] of symbolCounts) {
      expect(count, `symbol "${symbol}" should appear 2 times`).toBe(2);
    }
  });

  it('contains the expected culture symbols', () => {
    const expected = ['writing', 'medicine', 'pottery', 'art', 'music', 'weaving', 'transport', 'sundial'];
    const symbols = new Set<string>();
    for (const card of cultureCards) {
      if (card.scoringBottom.type === 'culture') {
        symbols.add(card.scoringBottom.symbol);
      }
    }
    expect([...symbols].sort()).toEqual(expected.sort());
  });
});

describe('multiplier cards', () => {
  const multiplierCards = ALL_CIVILIZATION_CARDS.filter(
    (c) => c.scoringBottom.type === 'multiplier'
  );

  it('has 5 farmer cards', () => {
    const farmers = multiplierCards.filter(
      (c) => c.scoringBottom.type === 'multiplier' && c.scoringBottom.category === 'farmer'
    );
    expect(farmers).toHaveLength(5);
  });

  it('has 5 toolMaker cards', () => {
    const toolMakers = multiplierCards.filter(
      (c) => c.scoringBottom.type === 'multiplier' && c.scoringBottom.category === 'toolMaker'
    );
    expect(toolMakers).toHaveLength(5);
  });

  it('has 5 hutBuilder cards', () => {
    const hutBuilders = multiplierCards.filter(
      (c) => c.scoringBottom.type === 'multiplier' && c.scoringBottom.category === 'hutBuilder'
    );
    expect(hutBuilders).toHaveLength(5);
  });

  it('has 5 shaman cards', () => {
    const shamans = multiplierCards.filter(
      (c) => c.scoringBottom.type === 'multiplier' && c.scoringBottom.category === 'shaman'
    );
    expect(shamans).toHaveLength(5);
  });
});

describe('CULTURE_SYMBOLS', () => {
  it('has 8 symbols', () => {
    expect(CULTURE_SYMBOLS).toHaveLength(8);
  });

  it('contains all expected symbols', () => {
    const expected = ['writing', 'medicine', 'pottery', 'art', 'music', 'weaving', 'transport', 'sundial'];
    expect([...CULTURE_SYMBOLS].sort()).toEqual(expected.sort());
  });
});

describe('createShuffledDeck', () => {
  it('returns 36 cards', () => {
    const deck = createShuffledDeck();
    expect(deck).toHaveLength(36);
  });

  it('contains all the same card ids as ALL_CIVILIZATION_CARDS', () => {
    const deck = createShuffledDeck();
    const deckIds = deck.map((c) => c.id).sort();
    const originalIds = ALL_CIVILIZATION_CARDS.map((c) => c.id).sort();
    expect(deckIds).toEqual(originalIds);
  });
});
