import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../config/economy';
import { GAMEPLAY, SIM_DT, speedAtDistance } from '../config/gameplay';
import { AutoPilot } from '../engine/autopilot';
import { RunSimulation } from '../engine/simulation';

/**
 * Simulated-run earnings report. Typical 60–90 s skating should land near
 * ECONOMY.run.targetCashPerRun after applying the assumed collection rate to
 * pickups the skater actually passes. Printed via `npm run report:economy`.
 */
describe('economy report', () => {
  it('typical 60–90 s runs pay about 75–150 Mall Cash from pickups', () => {
    const [loSec, hiSec] = ECONOMY.run.typicalRunSeconds;
    const [loCash, hiCash] = ECONOMY.run.targetCashPerRun;
    const runs = 24;
    let placedSum = 0;
    let collectedSum = 0;
    let distSum = 0;
    let survived = 0;
    const lines: string[] = [];
    for (let i = 0; i < runs; i++) {
      const seconds = loSec + Math.floor(((hiSec - loSec) * i) / (runs - 1));
      const sim = new RunSimulation({ seed: `earn-${i}`, runId: `earn-${i}` });
      const bot = new AutoPilot(sim);
      const seen = new Set<number>();
      let placed = 0;
      while (sim.phase === 'running' && sim.seconds < seconds) {
        sim.step(bot.next());
        for (const p of sim.course.pickups) {
          if (p.kind === 'bag' || seen.has(p.id) || p.s >= sim.player.s) continue;
          seen.add(p.id);
          placed += ECONOMY.pickupValues[p.kind];
        }
      }
      if (sim.phase === 'running') survived++;
      placedSum += placed;
      collectedSum += sim.cash;
      distSum += sim.distance;
      lines.push(
        `  seed earn-${i}  ${seconds}s  ${sim.distance.toFixed(0)} m  placed ${placed}  collected ${sim.cash}` +
          (sim.phase === 'running' ? '' : `  ended=${sim.phase}`),
      );
    }
    const n = runs;
    const avgPlaced = placedSum / n;
    const avgCollected = collectedSum / n;
    const expected = avgPlaced * ECONOMY.run.typicalCollectionRate;
    const avgDist = distSum / n;
    const avgSpeed = avgDist / ((loSec + hiSec) / 2);
    const report =
      `Mall Rats economy report (${runs} simulated ${loSec}–${hiSec}s runs)\n` +
      lines.join('\n') +
      `\navg distance ${avgDist.toFixed(0)} m  avg speed ${avgSpeed.toFixed(2)} m/s (start ${GAMEPLAY.speed.start}, cap ${GAMEPLAY.speed.max})\n` +
      `avg pickups placed along the path ${avgPlaced.toFixed(1)}  × collection ${ECONOMY.run.typicalCollectionRate} = ${expected.toFixed(1)} expected collected\n` +
      `avg actually collected by the planning bot ${avgCollected.toFixed(1)}  (survived ${survived}/${runs})\n` +
      `target band ${loCash}–${hiCash} Mall Cash\n`;
    process.stdout.write(report);
    expect(survived, 'planning bot should finish ordinary runs').toBe(runs);
    expect(expected).toBeGreaterThanOrEqual(loCash * 0.85);
    expect(expected).toBeLessThanOrEqual(hiCash * 1.25);
    expect(avgCollected).toBeGreaterThanOrEqual(loCash * 0.5);
    expect(avgCollected).toBeLessThanOrEqual(hiCash * 1.6);
    void SIM_DT;
    void speedAtDistance;
  });
});
