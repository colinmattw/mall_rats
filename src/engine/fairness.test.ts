import { describe, expect, it } from 'vitest';
import type { EnvId } from '../config/environments';
import { GAMEPLAY } from '../config/gameplay';
import { AutoPilot } from './autopilot';
import { RunSimulation } from './simulation';

/**
 * End-to-end fairness: a planning bot plays the real simulation (real
 * generation, transitions, junction branches, bags, forgiving hitboxes) for
 * minutes at a time. Any unavoidable obstacle would show up as a collision.
 */
const PREFS: EnvId[][] = [
  ['foodcourt', 'deptstore', 'maintenance', 'atrium'],
  ['atrium', 'maintenance', 'foodcourt', 'deptstore'],
  ['deptstore', 'atrium', 'maintenance', 'foodcourt'],
  ['maintenance', 'foodcourt', 'atrium', 'deptstore'],
];

describe('fair routes end to end', () => {
  it('a planning bot survives long runs at full speed through every branch type without a single collision', () => {
    const envs = new Set<string>();
    let maxSpeed = 0;
    for (let i = 0; i < 8; i++) {
      let n = 0;
      const sim = new RunSimulation({ seed: `fair-${i}`, runId: `fair-${i}`, hooks: { isBagDue: () => n++ % 1800 === 0 } });
      const bot = new AutoPilot(sim, { routePreference: PREFS[i % PREFS.length] });
      const seconds = i < 2 ? 360 : 150;
      const hits: string[] = [];
      while (sim.phase === 'running' && sim.seconds < seconds) {
        sim.step(bot.next());
        for (const e of sim.drainEvents()) {
          if (e.type === 'envChange') envs.add(e.env);
          if (e.type === 'crash' || e.type === 'minorHit' || e.type === 'smash') hits.push(`${e.type}@${sim.player.s.toFixed(0)} ${sim.course.chunkAt(sim.player.s)?.templateId}`);
        }
        maxSpeed = Math.max(maxSpeed, sim.player.speed);
      }
      expect(hits, `seed fair-${i}`).toEqual([]);
      expect(sim.phase).toBe('running');
      expect(bot.failedPlans).toBe(0);
    }
    for (const env of ['foodcourt', 'deptstore', 'maintenance', 'atrium']) expect(envs).toContain(env);
    expect(maxSpeed).toBeGreaterThan(GAMEPLAY.speed.max - 2);
  });
});
