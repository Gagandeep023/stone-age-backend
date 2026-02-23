import { describe, it, expect, vi } from 'vitest';
import { rollDice, calculateResources, applyTools } from './DiceRoller.js';

describe('DiceRoller', () => {
  describe('rollDice', () => {
    it('returns the correct number of dice', () => {
      expect(rollDice(1)).toHaveLength(1);
      expect(rollDice(3)).toHaveLength(3);
      expect(rollDice(5)).toHaveLength(5);
      expect(rollDice(0)).toHaveLength(0);
    });

    it('returns values between 1 and 6 inclusive', () => {
      // Roll many dice to check the range
      const results = rollDice(100);
      for (const value of results) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    });

    it('returns integers only', () => {
      const results = rollDice(50);
      for (const value of results) {
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('produces varied results across multiple rolls', () => {
      // Roll enough dice that we should see more than one unique value
      const results = rollDice(60);
      const unique = new Set(results);
      expect(unique.size).toBeGreaterThan(1);
    });

    it('returns predictable values when Math.random is mocked', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      // Math.floor(0.5 * 6) + 1 = 4
      randomSpy.mockReturnValue(0.5);
      const results = rollDice(3);
      expect(results).toEqual([4, 4, 4]);
      randomSpy.mockRestore();
    });
  });

  describe('calculateResources', () => {
    it('performs integer division correctly', () => {
      expect(calculateResources(10, 3)).toBe(3);
      expect(calculateResources(7, 4)).toBe(1);
      expect(calculateResources(11, 5)).toBe(2);
      expect(calculateResources(6, 6)).toBe(1);
    });

    it('returns 0 when total is less than divisor', () => {
      expect(calculateResources(2, 3)).toBe(0);
      expect(calculateResources(1, 6)).toBe(0);
      expect(calculateResources(0, 4)).toBe(0);
    });

    it('handles exact multiples', () => {
      expect(calculateResources(12, 3)).toBe(4);
      expect(calculateResources(24, 6)).toBe(4);
      expect(calculateResources(20, 5)).toBe(4);
    });

    it('floors the result for non-exact divisions', () => {
      // 13 / 3 = 4.333... -> 4
      expect(calculateResources(13, 3)).toBe(4);
      // 9 / 4 = 2.25 -> 2
      expect(calculateResources(9, 4)).toBe(2);
      // 17 / 5 = 3.4 -> 3
      expect(calculateResources(17, 5)).toBe(3);
    });
  });

  describe('applyTools', () => {
    it('adds tool values to the dice total', () => {
      expect(applyTools(10, [1, 2, 3])).toBe(16);
      expect(applyTools(8, [4])).toBe(12);
      expect(applyTools(5, [2, 2])).toBe(9);
    });

    it('returns the same total with an empty tool array', () => {
      expect(applyTools(10, [])).toBe(10);
      expect(applyTools(0, [])).toBe(0);
      expect(applyTools(25, [])).toBe(25);
    });

    it('handles a single tool value', () => {
      expect(applyTools(7, [3])).toBe(10);
    });

    it('handles large tool values', () => {
      expect(applyTools(12, [4, 4, 4])).toBe(24);
    });
  });
});
