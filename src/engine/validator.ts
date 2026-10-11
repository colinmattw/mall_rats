import { GAMEPLAY, LANE_COUNT, type GameplayConfig } from '../config/gameplay';
import type { ChunkTemplate } from '../config/routes';
import { Course, overlapsObstacle, type CourseObstacle, type CourseRail, type PlayerBox } from './course';
import {
  clonePlayer,
  createPlayer,
  createStepContext,
  playerBox,
  stepPlayer,
  type Intent,
  type PlayerState,
} from './player';

/**
 * Exhaustive route validator.
 *
 * Breadth-first search over every distinct skater state reachable at each
 * simulation tick, using the real player step function and hitboxes that are
 * stricter than the in-game ones. A chunk is fair from an entry lane when at
 * least one collision-free state survives to the end of the chunk.
 *
 * The validator deliberately uses a subset of the skater's real abilities
 * (no fast-fall, no buffered inputs, decisions at 30 Hz) so anything it
 * proves passable is passable for a human with forgiving hitboxes.
 */
export interface ValidationTarget {
  obstacles: readonly CourseObstacle[];
  rails: readonly CourseRail[];
  sStart: number;
  sEnd: number;
  bag?: { x: number; s: number; y: number } | null;
}

export interface ValidationOptions {
  speed: number | ((s: number) => number);
  entryLanes?: number[];
  cfg?: GameplayConfig;
  decisionInterval?: number;
  startStates?: PlayerState[];
  recordPath?: boolean;
  /** Prefer surviving end states in this lane when reconstructing a path. */
  preferLane?: number;
}

export interface ValidationResult {
  passableFrom: boolean[];
  bagReachableFrom: boolean[] | null;
  statesExplored: number;
  peakStates: number;
  ticks: number;
  path?: Array<Intent | null>;
}

interface Node {
  p: PlayerState;
  mask: number;
  bag: boolean;
  parent: Node | null;
  action: Intent | null;
  /** Tick at which the path first reached the preferred lane (path recording only). */
  arrive: number;
}

const KIND_INDEX: Record<string, number> = { jump: 0, ollie: 1, hop: 2, pop: 3, fall: 4 };
const ACTIONS: Intent[] = ['left', 'right', 'up', 'down'];

function keyOf(p: PlayerState, railIndex: Map<number, number>, bag: boolean): number {
  const air = p.mode === 'air';
  const modeI = p.mode === 'ground' ? 0 : air ? 1 : 2;
  const railI = p.rail ? Math.min(15, (railIndex.get(p.rail.id) ?? 0) + 1) : 0;
  let k = p.lane;
  k = k * 4 + p.targetLane;
  k = k * 32 + Math.min(31, p.lcTick);
  k = k * 4 + modeI;
  k = k * 128 + (air ? Math.min(127, p.airTick) : 0);
  k = k * 8 + (air ? KIND_INDEX[p.airKind]! : 0);
  k = k * 256 + (air ? Math.round(p.takeoffY * 100) & 255 : 0);
  k = k * 16 + railI;
  k = k * 64 + Math.min(63, p.duckTick);
  k = k * 2 + (bag ? 1 : 0);
  return k;
}

/**
 * Validator action set: a conservative subset of what the skater can really do.
 * No ducking mid lane-change, no lane changes while ducking, no re-ducking to
 * extend a duck. Anything provable with fewer abilities is fair with all of them.
 */
function applicable(p: PlayerState, a: Intent): boolean {
  switch (a) {
    case 'up':
      return p.mode !== 'air';
    case 'down':
      return p.mode === 'ground' && p.duckTick === 0 && p.lane === p.targetLane;
    case 'left':
    case 'right': {
      if (p.mode === 'air' || p.duckTick > 0) return false;
      const dir = a === 'left' ? -1 : 1;
      if (p.mode === 'ground' && p.lane !== p.targetLane) return Math.sign(p.targetLane - p.lane) !== dir;
      const t = p.lane + dir;
      return t >= 0 && t < LANE_COUNT;
    }
    default:
      return false;
  }
}

export function touchesPoint(box: PlayerBox, x: number, s: number, y: number, radius: number): boolean {
  const cx = (box.x0 + box.x1) / 2;
  return (
    Math.abs(cx - x) < radius && s > box.s0 - radius && s < box.s1 + radius && y > box.y0 - 0.45 && y < box.y1 + 0.45
  );
}

export function collidesAny(box: PlayerBox, obstacles: readonly CourseObstacle[], margin: number): CourseObstacle | null {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]!;
    if (o.disabled) continue;
    if (o.s1 < box.s0 - 1 || o.s0 > box.s1 + 1) continue;
    if (overlapsObstacle(box, o, margin)) return o;
  }
  return null;
}

export function validateCourse(target: ValidationTarget, opts: ValidationOptions): ValidationResult {
  const cfg = opts.cfg ?? GAMEPLAY;
  const speedFn = typeof opts.speed === 'number' ? (() => opts.speed as number) : opts.speed;
  const ctx = createStepContext(target.rails, speedFn, { buffering: false, cfg });
  const interval = opts.decisionInterval ?? 2;
  const margin = -cfg.validatorPadding;
  const bagRadius = cfg.pickupRadius.bag - 0.25;
  const railIndex = new Map<number, number>();
  target.rails.forEach((r, i) => railIndex.set(r.id, i));
  const box: PlayerBox = { x0: 0, x1: 0, s0: 0, s1: 0, y0: 0, y1: 0 };
  const lanes = opts.entryLanes ?? [0, 1, 2];
  const record = !!opts.recordPath;

  let frontier = new Map<number, Node>();
  const starts = opts.startStates ?? lanes.map((l) => createPlayer(target.sStart, l, cfg));
  starts.forEach((p, i) => {
    const lane = opts.startStates ? i : lanes[i]!;
    const q = clonePlayer(p);
    q.buffered = null;
    q.trickTick = 0;
    const bag = !!target.bag && touchesPoint(playerBox(q, cfg, box), target.bag.x, target.bag.s, target.bag.y, bagRadius);
    const key = keyOf(q, railIndex, bag);
    const existing = frontier.get(key);
    if (existing) existing.mask |= 1 << lane;
    else frontier.set(key, { p: q, mask: 1 << lane, bag, parent: null, action: null, arrive: q.targetLane === opts.preferLane ? 0 : Infinity });
  });

  let explored = 0;
  let peak = frontier.size;
  let tick = 0;
  let s = starts[0]?.s ?? target.sStart;

  while (frontier.size > 0 && s < target.sEnd) {
    const decision = tick % interval === 0;
    const next = new Map<number, Node>();
    for (const node of frontier.values()) {
      for (let ai = -1; ai < (decision ? ACTIONS.length : 0); ai++) {
        const action = ai < 0 ? null : ACTIONS[ai]!;
        if (action && !applicable(node.p, action)) continue;
        const q = clonePlayer(node.p);
        stepPlayer(q, ctx, action, null);
        explored++;
        if (q.bumped) continue;
        playerBox(q, cfg, box);
        if (collidesAny(box, target.obstacles, margin)) continue;
        const bag =
          node.bag || (!!target.bag && touchesPoint(box, target.bag.x, target.bag.s, target.bag.y, bagRadius));
        const key = keyOf(q, railIndex, bag);
        const existing = next.get(key);
        const arrive = node.arrive !== Infinity ? node.arrive : q.targetLane === opts.preferLane ? tick + 1 : Infinity;
        if (existing) {
          existing.mask |= node.mask;
          // Identical states have identical futures, so re-parenting keeps the path valid.
          if (record && arrive < existing.arrive) {
            existing.parent = node;
            existing.action = action;
            existing.arrive = arrive;
          }
        } else {
          next.set(key, { p: q, mask: node.mask, bag, parent: record ? node : null, action, arrive });
        }
      }
    }
    frontier = next;
    peak = Math.max(peak, frontier.size);
    tick++;
    const first = frontier.values().next();
    if (!first.done) s = first.value.p.s;
  }

  const passableFrom = new Array(LANE_COUNT).fill(false) as boolean[];
  const bagReachableFrom = target.bag ? (new Array(LANE_COUNT).fill(false) as boolean[]) : null;
  let best: Node | null = null;
  for (const node of frontier.values()) {
    for (let l = 0; l < LANE_COUNT; l++) {
      if (node.mask & (1 << l)) {
        passableFrom[l] = true;
        if (bagReachableFrom && node.bag) bagReachableFrom[l] = true;
      }
    }
    if (record) {
      const scoreOf = (n: Node) =>
        (n.bag ? 8 : 0) +
        (opts.preferLane === n.p.targetLane ? 3 : 0) +
        (n.p.mode === 'ground' ? 2 : 0) +
        (n.arrive !== Infinity && opts.preferLane === n.p.targetLane ? 1 - n.arrive / (tick + 1) : 0);
      if (!best || scoreOf(node) > scoreOf(best)) best = node;
    }
  }

  const result: ValidationResult = { passableFrom, bagReachableFrom, statesExplored: explored, peakStates: peak, ticks: tick };
  if (record && best) {
    const path: Array<Intent | null> = [];
    for (let n: Node | null = best; n && n.parent; n = n.parent) path.push(n.action);
    path.reverse();
    result.path = path;
  }
  return result;
}

export interface TemplateValidationOptions {
  speed: number;
  difficulty: number;
  mirror: boolean;
  bagSlot?: number | null;
  cfg?: GameplayConfig;
}

/** Validate one chunk template variant in isolation, entered grounded from each lane. */
export function validateTemplate(template: ChunkTemplate, opts: TemplateValidationOptions): ValidationResult {
  const cfg = opts.cfg ?? GAMEPLAY;
  const course = new Course(cfg);
  const chunk = course.addChunk(template, { mirror: opts.mirror, difficulty: opts.difficulty, bagSlot: opts.bagSlot ?? null });
  const bagPickup = chunk.pickups.find((p) => p.kind === 'bag');
  return validateCourse(
    {
      obstacles: chunk.obstacles,
      rails: chunk.rails,
      sStart: chunk.s0,
      sEnd: chunk.s1,
      bag: bagPickup ? { x: bagPickup.x, s: bagPickup.s, y: bagPickup.y } : null,
    },
    { speed: opts.speed, cfg },
  );
}

/** Distinct difficulty thresholds that change a template's contents. */
export function difficultyLayers(template: ChunkTemplate): number[] {
  const set = new Set<number>([template.minDifficulty]);
  for (const o of template.obstacles) if (o.d !== undefined) set.add(o.d);
  for (const r of template.rails) if (r.d !== undefined) set.add(r.d);
  return [...set].filter((d) => d >= template.minDifficulty).sort((a, b) => a - b);
}

/** The highest layer threshold active at a given difficulty. */
export function activeLayer(template: ChunkTemplate, difficulty: number): number {
  let layer = template.minDifficulty;
  for (const d of difficultyLayers(template)) if (d <= difficulty) layer = d;
  return layer;
}

/** Memoised runtime validation (per template variant and speed bucket). */
export class ValidationCache {
  private cache = new Map<string, ValidationResult>();
  hits = 0;
  misses = 0;

  constructor(private readonly cfg: GameplayConfig = GAMEPLAY, private readonly bucket = 0.5) {}

  validate(template: ChunkTemplate, opts: { speed: number; difficulty: number; mirror: boolean; bagSlot?: number | null }) {
    const layer = activeLayer(template, opts.difficulty);
    // Round speed *up* to the bucket so the cached proof covers the actual speed's harder neighbour.
    const speed = Math.ceil(opts.speed / this.bucket) * this.bucket;
    const key = `${template.id}|${opts.mirror ? 1 : 0}|${layer}|${opts.bagSlot ?? -1}|${speed}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.hits++;
      return hit;
    }
    this.misses++;
    const result = validateTemplate(template, { speed, difficulty: layer, mirror: opts.mirror, bagSlot: opts.bagSlot, cfg: this.cfg });
    this.cache.set(key, result);
    return result;
  }
}
