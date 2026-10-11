import type { EnvId } from '../config/environments';
import { speedAtDistance } from '../config/gameplay';
import type { Intent } from './player';
import type { RunSimulation } from './simulation';
import { validateCourse } from './validator';

/**
 * A planning bot that plays the real simulation. Used by tests to prove that
 * generated courses (including chunk transitions and junction branches) are
 * survivable end-to-end at full speed, and by the dev fixtures for demos.
 */
export class AutoPilot {
  private plan: Array<Intent | null> = [];
  private sincePlan = 0;
  failedPlans = 0;

  constructor(
    private readonly sim: RunSimulation,
    private readonly opts: { lookaheadSeconds?: number; replanTicks?: number; preferLane?: number; routePreference?: EnvId[] } = {},
  ) {}

  /** Lane whose junction door leads to the most preferred environment (if a junction is pending). */
  private junctionLane(): number | undefined {
    const options = this.sim.generator.waitingJunction?.junction?.options;
    const prefs = this.opts.routePreference;
    if (!options || !prefs?.length) return undefined;
    for (const env of prefs) {
      const lane = options.indexOf(env);
      if (lane >= 0) return lane;
    }
    return undefined;
  }

  next(): Intent | null {
    const replanTicks = this.opts.replanTicks ?? 24;
    if (this.plan.length === 0 || this.sincePlan >= replanTicks) this.replan();
    this.sincePlan++;
    return this.plan.length ? this.plan.shift()! : null;
  }

  private replan(): void {
    const sim = this.sim;
    const p = sim.player;
    this.sincePlan = 0;
    if (p.buffered) p.buffered = null;
    const lookahead = Math.max(30, p.speed * (this.opts.lookaheadSeconds ?? 2.6));
    const sEnd = Math.min(p.s + lookahead, sim.course.end - 0.5);
    const speedFn = sim.tutorial ? () => p.speed : (s: number) => speedAtDistance(s, sim.cfg);
    const result = validateCourse(
      {
        obstacles: sim.course.obstacles.filter((o) => !o.disabled && o.s1 > p.s - 2 && o.s0 < sEnd + 2),
        rails: sim.course.rails,
        sStart: p.s,
        sEnd,
      },
      { speed: speedFn, startStates: [p], recordPath: true, cfg: sim.cfg, preferLane: this.junctionLane() ?? this.opts.preferLane ?? 1 },
    );
    if (result.path && result.passableFrom[0]) {
      this.plan = result.path;
    } else {
      this.failedPlans++;
      this.plan = [];
    }
  }
}
