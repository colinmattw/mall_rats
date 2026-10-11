import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../config/economy';
import { ENV_IDS, type EnvId } from '../config/environments';
import { GAMEPLAY, settleTime, speedAtDistance } from '../config/gameplay';
import { OBSTACLE_TYPES } from '../config/obstacles';
import { JUNCTION_CHUNK, JUNCTION_OPTIONS, ROUTE_CHUNKS, TUTORIAL_CHUNK, type ChunkTemplate } from '../config/routes';
import { Course, templateTailClear } from './course';
import { RouteGenerator } from './generator';
import { difficultyLayers, validateTemplate } from './validator';

const SPEEDS = [GAMEPLAY.speed.start, 13, 15, 17, 19, 21, GAMEPLAY.speed.max];
const ALL = [...ROUTE_CHUNKS, JUNCTION_CHUNK];

describe('authored route chunks', () => {
  it('ship at least 12 meaningful chunk variations across all five environments', () => {
    expect(ROUTE_CHUNKS.length).toBeGreaterThanOrEqual(12);
    for (const env of ENV_IDS) expect(ROUTE_CHUNKS.filter((c) => c.env === env).length).toBeGreaterThanOrEqual(2);
    expect(new Set(ROUTE_CHUNKS.map((c) => c.id)).size).toBe(ROUTE_CHUNKS.length);
  });

  it('every variant is passable from every entry lane across the whole speed range, with reachable bags', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const t of ALL) {
      for (const layer of difficultyLayers(t)) {
        for (const mirror of t.mirror ? [false, true] : [false]) {
          for (const speed of SPEEDS) {
            const slots = t.bagSlots.length ? t.bagSlots.map((_, i) => i) : [null];
            for (const bagSlot of slots) {
              const r = validateTemplate(t, { speed, difficulty: layer, mirror, bagSlot });
              checked++;
              if (!r.passableFrom.every(Boolean)) failures.push(`${t.id} d=${layer} m=${mirror} v=${speed}: passable ${r.passableFrom}`);
              if (r.bagReachableFrom && !r.bagReachableFrom.every(Boolean)) failures.push(`${t.id} d=${layer} m=${mirror} v=${speed} slot=${bagSlot}: bag ${r.bagReachableFrom}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(500);
  });

  it('never places Mall Cash inside an obstacle', () => {
    for (const t of [...ALL, TUTORIAL_CHUNK]) {
      const course = new Course();
      const c = course.addChunk(t, { mirror: false, difficulty: 1 });
      for (const p of c.pickups) {
        for (const o of c.obstacles) {
          const inside = p.x > o.x0 && p.x < o.x1 && p.s > o.s0 - 0.2 && p.s < o.s1 + 0.2 && p.y > o.y0 && p.y < o.y1;
          expect(inside, `${t.id}: pickup at s=${p.s} inside ${o.def.id}`).toBe(false);
        }
      }
    }
  });

  it('keeps obstacle classes honest: jumpable, duckable, or truly lane-blocking', () => {
    for (const def of Object.values(OBSTACLE_TYPES)) {
      if (def.requirement === 'jump') expect(def.y1, def.id).toBeLessThanOrEqual(1.0);
      if (def.requirement === 'duck') expect(def.y0, def.id).toBeGreaterThan(GAMEPLAY.player.duckHeight + GAMEPLAY.validatorPadding);
      // Even with forgiving in-game hitboxes a jump apex never clears a blocking obstacle.
      if (def.requirement === 'block') expect(def.y1 - GAMEPLAY.collisionMargin, def.id).toBeGreaterThan(GAMEPLAY.jump.height + 0.05);
    }
  });

  it('expresses the intended route tradeoffs', () => {
    const per = (env: EnvId) => {
      const list = ROUTE_CHUNKS.filter((c) => c.env === env);
      let cash = 0;
      let len = 0;
      let obstacles = 0;
      let rails = 0;
      for (const t of list) {
        const c = new Course().addChunk(t, { mirror: false, difficulty: 1, coinScale: ECONOMY.coinDensity[env] });
        cash += c.pickups.reduce((n, p) => n + (p.kind === 'bag' ? 0 : ECONOMY.pickupValues[p.kind]), 0);
        len += t.length;
        obstacles += c.obstacles.length;
        rails += c.rails.length;
      }
      return { cashPerM: cash / len, obstaclesPerM: obstacles / len, rails: rails / list.length };
    };
    const concourse = per('concourse');
    const food = per('foodcourt');
    const dept = per('deptstore');
    const maint = per('maintenance');
    const atrium = per('atrium');
    expect(food.cashPerM).toBeGreaterThan(concourse.cashPerM * 1.5);
    expect(dept.cashPerM).toBeGreaterThan(concourse.cashPerM);
    expect(maint.cashPerM).toBeLessThan(concourse.cashPerM);
    expect(maint.obstaclesPerM).toBeLessThan(concourse.obstaclesPerM);
    expect(atrium.rails).toBeGreaterThan(concourse.rails);
    expect(atrium.rails).toBeGreaterThanOrEqual(2);
  });

  it('junction options always keep the main concourse and only lead to known environments', () => {
    for (const o of JUNCTION_OPTIONS) {
      expect(o).toContain('concourse');
      expect(o.some((e) => e !== 'concourse')).toBe(true);
      for (const e of o) expect(ENV_IDS).toContain(e);
    }
  });
});

describe('route generation', () => {
  function generate(seed: string, distance: number, pickLane: (options: string[]) => number) {
    const course = new Course();
    const gen = new RouteGenerator(seed);
    gen.start(course);
    const hooks = { isBagDue: () => false, onBagPlaced: () => {} };
    let guard = 0;
    while (course.end < distance && guard++ < 2000) {
      gen.fill(course, course.end + 200, hooks);
      if (gen.waitingJunction?.junction) gen.decideJunction(course, pickLane(gen.waitingJunction.junction.options));
      course.recycleBefore(course.end - 400);
    }
    return { course, gen };
  }

  it('keeps every chunk transition settle-safe for the speed at that point', () => {
    for (const seed of ['g1', 'g2', 'g3']) {
      const { gen } = generate(seed, 9000, (o) => o.findIndex((e) => e !== 'concourse'));
      const log = gen.log;
      for (let i = 1; i < log.length; i++) {
        const cur = log[i]!;
        if (cur.kind !== 'chunk' && cur.kind !== 'junction') continue;
        // Sum of clear space between the previous chunk's last obstacle and this chunk.
        let gap = 0;
        for (let j = i - 1; j >= 0; j--) {
          const prev = log[j]!;
          const t = [...ROUTE_CHUNKS, JUNCTION_CHUNK].find((x) => x.id === prev.templateId);
          if (t) {
            gap += templateTailClear(t, prev.difficulty);
            break;
          }
          gap += prev.s1 - prev.s0;
        }
        const required = speedAtDistance(cur.s0) * settleTime();
        expect(gap, `${seed} before ${cur.templateId}@${cur.s0.toFixed(0)}`).toBeGreaterThanOrEqual(required);
      }
    }
  });

  it('branches always reconnect to the main concourse and memory stays bounded', () => {
    const { course, gen } = generate('long', 30000, (o) => o.findIndex((e) => e !== 'concourse'));
    const kinds = gen.log.map((l) => l.kind);
    expect(kinds.filter((k) => k === 'lobby').length).toBeGreaterThan(5);
    let inBranch = false;
    for (const l of gen.log) {
      if (l.kind === 'lobby' && l.env !== 'concourse') inBranch = true;
      if (l.kind === 'exit') inBranch = false;
      if (inBranch) expect(['chunk', 'filler', 'lobby', 'exit']).toContain(l.kind);
    }
    // Pools recycle objects: allocations do not grow with distance.
    expect(course.stats.obstaclesAllocated).toBeLessThan(150);
    expect(course.stats.pickupsAllocated).toBeLessThan(900);
    expect(course.chunks.length).toBeLessThan(40);
  });

  it('ramps speed toward a controllable cap', () => {
    expect(speedAtDistance(0)).toBe(GAMEPLAY.speed.start);
    expect(speedAtDistance(1e7)).toBeCloseTo(GAMEPLAY.speed.max, 6);
    expect(speedAtDistance(2000)).toBeGreaterThan(speedAtDistance(1000));
  });

  it('uses the route RNG only for layout (seeded and reproducible)', () => {
    const a = generate('same', 3000, () => 1).gen.log.map((l) => `${l.templateId}:${l.mirrored}`);
    const b = generate('same', 3000, () => 1).gen.log.map((l) => `${l.templateId}:${l.mirrored}`);
    expect(a).toEqual(b);
  });
});

export const _templatesForDocs: ChunkTemplate[] = ROUTE_CHUNKS;
