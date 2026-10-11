import { GAMEPLAY, type GameplayConfig } from '../config/gameplay';

/**
 * Style score (separate from currency). Consecutive successful actions build a
 * combo multiplier; repeating the same action gives diminishing credit;
 * collisions break the combo.
 */
export interface StyleAward {
  id: string;
  label: string;
  base: number;
  points: number;
  multiplier: number;
  repeatFactor: number;
  combo: number;
  bonus?: boolean;
}

export const STYLE_POINTS = {
  cleanJump: 50,
  duckUnder: 40,
  nearMiss: 75,
  closeCall: 60,
  cleanLanding: 50,
  grindBase: 60,
  grindPerMeter: 8,
  railTransfer: 90,
  variety: 60,
  trickChain: 150,
};

export class StyleScorer {
  score = 0;
  combo = 0;
  bestCombo = 0;
  multiplier = 1;
  private idleTicks = 0;
  private history: string[] = [];
  private comboTrickIds = new Set<string>();
  private chainAwarded = false;
  /** Times a combo contained three different tricks (mission tracking). */
  trickChains = 0;

  constructor(private readonly cfg: GameplayConfig = GAMEPLAY) {}

  private multiplierFor(combo: number): number {
    const c = this.cfg.combo;
    return Math.min(c.maxMultiplier, 1 + c.perAction * Math.max(0, combo - 1));
  }

  /** Award an action. Returns the award and any bonus awards it unlocked. */
  award(id: string, label: string, base: number, opts: { trick?: boolean; noCombo?: boolean } = {}): StyleAward[] {
    const out: StyleAward[] = [];
    const repeats = this.history.reduce((n, h) => (h === id ? n + 1 : n), 0);
    const repeatFactor = Math.pow(this.cfg.combo.repeatDecay, repeats);
    if (!opts.noCombo) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    }
    this.multiplier = opts.noCombo ? 1 : this.multiplierFor(this.combo);
    const points = Math.max(1, Math.round(base * repeatFactor * this.multiplier));
    this.score += points;
    out.push({ id, label, base, points, multiplier: this.multiplier, repeatFactor, combo: this.combo });
    this.history.push(id);
    if (this.history.length > this.cfg.combo.historySize) this.history.shift();
    this.idleTicks = 0;

    if (!opts.noCombo) {
      const n = this.history.length;
      if (n >= 3) {
        const [a, b, c] = this.history.slice(-3);
        if (a !== b && b !== c && a !== c && this.combo >= 3) {
          const bonus = Math.round(STYLE_POINTS.variety * this.multiplier);
          this.score += bonus;
          out.push({ id: 'variety', label: 'Variety', base: STYLE_POINTS.variety, points: bonus, multiplier: this.multiplier, repeatFactor: 1, combo: this.combo, bonus: true });
        }
      }
      if (opts.trick) {
        this.comboTrickIds.add(id);
        if (this.comboTrickIds.size >= 3 && !this.chainAwarded) {
          this.chainAwarded = true;
          this.trickChains++;
          const bonus = Math.round(STYLE_POINTS.trickChain * this.multiplier);
          this.score += bonus;
          out.push({ id: 'trickChain', label: 'Trick Chain x3', base: STYLE_POINTS.trickChain, points: bonus, multiplier: this.multiplier, repeatFactor: 1, combo: this.combo, bonus: true });
        }
      }
    }
    return out;
  }

  /** Called once per simulation tick. Combos lapse after a quiet period. */
  tick(): boolean {
    if (this.combo === 0) return false;
    this.idleTicks++;
    if (this.idleTicks > this.cfg.combo.timeoutTicks) {
      this.resetCombo();
      return true;
    }
    return false;
  }

  /** Collisions (and sketchy landings) break the combo. Returns the combo lost. */
  breakCombo(): number {
    const lost = this.combo;
    this.resetCombo();
    return lost;
  }

  private resetCombo(): void {
    this.combo = 0;
    this.multiplier = 1;
    this.idleTicks = 0;
    this.comboTrickIds.clear();
    this.chainAwarded = false;
  }

  /** 0..1 progress of the combo timeout (for the HUD bar). */
  get comboTimeLeft(): number {
    if (this.combo === 0) return 0;
    return 1 - this.idleTicks / this.cfg.combo.timeoutTicks;
  }
}
