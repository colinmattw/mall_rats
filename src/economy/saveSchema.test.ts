import { describe, expect, it } from 'vitest';
import { STARTER_ITEMS, STARTER_LOADOUT } from '../config/catalog';
import {
  SAVE_VERSION,
  assertInvariants,
  createDefaultSave,
  migrateSave,
  sanitizeSave,
} from './saveSchema';

describe('save schema', () => {
  it('creates a valid default profile', () => {
    const d = createDefaultSave(1_700_000_000_000, 'seed');
    expect(d.version).toBe(SAVE_VERSION);
    expect(d.wallet.cash).toBe(0);
    for (const it of STARTER_ITEMS) expect(d.owned[it.id]?.source).toBe('starter');
    expect(d.equipped).toEqual(STARTER_LOADOUT);
    expect(() => assertInvariants(d)).not.toThrow();
    expect(d.missions.active).toHaveLength(3);
  });

  it('migrates the v0 prototype layout (flat coins + ownedItems)', () => {
    const raw = migrateSave({
      version: 0,
      coins: 1234,
      ownedItems: ['top_striped_tee', 'ghost_item'],
    });
    expect(raw.version).toBe(1);
    expect(raw.wallet).toEqual({ cash: 1234 });
    expect((raw.owned as Record<string, unknown>)['top_striped_tee']).toMatchObject({ source: 'shop' });
    expect(raw.coins).toBeUndefined();
    expect(raw.ownedItems).toBeUndefined();
    const clean = sanitizeSave(raw, 10);
    expect(clean.wallet.cash).toBe(1234);
    expect(clean.owned['top_striped_tee']).toBeTruthy();
    expect(clean.owned['ghost_item']).toBeUndefined();
  });

  it('repairs corrupt, negative and unknown values without throwing', () => {
    const clean = sanitizeSave(
      {
        version: 1,
        wallet: { cash: -50.7 },
        owned: { nope: { at: 1, source: 'shop' }, top_shop_tee: { at: 1, source: 'starter' } },
        duplicates: { top_striped_tee: 3, board_shop_deck: 2 },
        equipped: { top: 'top_holo_bomber', bottom: 'bottom_everyday_jeans', shoes: 'shoes_canvas_lows', board: 'board_shop_deck', headwear: 'hat_cuffed_beanie' },
        appearance: { skinTone: '#fff', hairStyle: 'mullet', hairColor: '#000', face: 'alien' },
        settings: { graphics: 'ultra', soundVolume: 4, swipeSensitivity: 9 },
      },
      99,
    );
    expect(clean.wallet.cash).toBe(0);
    expect(clean.owned['nope']).toBeUndefined();
    expect(clean.owned['top_shop_tee']).toBeTruthy();
    expect(clean.duplicates['top_striped_tee']).toBeUndefined();
    expect(clean.duplicates['board_shop_deck']).toBe(2);
    expect(clean.equipped.top).toBe('top_shop_tee');
    expect(clean.equipped.headwear).toBeNull();
    expect(clean.appearance.hairStyle).toBe('swoop');
    expect(clean.settings.graphics).toBe('medium');
    expect(clean.settings.soundVolume).toBeLessThanOrEqual(1);
    expect(clean.settings.swipeSensitivity).toBeLessThanOrEqual(2);
    expect(() => assertInvariants(clean)).not.toThrow();
  });

  it('rejects invariant violations', () => {
    const d = createDefaultSave();
    d.wallet.cash = -1;
    expect(() => assertInvariants(d)).toThrow(/wallet/);
    d.wallet.cash = 0;
    d.equipped.top = 'top_striped_tee';
    expect(() => assertInvariants(d)).toThrow(/not owned/);
  });
});
