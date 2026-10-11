import { describe, expect, it } from 'vitest';
import { CATALOG_ITEMS, STARTER_LOADOUT, getItem } from '../config/catalog';
import { ECONOMY } from '../config/economy';
import { emptyProgress } from './saveSchema';
import { GameStore, MemoryStorage, type RunResult } from './store';
import type { RunProgress, RunSummary } from '../engine/simulation';

function makeStore() {
  const storage = new MemoryStorage();
  const store = new GameStore(storage, { now: () => 1_700_000_000_000 });
  return { storage, store };
}

function progress(partial: Partial<RunProgress> = {}): RunProgress {
  return { ...emptyProgress(), ...partial };
}

function summary(runId: string, extra: Partial<RunSummary> = {}): RunSummary {
  return {
    ...progress(),
    runId,
    seed: 'seed',
    tutorial: false,
    endReason: 'crash',
    durationSeconds: 40,
    bestCombo: 1,
    ...extra,
  };
}

describe('GameStore economy', () => {
  it('never lets the wallet go negative and refuses overspending', () => {
    const { store } = makeStore();
    store.dev.setCash(200);
    const item = CATALOG_ITEMS.find((i) => i.price > 200)!;
    const r = store.purchaseItem(item.id, 'p1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('insufficient_funds');
    expect(store.cash).toBe(200);
    store.dev.grantCash(-10_000);
    expect(store.cash).toBe(0);
  });

  it('refuses buying an owned item twice and is idempotent for the same purchase id', () => {
    const { store } = makeStore();
    const item = CATALOG_ITEMS.find((i) => i.rarity === 'common')!;
    store.dev.setCash(item.price * 3);
    const a = store.purchaseItem(item.id, 'buy-a');
    expect(a.ok).toBe(true);
    expect(store.isOwned(item.id)).toBe(true);
    const replay = store.purchaseItem(item.id, 'buy-a');
    expect(replay.ok && replay.replayed).toBe(true);
    expect(store.cash).toBe(item.price * 2);
    const again = store.purchaseItem(item.id, 'buy-b');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe('already_owned');
    expect(store.cash).toBe(item.price * 2);
  });

  it('refuses to equip an unowned item and never unequips required slots', () => {
    const { store } = makeStore();
    const item = CATALOG_ITEMS.find((i) => i.slot === 'top')!;
    const r = store.equip(item.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_owned');
    expect(store.snapshot.equipped.top).toBe(STARTER_LOADOUT.top);
    expect(store.unequip('top').ok).toBe(false);
    expect(store.unequip('headwear').ok).toBe(true);
  });

  it('never sells the last owned copy — only extra duplicates', () => {
    const { store } = makeStore();
    const item = CATALOG_ITEMS[0]!;
    store.dev.unlockAll();
    expect(store.previewSale(item.id, 1).ok).toBe(false);
    store.dev.addDuplicates();
    const have = store.duplicateCount(item.id);
    expect(have).toBeGreaterThan(0);
    const sale = store.sellDuplicates('s1', item.id, have);
    expect(sale.ok).toBe(true);
    if (sale.ok) expect(sale.value.payout).toBe(have * ECONOMY.sellback[item.rarity]);
    expect(store.isOwned(item.id)).toBe(true);
    expect(store.duplicateCount(item.id)).toBe(0);
    expect(store.sellDuplicates('s2', item.id, 1).ok).toBe(false);
    expect(store.snapshot.equipped.top).toBeTruthy();
  });

  it('sell-all is atomic against a stale expected payout and idempotent by sale id', () => {
    const { store } = makeStore();
    store.dev.unlockAll();
    store.dev.addDuplicates();
    const preview = store.previewSellAll();
    expect(preview.payout).toBeGreaterThan(0);
    const stale = store.sellAllDuplicates('all-1', preview.payout + 1);
    expect(stale.ok).toBe(false);
    const first = store.sellAllDuplicates('all-1', preview.payout);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.payout).toBe(preview.payout);
    const replay = store.sellAllDuplicates('all-1', preview.payout);
    expect(replay.ok && replay.replayed).toBe(true);
    expect(store.previewSellAll().payout).toBe(0);
    for (const it of CATALOG_ITEMS) expect(store.isOwned(it.id)).toBe(true);
  });

  it('keeps collected Mall Cash after a crash and does not pay the results screen twice', () => {
    const { store } = makeStore();
    const { runId } = store.beginRun({ tutorial: false });
    store.commitRun(runId, progress({ cash: 90, distance: 400, style: 200 }));
    expect(store.cash).toBe(90);
    const first = store.finishRun(summary(runId, { cash: 90, distance: 400, style: 200, endReason: 'crash' }));
    expect(store.cash).toBe(90);
    expect(store.snapshot.activeRun).toBeNull();
    expect(store.snapshot.stats.crashes).toBe(1);
    const second = store.finishRun(summary(runId, { cash: 90, distance: 400, style: 200, endReason: 'crash' }));
    expect(store.cash).toBe(90);
    expect(second.cashCollected).toBe(90);
    expect(first.records.distance).toBe(true);
    expect(second.records.distance).toBe(false);
  });

  it('closes an abandoned run on reload without losing committed rewards', () => {
    const storage = new MemoryStorage();
    const a = new GameStore(storage);
    const { runId } = a.beginRun({ tutorial: false });
    a.commitRun(runId, progress({ cash: 55, distance: 220 }));
    const b = new GameStore(storage);
    expect(b.cash).toBe(55);
    expect(b.snapshot.activeRun?.runId).toBe(runId);
    b.finalizeAbandonedRun();
    expect(b.snapshot.activeRun).toBeNull();
    expect(b.cash).toBe(55);
    expect(b.snapshot.stats.runsPlayed).toBe(1);
  });

  it('does not reroll drop distance or bag contents across reloads', () => {
    const storage = new MemoryStorage();
    const a = new GameStore(storage, { now: () => 10 });
    const nextAt = a.snapshot.drop.nextOpportunityAt;
    const rng = [...a.snapshot.drop.rng];
    a.addDropDistance(1234);
    a.flush();
    const b = new GameStore(storage, { now: () => 20 });
    expect(b.snapshot.drop.nextOpportunityAt).toBe(nextAt);
    expect(b.snapshot.drop.rng).toEqual(rng);
    expect(b.snapshot.drop.distanceSinceOpportunity).toBeCloseTo(1234, 6);

    const { runId } = b.beginRun({ tutorial: false });
    const first = b.collectBag(runId, 'bag-1');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const itemId = first.value.item.id;
    const c = new GameStore(storage, { now: () => 30 });
    const replay = c.collectBag(runId, 'bag-1');
    expect(replay.ok && replay.replayed).toBe(true);
    if (replay.ok) expect(replay.value.item.id).toBe(itemId);
    expect(c.snapshot.unrevealed).toHaveLength(1);
    c.markRevealed([first.value.reward.rewardId]);
    expect(c.snapshot.unrevealed).toHaveLength(0);
    const afterReveal = c.collectBag(runId, 'bag-1');
    expect(afterReveal.ok).toBe(false);
  });

  it('grants a tutorial reward once and ignores a second finish', () => {
    const { store } = makeStore();
    const { runId } = store.beginRun({ tutorial: true });
    const r = store.finishRun(summary(runId, { tutorial: true, endReason: 'tutorialComplete' }));
    expect(r.tutorialReward).toBe(ECONOMY.tutorialReward);
    expect(store.cash).toBe(ECONOMY.tutorialReward);
    const again = store.finishRun(summary(runId, { tutorial: true, endReason: 'tutorialComplete' }));
    expect(again.tutorialReward).toBe(0);
    expect(store.cash).toBe(ECONOMY.tutorialReward);
    expect(store.snapshot.tutorial.completed).toBe(true);
  });

  it('pays mission rewards exactly once and rotates in the next mission', () => {
    const { store } = makeStore();
    const { runId } = store.beginRun({ tutorial: false });
    const firstId = store.snapshot.missions.active[0]!.missionId;
    store.commitRun(runId, progress({ cleanJumps: 5, cash: 0, distance: 10 }));
    const completed = store.snapshot.missions.completed.filter((c) => c.missionId === firstId);
    expect(completed).toHaveLength(1);
    expect(store.cash).toBe(completed[0]!.reward);
    const after = store.commitRun(runId, progress({ cleanJumps: 5, cash: 0, distance: 10 }));
    expect(after.completed).toHaveLength(0);
    expect(store.snapshot.missions.active[0]!.missionId).not.toBe(firstId);
    expect(store.snapshot.missions.active).toHaveLength(3);
  });

  it('leaves equipped items and cash untouched when a save write fails', () => {
    const { store, storage } = makeStore();
    store.dev.setCash(5000);
    storage.failWrites = true;
    const item = CATALOG_ITEMS.find((i) => i.price <= 5000)!;
    const r = store.purchaseItem(item.id, 'fail-buy');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('save_failed');
    expect(store.cash).toBe(5000);
    expect(store.isOwned(item.id)).toBe(false);
  });

  it('unequips a clipping accessory when a conflicting hat is equipped', () => {
    const { store } = makeStore();
    store.dev.unlockAll();
    expect(store.equip('acc_big_headphones').ok).toBe(true);
    const r = store.equip('hat_sticker_helmet');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.removed).toContain('acc_big_headphones');
    expect(store.snapshot.equipped.headwear).toBe('hat_sticker_helmet');
    expect(store.snapshot.equipped.accessory).toBeNull();
  });

  it('saves and loads outfit presets only with owned items', () => {
    const { store } = makeStore();
    store.dev.unlockAll();
    store.equip('top_striped_tee');
    expect(store.savePreset(0, 'Mall Fit').ok).toBe(true);
    store.equip('top_shop_tee');
    expect(store.loadPreset(0).ok).toBe(true);
    expect(store.snapshot.equipped.top).toBe('top_striped_tee');
    const empty = store.loadPreset(2);
    expect(empty.ok).toBe(false);
  });

  it('caps rewarded ads per calendar day and ignores duplicate callbacks', () => {
    const { store } = makeStore();
    for (let i = 0; i < ECONOMY.rewardedAd.dailyCap; i++) {
      const g = store.grantAdReward({ rewardId: `ad-${i}`, verified: true, provider: 'mock' });
      expect(g.ok).toBe(true);
    }
    expect(store.cash).toBe(ECONOMY.rewardedAd.amount * ECONOMY.rewardedAd.dailyCap);
    const over = store.grantAdReward({ rewardId: 'ad-extra', verified: true, provider: 'mock' });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.code).toBe('cap_reached');
    const dup = store.grantAdReward({ rewardId: 'ad-0', verified: true, provider: 'mock' });
    expect(dup.ok && dup.replayed).toBe(true);
    expect(store.grantAdReward({ rewardId: 'unverified', verified: false, provider: 'mock' }).ok).toBe(false);
  });

  it('fulfils a verified purchase exactly once', () => {
    const { store } = makeStore();
    store.recordPurchase({
      transactionId: 'tx-1',
      productId: 'mallrats.cash.1000',
      amount: 1000,
      provider: 'mock-dev',
      environment: 'development',
      status: 'pending',
    });
    expect(store.fulfillPurchase('tx-1').ok).toBe(false);
    store.setPurchaseStatus('tx-1', 'verified');
    const first = store.fulfillPurchase('tx-1');
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.amount).toBe(1000);
    const second = store.fulfillPurchase('tx-1');
    expect(second.ok && second.replayed).toBe(true);
    expect(store.cash).toBe(1000);
  });
});

describe('results payload', () => {
  it('exposes unrevealed bag rewards until the player opens them', () => {
    const { store } = makeStore();
    const { runId } = store.beginRun({ tutorial: false });
    const bag = store.collectBag(runId, 'b');
    expect(bag.ok).toBe(true);
    const result: RunResult = store.finishRun(summary(runId, { endReason: 'quit' }));
    expect(result.rewards).toHaveLength(1);
    expect(getItem(result.rewards[0]!.itemId)).toBeTruthy();
  });
});
