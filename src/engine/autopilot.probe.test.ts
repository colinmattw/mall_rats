import { describe, it } from 'vitest';
import type { EnvId } from '../config/environments';
import { AutoPilot } from './autopilot';
import { RunSimulation } from './simulation';

const PREFS: EnvId[][] = [
  ['foodcourt', 'deptstore', 'maintenance', 'atrium'],
  ['atrium', 'maintenance', 'foodcourt', 'deptstore'],
  ['deptstore', 'atrium', 'maintenance', 'foodcourt'],
  ['maintenance', 'foodcourt', 'atrium', 'deptstore'],
];

describe('autopilot probe', () => {
  it('plays seeded runs through every branch type', () => {
    const seeds = Number(process.env.PROBE_SEEDS ?? 16);
    for (let i = 0; i < seeds; i++) {
      const seed = `probe-${i}`;
      let n = 0;
      const sim = new RunSimulation({ seed, runId: seed, hooks: { isBagDue: () => n++ % 1500 === 0 } });
      const bot = new AutoPilot(sim, { routePreference: PREFS[i % PREFS.length] });
      const envs = new Set<string>();
      let hits = 0;
      while (sim.phase === 'running' && sim.seconds < 200) {
        sim.step(bot.next());
        const wj = sim.generator.waitingJunction;
        if (process.env.PROBE_JUNCTIONS && wj?.junction && sim.tick % 60 === 0)
          process.stdout.write(`  approach ${seed} s=${sim.player.s.toFixed(0)} facade=${wj.junction.facadeS.toFixed(0)} opts=${wj.junction.options.join('/')} pref=${(bot as unknown as { junctionLane(): number | undefined }).junctionLane()} lane=${sim.player.lane}\n`);
        for (const e of sim.drainEvents()) {
          if (e.type === 'envChange') envs.add(e.env);
          if (e.type === 'junction' && process.env.PROBE_JUNCTIONS)
            process.stdout.write(`JUNCTION ${seed} lane=${e.lane} env=${e.env} playerLane=${sim.player.lane}->${sim.player.targetLane} prefLane=${(bot as unknown as { junctionLane(): number | undefined }).junctionLane?.()}\n`);
          if (e.type === 'crash' || e.type === 'minorHit' || e.type === 'smash' || (e.type === 'player' && e.ev.type === 'railBump')) {
            hits++;
            const c = sim.course.chunkAt(sim.player.s);
            const o = 'obstacle' in e ? e.obstacle : null;
            process.stdout.write(
              `HIT ${seed} ${e.type} s=${sim.player.s.toFixed(1)} v=${sim.player.speed.toFixed(1)} lane=${sim.player.lane}->${sim.player.targetLane} mode=${sim.player.mode} y=${sim.player.y.toFixed(2)} ${o ? `${o.def.id} lanes=${o.laneMin}-${o.laneMax} s0=${o.s0.toFixed(1)}` : ''} chunk=${c?.templateId}@${c ? (sim.player.s - c.s0).toFixed(1) : '?'} mirrored=${c?.mirrored} d=${c?.difficulty}\n`,
            );
          }
        }
      }
      process.stdout.write(`${seed}: ${sim.phase}/${sim.endReason ?? '-'} t=${sim.seconds.toFixed(0)} d=${sim.distance.toFixed(0)} hits=${hits} failedPlans=${bot.failedPlans} envs=${[...envs].join(',')}\n`);
    }
  });
});
