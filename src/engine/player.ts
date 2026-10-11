import { GAMEPLAY, LANE_COUNT, SIM_DT, gravity, jumpLaunch, laneX, type GameplayConfig } from '../config/gameplay';
import { surfaceAt, type CourseRail, type PlayerBox, type SurfaceInfo } from './course';

/**
 * Player movement is a deterministic, fixed-tick state machine. Positions are
 * pure functions of discrete timers (lane-change tick, air tick, take-off
 * height), which lets the route validator explore every reachable state
 * exactly using this same code.
 */
export type Intent = 'left' | 'right' | 'up' | 'down' | 'trickLeft' | 'trickRight';
export type PlayerMode = 'ground' | 'air' | 'grind';
export type AirKind = 'jump' | 'ollie' | 'hop' | 'pop' | 'fall';

export interface TrickDef {
  id: string;
  name: string;
  points: number;
  /** Board rotations about its long axis (+ = kickflip direction). */
  flip: number;
  /** Board rotations about the vertical axis. */
  shove: number;
  /** Skater body spin (turns). */
  spin: number;
}

export const TRICKS: Record<string, TrickDef> = {
  kickflip: { id: 'kickflip', name: 'Kickflip', points: 100, flip: 1, shove: 0, spin: 0 },
  heelflip: { id: 'heelflip', name: 'Heelflip', points: 100, flip: -1, shove: 0, spin: 0 },
  varialKick: { id: 'varialKick', name: 'Varial Kickflip', points: 150, flip: 1, shove: 0.5, spin: 0 },
  varialHeel: { id: 'varialHeel', name: 'Varial Heelflip', points: 150, flip: -1, shove: -0.5, spin: 0 },
  doubleKick: { id: 'doubleKick', name: 'Double Kickflip', points: 190, flip: 2, shove: 0, spin: 0 },
  doubleHeel: { id: 'doubleHeel', name: 'Double Heelflip', points: 190, flip: -2, shove: 0, spin: 0 },
  popShove: { id: 'popShove', name: 'Pop Shove-it', points: 160, flip: 0, shove: 0.5, spin: 0 },
  fsShove: { id: 'fsShove', name: 'Frontside 180', points: 170, flip: 0, shove: -0.5, spin: 0.5 },
  treFlip: { id: 'treFlip', name: '360 Flip', points: 260, flip: 1, shove: 1, spin: 0 },
  hardflip: { id: 'hardflip', name: 'Hardflip', points: 240, flip: -1, shove: 0.5, spin: 0 },
};

export type PlayerEvent =
  | { type: 'laneChange'; dir: number }
  | { type: 'laneReverse' }
  | { type: 'jump'; kind: AirKind }
  | { type: 'land'; tricks: number; sketchy: boolean; fromHeight: number }
  | { type: 'grindStart'; rail: CourseRail; entry: 'kicker' | 'land' | 'transfer' }
  | { type: 'grindEnd'; rail: CourseRail; distance: number }
  | { type: 'duck'; airborne: boolean }
  | { type: 'trick'; trick: TrickDef; dir: number }
  | { type: 'trickDone'; trick: TrickDef; clean: boolean }
  | { type: 'edgeBump'; dir: number }
  | { type: 'railBump' };

export interface PlayerState {
  tick: number;
  s: number;
  speed: number;
  lane: number;
  targetLane: number;
  lcTick: number;
  x: number;
  y: number;
  mode: PlayerMode;
  airTick: number;
  takeoffY: number;
  launch: number;
  airKind: AirKind;
  fastFall: boolean;
  ffY: number;
  ffTick: number;
  rail: CourseRail | null;
  grindStartS: number;
  duckTick: number;
  trickTick: number;
  trickDir: number;
  trickId: string;
  tricksThisAir: number;
  lastTrickDir: number;
  stumbleTick: number;
  graceTick: number;
  buffered: Intent | null;
  bufferTicks: number;
  /** Set during a step when the skater was pushed back by a rail side. */
  bumped: boolean;
  prevX: number;
  prevY: number;
  prevS: number;
}

export interface StepContext {
  cfg: GameplayConfig;
  rails: readonly CourseRail[];
  baseSpeed: (s: number) => number;
  buffering: boolean;
  g: number;
  jumpV: number;
}

export function createStepContext(
  rails: readonly CourseRail[],
  baseSpeed: (s: number) => number,
  opts: { buffering?: boolean; cfg?: GameplayConfig } = {},
): StepContext {
  const cfg = opts.cfg ?? GAMEPLAY;
  return { cfg, rails, baseSpeed, buffering: opts.buffering ?? true, g: gravity(cfg), jumpV: jumpLaunch(cfg) };
}

export function createPlayer(s = 0, lane = 1, cfg: GameplayConfig = GAMEPLAY): PlayerState {
  const x = laneX(lane, cfg);
  return {
    tick: 0,
    s,
    speed: 0,
    lane,
    targetLane: lane,
    lcTick: 0,
    x,
    y: 0,
    mode: 'ground',
    airTick: 0,
    takeoffY: 0,
    launch: 0,
    airKind: 'jump',
    fastFall: false,
    ffY: 0,
    ffTick: 0,
    rail: null,
    grindStartS: 0,
    duckTick: 0,
    trickTick: 0,
    trickDir: 0,
    trickId: '',
    tricksThisAir: 0,
    lastTrickDir: 0,
    stumbleTick: 0,
    graceTick: 0,
    buffered: null,
    bufferTicks: 0,
    bumped: false,
    prevX: x,
    prevY: 0,
    prevS: s,
  };
}

export function clonePlayer(p: PlayerState, out?: PlayerState): PlayerState {
  if (!out) return { ...p };
  Object.assign(out, p);
  return out;
}

export function isChangingLanes(p: PlayerState): boolean {
  return p.lane !== p.targetLane;
}

export function playerHeight(p: PlayerState, cfg: GameplayConfig = GAMEPLAY): number {
  if (p.duckTick > 0) return cfg.player.duckHeight;
  if (p.mode === 'air') return cfg.player.airHeight;
  return cfg.player.height;
}

export function playerBox(p: PlayerState, cfg: GameplayConfig, out: PlayerBox): PlayerBox {
  out.x0 = p.x - cfg.player.halfWidth;
  out.x1 = p.x + cfg.player.halfWidth;
  out.s0 = p.s - cfg.player.halfDepth;
  out.s1 = p.s + cfg.player.halfDepth;
  out.y0 = p.y;
  out.y1 = p.y + playerHeight(p, cfg);
  return out;
}

/** Same box, but at the previous tick's position. */
export function prevPlayerBox(p: PlayerState, cfg: GameplayConfig, out: PlayerBox): PlayerBox {
  out.x0 = p.prevX - cfg.player.halfWidth;
  out.x1 = p.prevX + cfg.player.halfWidth;
  out.s0 = p.prevS - cfg.player.halfDepth;
  out.s1 = p.prevS + cfg.player.halfDepth;
  out.y0 = p.prevY;
  out.y1 = p.prevY + playerHeight(p, cfg);
  return out;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function computeX(p: PlayerState, cfg: GameplayConfig = GAMEPLAY): number {
  if (p.lane === p.targetLane) return laneX(p.lane, cfg);
  const t = Math.min(1, p.lcTick / cfg.laneChangeTicks);
  const a = laneX(p.lane, cfg);
  const b = laneX(p.targetLane, cfg);
  return a + (b - a) * smooth(t);
}

/** Lane the skater is closest to right now. */
export function nearestLane(p: PlayerState, cfg: GameplayConfig = GAMEPLAY): number {
  const raw = Math.round(p.x / cfg.laneWidth + (LANE_COUNT - 1) / 2);
  return Math.max(0, Math.min(LANE_COUNT - 1, raw));
}

function pickTrick(p: PlayerState, dir: number): TrickDef {
  const fromRail = p.airKind === 'ollie' || p.airKind === 'hop' || p.airKind === 'pop';
  if (p.tricksThisAir === 0) {
    if (fromRail) return dir < 0 ? TRICKS.varialKick! : TRICKS.varialHeel!;
    return dir < 0 ? TRICKS.kickflip! : TRICKS.heelflip!;
  }
  if (p.tricksThisAir === 1) {
    if (dir === p.lastTrickDir) return dir < 0 ? TRICKS.doubleKick! : TRICKS.doubleHeel!;
    return dir < 0 ? TRICKS.popShove! : TRICKS.fsShove!;
  }
  return dir < 0 ? TRICKS.treFlip! : TRICKS.hardflip!;
}

function startAir(p: PlayerState, kind: AirKind, fromY: number, launch: number, ev: PlayerEvent[] | null): void {
  p.mode = 'air';
  p.airKind = kind;
  p.airTick = 0;
  p.takeoffY = fromY;
  p.launch = launch;
  p.fastFall = false;
  p.ffTick = 0;
  p.tricksThisAir = 0;
  p.lastTrickDir = 0;
  p.trickTick = 0;
  p.rail = null;
  if (ev && kind !== 'fall') ev.push({ type: 'jump', kind });
}

function endGrind(p: PlayerState, ev: PlayerEvent[] | null): void {
  if (p.rail && ev) ev.push({ type: 'grindEnd', rail: p.rail, distance: Math.max(0, p.s - p.grindStartS) });
  p.rail = null;
}

function startGrind(p: PlayerState, rail: CourseRail, entry: 'kicker' | 'land' | 'transfer', ev: PlayerEvent[] | null): void {
  p.mode = 'grind';
  p.rail = rail;
  p.y = rail.height;
  p.grindStartS = p.s;
  if (ev) ev.push({ type: 'grindStart', rail, entry });
}

function completeTrick(p: PlayerState, clean: boolean, ev: PlayerEvent[] | null): void {
  const trick = TRICKS[p.trickId];
  if (trick && ev) ev.push({ type: 'trickDone', trick, clean });
  p.trickTick = 0;
}

function doTrick(p: PlayerState, dir: number, ctx: StepContext, ev: PlayerEvent[] | null): 'done' | 'ignored' {
  if (p.trickTick > 0) {
    const progress = p.trickTick / ctx.cfg.trick.ticks;
    if (progress < ctx.cfg.trick.cleanFraction) return 'ignored';
    completeTrick(p, true, ev);
  }
  const trick = pickTrick(p, dir);
  p.trickTick = 1;
  p.trickDir = dir;
  p.trickId = trick.id;
  p.tricksThisAir++;
  p.lastTrickDir = dir;
  if (ev) ev.push({ type: 'trick', trick, dir });
  return 'done';
}

function reverseLaneChange(p: PlayerState, cfg: GameplayConfig): void {
  const from = p.lane;
  p.lane = p.targetLane;
  p.targetLane = from;
  p.lcTick = cfg.laneChangeTicks - p.lcTick;
}

/**
 * Apply a player intent. Returns 'buffer' when the intent cannot happen yet
 * but may become valid shortly (e.g. jump pressed just before landing).
 */
export function applyIntent(
  p: PlayerState,
  intent: Intent,
  ctx: StepContext,
  ev: PlayerEvent[] | null,
): 'done' | 'buffer' | 'ignored' {
  const cfg = ctx.cfg;
  switch (intent) {
    case 'left':
    case 'right': {
      const dir = intent === 'left' ? -1 : 1;
      if (p.mode === 'air') return doTrick(p, dir, ctx, ev);
      if (p.mode === 'grind') {
        const target = p.lane + dir;
        if (target < 0 || target >= LANE_COUNT) {
          if (ev) ev.push({ type: 'edgeBump', dir });
          return 'ignored';
        }
        endGrind(p, ev);
        startAir(p, 'hop', p.y, cfg.railHopLaunch, ev);
        p.targetLane = target;
        p.lcTick = 0;
        if (ev) ev.push({ type: 'laneChange', dir });
        return 'done';
      }
      if (isChangingLanes(p)) {
        const curDir = Math.sign(p.targetLane - p.lane);
        if (dir === curDir) return 'buffer';
        reverseLaneChange(p, cfg);
        if (ev) ev.push({ type: 'laneReverse' });
        return 'done';
      }
      const target = p.lane + dir;
      if (target < 0 || target >= LANE_COUNT) {
        if (ev) ev.push({ type: 'edgeBump', dir });
        return 'ignored';
      }
      p.targetLane = target;
      p.lcTick = 0;
      if (ev) ev.push({ type: 'laneChange', dir });
      return 'done';
    }
    case 'up': {
      if (p.mode === 'air') return 'buffer';
      const kind: AirKind = p.mode === 'grind' ? 'ollie' : 'jump';
      if (p.mode === 'grind') endGrind(p, ev);
      p.duckTick = 0;
      startAir(p, kind, p.y, ctx.jumpV, ev);
      return 'done';
    }
    case 'down': {
      if (p.mode === 'air' && !p.fastFall) {
        p.fastFall = true;
        p.ffY = p.y;
        p.ffTick = 0;
      }
      p.duckTick = cfg.duckTicks;
      if (ev) ev.push({ type: 'duck', airborne: p.mode === 'air' });
      return 'done';
    }
    case 'trickLeft':
    case 'trickRight': {
      if (p.mode !== 'air') return 'ignored';
      return doTrick(p, intent === 'trickLeft' ? -1 : 1, ctx, ev);
    }
  }
  return 'ignored';
}

function land(p: PlayerState, surf: SurfaceInfo, ctx: StepContext, ev: PlayerEvent[] | null): void {
  const fromHeight = Math.max(0, p.takeoffY + (p.launch * p.launch) / (2 * ctx.g) - surf.h);
  let sketchy = false;
  if (p.trickTick > 0) {
    const progress = p.trickTick / ctx.cfg.trick.ticks;
    const clean = progress >= ctx.cfg.trick.cleanFraction;
    completeTrick(p, clean, ev);
    sketchy = !clean;
  }
  const tricks = p.tricksThisAir;
  const wasHop = p.airKind === 'hop';
  p.y = surf.h;
  p.fastFall = false;
  p.airTick = 0;
  p.tricksThisAir = 0;
  if (ev) ev.push({ type: 'land', tricks, sketchy, fromHeight });
  if (surf.rail && p.s >= surf.rail.s0) {
    startGrind(p, surf.rail, wasHop ? 'transfer' : 'land', ev);
  } else {
    p.mode = 'ground';
  }
}

function bump(p: PlayerState, cfg: GameplayConfig, ev: PlayerEvent[] | null): boolean {
  if (!isChangingLanes(p)) return false;
  reverseLaneChange(p, cfg);
  p.x = p.prevX;
  p.bumped = true;
  if (ev) ev.push({ type: 'railBump' });
  return true;
}

/**
 * Advance the skater one fixed tick. `intent` is a freshly issued input (or
 * null); buffered intents are retried automatically when buffering is on.
 */
export function stepPlayer(p: PlayerState, ctx: StepContext, intent: Intent | null, ev: PlayerEvent[] | null): void {
  const cfg = ctx.cfg;
  p.prevX = p.x;
  p.prevY = p.y;
  p.prevS = p.s;
  p.bumped = false;
  p.tick++;

  if (intent) {
    const r = applyIntent(p, intent, ctx, ev);
    if (r === 'buffer' && ctx.buffering) {
      p.buffered = intent;
      p.bufferTicks = cfg.inputBufferTicks;
    }
  } else if (p.buffered) {
    const r = applyIntent(p, p.buffered, ctx, ev);
    if (r !== 'buffer') p.buffered = null;
    else if (--p.bufferTicks <= 0) p.buffered = null;
  }

  // Lateral.
  if (isChangingLanes(p)) {
    p.lcTick++;
    if (p.lcTick >= cfg.laneChangeTicks) {
      p.lane = p.targetLane;
      p.lcTick = 0;
    }
  }
  p.x = computeX(p, cfg);

  // Forward.
  let factor = 1;
  if (p.stumbleTick > 0) {
    const t = 1 - p.stumbleTick / cfg.stumble.recoverTicks;
    factor = cfg.stumble.speedFactor + (1 - cfg.stumble.speedFactor) * t;
  }
  p.speed = ctx.baseSpeed(p.s) * factor;
  p.s += p.speed * SIM_DT;

  // Vertical.
  if (p.mode === 'ground') {
    const surf = surfaceAt(ctx.rails, p.x, p.s, cfg);
    if (surf.h > p.y + cfg.stepUpHeight) {
      if (!bump(p, cfg, ev)) {
        p.y = surf.h;
        if (surf.rail) startGrind(p, surf.rail, 'kicker', ev);
      }
    } else if (surf.h >= p.y - 0.02) {
      p.y = surf.h;
      if (surf.rail) startGrind(p, surf.rail, 'kicker', ev);
    } else {
      startAir(p, 'fall', p.y, 0, ev);
    }
  } else if (p.mode === 'grind') {
    const r = p.rail!;
    if (p.s > r.s1) {
      endGrind(p, ev);
      startAir(p, 'pop', r.height, cfg.railEndPopLaunch, ev);
    } else {
      p.y = r.height;
    }
  } else {
    p.airTick++;
    let vy: number;
    if (p.fastFall) {
      p.ffTick++;
      p.y = p.ffY - cfg.fastFallSpeed * p.ffTick * SIM_DT;
      vy = -cfg.fastFallSpeed;
    } else {
      const t = p.airTick * SIM_DT;
      p.y = p.takeoffY + p.launch * t - 0.5 * ctx.g * t * t;
      vy = p.launch - ctx.g * t;
    }
    if (p.trickTick > 0) {
      p.trickTick++;
      if (p.trickTick > cfg.trick.ticks) completeTrick(p, true, ev);
    }
    const surf = surfaceAt(ctx.rails, p.x, p.s, cfg);
    if (p.y < surf.h - cfg.stepUpHeight && p.prevY < surf.h - cfg.stepUpHeight) {
      // Drifting sideways into a rail body below its top.
      if (!bump(p, cfg, ev)) land(p, surf, ctx, ev);
    } else if (vy <= 0 && p.y <= surf.h) {
      land(p, surf, ctx, ev);
    }
  }

  if (p.duckTick > 0) p.duckTick--;
  if (p.stumbleTick > 0) p.stumbleTick--;
  if (p.graceTick > 0) p.graceTick--;
}

/** Push the skater back toward the lane they came from after a side-swipe. */
export function bounceBack(p: PlayerState, cfg: GameplayConfig = GAMEPLAY): boolean {
  if (!isChangingLanes(p)) return false;
  reverseLaneChange(p, cfg);
  p.x = computeX(p, cfg);
  return true;
}

export function stumble(p: PlayerState, cfg: GameplayConfig = GAMEPLAY): void {
  p.stumbleTick = cfg.stumble.recoverTicks;
  p.graceTick = cfg.stumble.graceTicks;
}
