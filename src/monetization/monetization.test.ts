import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../config/economy';
import { CURRENCY_PACKS, packById } from '../config/iap';
import { GameStore, MemoryStorage } from '../economy/store';
import { DisabledAdProvider, MockAdProvider, watchRewardedAd } from './ads';
import {
  MockBillingProvider,
  MockPurchaseVerifier,
  UnconfiguredBillingProvider,
  UnconfiguredVerifier,
  buyCurrencyPack,
  resumePendingPurchases,
} from './billing';

function store() {
  return new GameStore(new MemoryStorage(), { now: () => Date.UTC(2026, 0, 1) });
}

describe('rewarded ads', () => {
  it('grants currency only after a verified completion', async () => {
    const s = store();
    const ads = new MockAdProvider();
    ads.mode = 'completed';
    const r = await watchRewardedAd(ads, s, 'results');
    expect(r.status).toBe('granted');
    if (r.status === 'granted') expect(r.amount).toBe(ECONOMY.rewardedAd.amount);
    expect(s.cash).toBe(ECONOMY.rewardedAd.amount);
  });

  it('grants nothing when the player closes early, the ad errors, or ads are off', async () => {
    const s = store();
    const ads = new MockAdProvider();
    ads.mode = 'cancelled';
    expect((await watchRewardedAd(ads, s, 'x')).status).toBe('cancelled');
    ads.mode = 'error';
    expect((await watchRewardedAd(ads, s, 'x')).status).toBe('error');
    ads.mode = 'unavailable';
    expect((await watchRewardedAd(ads, s, 'x')).status).toBe('unavailable');
    expect(s.cash).toBe(0);
    const off = new DisabledAdProvider();
    expect(off.isAvailable()).toBe(false);
    expect((await watchRewardedAd(off, s, 'x')).status).toBe('unavailable');
  });

  it('ignores a duplicate completion callback for the same reward id', async () => {
    const s = store();
    const ads = new MockAdProvider();
    ads.mode = 'completed';
    ads.duplicateCallbacks = true;
    await watchRewardedAd(ads, s, 'x');
    expect(s.cash).toBe(ECONOMY.rewardedAd.amount);
    expect(Object.keys(s.snapshot.adRewards)).toHaveLength(1);
  });
});

describe('currency packs', () => {
  it('defines fixed amounts with no baked-in real-money prices', () => {
    expect(CURRENCY_PACKS).toHaveLength(4);
    expect(new Set(CURRENCY_PACKS.map((p) => p.productId)).size).toBe(4);
    for (const p of CURRENCY_PACKS) {
      expect(p.amount).toBeGreaterThan(0);
      expect(JSON.stringify(p)).not.toMatch(/\$|USD|€|price/i);
    }
    expect(packById('nope')).toBeUndefined();
  });

  it('does not grant Mall Cash until the purchase is verified', async () => {
    const s = store();
    const billing = new MockBillingProvider();
    const verifier = new MockPurchaseVerifier(billing);
    billing.mode = 'cancel';
    expect((await buyCurrencyPack(billing, verifier, s, CURRENCY_PACKS[0]!.productId)).status).toBe('cancelled');
    billing.mode = 'fail';
    expect((await buyCurrencyPack(billing, verifier, s, CURRENCY_PACKS[0]!.productId)).status).toBe('failed');
    expect(s.cash).toBe(0);

    billing.mode = 'success';
    const ok = await buyCurrencyPack(billing, verifier, s, 'mallrats.cash.1000');
    expect(ok).toMatchObject({ status: 'fulfilled', amount: 1000 });
    expect(s.cash).toBe(1000);
    const tx = Object.values(s.snapshot.purchases)[0];
    expect(tx?.status).toBe('fulfilled');
    expect(tx?.amount).toBe(1000);
  });

  it('resumes a pending purchase later and fulfils it once', async () => {
    const s = store();
    const billing = new MockBillingProvider();
    const verifier = new MockPurchaseVerifier(billing);
    billing.mode = 'pending';
    const pending = await buyCurrencyPack(billing, verifier, s, 'mallrats.cash.3000');
    expect(pending.status).toBe('pending');
    expect(s.cash).toBe(0);
    if (pending.status !== 'pending') return;
    billing.approvePending(pending.transactionId);
    const resumed = await resumePendingPurchases(billing, verifier, s);
    expect(resumed.some((r) => r.status === 'fulfilled' && r.amount === 3000)).toBe(true);
    expect(s.cash).toBe(3000);
    const again = await resumePendingPurchases(billing, verifier, s);
    expect(again.filter((r) => r.status === 'fulfilled')).toHaveLength(0);
  });

  it('rejects unverified receipts and leaves the wallet unchanged', async () => {
    const s = store();
    const billing = new MockBillingProvider();
    billing.mode = 'success';
    const rogue = {
      async verify() {
        return { verified: false, productId: 'mallrats.cash.1000', amount: 0, environment: 'development' as const, reason: 'nope' };
      },
    };
    const r = await buyCurrencyPack(billing, rogue, s, 'mallrats.cash.1000');
    expect(r.status).toBe('failed');
    expect(s.cash).toBe(0);
  });

  it('reports unconfigured billing as unavailable', async () => {
    const s = store();
    const r = await buyCurrencyPack(new UnconfiguredBillingProvider(), new UnconfiguredVerifier(), s, 'mallrats.cash.1000');
    expect(r.status).toBe('failed');
    expect(s.cash).toBe(0);
  });
});
