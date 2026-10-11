import type { Rarity } from './catalog';

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
  rewardedAd: { amount: 100, dailyCap: 10 },
  /** One-time reward for completing the tutorial: enough for a modest cosmetic. */
  tutorialReward: 600,
  startingCash: 0,
  run: {
    /** Target earnings for an ordinary 60–90 s run, from pickups alone. */
    targetCashPerRun: [75, 150] as [number, number],
    typicalRunSeconds: [60, 90] as [number, number],
    /** Assumed share of placed Mall Cash a typical player actually collects. */
    typicalCollectionRate: 0.6,
    /** Collected rewards are committed to the save at least this often (ticks). */
    commitIntervalTicks: 90,
  },
};

export function sellValue(rarity: Rarity): number {
  return ECONOMY.sellback[rarity];
}
