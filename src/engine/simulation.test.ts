import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../config/gameplay';
import { JUNCTION_CHUNK, type ChunkTemplate, type ObstacleSpec } from '../config/routes';
import { AutoPilot } from './autopilot';
import { Course } from './course';
import { RouteGenerator } from './generator';
import type { Intent } from './player';
import { RunSimulation, type SimEvent } from './simulation';

const SPEED = 15;
const tickAt = (s: number) => Math.round((s / SPEED) * 60);

function tpl(obstacles: ObstacleSpec[], extra: Partial<ChunkTemplate> = {}): ChunkTemplate {
  return {
    id: 'test',
    name: 'Test',
    env: 'concourse',
    kind: 'chunk',
    length: 160,
    weight: 1,
    minDifficulty: 0,
    mirror: false,
    obstacles,
    rails: [],
    coins: [],
    bagSlots: [],
    ...extra,
  };
}

function simWith(t: ChunkTemplate, hooks: ConstructorParameters<typeof RunSimulation>[0]['hooks'] = {}) {
  return new RunSimulation({ seed: 'test', runId: 'run-test', fixedCourse: [t], constantSpeed: SPEED, hooks });
}

function play(sim: RunSimulation, ticks: number, intents: Record<number, Intent> = {}): SimEvent[] {
  const all: SimEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step(intents[t] ?? null);
    all.push(...sim.drainEvents());
  }
  return all;
}

describe('collisions and security', () => {
  it('a direct hit on a major obstacle ends the run', () => {
    const sim = simWith(tpl([{ t: 'kiosk', l: 1, s: 20, len: 6 }]));
    const events = play(sim, tickAt(25));
    expect(events.some((e) => e.type === 'crash')).toBe(true);
    expect(sim.phase).toBe('ending');
    const more = play(sim, GAMEPLAY.endSequenceTicks + 2);
    const end = more.find((e) => e.type === 'runEnd');
    expect(end && end.type === 'runEnd' && end.summary.endReason).toBe('crash');
    expect(sim.phase).toBe('ended');
  });

  it('a minor collision knocks the obstacle aside, slows the skater, adds pressure and breaks the combo', () => {
    const sim = simWith(tpl([{ t: 'wetFloor', l: 1, s: 20 }]));
    sim.scorer.award('a', 'A', 10);
    sim.scorer.award('b', 'B', 10);
    const events = play(sim, tickAt(22));
    const hit = events.find((e) => e.type === 'minorHit');
    expect(hit).toBeTruthy();
    expect(sim.security.pressure).toBe(GAMEPLAY.pressure.minorHit);
    expect(sim.player.stumbleTick).toBeGreaterThan(0);
    expect(sim.player.speed).toBeLessThan(SPEED);
    expect(sim.scorer.combo).toBe(0);
    expect(sim.course.obstacles[0]!.disabled).toBe(true);
    expect(sim.phase).toBe('running');
  });

  it('repeated mistakes fill the meter and security catches the skater', () => {
    const sim = simWith(tpl([
      { t: 'wetFloor', l: 1, s: 20 },
      { t: 'wetFloor', l: 1, s: 40 },
      { t: 'wetFloor', l: 1, s: 60 },
    ]));
    const events = play(sim, tickAt(70) + GAMEPLAY.endSequenceTicks + 30);
    expect(events.filter((e) => e.type === 'minorHit')).toHaveLength(3);
    expect(events.some((e) => e.type === 'captured')).toBe(true);
    const end = events.find((e) => e.type === 'runEnd');
    expect(end && end.type === 'runEnd' && end.summary.endReason).toBe('captured');
  });

  it('clean skating bleeds pressure off after a short delay', () => {
    const sim = simWith(tpl([{ t: 'wetFloor', l: 1, s: 10 }], { length: 400 }));
    play(sim, tickAt(12));
    const after = sim.security.pressure;
    play(sim, GAMEPLAY.pressure.decayDelayTicks - 10);
    expect(sim.security.pressure).toBeCloseTo(after, 6);
    play(sim, 60 * 4);
    expect(sim.security.pressure).toBeLessThan(after - 15);
  });

  it('side-swiping a major obstacle bounces the skater back instead of ending the run', () => {
    const sim = simWith(tpl([{ t: 'kiosk', l: 2, s: 10, len: 40 }]));
    const events = play(sim, tickAt(40), { [tickAt(20)]: 'right' });
    expect(events.some((e) => e.type === 'crash')).toBe(false);
    const hit = events.find((e) => e.type === 'minorHit');
    expect(hit && hit.type === 'minorHit' && hit.side).toBe(true);
    expect(sim.security.pressure).toBe(GAMEPLAY.pressure.sideBump);
    expect(sim.player.lane).toBe(1);
    expect(sim.phase).toBe('running');
  });

  it('breakable displays award style but raise pressure', () => {
    const sim = simWith(tpl([{ t: 'displayRack', l: 1, s: 20 }]));
    const events = play(sim, tickAt(23));
    expect(events.some((e) => e.type === 'smash')).toBe(true);
    expect(sim.scorer.score).toBeGreaterThanOrEqual(100);
    expect(sim.security.pressure).toBe(GAMEPLAY.pressure.breakable);
  });
});

describe('style actions', () => {
  it('jumping a low obstacle is a clean jump', () => {
    const sim = simWith(tpl([{ t: 'ropeLine', l: [0, 1, 2], s: 20 }]));
    const events = play(sim, tickAt(30), { [tickAt(15)]: 'up' });
    expect(events.some((e) => e.type === 'minorHit')).toBe(false);
    expect(sim.counters.cleanJumps).toBe(1);
    expect(events.some((e) => e.type === 'style' && e.award.id === 'cleanJump')).toBe(true);
  });

  it('ducking under an overhead banner avoids the hit', () => {
    const sim = simWith(tpl([{ t: 'bannerLow', l: [0, 1, 2], s: 20 }]));
    const events = play(sim, tickAt(30), { [tickAt(17.5)]: 'down' });
    expect(events.some((e) => e.type === 'minorHit')).toBe(false);
    expect(events.some((e) => e.type === 'style' && e.award.id === 'duckUnder')).toBe(true);
  });

  it('standing tall into an overhead banner is a collision', () => {
    const sim = simWith(tpl([{ t: 'bannerLow', l: [0, 1, 2], s: 20 }]));
    const events = play(sim, tickAt(30));
    expect(events.some((e) => e.type === 'minorHit')).toBe(true);
  });

  it('tricks are scored on clean landings', () => {
    const sim = simWith(tpl([]));
    const events = play(sim, 80, { 2: 'up', 6: 'trickLeft' });
    expect(events.some((e) => e.type === 'style' && e.award.id === 'kickflip')).toBe(true);
    expect(events.some((e) => e.type === 'style' && e.award.id === 'cleanLanding')).toBe(true);
    expect(sim.counters.tricks).toBe(1);
  });
});

describe('pickups and hooks', () => {
  it('collects Mall Cash tokens and stacks', () => {
    const sim = simWith(tpl([], { coins: [{ l: 1, s: 10, n: 5 }, { l: 1, s: 30, n: 1, stack: true }] }));
    play(sim, tickAt(40));
    expect(sim.cash).toBe(5 + 5);
  });

  it('reports collected and missed rare bags', () => {
    const got = simWith(tpl([], { bagSlots: [{ l: 1, s: 30 }] }));
    const e1 = play(got, tickAt(40));
    expect(e1.some((e) => e.type === 'bagCollected')).toBe(true);
    const missed = simWith(tpl([], { bagSlots: [{ l: 0, s: 30 }] }));
    const e2 = play(missed, tickAt(40));
    expect(e2.some((e) => e.type === 'bagMissed')).toBe(true);
    expect(e2.some((e) => e.type === 'bagCollected')).toBe(false);
  });

  it('feeds travelled distance to the drop director hook', () => {
    let total = 0;
    const sim = simWith(tpl([]), { onDistance: (m) => (total += m) });
    play(sim, 300);
    expect(total).toBeCloseTo(sim.player.s, 6);
  });
});

describe('routes', () => {
  it('a junction door choice leads into a themed branch that reconnects to the concourse', () => {
    const course = new Course();
    const gen = new RouteGenerator('branch-test');
    gen.start(course);
    course.addChunk(JUNCTION_CHUNK, { mirror: false, difficulty: 0, junctionOptions: ['foodcourt', 'concourse', 'concourse'] });
    gen.waitingJunction = course.chunks[course.chunks.length - 1]!;
    const env = gen.decideJunction(course, 0);
    expect(env).toBe('foodcourt');
    gen.fill(course, course.end + 600, { isBagDue: () => false, onBagPlaced: () => {} });
    const envs = course.chunks.map((c) => `${c.env}:${c.kind}`);
    const lobby = envs.indexOf('foodcourt:lobby');
    const exit = envs.indexOf('foodcourt:exit');
    expect(lobby).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(lobby);
    expect(envs.slice(lobby, exit).some((e) => e === 'foodcourt:chunk')).toBe(true);
    expect(envs.slice(exit + 1).some((e) => e.startsWith('concourse:'))).toBe(true);
  });

  it('the interactive tutorial can be completed and reports completion', () => {
    const sim = new RunSimulation({ seed: 'tut', runId: 'tut', tutorial: true });
    const bot = new AutoPilot(sim);
    let wantTrick = false;
    let end: SimEvent | undefined;
    for (let t = 0; t < 60 * 120 && !end; t++) {
      let intent = bot.next();
      if (wantTrick && sim.player.mode === 'air' && sim.player.trickTick === 0 && sim.player.airTick > 3) {
        intent = 'trickLeft';
        wantTrick = false;
      }
      sim.step(intent);
      for (const e of sim.drainEvents()) {
        if (e.type === 'tutorial' && e.step.expect === 'trick' && e.state !== 'done') wantTrick = true;
        if (e.type === 'runEnd') end = e;
      }
    }
    expect(end && end.type === 'runEnd' && end.summary.endReason).toBe('tutorialComplete');
    expect(sim.tutorialIndex).toBeGreaterThanOrEqual(6);
  });
});
