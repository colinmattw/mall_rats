import { describe, it } from 'vitest';
import { AutoPilot } from './autopilot';
import { RunSimulation } from './simulation';

describe('autopilot probe', () => {
  it('plays seeded runs', () => {
    for (const seed of ['alpha', 'bravo', 'charlie']) {
      let bagsDue = 0;
      const sim = new RunSimulation({
        seed,
        runId: `probe-${seed}`,
        hooks: { isBagDue: () => bagsDue++ % 2000 === 0 },
      });
      const bot = new AutoPilot(sim);
      const t0 = performance.now();
      const envs = new Set<string>();
      let junctions = 0;
      while (sim.phase === 'running' && sim.seconds < 240) {
        sim.step(bot.next());
        for (const e of sim.drainEvents()) {
          if (e.type === 'junction') junctions++;
          if (e.type === 'envChange') envs.add(e.env);
          if (e.type === 'crash')
            process.stdout.write(`CRASH ${seed} at s=${sim.player.s.toFixed(1)} obstacle=${e.obstacle.def.id} lanes=${e.obstacle.laneMin}-${e.obstacle.laneMax} s0=${e.obstacle.s0.toFixed(1)} chunk=${sim.course.chunkAt(sim.player.s)?.templateId}\n`);
          if (e.type === 'minorHit')
            process.stdout.write(`HIT ${seed} s=${sim.player.s.toFixed(1)} ${e.obstacle.def.id} side=${e.side} chunk=${sim.course.chunkAt(sim.player.s)?.templateId}\n`);
        }
      }
      process.stdout.write(
        `${seed}: phase=${sim.phase} reason=${sim.endReason} t=${sim.seconds.toFixed(0)}s dist=${sim.distance.toFixed(0)} speed=${sim.player.speed.toFixed(1)} cash=${sim.cash} style=${sim.scorer.score} junctions=${junctions} envs=${[...envs].join(',')} failedPlans=${bot.failedPlans} chunksAdded=${sim.course.stats.chunksAdded} obstaclesAllocated=${sim.course.stats.obstaclesAllocated} wall=${(performance.now() - t0).toFixed(0)}ms\n`,
      );
    }
  });
});
