import { describe, expect, it } from 'vitest';
import { GAMEPLAY, laneX } from '../config/gameplay';
import type { CourseRail } from './course';
import { createPlayer, createStepContext, playerHeight, stepPlayer, type Intent, type PlayerEvent, type PlayerState } from './player';

const cfg = GAMEPLAY;

function rail(lane: number, kickerS0: number, length: number, id = 1): CourseRail {
  return { id, lane, x: laneX(lane), kickerS0, s0: kickerS0 + cfg.kickerLength, s1: kickerS0 + length, height: cfg.railHeight, chunkUid: 0 };
}

function run(p: PlayerState, ticks: number, opts: { rails?: CourseRail[]; speed?: number; intents?: Record<number, Intent>; events?: PlayerEvent[]; buffering?: boolean } = {}) {
  const ctx = createStepContext(opts.rails ?? [], () => opts.speed ?? 15, { buffering: opts.buffering ?? true });
  for (let t = 0; t < ticks; t++) stepPlayer(p, ctx, opts.intents?.[t] ?? null, opts.events ?? null);
  return p;
}

describe('lane changes', () => {
  it('moves exactly one lane in laneChangeTicks', () => {
    const p = createPlayer(0, 1);
    run(p, 1, { intents: { 0: 'right' } });
    expect(p.targetLane).toBe(2);
    expect(p.x).toBeGreaterThan(laneX(1));
    expect(p.x).toBeLessThan(laneX(2));
    run(p, cfg.laneChangeTicks - 1);
    expect(p.lane).toBe(2);
    expect(p.x).toBeCloseTo(laneX(2), 6);
  });

  it('ignores moves past the outer lanes with an edge bump', () => {
    const p = createPlayer(0, 0);
    const events: PlayerEvent[] = [];
    run(p, 20, { intents: { 0: 'left' }, events });
    expect(p.lane).toBe(0);
    expect(events.some((e) => e.type === 'edgeBump')).toBe(true);
  });

  it('reverses smoothly when the opposite direction is pressed mid-change', () => {
    const p = createPlayer(0, 1);
    let lastX = p.x;
    let maxStep = 0;
    const ctx = createStepContext([], () => 15);
    for (let t = 0; t < 40; t++) {
      stepPlayer(p, ctx, t === 0 ? 'right' : t === 4 ? 'left' : null, null);
      maxStep = Math.max(maxStep, Math.abs(p.x - lastX));
      lastX = p.x;
    }
    expect(p.lane).toBe(1);
    expect(p.x).toBeCloseTo(laneX(1), 6);
    expect(maxStep).toBeLessThan(0.5);
  });

  it('buffers a same-direction swipe until the current change finishes', () => {
    const p = createPlayer(0, 0);
    run(p, 40, { intents: { 0: 'right', 3: 'right' } });
    expect(p.lane).toBe(2);
  });
});

describe('jumping', () => {
  it('stays airborne for the configured air time and reaches the configured height', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    let peak = 0;
    const ctx = createStepContext([], () => 15);
    let landTick = -1;
    for (let t = 0; t < 80; t++) {
      stepPlayer(p, ctx, t === 0 ? 'up' : null, events);
      peak = Math.max(peak, p.y);
      if (landTick < 0 && events.some((e) => e.type === 'land')) landTick = t;
    }
    // The take-off step is the first air tick (step indices are 0-based).
    expect(landTick + 1).toBe(cfg.jump.airTicks);
    expect(peak).toBeGreaterThan(cfg.jump.height - 0.03);
    expect(peak).toBeLessThan(cfg.jump.height + 0.01);
    expect(p.mode).toBe('ground');
  });

  it('turns horizontal swipes in the air into tricks without changing the landing lane', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    run(p, 60, { intents: { 0: 'up', 5: 'left', 28: 'right' }, events });
    expect(p.lane).toBe(1);
    expect(p.targetLane).toBe(1);
    const tricks = events.filter((e) => e.type === 'trick');
    expect(tricks.length).toBe(2);
    expect(events.filter((e) => e.type === 'laneChange')).toHaveLength(0);
  });

  it('marks a trick still spinning at touchdown as sketchy', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    run(p, 60, { intents: { 0: 'up', [cfg.jump.airTicks - 3]: 'left' }, events });
    const done = events.find((e) => e.type === 'trickDone');
    expect(done && done.type === 'trickDone' && done.clean).toBe(false);
    const land = events.find((e) => e.type === 'land');
    expect(land && land.type === 'land' && land.sketchy).toBe(true);
  });

  it('buffers a jump pressed just before landing', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    run(p, cfg.jump.airTicks + 3, { intents: { 0: 'up', [cfg.jump.airTicks - 4]: 'up' }, events });
    expect(events.filter((e) => e.type === 'jump')).toHaveLength(2);
    expect(p.mode).toBe('air');
  });

  it('a single swipe never triggers two actions', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    run(p, 3, { intents: { 0: 'up', 1: 'left' }, events });
    // jump then (airborne) trick — never a lane change in the air
    expect(events.map((e) => e.type)).toEqual(['jump', 'trick']);
    expect(p.targetLane).toBe(1);
  });

  it('Q/E trick intents do nothing on the ground', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    run(p, 5, { intents: { 0: 'trickLeft', 1: 'trickRight' }, events });
    expect(events).toHaveLength(0);
  });
});

describe('ducking', () => {
  it('lowers the skater for the configured duration', () => {
    const p = createPlayer(0, 1);
    run(p, 1, { intents: { 0: 'down' } });
    expect(playerHeight(p)).toBe(cfg.player.duckHeight);
    run(p, cfg.duckTicks);
    expect(p.duckTick).toBe(0);
    expect(playerHeight(p)).toBe(cfg.player.height);
  });

  it('duck in the air fast-falls and lands sooner', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    let landTick = -1;
    const ctx = createStepContext([], () => 15);
    for (let t = 0; t < 60; t++) {
      stepPlayer(p, ctx, t === 0 ? 'up' : t === 12 ? 'down' : null, events);
      if (landTick < 0 && events.some((e) => e.type === 'land')) landTick = t;
    }
    expect(landTick).toBeGreaterThan(0);
    expect(landTick).toBeLessThan(cfg.jump.airTicks);
  });

  it('jumping cancels a duck', () => {
    const p = createPlayer(0, 1);
    run(p, 3, { intents: { 0: 'down', 2: 'up' } });
    expect(p.duckTick).toBe(0);
    expect(p.mode).toBe('air');
  });
});

describe('grinding', () => {
  it('rolling up a marked kicker starts a grind and the rail end pops off', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    const r = rail(1, 5, 20);
    run(p, 120, { rails: [r], events });
    const start = events.find((e) => e.type === 'grindStart');
    expect(start && start.type === 'grindStart' && start.entry).toBe('kicker');
    const end = events.find((e) => e.type === 'grindEnd');
    expect(end && end.type === 'grindEnd' && end.distance).toBeGreaterThan(15);
    expect(p.mode === 'air' || p.mode === 'ground').toBe(true);
  });

  it('landing on a rail from a jump starts a grind', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    // Jump before the kicker so the skater comes down onto the rail top.
    run(p, 70, { rails: [rail(1, 4, 30)], intents: { 0: 'up' }, events });
    const start = events.find((e) => e.type === 'grindStart');
    expect(start && start.type === 'grindStart' && start.entry).toBe('land');
  });

  it('changing lanes into the side of a rail bumps the skater back', () => {
    const p = createPlayer(0, 0);
    const events: PlayerEvent[] = [];
    run(p, 30, { rails: [rail(1, 0, 40)], intents: { 0: 'right' }, events });
    expect(events.some((e) => e.type === 'railBump')).toBe(true);
    expect(p.lane).toBe(0);
  });

  it('hopping sideways off a rail onto a parallel rail is a transfer', () => {
    const p = createPlayer(0, 1);
    const events: PlayerEvent[] = [];
    run(p, 140, { rails: [rail(1, 2, 40, 1), rail(2, 2, 40, 2)], intents: { 30: 'right' }, events });
    const starts = events.filter((e) => e.type === 'grindStart');
    expect(starts.some((e) => e.type === 'grindStart' && e.entry === 'transfer')).toBe(true);
    expect(p.lane).toBe(2);
  });
});

describe('stumbles', () => {
  it('a stumble slows the skater and recovers', () => {
    const p = createPlayer(0, 1);
    run(p, 2);
    const base = p.speed;
    p.stumbleTick = cfg.stumble.recoverTicks;
    run(p, 1);
    expect(p.speed).toBeLessThan(base * 0.8);
    run(p, cfg.stumble.recoverTicks);
    expect(p.speed).toBeCloseTo(base, 5);
  });
});
