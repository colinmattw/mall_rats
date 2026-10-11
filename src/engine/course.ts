import { GAMEPLAY, laneX, LANE_COUNT, type GameplayConfig } from '../config/gameplay';
import { OBSTACLE_TYPES, type ObstacleTypeDef } from '../config/obstacles';
import type { EnvId } from '../config/environments';
import type { ChunkKind, ChunkTemplate } from '../config/routes';

export interface CourseObstacle {
  id: number;
  def: ObstacleTypeDef;
  laneMin: number;
  laneMax: number;
  x0: number;
  x1: number;
  s0: number;
  s1: number;
  y0: number;
  y1: number;
  /** Knocked over / smashed. No longer collides. */
  disabled: boolean;
  hitTick: number;
  hitDir: number;
  /** Clean-jump / near-miss bookkeeping. */
  resolved: boolean;
  minClearance: number;
  minVertical: number;
  wasAirborneOver: boolean;
  wasDuckedUnder: boolean;
  chunkUid: number;
}

export interface CourseRail {
  id: number;
  lane: number;
  x: number;
  kickerS0: number;
  s0: number;
  s1: number;
  height: number;
  chunkUid: number;
}

export type PickupKind = 'cash' | 'stack' | 'bag';

export interface CoursePickup {
  id: number;
  kind: PickupKind;
  lane: number;
  x: number;
  s: number;
  y: number;
  value: number;
  collected: boolean;
  collectedTick: number;
  chunkUid: number;
}

export interface JunctionState {
  options: [EnvId, EnvId, EnvId];
  facadeS: number;
  decided: EnvId | null;
  decidedLane: number;
}

export interface ChunkInstance {
  uid: number;
  templateId: string;
  name: string;
  env: EnvId;
  kind: ChunkKind;
  s0: number;
  s1: number;
  mirrored: boolean;
  difficulty: number;
  obstacles: CourseObstacle[];
  rails: CourseRail[];
  pickups: CoursePickup[];
  features: string[];
  junction: JunctionState | null;
  /** For exit chunks: the environment that follows (always the main concourse). */
  exitTo: EnvId | null;
  decorSeed: number;
  hasBag: boolean;
}

export interface SurfaceInfo {
  h: number;
  rail: CourseRail | null;
}

const NO_SURFACE: SurfaceInfo = { h: 0, rail: null };

/** Height of the ground / ramp / rail directly under (x, s). */
export function surfaceAt(rails: readonly CourseRail[], x: number, s: number, cfg: GameplayConfig = GAMEPLAY): SurfaceInfo {
  let best: SurfaceInfo = NO_SURFACE;
  for (let i = 0; i < rails.length; i++) {
    const r = rails[i]!;
    if (s < r.kickerS0 || s > r.s1) continue;
    if (Math.abs(x - r.x) > cfg.railCatchHalfWidth) continue;
    let h: number;
    if (s < r.s0) {
      h = (r.height * (s - r.kickerS0)) / Math.max(0.001, r.s0 - r.kickerS0);
    } else {
      h = r.height;
    }
    if (h > best.h) best = { h, rail: s >= r.s0 ? r : null };
  }
  return best;
}

/** Lane-span helpers for obstacle boxes. */
export function obstacleLateral(laneMin: number, laneMax: number, def: ObstacleTypeDef, cfg: GameplayConfig = GAMEPLAY) {
  const cx = (laneX(laneMin, cfg) + laneX(laneMax, cfg)) / 2;
  const half = (def.width + (laneMax - laneMin) * cfg.laneWidth) / 2;
  return { x0: cx - half, x1: cx + half };
}

export interface PlayerBox {
  x0: number;
  x1: number;
  s0: number;
  s1: number;
  y0: number;
  y1: number;
}

/**
 * Does the player box overlap the obstacle box? `margin` > 0 shrinks the
 * obstacle (forgiving in-game hitboxes); `margin` < 0 inflates it (validator).
 */
export function overlapsObstacle(p: PlayerBox, o: CourseObstacle, margin: number): boolean {
  if (p.x1 <= o.x0 + margin || p.x0 >= o.x1 - margin) return false;
  if (p.s1 <= o.s0 + margin || p.s0 >= o.s1 - margin) return false;
  const top = o.y1 - margin;
  const bottom = o.y0 > 0.01 ? o.y0 + margin : o.y0;
  if (p.y1 <= bottom || p.y0 >= top) return false;
  return true;
}

export function lateralOverlap(p: PlayerBox, o: CourseObstacle, margin: number): boolean {
  return !(p.x1 <= o.x0 + margin || p.x0 >= o.x1 - margin);
}

let globalIds = 1;
const nextId = () => globalIds++;

/**
 * Holds the generated course ahead of the player. Old chunks are recycled into
 * pools so memory stays bounded no matter how long a run lasts.
 */
export class Course {
  chunks: ChunkInstance[] = [];
  /** Flattened, ordered views over active chunks (rebuilt on add / recycle). */
  obstacles: CourseObstacle[] = [];
  rails: CourseRail[] = [];
  pickups: CoursePickup[] = [];
  end = 0;
  private chunkUid = 1;
  private obstaclePool: CourseObstacle[] = [];
  private railPool: CourseRail[] = [];
  private pickupPool: CoursePickup[] = [];
  /** Lifetime counters exposed for tests (memory boundedness). */
  stats = { obstaclesAllocated: 0, pickupsAllocated: 0, railsAllocated: 0, chunksAdded: 0, chunksRecycled: 0 };

  constructor(public readonly cfg: GameplayConfig = GAMEPLAY) {}

  reset(start = 0): void {
    while (this.chunks.length) this.releaseChunk(this.chunks.shift()!);
    this.end = start;
    this.rebuildViews();
  }

  addChunk(
    template: ChunkTemplate,
    opts: {
      mirror: boolean;
      difficulty: number;
      bagSlot?: number | null;
      decorSeed?: number;
      junctionOptions?: [EnvId, EnvId, EnvId];
      exitTo?: EnvId | null;
      /** Coin line length multiplier (economy tuning). Arcs and stacks are unaffected. */
      coinScale?: number;
    },
  ): ChunkInstance {
    const s0 = this.end;
    const uid = this.chunkUid++;
    const ml = (l: number) => (opts.mirror ? LANE_COUNT - 1 - l : l);
    const cfg = this.cfg;
    const chunk: ChunkInstance = {
      uid,
      templateId: template.id,
      name: template.name,
      env: template.env,
      kind: template.kind,
      s0,
      s1: s0 + template.length,
      mirrored: opts.mirror,
      difficulty: opts.difficulty,
      obstacles: [],
      rails: [],
      pickups: [],
      features: template.features ? [...template.features] : [],
      junction: null,
      exitTo: opts.exitTo ?? null,
      decorSeed: opts.decorSeed ?? uid * 7919,
      hasBag: false,
    };

    for (const spec of template.obstacles) {
      if ((spec.d ?? 0) > opts.difficulty) continue;
      const def = OBSTACLE_TYPES[spec.t];
      const lanes = (Array.isArray(spec.l) ? spec.l : [spec.l]).map(ml);
      const laneMin = Math.min(...lanes);
      const laneMax = Math.max(...lanes);
      const o = this.obstaclePool.pop() ?? this.allocObstacle();
      const lat = obstacleLateral(laneMin, laneMax, def, cfg);
      o.id = nextId();
      o.def = def;
      o.laneMin = laneMin;
      o.laneMax = laneMax;
      o.x0 = lat.x0;
      o.x1 = lat.x1;
      o.s0 = s0 + spec.s;
      o.s1 = s0 + spec.s + (spec.len ?? def.depth);
      o.y0 = def.y0;
      o.y1 = def.y1;
      o.disabled = false;
      o.hitTick = -1;
      o.hitDir = 0;
      o.resolved = false;
      o.minClearance = Infinity;
      o.minVertical = Infinity;
      o.wasAirborneOver = false;
      o.wasDuckedUnder = false;
      o.chunkUid = uid;
      chunk.obstacles.push(o);
    }
    chunk.obstacles.sort((a, b) => a.s0 - b.s0);

    for (const spec of template.rails) {
      if ((spec.d ?? 0) > opts.difficulty) continue;
      const lane = ml(spec.l);
      const r = this.railPool.pop() ?? this.allocRail();
      r.id = nextId();
      r.lane = lane;
      r.x = laneX(lane, cfg);
      r.kickerS0 = s0 + spec.s;
      r.s0 = s0 + spec.s + cfg.kickerLength;
      r.s1 = s0 + spec.s + spec.len;
      r.height = cfg.railHeight;
      r.chunkUid = uid;
      chunk.rails.push(r);
    }

    for (const spec of template.coins) {
      if ((spec.d ?? 0) > opts.difficulty) continue;
      const lane = ml(spec.l);
      const gap = spec.gap ?? 2.5;
      const scaled = spec.arc || spec.stack ? spec.n : Math.max(1, Math.round(spec.n * (opts.coinScale ?? 1)));
      for (let i = 0; i < scaled; i++) {
        const p = this.pickupPool.pop() ?? this.allocPickup();
        p.id = nextId();
        p.kind = spec.stack ? 'stack' : 'cash';
        p.lane = lane;
        p.x = laneX(lane, cfg);
        p.s = s0 + spec.s + i * gap;
        let y = 0.75;
        if (spec.rail) y = cfg.railHeight + 0.75;
        if (spec.arc && spec.n > 1) {
          const u = (i / (spec.n - 1)) * 2 - 1;
          y = 0.6 + spec.arc * (1 - u * u);
        }
        p.y = y;
        p.value = 0;
        p.collected = false;
        p.collectedTick = -1;
        p.chunkUid = uid;
        chunk.pickups.push(p);
      }
    }

    if (opts.bagSlot !== undefined && opts.bagSlot !== null) {
      const slot = template.bagSlots[opts.bagSlot];
      if (slot) {
        const lane = ml(slot.l);
        const p = this.pickupPool.pop() ?? this.allocPickup();
        p.id = nextId();
        p.kind = 'bag';
        p.lane = lane;
        p.x = laneX(lane, cfg);
        p.s = s0 + slot.s;
        p.y = (slot.rail ? cfg.railHeight : 0) + 0.95;
        p.value = 0;
        p.collected = false;
        p.collectedTick = -1;
        p.chunkUid = uid;
        // Remove any coin sharing the bag's spot so the bag reads clearly.
        chunk.pickups = chunk.pickups.filter((c) => {
          const clash = c.lane === lane && Math.abs(c.s - p.s) < 1.6;
          if (clash) this.pickupPool.push(c);
          return !clash;
        });
        chunk.pickups.push(p);
        chunk.hasBag = true;
      }
    }
    chunk.pickups.sort((a, b) => a.s - b.s);

    if (template.kind === 'junction' && opts.junctionOptions) {
      chunk.junction = {
        options: opts.mirror
          ? [opts.junctionOptions[2], opts.junctionOptions[1], opts.junctionOptions[0]]
          : opts.junctionOptions,
        facadeS: chunk.s1,
        decided: null,
        decidedLane: -1,
      };
    }

    this.chunks.push(chunk);
    this.end = chunk.s1;
    this.stats.chunksAdded++;
    this.rebuildViews();
    return chunk;
  }

  /** Release chunks that end before `s`. Returns the number recycled. */
  recycleBefore(s: number): number {
    let n = 0;
    while (this.chunks.length > 1 && this.chunks[0]!.s1 < s) {
      this.releaseChunk(this.chunks.shift()!);
      n++;
    }
    if (n) this.rebuildViews();
    return n;
  }

  chunkAt(s: number): ChunkInstance | null {
    for (const c of this.chunks) if (s >= c.s0 && s < c.s1) return c;
    return null;
  }

  get pooledCounts() {
    return { obstacles: this.obstaclePool.length, rails: this.railPool.length, pickups: this.pickupPool.length };
  }

  private releaseChunk(c: ChunkInstance): void {
    for (const o of c.obstacles) this.obstaclePool.push(o);
    for (const r of c.rails) this.railPool.push(r);
    for (const p of c.pickups) this.pickupPool.push(p);
    c.obstacles = [];
    c.rails = [];
    c.pickups = [];
    this.stats.chunksRecycled++;
  }

  private rebuildViews(): void {
    this.obstacles = [];
    this.rails = [];
    this.pickups = [];
    for (const c of this.chunks) {
      for (const o of c.obstacles) this.obstacles.push(o);
      for (const r of c.rails) this.rails.push(r);
      for (const p of c.pickups) this.pickups.push(p);
    }
  }

  private allocObstacle(): CourseObstacle {
    this.stats.obstaclesAllocated++;
    return {
      id: 0,
      def: OBSTACLE_TYPES.wetFloor,
      laneMin: 0,
      laneMax: 0,
      x0: 0,
      x1: 0,
      s0: 0,
      s1: 0,
      y0: 0,
      y1: 0,
      disabled: false,
      hitTick: -1,
      hitDir: 0,
      resolved: false,
      minClearance: Infinity,
      minVertical: Infinity,
      wasAirborneOver: false,
      wasDuckedUnder: false,
      chunkUid: 0,
    };
  }

  private allocRail(): CourseRail {
    this.stats.railsAllocated++;
    return { id: 0, lane: 0, x: 0, kickerS0: 0, s0: 0, s1: 0, height: 0, chunkUid: 0 };
  }

  private allocPickup(): CoursePickup {
    this.stats.pickupsAllocated++;
    return { id: 0, kind: 'cash', lane: 0, x: 0, s: 0, y: 0, value: 0, collected: false, collectedTick: -1, chunkUid: 0 };
  }
}

/** First obstacle start (relative to the chunk) – the clear run-in. */
export function templateHeadClear(t: ChunkTemplate, difficulty: number): number {
  let first = t.length;
  for (const o of t.obstacles) if ((o.d ?? 0) <= difficulty) first = Math.min(first, o.s);
  for (const r of t.rails) if ((r.d ?? 0) <= difficulty) first = Math.min(first, r.s);
  return first;
}

/** Clear distance after the last obstacle / rail end. */
export function templateTailClear(t: ChunkTemplate, difficulty: number): number {
  let last = 0;
  for (const o of t.obstacles) {
    if ((o.d ?? 0) > difficulty) continue;
    last = Math.max(last, o.s + (o.len ?? OBSTACLE_TYPES[o.t].depth));
  }
  for (const r of t.rails) if ((r.d ?? 0) <= difficulty) last = Math.max(last, r.s + r.len);
  return t.length - last;
}
