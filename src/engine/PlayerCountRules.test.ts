import { describe, it, expect } from 'vitest';
import {
  getBlockedVillageLocation,
  getBuildingStackCount,
  isLocationAvailable,
} from './PlayerCountRules.js';

describe('PlayerCountRules', () => {
  describe('getBlockedVillageLocation', () => {
    it('returns null for 4 players', () => {
      expect(getBlockedVillageLocation(4, 0)).toBeNull();
      expect(getBlockedVillageLocation(4, 1)).toBeNull();
      expect(getBlockedVillageLocation(4, 5)).toBeNull();
    });

    it('rotates through toolMaker, hut, field for 2 players', () => {
      // VILLAGE_LOCATIONS = ['toolMaker', 'hut', 'field']
      expect(getBlockedVillageLocation(2, 0)).toBe('toolMaker'); // 0 % 3 = 0
      expect(getBlockedVillageLocation(2, 1)).toBe('hut');       // 1 % 3 = 1
      expect(getBlockedVillageLocation(2, 2)).toBe('field');     // 2 % 3 = 2
      expect(getBlockedVillageLocation(2, 3)).toBe('toolMaker'); // 3 % 3 = 0
      expect(getBlockedVillageLocation(2, 4)).toBe('hut');       // 4 % 3 = 1
      expect(getBlockedVillageLocation(2, 5)).toBe('field');     // 5 % 3 = 2
    });

    it('rotates through toolMaker, hut, field for 3 players', () => {
      expect(getBlockedVillageLocation(3, 0)).toBe('toolMaker');
      expect(getBlockedVillageLocation(3, 1)).toBe('hut');
      expect(getBlockedVillageLocation(3, 2)).toBe('field');
      expect(getBlockedVillageLocation(3, 3)).toBe('toolMaker');
    });

    it('blocks a location for fewer than 4 players', () => {
      // playerCount 2 and 3 should always return a non-null value
      for (let round = 0; round < 10; round++) {
        expect(getBlockedVillageLocation(2, round)).not.toBeNull();
        expect(getBlockedVillageLocation(3, round)).not.toBeNull();
      }
    });
  });

  describe('getBuildingStackCount', () => {
    it('returns the player count as the number of building stacks', () => {
      expect(getBuildingStackCount(2)).toBe(2);
      expect(getBuildingStackCount(3)).toBe(3);
      expect(getBuildingStackCount(4)).toBe(4);
    });
  });

  describe('isLocationAvailable', () => {
    it('returns false for a blocked village location', () => {
      expect(isLocationAvailable('toolMaker', 2, 'toolMaker')).toBe(false);
      expect(isLocationAvailable('hut', 3, 'hut')).toBe(false);
      expect(isLocationAvailable('field', 2, 'field')).toBe(false);
    });

    it('returns true for village locations that are not blocked', () => {
      expect(isLocationAvailable('hut', 2, 'toolMaker')).toBe(true);
      expect(isLocationAvailable('field', 3, 'toolMaker')).toBe(true);
      expect(isLocationAvailable('toolMaker', 2, 'field')).toBe(true);
    });

    it('returns true for village locations when blockedVillage is null', () => {
      expect(isLocationAvailable('toolMaker', 4, null)).toBe(true);
      expect(isLocationAvailable('hut', 4, null)).toBe(true);
      expect(isLocationAvailable('field', 4, null)).toBe(true);
    });

    it('returns false for building stacks beyond player count', () => {
      // 2 players: only building_0 and building_1 available
      expect(isLocationAvailable('building_2', 2, null)).toBe(false);
      expect(isLocationAvailable('building_3', 2, null)).toBe(false);

      // 3 players: only building_0, building_1, building_2 available
      expect(isLocationAvailable('building_3', 3, null)).toBe(false);
    });

    it('returns true for building stacks within player count', () => {
      expect(isLocationAvailable('building_0', 2, null)).toBe(true);
      expect(isLocationAvailable('building_1', 2, null)).toBe(true);
      expect(isLocationAvailable('building_0', 4, null)).toBe(true);
      expect(isLocationAvailable('building_3', 4, null)).toBe(true);
    });

    it('returns true for resource and other valid locations', () => {
      expect(isLocationAvailable('huntingGrounds', 2, 'toolMaker')).toBe(true);
      expect(isLocationAvailable('forest', 3, 'hut')).toBe(true);
      expect(isLocationAvailable('clayPit', 4, null)).toBe(true);
      expect(isLocationAvailable('quarry', 2, 'field')).toBe(true);
      expect(isLocationAvailable('river', 3, 'toolMaker')).toBe(true);
    });

    it('returns true for civilization card locations', () => {
      expect(isLocationAvailable('civCard_0', 2, null)).toBe(true);
      expect(isLocationAvailable('civCard_3', 4, 'hut')).toBe(true);
    });
  });
});
