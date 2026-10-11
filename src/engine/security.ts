import { GAMEPLAY, SIM_DT, type GameplayConfig } from '../config/gameplay';

/**
 * Security pressure. Minor collisions add pressure; clean skating bleeds it
 * off after a short delay. Full pressure means the guard catches up.
 */
export class SecurityMeter {
  pressure = 0;
  ticksSinceHit = Number.POSITIVE_INFINITY;
  captured = false;
  enabled = true;

  constructor(private readonly cfg: GameplayConfig = GAMEPLAY) {}

  add(amount: number): void {
    if (!this.enabled || this.captured) return;
    this.pressure = Math.min(this.cfg.pressure.max, this.pressure + amount);
    this.ticksSinceHit = 0;
    if (this.pressure >= this.cfg.pressure.max) this.captured = true;
  }

  tick(): void {
    this.ticksSinceHit++;
    if (this.captured) return;
    if (this.ticksSinceHit > this.cfg.pressure.decayDelayTicks && this.pressure > 0) {
      this.pressure = Math.max(0, this.pressure - this.cfg.pressure.decayPerSecond * SIM_DT);
    }
  }

  get ratio(): number {
    return this.pressure / this.cfg.pressure.max;
  }

  /** Metres the guard trails behind the skater (for rendering). */
  guardGap(): number {
    const r = Math.min(1, this.ratio);
    return 15 - 13.6 * Math.pow(r, 0.85);
  }
}
