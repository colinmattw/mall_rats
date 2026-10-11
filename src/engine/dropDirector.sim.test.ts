import { describe, expect, it } from 'vitest';
import { DROPS, maxDroughtDistance } from '../config/drops';
import { ECONOMY } from '../config/economy';
import { SIM_DT, speedAtDistance } from '../config/gameplay';
import { addDropDistance, createDropDirectorState, isBagDue, recordOpportunity } from './dropDirector';
import { Rng } from './rng';

/**
 * Cadence verification: simulate thousands of ordinary 60–90 s runs on the
 * real speed curve and measure active skating time between bag opportunities.
 * Run with `npm run sim:drops` for the printed report.
 */
function runDistance(seconds: number): number {
  let s = 0;
  for (let t = 0; t < seconds / SIM_DT; t++) s += speedAtDistance(s) * SIM_DT;
  return s;
}

describe('drop cadence simulation', () => {
  it('the reference speed matches the average speed of ordinary runs', () => {
    const [lo, hi] = ECONOMY.run.typicalRunSeconds;
    let sum = 0;
    let n = 0;
    for (let sec = lo; sec <= hi; sec++) {
      sum += runDistance(sec) / sec;
      n++;
    }
    const avg = sum / n;
    process.stdout.write(`average speed over ${lo}-${hi}s runs: ${avg.toFixed(2)} m/s (reference ${DROPS.referenceSpeed})\n`);
    expect(Math.abs(avg - DROPS.referenceSpeed) / DROPS.referenceSpeed).toBeLessThan(0.06);
  });

  it('delivers about one opportunity per 20–30 minutes of active skating, never beyond the drought cap', () => {
    const rng = new Rng('cadence');
    const state = createDropDirectorState('cadence-profile');
    const gapsMin: number[] = [];
    const gapsDist: number[] = [];
    let active = 0;
    let lastAt = 0;
    let distSince = 0;
    const runs = 6000;
    for (let r = 0; r < runs; r++) {
      const seconds = rng.range(ECONOMY.run.typicalRunSeconds[0], ECONOMY.run.typicalRunSeconds[1]);
      let s = 0;
      for (let t = 0; t < seconds / SIM_DT; t++) {
        const ds = speedAtDistance(s) * SIM_DT;
        s += ds;
        active += SIM_DT;
        distSince += ds;
        addDropDistance(state, ds);
        if (isBagDue(state)) {
          gapsMin.push((active - lastAt) / 60);
          gapsDist.push(distSince);
          lastAt = active;
          distSince = 0;
          recordOpportunity(state, rng.chance(0.75));
        }
      }
    }
    const mean = gapsMin.reduce((a, b) => a + b, 0) / gapsMin.length;
    const maxDist = Math.max(...gapsDist);
    const minMin = Math.min(...gapsMin);
    const maxMin = Math.max(...gapsMin);
    process.stdout.write(
      `bag opportunities: ${gapsMin.length} over ${(active / 3600).toFixed(1)} h of skating\n` +
        `mean gap ${mean.toFixed(1)} min (min ${minMin.toFixed(1)}, max ${maxMin.toFixed(1)}); max distance ${maxDist.toFixed(0)} m (cap ${maxDroughtDistance().toFixed(0)} m)\n`,
    );
    expect(mean).toBeGreaterThanOrEqual(20);
    expect(mean).toBeLessThanOrEqual(30);
    expect(maxDist).toBeLessThanOrEqual(maxDroughtDistance() + 30);
    expect(state.opportunities).toBe(gapsMin.length);
  });
});
