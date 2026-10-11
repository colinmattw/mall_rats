import type { Rarity } from './catalog';

/**
 * Rare bag drop director configuration.
 *
 * Target: about one bag opportunity per 20–30 minutes of typical active
 * skating, measured across runs. The director works in distance so paused or
 * backgrounded time never counts. Minutes are translated to metres with the
 * reference speed: the average forward speed of an ordinary 60–90 s run on the
 * default speed curve (verified by src/engine/dropDirector.sim.test.ts).
 */
export const DROPS = {
  referenceSpeed: 13.0,
  opportunityMinutes: [20, 30] as [number, number],
  /** Hard cap on distance without an opportunity, in reference minutes. */
  maxDroughtMinutes: 32,
  rarityWeights: { common: 50, uncommon: 28, rare: 15, epic: 6, legendary: 1 } as Record<Rarity, number>,
};

export type DropConfig = typeof DROPS;

export function opportunityDistanceRange(cfg: DropConfig = DROPS): [number, number] {
  return [cfg.opportunityMinutes[0] * 60 * cfg.referenceSpeed, cfg.opportunityMinutes[1] * 60 * cfg.referenceSpeed];
}

export function maxDroughtDistance(cfg: DropConfig = DROPS): number {
  return cfg.maxDroughtMinutes * 60 * cfg.referenceSpeed;
}
