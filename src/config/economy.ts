import type { Rarity } from './catalog';
import type { EnvId } from './environments';

/**
 * Economy tuning. Values are starting assumptions and are documented (with the
 * play time they imply) in docs/ECONOMY.md. Rewards never change based on a
 * player's spending.
 */
export const ECONOMY = {
  currencyName: 'Mall Cash',
  /** Mall Cash paid for selling one duplicate copy. */
  sellback: { common: 75, uncommon: 150, rare: 400, epic: 1000, legendary: 2500 } as Record<Rarity, number>,
  /** Fixed shop price bands per rarity (every catalog price must sit inside its band). */
  priceBands: {
    common: [300, 600],
    uncommon: [800, 1500],
    rare: [2500, 4000],
    epic: [6000, 10000],
    legendary: [15000, 25000],
  } as Record<Rarity, [number, number]>,
  pickupValues: { cash: 1, stack: 5 },
  /**
   * Scales the length of authored coin lines per environment (jump arcs and
   * cash stacks are left untouched). This is the main knob for run earnings
   * and keeps each route's reward tradeoff intact.
   */
  coinDensity: { concourse: 0.6, foodcourt: 0.7, deptstore: 0.65, maintenance: 0.55, atrium: 0.6 } as Record<EnvId, number>,
  rewardedAd: { amount: 100, dailyCap: 10 },
  /** One-time reward for completing the tutorial: enough for a modest cosmetic. */
  tutorialReward: 600,
  startingCash: 0,
  run: {
    /** Target earnings for an ordinary 60–90 s run, from pickups alone. */
    targetCashPerRun: [75, 150] as [number, number],
    typicalRunSeconds: [60, 90] as [number, number],
    /** Assumed share of placed Mall Cash a typical player actually collects. */
    typicalCollectionRate: 0.55,
    /** Collected rewards are committed to the save at least this often (ticks). */
    commitIntervalTicks: 90,
  },
};

export function sellValue(rarity: Rarity): number {
  return ECONOMY.sellback[rarity];
}
