import { describe, expect, it } from 'vitest';
import { ECONOMY } from './economy';
import {
  ALL_ITEMS,
  ALL_SLOTS,
  CATALOG_ITEMS,
  CLOTHING_SLOTS,
  DEFAULT_APPEARANCE,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  INCOMPATIBLE_TAGS,
  ITEMS_BY_ID,
  OPTIONAL_SLOTS,
  RARITIES,
  SKIN_TONES,
  STARTER_ITEMS,
  STARTER_LOADOUT,
  conflictingItems,
  getItem,
  type CatalogItem,
  type Slot,
} from './catalog';

const GAMEPLAY_KEYS = ['speed', 'jump', 'hitbox', 'pressure', 'multiplier', 'pickupValue', 'score'];

describe('cosmetic catalogue', () => {
  it('ships at least 30 unique non-starter items across five rarities and every slot', () => {
    expect(CATALOG_ITEMS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ALL_ITEMS.map((i) => i.id)).size).toBe(ALL_ITEMS.length);
    expect(new Set(CATALOG_ITEMS.map((i) => i.rarity))).toEqual(new Set(RARITIES));
    for (const slot of ALL_SLOTS) {
      const n = CATALOG_ITEMS.filter((i) => i.slot === slot).length;
      expect(n, slot).toBeGreaterThanOrEqual(slot === 'board' ? 8 : 5);
    }
  });

  it('makes every non-starter item directly purchasable at a fixed in-band price', () => {
    for (const it of CATALOG_ITEMS) {
      expect(it.starter, it.id).toBeFalsy();
      expect(it.price, it.id).toBeGreaterThan(0);
      expect(it.dropEligible, it.id).toBe(true);
      const [lo, hi] = ECONOMY.priceBands[it.rarity];
      expect(it.price, `${it.id} ${it.rarity}`).toBeGreaterThanOrEqual(lo);
      expect(it.price, `${it.id} ${it.rarity}`).toBeLessThanOrEqual(hi);
    }
    for (const it of STARTER_ITEMS) {
      expect(it.starter).toBe(true);
      expect(it.price).toBe(0);
      expect(it.dropEligible).toBe(false);
    }
  });

  it('starts every player with a complete free outfit and board', () => {
    for (const slot of ALL_SLOTS) {
      if (OPTIONAL_SLOTS.includes(slot)) {
        expect(STARTER_LOADOUT[slot]).toBeNull();
        continue;
      }
      const id = STARTER_LOADOUT[slot];
      const item = getItem(id);
      expect(item, slot).toBeTruthy();
      expect(item!.starter).toBe(true);
      expect(item!.slot).toBe(slot);
    }
  });

  it('is cosmetic only: items never carry gameplay stats', () => {
    for (const it of ALL_ITEMS) {
      for (const key of GAMEPLAY_KEYS) expect(it, it.id).not.toHaveProperty(key);
      expect(it.visual.kind.length).toBeGreaterThan(0);
      if (it.slot === 'board') expect(it.visual.board, it.id).toBeTruthy();
    }
  });

  it('offers free look options that are not shop items', () => {
    expect(SKIN_TONES.length).toBeGreaterThanOrEqual(8);
    expect(HAIR_STYLES.length).toBeGreaterThanOrEqual(8);
    expect(HAIR_COLORS.length).toBeGreaterThanOrEqual(8);
    expect(FACES.length).toBeGreaterThanOrEqual(6);
    expect(SKIN_TONES).toContain(DEFAULT_APPEARANCE.skinTone);
    expect(HAIR_STYLES.some((h) => h.id === DEFAULT_APPEARANCE.hairStyle)).toBe(true);
  });

  it('unequips clipping accessories when a full-head helmet is worn', () => {
    const loadout = {
      ...STARTER_LOADOUT,
      accessory: 'acc_big_headphones',
      headwear: null,
    };
    const conflicts = conflictingItems('hat_sticker_helmet', loadout);
    expect(conflicts).toEqual(['acc_big_headphones']);
    expect(INCOMPATIBLE_TAGS).toEqual([['fullHead', 'overEars']]);
  });

  it('indexes every item by id', () => {
    expect(Object.keys(ITEMS_BY_ID)).toHaveLength(ALL_ITEMS.length);
    expect(getItem('nope')).toBeUndefined();
    expect(getItem(null)).toBeUndefined();
  });

  it('covers each rarity with at least one clothing piece and one board', () => {
    const by = (slot: Slot, rarity: CatalogItem['rarity']) => ALL_ITEMS.filter((i) => i.slot === slot && i.rarity === rarity);
    for (const r of ['common', 'uncommon', 'rare', 'epic'] as const) {
      expect(CATALOG_ITEMS.filter((i) => i.slot !== 'board' && i.rarity === r).length, r).toBeGreaterThan(0);
      expect(by('board', r).length, `board ${r}`).toBeGreaterThan(0);
    }
    expect(CATALOG_ITEMS.filter((i) => i.rarity === 'legendary').length).toBeGreaterThanOrEqual(3);
  });

  it('keeps clothing slot labels and optional slots consistent', () => {
    expect(CLOTHING_SLOTS).toEqual(['headwear', 'top', 'bottom', 'shoes', 'accessory']);
    expect(OPTIONAL_SLOTS).toEqual(['headwear', 'accessory']);
  });
});
