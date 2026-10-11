import {
  ALL_ITEMS,
  CATALOG_ITEMS,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  OPTIONAL_SLOTS,
  SKIN_TONES,
  conflictingItems,
  getItem,
  type Appearance,
  type CatalogItem,
  type Loadout,
  type Rarity,
  type Slot,
} from '../config/catalog';
import { ECONOMY, sellValue } from '../config/economy';
import { missionByIndex, type MissionDef } from '../config/missions';
import { addDropDistance, isBagDue, recordOpportunity, resolveDropItem } from '../engine/dropDirector';
import type { RunProgress, RunSummary } from '../engine/simulation';
import {
  LEDGER_LIMIT,
  PRESET_SLOTS,
  PROCESSED_LIMIT,
  assertInvariants,
  createDefaultSave,
  emptyProgress,
  migrateSave,
  sanitizeSave,
  type CompletedMission,
  type LedgerEntry,
  type PurchaseRecord,
  type PurchaseStatus,
  type SaveData,
  type Settings,
  type UnrevealedReward,
} from './saveSchema';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

export type EconomyErrorCode =
  | 'insufficient_funds'
  | 'already_owned'
  | 'not_owned'
  | 'unknown_item'
  | 'not_purchasable'
  | 'no_duplicates'
  | 'invalid_quantity'
  | 'invalid_slot'
  | 'cap_reached'
  | 'not_verified'
  | 'invalid_state'
  | 'save_failed';

export type OpResult<T> =
  | { ok: true; value: T; replayed?: boolean }
  | { ok: false; code: EconomyErrorCode; message: string; detail?: Record<string, number | string> };

const ok = <T>(value: T, replayed = false): OpResult<T> => ({ ok: true, value, replayed });
const fail = <T>(code: EconomyErrorCode, message: string, detail?: Record<string, number | string>): OpResult<T> => ({
  ok: false,
  code,
  message,
  detail,
});

export interface CommitResult {
  cashAdded: number;
  completed: CompletedMission[];
}

export interface RunResult {
  summary: RunSummary;
  records: { distance: boolean; style: boolean };
  previousBest: { distance: number; style: number };
  cashCollected: number;
  missionRewards: CompletedMission[];
  tutorialReward: number;
  rewards: UnrevealedReward[];
}

export interface BagReward {
  reward: UnrevealedReward;
  item: CatalogItem;
  duplicate: boolean;
}

export const SAVE_KEY = 'mallrats.save';

function missionValue(def: MissionDef, p: RunProgress): number {
  switch (def.kind) {
    case 'cleanJumps':
      return p.cleanJumps;
    case 'grindDistance':
      return p.grindDistance;
    case 'collectCash':
      return p.cash;
    case 'reachDistance':
      return p.distance;
    case 'trickChain':
      return p.trickChains;
    case 'routeVisit':
      return def.env && p.envsVisited.includes(def.env) ? 1 : 0;
    case 'noHitTime':
      return p.maxNoHitSeconds;
    case 'tricks':
      return p.tricks;
    case 'nearMisses':
      return p.nearMisses;
    case 'style':
      return p.style;
    case 'grinds':
      return p.grinds;
    case 'runs':
      return 0;
  }
}

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Local game state with atomic, idempotent economy operations.
 *
 * Every mutation runs on a cloned draft; invariants (no negative balance,
 * equipped items owned, ...) are checked before the draft replaces the live
 * state and is written to storage in one write. If the write fails, the live
 * state is left untouched. Operations that pay out carry an idempotency key so
 * replays (double taps, duplicate callbacks, results screen re-renders) are
 * no-ops.
 *
 * NOTE: this is browser-local storage. It is not tamper-proof and must not be
 * treated as authoritative for paid currency (see docs/MONETIZATION.md).
 */
export class GameStore {
  private data: SaveData;
  private listeners = new Set<() => void>();
  private pendingDropMeters = 0;
  private readonly now: () => number;
  readonly key: string;
  lastSaveError: string | null = null;
  loadedFrom: 'fresh' | 'primary' | 'backup' = 'fresh';

  constructor(
    private readonly storage: StorageLike,
    opts: { key?: string; now?: () => number } = {},
  ) {
    this.key = opts.key ?? SAVE_KEY;
    this.now = opts.now ?? (() => Date.now());
    this.data = this.load();
  }

  // ---------------------------------------------------------------- basics
  get snapshot(): SaveData {
    return this.data;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SaveData => this.data;

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private load(): SaveData {
    for (const [key, source] of [
      [this.key, 'primary'],
      [`${this.key}.backup`, 'backup'],
    ] as const) {
      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const data = sanitizeSave(migrateSave(parsed), this.now());
        assertInvariants(data);
        this.loadedFrom = source;
        return data;
      } catch {
        // Corrupt or unreadable – fall through to the backup / a fresh save.
      }
    }
    this.loadedFrom = 'fresh';
    const fresh = createDefaultSave(this.now());
    this.write(fresh, null);
    return fresh;
  }

  private write(next: SaveData, previousRaw: string | null): void {
    const raw = JSON.stringify(next);
    if (previousRaw) this.storage.setItem(`${this.key}.backup`, previousRaw);
    this.storage.setItem(this.key, raw);
  }

  /** Run a mutation atomically. Throws (leaving state untouched) on invariant or write failure. */
  private transact<T>(fn: (d: SaveData) => T): T {
    const draft = structuredClone(this.data);
    const result = fn(draft);
    draft.updatedAt = this.now();
    this.prune(draft);
    assertInvariants(draft);
    let previousRaw: string | null = null;
    try {
      previousRaw = this.storage.getItem(this.key);
    } catch {
      previousRaw = null;
    }
    try {
      this.write(draft, previousRaw);
      this.lastSaveError = null;
    } catch (e) {
      this.lastSaveError = e instanceof Error ? e.message : String(e);
      throw new Error(`save_failed: ${this.lastSaveError}`);
    }
    this.data = draft;
    this.notify();
    return result;
  }

  private safe<T>(fn: () => OpResult<T>): OpResult<T> {
    try {
      return fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith('save_failed')) return fail('save_failed', 'Could not save. Free some storage and try again.');
      return fail('invalid_state', msg);
    }
  }

  private prune(d: SaveData): void {
    const keys = Object.keys(d.processed);
    if (keys.length > PROCESSED_LIMIT) {
      keys
        .sort((a, b) => d.processed[a]! - d.processed[b]!)
        .slice(0, keys.length - PROCESSED_LIMIT)
        .forEach((k) => delete d.processed[k]);
    }
    if (d.ledger.length > LEDGER_LIMIT) d.ledger.splice(0, d.ledger.length - LEDGER_LIMIT);
    if (d.missions.completed.length > 60) d.missions.completed.splice(0, d.missions.completed.length - 60);
  }

  private ledger(d: SaveData, kind: LedgerEntry['kind'], amount: number, note: string, id: string): void {
    d.ledger.push({ id, at: this.now(), kind, amount, note });
  }

  private foldDropDistance(d: SaveData): void {
    if (this.pendingDropMeters > 0) {
      addDropDistance(d.drop, this.pendingDropMeters);
      this.pendingDropMeters = 0;
    }
  }

  // ---------------------------------------------------------------- queries
  isOwned(id: string): boolean {
    return !!this.data.owned[id];
  }

  duplicateCount(id: string): number {
    return this.data.duplicates[id] ?? 0;
  }

  get cash(): number {
    return this.data.wallet.cash;
  }

  collectionProgress(): { owned: number; total: number } {
    const total = CATALOG_ITEMS.length;
    const owned = CATALOG_ITEMS.filter((i) => this.data.owned[i.id]).length;
    return { owned, total };
  }

  adRewardsToday(): number {
    const today = dayKey(this.now());
    return Object.values(this.data.adRewards).filter((r) => dayKey(r.at) === today).length;
  }

  // ---------------------------------------------------------------- run lifecycle
  beginRun(opts: { tutorial: boolean }): { runId: string; seed: string } {
    if (this.data.activeRun) this.finalizeAbandonedRun();
    return this.transact((d) => {
      d.runCounter++;
      const runId = `run_${d.profileId}_${d.runCounter}`;
      const seed = `${d.profileId}:${d.runCounter}`;
      d.activeRun = { runId, startedAt: this.now(), tutorial: opts.tutorial, committed: emptyProgress() };
      return { runId, seed };
    });
  }

  addDropDistance(meters: number): void {
    if (meters > 0) this.pendingDropMeters += meters;
  }

  isBagDue(): boolean {
    const d = this.data.drop;
    const probe = { ...d, distanceSinceOpportunity: d.distanceSinceOpportunity + this.pendingDropMeters };
    return isBagDue(probe);
  }

  private applyProgress(d: SaveData, runId: string, progress: RunProgress): CommitResult {
    const run = d.activeRun;
    const result: CommitResult = { cashAdded: 0, completed: [] };
    if (!run || run.runId !== runId) return result;
    const prev = run.committed;
    const cashDelta = Math.max(0, Math.floor(progress.cash) - prev.cash);
    if (cashDelta > 0) {
      d.wallet.cash += cashDelta;
      d.stats.cashFromPickups += cashDelta;
      result.cashAdded = cashDelta;
    }
    if (!run.tutorial) {
      for (const m of d.missions.active) {
        const def = missionByIndex(m.missionIndex);
        if (def.kind === 'runs') continue;
        if (def.scope === 'run') m.progress = Math.max(m.progress, missionValue(def, progress));
        else m.progress += Math.max(0, missionValue(def, progress) - missionValue(def, prev));
      }
      result.completed.push(...this.settleMissions(d, runId));
    }
    run.committed = {
      ...progress,
      cash: Math.max(prev.cash, Math.floor(progress.cash)),
      envsVisited: [...progress.envsVisited],
    };
    return result;
  }

  private settleMissions(d: SaveData, runId: string | null): CompletedMission[] {
    const done: CompletedMission[] = [];
    let guard = 0;
    for (let i = 0; i < d.missions.active.length && guard++ < 20; i++) {
      const m = d.missions.active[i]!;
      const def = missionByIndex(m.missionIndex);
      if (m.progress < def.target) continue;
      const key = `mission:${m.instanceId}`;
      if (!d.processed[key]) {
        d.processed[key] = this.now();
        d.wallet.cash += def.reward.cash;
        d.stats.cashFromMissions += def.reward.cash;
        d.stats.missionsCompleted++;
        if (def.reward.badge && !d.missions.badges.includes(def.reward.badge)) d.missions.badges.push(def.reward.badge);
        this.ledger(d, 'mission', def.reward.cash, def.title, key);
        const c: CompletedMission = {
          instanceId: m.instanceId,
          missionId: def.id,
          title: def.title,
          reward: def.reward.cash,
          badge: def.reward.badge,
          at: this.now(),
          runId,
        };
        d.missions.completed.push(c);
        done.push(c);
      }
      d.missions.instanceCounter++;
      const nextIndex = d.missions.nextIndex++;
      d.missions.active[i] = {
        instanceId: `mi_${d.missions.instanceCounter}`,
        missionIndex: nextIndex,
        missionId: missionByIndex(nextIndex).id,
        progress: 0,
        startedAt: this.now(),
      };
      i--;
    }
    return done;
  }

  /** Commit rewards collected so far in a live run (idempotent: only deltas apply). */
  commitRun(runId: string, progress: RunProgress): CommitResult {
    try {
      return this.transact((d) => {
        this.foldDropDistance(d);
        return this.applyProgress(d, runId, progress);
      });
    } catch {
      return { cashAdded: 0, completed: [] };
    }
  }

  /**
   * Finish a run. Everything collected was already granted during the run;
   * this only commits the final delta and updates statistics. Calling it twice
   * for the same run returns the same result without granting anything.
   */
  finishRun(summary: RunSummary): RunResult {
    const key = `run:${summary.runId}:finished`;
    const prevBest = { distance: this.data.stats.bestDistance, style: this.data.stats.bestStyle };
    if (this.data.processed[key]) return this.describeRun(summary, prevBest, false);
    let tutorialReward = 0;
    const result = this.transact((d) => {
      this.foldDropDistance(d);
      const completedNow = this.applyProgress(d, summary.runId, summary).completed;
      d.processed[key] = this.now();
      const before = { distance: d.stats.bestDistance, style: d.stats.bestStyle };
      if (!summary.tutorial) {
        const s = d.stats;
        s.runsPlayed++;
        s.totalDistance += summary.distance;
        s.totalGrinds += summary.grinds;
        s.totalGrindDistance += summary.grindDistance;
        s.totalTricks += summary.tricks;
        s.totalCleanJumps += summary.cleanJumps;
        s.totalNearMisses += summary.nearMisses;
        s.bestDistance = Math.max(s.bestDistance, summary.distance);
        s.bestStyle = Math.max(s.bestStyle, summary.style);
        s.bestCombo = Math.max(s.bestCombo, summary.bestCombo);
        s.longestNoHitSeconds = Math.max(s.longestNoHitSeconds, summary.maxNoHitSeconds);
        if (summary.endReason === 'captured') s.captures++;
        if (summary.endReason === 'crash') s.crashes++;
        for (const m of d.missions.active) {
          const def = missionByIndex(m.missionIndex);
          if (def.kind === 'runs') m.progress += 1;
        }
        completedNow.push(...this.settleMissions(d, summary.runId));
      } else if (summary.endReason === 'tutorialComplete') {
        d.tutorial.completed = true;
        if (!d.tutorial.rewarded && !d.processed['tutorial:reward']) {
          d.processed['tutorial:reward'] = this.now();
          d.tutorial.rewarded = true;
          d.wallet.cash += ECONOMY.tutorialReward;
          tutorialReward = ECONOMY.tutorialReward;
          this.ledger(d, 'tutorial', ECONOMY.tutorialReward, 'Tutorial complete', 'tutorial:reward');
        }
      }
      d.runHistory.push({
        runId: summary.runId,
        at: this.now(),
        distance: summary.distance,
        style: summary.style,
        cash: summary.cash,
        endReason: summary.endReason,
      });
      if (d.runHistory.length > 20) d.runHistory.shift();
      if (d.activeRun?.runId === summary.runId) d.activeRun = null;
      return before;
    });
    const r = this.describeRun(summary, result, !summary.tutorial);
    r.tutorialReward = tutorialReward;
    return r;
  }

  private describeRun(summary: RunSummary, prevBest: { distance: number; style: number }, fresh: boolean): RunResult {
    const d = this.data;
    return {
      summary,
      records: {
        distance: fresh && summary.distance > prevBest.distance && summary.distance > 0,
        style: fresh && summary.style > prevBest.style && summary.style > 0,
      },
      previousBest: prevBest,
      cashCollected: summary.cash,
      missionRewards: d.missions.completed.filter((c) => c.runId === summary.runId),
      tutorialReward: 0,
      rewards: d.unrevealed.filter((u) => u.runId === summary.runId),
    };
  }

  /** A reload abandoned a run: keep what was committed and close it out. */
  finalizeAbandonedRun(): void {
    const run = this.data.activeRun;
    if (!run) return;
    const summary: RunSummary = {
      ...run.committed,
      runId: run.runId,
      seed: '',
      tutorial: run.tutorial,
      endReason: 'quit',
      durationSeconds: 0,
      bestCombo: 0,
    };
    try {
      this.finishRun(summary);
    } catch {
      // Leave it for the next attempt.
    }
  }

  /** Collect a rare bag: resolve, grant and persist immediately (idempotent per bag). */
  collectBag(runId: string, bagKey: string): OpResult<BagReward> {
    return this.safe(() => {
      const key = `bag:${runId}:${bagKey}`;
      if (this.data.processed[key]) {
        const existing = this.data.unrevealed.find((u) => u.rewardId === key);
        if (existing) return ok({ reward: existing, item: getItem(existing.itemId)!, duplicate: existing.duplicate }, true);
        return fail('invalid_state', 'Bag already collected');
      }
      const value = this.transact((d) => {
        this.foldDropDistance(d);
        d.processed[key] = this.now();
        const item = resolveDropItem(d.drop, ALL_ITEMS);
        recordOpportunity(d.drop, true);
        const duplicate = !!d.owned[item.id];
        if (duplicate) d.duplicates[item.id] = (d.duplicates[item.id] ?? 0) + 1;
        else {
          d.owned[item.id] = { at: this.now(), source: 'drop' };
          if (!d.newItems.includes(item.id)) d.newItems.push(item.id);
          if (!d.discovered.includes(item.id)) d.discovered.push(item.id);
        }
        d.stats.bagsCollected++;
        const reward: UnrevealedReward = { rewardId: key, itemId: item.id, duplicate, runId, at: this.now() };
        d.unrevealed.push(reward);
        return { reward, item, duplicate };
      });
      return ok(value);
    });
  }

  /** The skater passed a bag without collecting it: the opportunity is spent. */
  recordBagMissed(runId: string, bagKey: string): void {
    const key = `bagmiss:${runId}:${bagKey}`;
    if (this.data.processed[key]) return;
    try {
      this.transact((d) => {
        this.foldDropDistance(d);
        d.processed[key] = this.now();
        recordOpportunity(d.drop, false);
        d.stats.bagsMissed++;
      });
    } catch {
      // Non-fatal: the bag will simply be offered again.
    }
  }

  markRevealed(rewardIds: string[]): void {
    if (!rewardIds.length) return;
    try {
      this.transact((d) => {
        d.unrevealed = d.unrevealed.filter((u) => !rewardIds.includes(u.rewardId));
      });
    } catch {
      // Keep them unrevealed; they will be shown again later.
    }
  }

  // ---------------------------------------------------------------- shop & wardrobe
  purchaseItem(itemId: string, purchaseId: string): OpResult<{ item: CatalogItem; balance: number }> {
    return this.safe(() => {
      const item = getItem(itemId);
      if (!item) return fail('unknown_item', 'That item does not exist.');
      const key = `shop:${purchaseId}`;
      if (this.data.processed[key]) return ok({ item, balance: this.data.wallet.cash }, true);
      if (item.starter || item.price <= 0) return fail('not_purchasable', 'Starter items are already yours.');
      if (this.data.owned[itemId]) return fail('already_owned', 'You already own this item.');
      if (this.data.wallet.cash < item.price)
        return fail('insufficient_funds', 'Not enough Mall Cash.', { shortfall: item.price - this.data.wallet.cash });
      const balance = this.transact((d) => {
        d.processed[key] = this.now();
        d.wallet.cash -= item.price;
        d.owned[itemId] = { at: this.now(), source: 'shop' };
        if (!d.discovered.includes(itemId)) d.discovered.push(itemId);
        d.stats.shopSpend += item.price;
        if (d.saveTarget === itemId) d.saveTarget = null;
        this.ledger(d, 'shop', -item.price, item.name, key);
        return d.wallet.cash;
      });
      return ok({ item, balance });
    });
  }

  equip(itemId: string): OpResult<{ removed: string[] }> {
    return this.safe(() => {
      const item = getItem(itemId);
      if (!item) return fail('unknown_item', 'That item does not exist.');
      if (!this.data.owned[itemId]) return fail('not_owned', 'You need to own this item first.');
      const removed = conflictingItems(itemId, this.data.equipped);
      this.transact((d) => {
        (d.equipped as Record<Slot, string | null>)[item.slot] = itemId;
        for (const r of removed) {
          const other = getItem(r)!;
          if (OPTIONAL_SLOTS.includes(other.slot)) (d.equipped as Record<Slot, string | null>)[other.slot] = null;
        }
        d.newItems = d.newItems.filter((n) => n !== itemId);
      });
      return ok({ removed });
    });
  }

  unequip(slot: Slot): OpResult<true> {
    return this.safe(() => {
      if (!OPTIONAL_SLOTS.includes(slot)) return fail('invalid_slot', 'That slot always needs an item.');
      this.transact((d) => {
        (d.equipped as Record<Slot, string | null>)[slot] = null;
      });
      return ok(true);
    });
  }

  setAppearance(patch: Partial<Appearance>): OpResult<Appearance> {
    return this.safe(() => {
      if (patch.skinTone && !SKIN_TONES.includes(patch.skinTone)) return fail('invalid_state', 'Unknown skin tone');
      if (patch.hairColor && !HAIR_COLORS.includes(patch.hairColor)) return fail('invalid_state', 'Unknown hair color');
      if (patch.hairStyle && !HAIR_STYLES.some((h) => h.id === patch.hairStyle)) return fail('invalid_state', 'Unknown hairstyle');
      if (patch.face && !FACES.some((f) => f.id === patch.face)) return fail('invalid_state', 'Unknown face');
      const value = this.transact((d) => {
        d.appearance = { ...d.appearance, ...patch };
        return d.appearance;
      });
      return ok(value);
    });
  }

  savePreset(index: number, name?: string): OpResult<true> {
    return this.safe(() => {
      if (index < 0 || index >= PRESET_SLOTS) return fail('invalid_slot', 'No such preset slot.');
      this.transact((d) => {
        d.presets[index] = {
          name: (name ?? d.presets[index]?.name ?? `Fit ${index + 1}`).slice(0, 24),
          loadout: { ...d.equipped },
          appearance: { ...d.appearance },
        };
      });
      return ok(true);
    });
  }

  loadPreset(index: number): OpResult<true> {
    return this.safe(() => {
      const p = this.data.presets[index];
      if (!p) return fail('invalid_slot', 'That preset is empty.');
      for (const id of Object.values(p.loadout)) if (id && !this.data.owned[id]) return fail('not_owned', 'Preset uses an item you do not own.');
      this.transact((d) => {
        d.equipped = { ...p.loadout };
        d.appearance = { ...p.appearance };
      });
      return ok(true);
    });
  }

  renamePreset(index: number, name: string): OpResult<true> {
    return this.safe(() => {
      if (!this.data.presets[index]) return fail('invalid_slot', 'That preset is empty.');
      this.transact((d) => {
        d.presets[index]!.name = name.trim().slice(0, 24) || `Fit ${index + 1}`;
      });
      return ok(true);
    });
  }

  setSaveTarget(itemId: string | null): OpResult<true> {
    return this.safe(() => {
      if (itemId && !getItem(itemId)) return fail('unknown_item', 'That item does not exist.');
      if (itemId && this.data.owned[itemId]) return fail('already_owned', 'You already own this item.');
      this.transact((d) => {
        d.saveTarget = itemId;
      });
      return ok(true);
    });
  }

  clearNew(itemId?: string): void {
    if (!this.data.newItems.length) return;
    try {
      this.transact((d) => {
        d.newItems = itemId ? d.newItems.filter((n) => n !== itemId) : [];
      });
    } catch {
      // cosmetic only
    }
  }

  // ---------------------------------------------------------------- duplicates
  previewSale(itemId: string, quantity: number): OpResult<{ payout: number; quantity: number; remaining: number }> {
    const item = getItem(itemId);
    if (!item) return fail('unknown_item', 'That item does not exist.');
    const have = this.data.duplicates[itemId] ?? 0;
    if (have <= 0) return fail('no_duplicates', 'No duplicates to sell. Your owned copy is always kept.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > have)
      return fail('invalid_quantity', `You can sell 1 to ${have} duplicate${have === 1 ? '' : 's'}.`);
    return ok({ payout: quantity * sellValue(item.rarity), quantity, remaining: have - quantity });
  }

  sellDuplicates(saleId: string, itemId: string, quantity: number): OpResult<{ payout: number; balance: number }> {
    return this.safe(() => {
      const key = `sale:${saleId}`;
      if (this.data.processed[key]) return ok({ payout: 0, balance: this.data.wallet.cash }, true);
      const preview = this.previewSale(itemId, quantity);
      if (!preview.ok) return preview;
      const item = getItem(itemId)!;
      const value = this.transact((d) => {
        const have = d.duplicates[itemId] ?? 0;
        if (have < quantity) throw new Error('Duplicate count changed');
        d.processed[key] = this.now();
        d.duplicates[itemId] = have - quantity;
        if (d.duplicates[itemId] === 0) delete d.duplicates[itemId];
        const payout = quantity * sellValue(item.rarity);
        d.wallet.cash += payout;
        d.stats.duplicateSaleEarnings += payout;
        this.ledger(d, 'sale', payout, `${quantity} x ${item.name}`, key);
        return { payout, balance: d.wallet.cash };
      });
      return ok(value);
    });
  }

  previewSellAll(): { payout: number; items: Array<{ item: CatalogItem; quantity: number; payout: number }> } {
    const items = Object.entries(this.data.duplicates)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const item = getItem(id)!;
        return { item, quantity: n, payout: n * sellValue(item.rarity) };
      })
      .sort((a, b) => b.payout - a.payout);
    return { payout: items.reduce((s, i) => s + i.payout, 0), items };
  }

  sellAllDuplicates(saleId: string, expectedPayout?: number): OpResult<{ payout: number; balance: number; sold: number }> {
    return this.safe(() => {
      const key = `sale:${saleId}`;
      if (this.data.processed[key]) return ok({ payout: 0, balance: this.data.wallet.cash, sold: 0 }, true);
      const preview = this.previewSellAll();
      if (preview.payout <= 0) return fail('no_duplicates', 'No duplicates to sell.');
      if (expectedPayout !== undefined && expectedPayout !== preview.payout)
        return fail('invalid_state', 'Your duplicates changed. Review the payout again.');
      const value = this.transact((d) => {
        d.processed[key] = this.now();
        let payout = 0;
        let sold = 0;
        for (const { item, quantity } of preview.items) {
          payout += quantity * sellValue(item.rarity);
          sold += quantity;
          delete d.duplicates[item.id];
        }
        d.wallet.cash += payout;
        d.stats.duplicateSaleEarnings += payout;
        this.ledger(d, 'sale', payout, `Sold ${sold} duplicates`, key);
        return { payout, balance: d.wallet.cash, sold };
      });
      return ok(value);
    });
  }

  // ---------------------------------------------------------------- ads
  /** Grant a rewarded-ad payout. Only call with a provider-verified completion. */
  grantAdReward(reward: { rewardId: string; verified: boolean; provider: string }): OpResult<{ amount: number; balance: number }> {
    return this.safe(() => {
      if (!reward.verified) return fail('not_verified', 'Ad completion was not verified.');
      if (this.data.adRewards[reward.rewardId]) return ok({ amount: 0, balance: this.data.wallet.cash }, true);
      if (this.adRewardsToday() >= ECONOMY.rewardedAd.dailyCap) return fail('cap_reached', 'Daily ad rewards reached. Come back tomorrow.');
      const amount = ECONOMY.rewardedAd.amount;
      const value = this.transact((d) => {
        d.adRewards[reward.rewardId] = { at: this.now(), amount, provider: reward.provider };
        d.wallet.cash += amount;
        d.stats.cashFromAds += amount;
        this.ledger(d, 'ad', amount, `Rewarded ad (${reward.provider})`, `ad:${reward.rewardId}`);
        return { amount, balance: d.wallet.cash };
      });
      return ok(value);
    });
  }

  // ---------------------------------------------------------------- purchases
  recordPurchase(rec: Omit<PurchaseRecord, 'createdAt' | 'updatedAt'>): OpResult<PurchaseRecord> {
    return this.safe(() => {
      const existing = this.data.purchases[rec.transactionId];
      if (existing) return ok(existing, true);
      const value = this.transact((d) => {
        const r: PurchaseRecord = { ...rec, createdAt: this.now(), updatedAt: this.now() };
        d.purchases[rec.transactionId] = r;
        return r;
      });
      return ok(value);
    });
  }

  setPurchaseStatus(transactionId: string, status: Exclude<PurchaseStatus, 'fulfilled'>, error?: string): OpResult<PurchaseRecord> {
    return this.safe(() => {
      const existing = this.data.purchases[transactionId];
      if (!existing) return fail('invalid_state', 'Unknown transaction.');
      if (existing.status === 'fulfilled') return ok(existing, true);
      const value = this.transact((d) => {
        const r = d.purchases[transactionId]!;
        r.status = status;
        r.updatedAt = this.now();
        if (error) r.error = error;
        return { ...r };
      });
      return ok(value);
    });
  }

  /** Grant currency for a verified purchase exactly once. */
  fulfillPurchase(transactionId: string): OpResult<{ amount: number; balance: number }> {
    return this.safe(() => {
      const existing = this.data.purchases[transactionId];
      if (!existing) return fail('invalid_state', 'Unknown transaction.');
      if (existing.status === 'fulfilled') return ok({ amount: 0, balance: this.data.wallet.cash }, true);
      if (existing.status !== 'verified') return fail('not_verified', 'Purchase has not been verified.');
      const value = this.transact((d) => {
        const r = d.purchases[transactionId]!;
        r.status = 'fulfilled';
        r.updatedAt = this.now();
        d.wallet.cash += r.amount;
        d.stats.cashFromPurchases += r.amount;
        this.ledger(d, 'purchase', r.amount, `${r.productId} (${r.environment})`, `iap:${transactionId}`);
        return { amount: r.amount, balance: d.wallet.cash };
      });
      return ok(value);
    });
  }

  pendingFulfillment(): PurchaseRecord[] {
    return Object.values(this.data.purchases).filter((p) => p.status === 'verified' || p.status === 'pending');
  }

  // ---------------------------------------------------------------- misc
  skipTutorial(): void {
    try {
      this.transact((d) => {
        d.tutorial.skipped = true;
      });
    } catch {
      // ignore
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    try {
      this.transact((d) => {
        d.settings = { ...d.settings, ...patch };
      });
    } catch {
      // ignore
    }
  }

  /** Flush pending drop-director distance (pagehide / pause). */
  flush(): void {
    if (this.pendingDropMeters <= 0) return;
    try {
      this.transact((d) => this.foldDropDistance(d));
    } catch {
      // keep pending
    }
  }

  resetAll(): void {
    const fresh = createDefaultSave(this.now());
    this.storage.removeItem(`${this.key}.backup`);
    this.write(fresh, null);
    this.data = fresh;
    this.pendingDropMeters = 0;
    this.notify();
  }

  // ---------------------------------------------------------------- development fixtures
  dev = {
    grantCash: (amount: number) =>
      this.transact((d) => {
        d.wallet.cash = Math.max(0, d.wallet.cash + Math.floor(amount));
        this.ledger(d, 'dev', amount, 'Dev grant', `dev:${this.now()}:${Math.random()}`);
      }),
    setCash: (amount: number) =>
      this.transact((d) => {
        d.wallet.cash = Math.max(0, Math.floor(amount));
      }),
    grantBagOfRarity: (rarity: Rarity, runId = 'dev') =>
      this.transact((d) => {
        const pool = CATALOG_ITEMS.filter((i) => i.rarity === rarity);
        const item = pool[Math.floor(Math.random() * pool.length)]!;
        const duplicate = !!d.owned[item.id];
        if (duplicate) d.duplicates[item.id] = (d.duplicates[item.id] ?? 0) + 1;
        else {
          d.owned[item.id] = { at: this.now(), source: 'dev' };
          d.newItems.push(item.id);
          if (!d.discovered.includes(item.id)) d.discovered.push(item.id);
        }
        const rewardId = `devbag:${this.now()}:${Math.random().toString(36).slice(2)}`;
        d.unrevealed.push({ rewardId, itemId: item.id, duplicate, runId, at: this.now() });
        return item;
      }),
    addDuplicates: () =>
      this.transact((d) => {
        const owned = CATALOG_ITEMS.filter((i) => d.owned[i.id]).slice(0, 4);
        for (const it of owned) d.duplicates[it.id] = (d.duplicates[it.id] ?? 0) + 2;
        return owned.length;
      }),
    unlockAll: () =>
      this.transact((d) => {
        for (const it of CATALOG_ITEMS) if (!d.owned[it.id]) d.owned[it.id] = { at: this.now(), source: 'dev' };
        d.discovered = Array.from(new Set([...d.discovered, ...CATALOG_ITEMS.map((i) => i.id)]));
      }),
    forceBagSoon: () =>
      this.transact((d) => {
        d.drop.nextOpportunityAt = Math.min(d.drop.nextOpportunityAt, d.drop.distanceSinceOpportunity + 120);
      }),
    randomOutfit: () =>
      this.transact((d) => {
        const owned = ALL_ITEMS.filter((i) => d.owned[i.id]);
        for (const slot of ['headwear', 'top', 'bottom', 'shoes', 'accessory', 'board'] as Slot[]) {
          const options = owned.filter((i) => i.slot === slot);
          if (options.length) (d.equipped as Record<Slot, string | null>)[slot] = options[Math.floor(Math.random() * options.length)]!.id;
        }
        for (const id of conflictingItems(d.equipped.headwear ?? '', d.equipped as Loadout)) {
          const other = getItem(id)!;
          if (OPTIONAL_SLOTS.includes(other.slot)) (d.equipped as Record<Slot, string | null>)[other.slot] = null;
        }
      }),
  };
}
