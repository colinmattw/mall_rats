import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, CATALOG_ITEMS, RARITIES, type Rarity } from '../config/catalog';
import { DROPS, maxDroughtDistance, opportunityDistanceRange } from '../config/drops';
import {
  addDropDistance,
  createDropDirectorState,
  effectiveRarityOdds,
  isBagDue,
  recordOpportunity,
  resolveDropItem,
  sanitizeDropDirectorState,
} from './dropDirector';

describe('drop director', () => {
  it('pre-rolls the next opportunity inside the configured window and below the drought cap', () => {
    const [lo, hi] = opportunityDistanceRange();
    for (let i = 0; i < 200; i++) {
      const s = createDropDirectorState(`seed-${i}`);
      expect(s.nextOpportunityAt).toBeGreaterThanOrEqual(lo);
      expect(s.nextOpportunityAt).toBeLessThanOrEqual(Math.min(hi, maxDroughtDistance()));
    }
  });

  it('becomes due only after enough distance and resets whether the bag is collected or missed', () => {
    const s = createDropDirectorState('due');
    addDropDistance(s, s.nextOpportunityAt - 1);
    expect(isBagDue(s)).toBe(false);
    addDropDistance(s, 2);
    expect(isBagDue(s)).toBe(true);
    recordOpportunity(s, false);
    expect(s.distanceSinceOpportunity).toBe(0);
    expect(isBagDue(s)).toBe(false);
    expect(s.missed).toBe(1);
    addDropDistance(s, s.nextOpportunityAt);
    recordOpportunity(s, true);
    expect(s.collected).toBe(1);
    expect(s.opportunities).toBe(2);
  });

  it('never exceeds the maximum drought distance', () => {
    const s = createDropDirectorState('drought');
    s.nextOpportunityAt = 1e12;
    const clean = sanitizeDropDirectorState(s, 'x');
    expect(clean.nextOpportunityAt).toBeLessThanOrEqual(maxDroughtDistance());
    addDropDistance(clean, maxDroughtDistance());
    expect(isBagDue(clean)).toBe(true);
  });

  it('ignores negative / non-finite distance (paused time never counts)', () => {
    const s = createDropDirectorState('neg');
    addDropDistance(s, -50);
    addDropDistance(s, Number.NaN);
    expect(s.distanceSinceOpportunity).toBe(0);
  });

  it('selects rarities with the configured weights', () => {
    const s = createDropDirectorState('weights');
    const tally: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    const N = 100_000;
    for (let i = 0; i < N; i++) tally[resolveDropItem(s, ALL_ITEMS).rarity]++;
    const total = RARITIES.reduce((n, r) => n + DROPS.rarityWeights[r], 0);
    for (const r of RARITIES) expect(Math.abs(tally[r] / N - DROPS.rarityWeights[r] / total), r).toBeLessThan(0.006);
  });

  it('only selects tiers that contain eligible items and renormalises their weights', () => {
    const noLegendary = CATALOG_ITEMS.filter((i) => i.rarity !== 'legendary');
    const odds = effectiveRarityOdds(noLegendary);
    expect(odds.legendary).toBe(0);
    expect(RARITIES.reduce((n, r) => n + odds[r], 0)).toBeCloseTo(1, 9);
    expect(odds.common).toBeCloseTo(50 / 99, 9);
    const s = createDropDirectorState('subset');
    for (let i = 0; i < 5000; i++) expect(resolveDropItem(s, noLegendary).rarity).not.toBe('legendary');
  });

  it('never drops starter items and respects per-item weights within a tier', () => {
    const s = createDropDirectorState('items');
    const commons = CATALOG_ITEMS.filter((i) => i.rarity === 'common').map((i) => ({ ...i, dropWeight: i.id === 'board_graffiti' ? 9 : 1 }));
    let graffiti = 0;
    for (let i = 0; i < 20000; i++) {
      const it = resolveDropItem(s, commons);
      expect(it.starter).toBeFalsy();
      if (it.id === 'board_graffiti') graffiti++;
    }
    const share = graffiti / 20000;
    expect(share).toBeGreaterThan(9 / (commons.length + 8) - 0.03);
    expect(share).toBeLessThan(9 / (commons.length + 8) + 0.03);
  });

  it('is fully determined by persisted state, so reloading cannot reroll a drop', () => {
    const s = createDropDirectorState('reroll');
    const snapshot = JSON.parse(JSON.stringify(s));
    const first = resolveDropItem(s, ALL_ITEMS).id;
    for (let attempt = 0; attempt < 20; attempt++) {
      const restored = sanitizeDropDirectorState(JSON.parse(JSON.stringify(snapshot)), 'ignored');
      expect(resolveDropItem(restored, ALL_ITEMS).id).toBe(first);
    }
  });
});
