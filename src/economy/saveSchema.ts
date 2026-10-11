import {
  ALL_SLOTS,
  DEFAULT_APPEARANCE,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  OPTIONAL_SLOTS,
  SKIN_TONES,
  STARTER_ITEMS,
  STARTER_LOADOUT,
  getItem,
  type Appearance,
  type Loadout,
  type Slot,
} from '../config/catalog';
import { ECONOMY } from '../config/economy';
import { ACTIVE_MISSION_SLOTS, missionByIndex } from '../config/missions';
import { createDropDirectorState, sanitizeDropDirectorState, type DropDirectorState } from '../engine/dropDirector';
import { randomSeed } from '../engine/rng';
import type { RunProgress } from '../engine/simulation';

/**
 * Versioned save format. Bump SAVE_VERSION and add a migration whenever the
 * persisted shape changes. Unknown or invalid values are sanitised on load.
 */
export const SAVE_VERSION = 1;

export interface OwnedRecord {
  at: number;
  source: 'starter' | 'shop' | 'drop' | 'dev';
}

export interface OutfitPreset {
  name: string;
  loadout: Loadout;
  appearance: Appearance;
}

export interface UnrevealedReward {
  rewardId: string;
  itemId: string;
  duplicate: boolean;
  runId: string;
  at: number;
}

export interface MissionInstance {
  instanceId: string;
  missionIndex: number;
  missionId: string;
  progress: number;
  /** Per-run baseline used for run-scoped missions / total deltas. */
  startedAt: number;
}

export interface CompletedMission {
  instanceId: string;
  missionId: string;
  title: string;
  reward: number;
  badge?: string;
  at: number;
  runId: string | null;
}

export interface Stats {
  bestDistance: number;
  bestStyle: number;
  bestCombo: number;
  totalDistance: number;
  runsPlayed: number;
  totalGrinds: number;
  totalGrindDistance: number;
  totalTricks: number;
  totalCleanJumps: number;
  totalNearMisses: number;
  cashFromPickups: number;
  cashFromMissions: number;
  cashFromAds: number;
  cashFromPurchases: number;
  duplicateSaleEarnings: number;
  shopSpend: number;
  bagsCollected: number;
  bagsMissed: number;
  captures: number;
  crashes: number;
  longestNoHitSeconds: number;
  missionsCompleted: number;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface Settings {
  sound: boolean;
  music: boolean;
  soundVolume: number;
  musicVolume: number;
  haptics: boolean;
  reducedMotion: boolean;
  graphics: GraphicsQuality;
  swipeSensitivity: number;
  showControlHints: boolean;
  devMockProviders: boolean;
}

export type PurchaseStatus = 'pending' | 'canceled' | 'failed' | 'verified' | 'fulfilled';

export interface PurchaseRecord {
  transactionId: string;
  productId: string;
  amount: number;
  provider: string;
  environment: 'development' | 'sandbox' | 'production';
  status: PurchaseStatus;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface LedgerEntry {
  id: string;
  at: number;
  kind: 'pickup' | 'mission' | 'tutorial' | 'sale' | 'ad' | 'purchase' | 'shop' | 'dev';
  amount: number;
  note: string;
}

export interface ActiveRunRecord {
  runId: string;
  startedAt: number;
  tutorial: boolean;
  committed: RunProgress;
}

export interface RunHistoryEntry {
  runId: string;
  at: number;
  distance: number;
  style: number;
  cash: number;
  endReason: string;
}

export interface SaveData {
  version: number;
  profileId: string;
  createdAt: number;
  updatedAt: number;
  wallet: { cash: number };
  owned: Record<string, OwnedRecord>;
  duplicates: Record<string, number>;
  newItems: string[];
  discovered: string[];
  equipped: Loadout;
  appearance: Appearance;
  presets: Array<OutfitPreset | null>;
  saveTarget: string | null;
  drop: DropDirectorState;
  unrevealed: UnrevealedReward[];
  missions: { active: MissionInstance[]; nextIndex: number; completed: CompletedMission[]; badges: string[]; instanceCounter: number };
  stats: Stats;
  settings: Settings;
  tutorial: { completed: boolean; rewarded: boolean; skipped: boolean };
  processed: Record<string, number>;
  adRewards: Record<string, { at: number; amount: number; provider: string }>;
  purchases: Record<string, PurchaseRecord>;
  ledger: LedgerEntry[];
  activeRun: ActiveRunRecord | null;
  runHistory: RunHistoryEntry[];
  runCounter: number;
}

export const PRESET_SLOTS = 3;
export const LEDGER_LIMIT = 120;
export const PROCESSED_LIMIT = 4000;

export function defaultStats(): Stats {
  return {
    bestDistance: 0,
    bestStyle: 0,
    bestCombo: 0,
    totalDistance: 0,
    runsPlayed: 0,
    totalGrinds: 0,
    totalGrindDistance: 0,
    totalTricks: 0,
    totalCleanJumps: 0,
    totalNearMisses: 0,
    cashFromPickups: 0,
    cashFromMissions: 0,
    cashFromAds: 0,
    cashFromPurchases: 0,
    duplicateSaleEarnings: 0,
    shopSpend: 0,
    bagsCollected: 0,
    bagsMissed: 0,
    captures: 0,
    crashes: 0,
    longestNoHitSeconds: 0,
    missionsCompleted: 0,
  };
}

export function defaultSettings(): Settings {
  return {
    sound: true,
    music: true,
    soundVolume: 0.8,
    musicVolume: 0.5,
    haptics: true,
    reducedMotion: false,
    graphics: 'medium',
    swipeSensitivity: 1,
    showControlHints: true,
    devMockProviders: true,
  };
}

export function emptyProgress(): RunProgress {
  return {
    cash: 0,
    distance: 0,
    style: 0,
    cleanJumps: 0,
    tricks: 0,
    grinds: 0,
    grindDistance: 0,
    nearMisses: 0,
    smashes: 0,
    minorHits: 0,
    bagsCollected: 0,
    bagsMissed: 0,
    trickChains: 0,
    maxNoHitSeconds: 0,
    envsVisited: [],
  };
}

function initialMissions(now: number): SaveData['missions'] {
  const active: MissionInstance[] = [];
  for (let i = 0; i < ACTIVE_MISSION_SLOTS; i++) {
    const def = missionByIndex(i);
    active.push({ instanceId: `mi_${i + 1}`, missionIndex: i, missionId: def.id, progress: 0, startedAt: now });
  }
  return { active, nextIndex: ACTIVE_MISSION_SLOTS, completed: [], badges: [], instanceCounter: ACTIVE_MISSION_SLOTS };
}

export function createDefaultSave(now = Date.now(), seed = randomSeed()): SaveData {
  const owned: Record<string, OwnedRecord> = {};
  for (const it of STARTER_ITEMS) owned[it.id] = { at: now, source: 'starter' };
  return {
    version: SAVE_VERSION,
    profileId: seed,
    createdAt: now,
    updatedAt: now,
    wallet: { cash: ECONOMY.startingCash },
    owned,
    duplicates: {},
    newItems: [],
    discovered: STARTER_ITEMS.map((i) => i.id),
    equipped: { ...STARTER_LOADOUT },
    appearance: { ...DEFAULT_APPEARANCE },
    presets: new Array(PRESET_SLOTS).fill(null),
    saveTarget: null,
    drop: createDropDirectorState(seed),
    unrevealed: [],
    missions: initialMissions(now),
    stats: defaultStats(),
    settings: defaultSettings(),
    tutorial: { completed: false, rewarded: false, skipped: false },
    processed: {},
    adRewards: {},
    purchases: {},
    ledger: [],
    activeRun: null,
    runHistory: [],
    runCounter: 0,
  };
}

// ------------------------------------------------------------------ migration

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations keyed by the version they upgrade *from*. Version 0 is the
 * pre-release prototype layout (flat `coins`, `ownedItems` array).
 */
export const MIGRATIONS: Record<number, Migration> = {
  0: (d) => {
    const out: Record<string, unknown> = { ...d };
    if (typeof d.coins === 'number' && !d.wallet) out.wallet = { cash: d.coins };
    if (Array.isArray(d.ownedItems) && !d.owned) {
      const owned: Record<string, OwnedRecord> = {};
      for (const id of d.ownedItems as unknown[]) if (typeof id === 'string') owned[id] = { at: Date.now(), source: 'shop' };
      out.owned = owned;
    }
    delete out.coins;
    delete out.ownedItems;
    out.version = 1;
    return out;
  },
};

export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  let data = { ...raw };
  let version = typeof data.version === 'number' ? data.version : 0;
  let guard = 0;
  while (version < SAVE_VERSION && guard++ < 50) {
    const m = MIGRATIONS[version];
    if (!m) throw new Error(`No migration from save version ${version}`);
    data = m(data);
    version = typeof data.version === 'number' ? data.version : version + 1;
  }
  return data;
}

// --------------------------------------------------------------- sanitisation

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d);
const int = (v: unknown, d: number) => Math.floor(num(v, d));
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' && v.length < 200 ? v : d);

function sanitizeLoadout(raw: unknown, owned: Record<string, OwnedRecord>, fallback: Loadout): Loadout {
  const r = isObj(raw) ? raw : {};
  const out = { ...fallback };
  for (const slot of ALL_SLOTS) {
    const id = r[slot];
    if (id === null && OPTIONAL_SLOTS.includes(slot)) {
      (out as Record<Slot, string | null>)[slot] = null;
      continue;
    }
    if (typeof id === 'string') {
      const it = getItem(id);
      if (it && it.slot === slot && owned[id]) (out as Record<Slot, string | null>)[slot] = id;
    }
  }
  return out;
}

function sanitizeAppearance(raw: unknown): Appearance {
  const r = isObj(raw) ? raw : {};
  return {
    skinTone: SKIN_TONES.includes(r.skinTone as string) ? (r.skinTone as string) : DEFAULT_APPEARANCE.skinTone,
    hairStyle: HAIR_STYLES.some((h) => h.id === r.hairStyle) ? (r.hairStyle as string) : DEFAULT_APPEARANCE.hairStyle,
    hairColor: HAIR_COLORS.includes(r.hairColor as string) ? (r.hairColor as string) : DEFAULT_APPEARANCE.hairColor,
    face: FACES.some((f) => f.id === r.face) ? (r.face as string) : DEFAULT_APPEARANCE.face,
  };
}

function sanitizeProgress(raw: unknown): RunProgress {
  const r = isObj(raw) ? raw : {};
  const e = emptyProgress();
  const out = { ...e };
  for (const k of Object.keys(e) as Array<keyof RunProgress>) {
    if (k === 'envsVisited') continue;
    (out as unknown as Record<string, number>)[k] = int(r[k], 0);
  }
  out.envsVisited = Array.isArray(r.envsVisited) ? (r.envsVisited.filter((x) => typeof x === 'string') as RunProgress['envsVisited']) : [];
  return out;
}

/** Repair any loaded data into a valid SaveData (never throws). */
export function sanitizeSave(raw: unknown, now = Date.now()): SaveData {
  const base = createDefaultSave(now);
  if (!isObj(raw)) return base;
  const d = raw;
  const profileId = str(d.profileId, base.profileId);

  const owned: Record<string, OwnedRecord> = {};
  if (isObj(d.owned)) {
    for (const [id, rec] of Object.entries(d.owned)) {
      if (!getItem(id)) continue;
      const r = isObj(rec) ? rec : {};
      const source = ['starter', 'shop', 'drop', 'dev'].includes(r.source as string) ? (r.source as OwnedRecord['source']) : 'shop';
      owned[id] = { at: num(r.at, now), source };
    }
  }
  for (const it of STARTER_ITEMS) if (!owned[it.id]) owned[it.id] = { at: now, source: 'starter' };

  const duplicates: Record<string, number> = {};
  if (isObj(d.duplicates)) {
    for (const [id, n] of Object.entries(d.duplicates)) {
      const q = int(n, 0);
      if (q > 0 && owned[id]) duplicates[id] = q;
    }
  }

  const equipped = sanitizeLoadout(d.equipped, owned, STARTER_LOADOUT);
  const presets: Array<OutfitPreset | null> = new Array(PRESET_SLOTS).fill(null);
  if (Array.isArray(d.presets)) {
    d.presets.slice(0, PRESET_SLOTS).forEach((p, i) => {
      if (!isObj(p)) return;
      presets[i] = {
        name: str(p.name, `Fit ${i + 1}`).slice(0, 24),
        loadout: sanitizeLoadout(p.loadout, owned, equipped),
        appearance: sanitizeAppearance(p.appearance),
      };
    });
  }

  const missionsRaw = isObj(d.missions) ? d.missions : {};
  let missions = base.missions;
  if (Array.isArray(missionsRaw.active)) {
    const active: MissionInstance[] = [];
    for (const m of missionsRaw.active) {
      if (!isObj(m)) continue;
      const idx = int(m.missionIndex, -1);
      if (idx < 0) continue;
      active.push({
        instanceId: str(m.instanceId, `mi_${idx + 1}`),
        missionIndex: idx,
        missionId: missionByIndex(idx).id,
        progress: num(m.progress, 0),
        startedAt: num(m.startedAt, now),
      });
    }
    missions = {
      active: active.slice(0, ACTIVE_MISSION_SLOTS),
      nextIndex: int(missionsRaw.nextIndex, ACTIVE_MISSION_SLOTS),
      completed: Array.isArray(missionsRaw.completed)
        ? (missionsRaw.completed.filter(isObj).slice(-60) as unknown as CompletedMission[])
        : [],
      badges: Array.isArray(missionsRaw.badges) ? (missionsRaw.badges.filter((b) => typeof b === 'string') as string[]) : [],
      instanceCounter: int(missionsRaw.instanceCounter, ACTIVE_MISSION_SLOTS),
    };
  }

  const statsRaw = isObj(d.stats) ? d.stats : {};
  const stats = defaultStats();
  for (const k of Object.keys(stats) as Array<keyof Stats>) stats[k] = num(statsRaw[k], 0);

  const settingsRaw = isObj(d.settings) ? d.settings : {};
  const ds = defaultSettings();
  const settings: Settings = {
    sound: bool(settingsRaw.sound, ds.sound),
    music: bool(settingsRaw.music, ds.music),
    soundVolume: Math.min(1, num(settingsRaw.soundVolume, ds.soundVolume)),
    musicVolume: Math.min(1, num(settingsRaw.musicVolume, ds.musicVolume)),
    haptics: bool(settingsRaw.haptics, ds.haptics),
    reducedMotion: bool(settingsRaw.reducedMotion, ds.reducedMotion),
    graphics: ['low', 'medium', 'high'].includes(settingsRaw.graphics as string) ? (settingsRaw.graphics as GraphicsQuality) : ds.graphics,
    swipeSensitivity: Math.min(2, Math.max(0.5, num(settingsRaw.swipeSensitivity, ds.swipeSensitivity))),
    showControlHints: bool(settingsRaw.showControlHints, ds.showControlHints),
    devMockProviders: bool(settingsRaw.devMockProviders, ds.devMockProviders),
  };

  const tutorialRaw = isObj(d.tutorial) ? d.tutorial : {};
  const processed: Record<string, number> = {};
  if (isObj(d.processed)) for (const [k, v] of Object.entries(d.processed)) processed[k] = num(v, now);

  const adRewards: SaveData['adRewards'] = {};
  if (isObj(d.adRewards)) {
    for (const [k, v] of Object.entries(d.adRewards)) {
      if (isObj(v)) adRewards[k] = { at: num(v.at, now), amount: int(v.amount, 0), provider: str(v.provider, 'unknown') };
    }
  }

  const purchases: SaveData['purchases'] = {};
  if (isObj(d.purchases)) {
    for (const [k, v] of Object.entries(d.purchases)) {
      if (!isObj(v)) continue;
      const status = ['pending', 'canceled', 'failed', 'verified', 'fulfilled'].includes(v.status as string) ? (v.status as PurchaseStatus) : 'failed';
      purchases[k] = {
        transactionId: k,
        productId: str(v.productId, ''),
        amount: int(v.amount, 0),
        provider: str(v.provider, 'unknown'),
        environment: (['development', 'sandbox', 'production'].includes(v.environment as string) ? v.environment : 'development') as PurchaseRecord['environment'],
        status,
        createdAt: num(v.createdAt, now),
        updatedAt: num(v.updatedAt, now),
        error: typeof v.error === 'string' ? v.error : undefined,
      };
    }
  }

  const unrevealed: UnrevealedReward[] = Array.isArray(d.unrevealed)
    ? d.unrevealed
        .filter(isObj)
        .filter((u) => typeof u.itemId === 'string' && !!getItem(u.itemId as string))
        .map((u) => ({
          rewardId: str(u.rewardId, `rw_${Math.random().toString(36).slice(2)}`),
          itemId: u.itemId as string,
          duplicate: bool(u.duplicate, false),
          runId: str(u.runId, ''),
          at: num(u.at, now),
        }))
    : [];

  const activeRunRaw = isObj(d.activeRun) ? d.activeRun : null;

  return {
    version: SAVE_VERSION,
    profileId,
    createdAt: num(d.createdAt, now),
    updatedAt: num(d.updatedAt, now),
    wallet: { cash: int(isObj(d.wallet) ? d.wallet.cash : 0, 0) },
    owned,
    duplicates,
    newItems: Array.isArray(d.newItems) ? (d.newItems.filter((id) => typeof id === 'string' && owned[id as string]) as string[]) : [],
    discovered: Array.from(
      new Set([
        ...Object.keys(owned),
        ...(Array.isArray(d.discovered) ? (d.discovered.filter((id) => typeof id === 'string' && getItem(id as string)) as string[]) : []),
      ]),
    ),
    equipped,
    appearance: sanitizeAppearance(d.appearance),
    presets,
    saveTarget: typeof d.saveTarget === 'string' && getItem(d.saveTarget) ? d.saveTarget : null,
    drop: sanitizeDropDirectorState(d.drop, profileId),
    unrevealed,
    missions,
    stats,
    settings,
    tutorial: {
      completed: bool(tutorialRaw.completed, false),
      rewarded: bool(tutorialRaw.rewarded, false),
      skipped: bool(tutorialRaw.skipped, false),
    },
    processed,
    adRewards,
    purchases,
    ledger: Array.isArray(d.ledger) ? (d.ledger.filter(isObj).slice(-LEDGER_LIMIT) as unknown as LedgerEntry[]) : [],
    activeRun: activeRunRaw
      ? {
          runId: str(activeRunRaw.runId, 'unknown'),
          startedAt: num(activeRunRaw.startedAt, now),
          tutorial: bool(activeRunRaw.tutorial, false),
          committed: sanitizeProgress(activeRunRaw.committed),
        }
      : null,
    runHistory: Array.isArray(d.runHistory) ? (d.runHistory.filter(isObj).slice(-20) as unknown as RunHistoryEntry[]) : [],
    runCounter: int(d.runCounter, 0),
  };
}

/** Hard invariants checked after every economy transaction. */
export function assertInvariants(d: SaveData): void {
  if (!Number.isInteger(d.wallet.cash) || d.wallet.cash < 0) throw new Error(`Invalid wallet balance: ${d.wallet.cash}`);
  for (const slot of ALL_SLOTS) {
    const id = d.equipped[slot];
    if (id === null) {
      if (!OPTIONAL_SLOTS.includes(slot)) throw new Error(`Required slot ${slot} empty`);
      continue;
    }
    const it = getItem(id);
    if (!it || it.slot !== slot) throw new Error(`Equipped item ${id} invalid for ${slot}`);
    if (!d.owned[id]) throw new Error(`Equipped item ${id} not owned`);
  }
  for (const [id, n] of Object.entries(d.duplicates)) {
    if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid duplicate count for ${id}`);
    if (n > 0 && !d.owned[id]) throw new Error(`Duplicate of unowned item ${id}`);
  }
}
