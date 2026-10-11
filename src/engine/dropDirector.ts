import { RARITIES, type CatalogItem, type Rarity } from '../config/catalog';
import { DROPS, maxDroughtDistance, opportunityDistanceRange, type DropConfig } from '../config/drops';
import { Rng, hashSeed, isRngState, type RngState } from './rng';

/**
 * Distance-based rare bag director.
 *
 * - Progress (metres since the last opportunity) persists across runs.
 * - The distance to the next opportunity is pre-rolled and persisted, so
 *   restarting or reloading can never reroll it.
 * - The item inside a bag is resolved from a dedicated, persisted RNG stream
 *   at the moment of collection, so reloading cannot reroll it either.
 * - Paused / backgrounded time is never counted because only simulated
 *   distance advances the director.
 */
export interface DropDirectorState {
  version: 1;
  rng: RngState;
  distanceSinceOpportunity: number;
  nextOpportunityAt: number;
  opportunities: number;
  collected: number;
  missed: number;
  totalDistance: number;
}

export function createDropDirectorState(seed: string, cfg: DropConfig = DROPS): DropDirectorState {
  const state: DropDirectorState = {
    version: 1,
    rng: hashSeed(`drops:${seed}`),
    distanceSinceOpportunity: 0,
    nextOpportunityAt: 0,
    opportunities: 0,
    collected: 0,
    missed: 0,
    totalDistance: 0,
  };
  rollNextOpportunity(state, cfg);
  return state;
}

export function sanitizeDropDirectorState(raw: unknown, seed: string, cfg: DropConfig = DROPS): DropDirectorState {
  const r = raw as Partial<DropDirectorState> | null;
  if (!r || typeof r !== 'object' || !isRngState(r.rng)) return createDropDirectorState(seed, cfg);
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const cap = maxDroughtDistance(cfg);
  return {
    version: 1,
    rng: [...r.rng] as RngState,
    distanceSinceOpportunity: num(r.distanceSinceOpportunity, 0),
    nextOpportunityAt: Math.min(cap, num(r.nextOpportunityAt, cap)),
    opportunities: Math.floor(num(r.opportunities, 0)),
    collected: Math.floor(num(r.collected, 0)),
    missed: Math.floor(num(r.missed, 0)),
    totalDistance: num(r.totalDistance, 0),
  };
}

function rollNextOpportunity(state: DropDirectorState, cfg: DropConfig): void {
  const rng = new Rng(state.rng);
  const [lo, hi] = opportunityDistanceRange(cfg);
  const roll = rng.range(lo, hi);
  state.nextOpportunityAt = Math.min(maxDroughtDistance(cfg), roll);
  state.rng = rng.getState();
}

export function addDropDistance(state: DropDirectorState, meters: number): void {
  if (!(meters > 0)) return;
  state.distanceSinceOpportunity += meters;
  state.totalDistance += meters;
}

export function isBagDue(state: DropDirectorState, cfg: DropConfig = DROPS): boolean {
  return (
    state.distanceSinceOpportunity >= state.nextOpportunityAt ||
    state.distanceSinceOpportunity >= maxDroughtDistance(cfg)
  );
}

/**
 * The bag reached the skater (collected or skated past). The drought resets
 * either way and the next opportunity distance is rolled and persisted.
 */
export function recordOpportunity(state: DropDirectorState, collected: boolean, cfg: DropConfig = DROPS): void {
  state.opportunities++;
  if (collected) state.collected++;
  else state.missed++;
  state.distanceSinceOpportunity = 0;
  rollNextOpportunity(state, cfg);
}

/** Normalised rarity odds over tiers that actually contain eligible items. */
export function effectiveRarityOdds(items: readonly CatalogItem[], cfg: DropConfig = DROPS): Record<Rarity, number> {
  const eligible = new Set(items.filter((i) => i.dropEligible && i.dropWeight > 0).map((i) => i.rarity));
  let total = 0;
  for (const r of RARITIES) if (eligible.has(r)) total += Math.max(0, cfg.rarityWeights[r]);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITIES) out[r] = eligible.has(r) && total > 0 ? Math.max(0, cfg.rarityWeights[r]) / total : 0;
  return out;
}

/** Pick the cosmetic inside a bag, advancing the persisted drop RNG stream. */
export function resolveDropItem(
  state: DropDirectorState,
  items: readonly CatalogItem[],
  cfg: DropConfig = DROPS,
): CatalogItem {
  const rng = new Rng(state.rng);
  const eligible = items.filter((i) => i.dropEligible && i.dropWeight > 0);
  if (eligible.length === 0) throw new Error('No drop-eligible items configured');
  const tiers = RARITIES.filter((r) => eligible.some((i) => i.rarity === r) && cfg.rarityWeights[r] > 0);
  const tier = rng.weighted(tiers, (r) => cfg.rarityWeights[r]) ?? tiers[0]!;
  const pool = eligible.filter((i) => i.rarity === tier);
  const picked = rng.weighted(pool, (i) => i.dropWeight) ?? pool[0]!;
  state.rng = rng.getState();
  return picked;
}
