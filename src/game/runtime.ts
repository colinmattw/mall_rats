import { audio, haptic } from '../audio/audio';
import type { Appearance, CatalogItem, Loadout } from '../config/catalog';
import { ECONOMY } from '../config/economy';
import { ENVIRONMENTS, type EnvId } from '../config/environments';
import { SIM_DT } from '../config/gameplay';
import type { TutorialStep } from '../config/routes';
import { AutoPilot } from '../engine/autopilot';
import type { StyleAward } from '../engine/scoring';
import { RunSimulation, type RunSummary, type SimEvent } from '../engine/simulation';
import type { Settings } from '../economy/saveSchema';
import type { CompletedMission } from '../economy/saveSchema';
import type { GameStore, RunResult } from '../economy/store';
import { GameRenderer, type StudioFocus } from '../render/scene';
import { InputController } from './input';

export interface HudSnapshot {
  distance: number;
  style: number;
  runCash: number;
  wallet: number;
  combo: number;
  multiplier: number;
  comboTime: number;
  pressure: number;
  speed: number;
  env: EnvId;
  phase: 'running' | 'ending' | 'ended';
  grinding: boolean;
  airborne: boolean;
}

export type ToastKind = 'bag' | 'mission' | 'route' | 'info' | 'warn' | 'record';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

export interface RuntimeCallbacks {
  onHud(h: HudSnapshot): void;
  onToast(t: Toast): void;
  onStyle(a: StyleAward): void;
  onRunEnd(result: RunResult): void;
  onAutoPause(): void;
  onTutorial(step: TutorialStep, state: 'show' | 'done' | 'retry'): void;
  onBagCollected(item: CatalogItem, duplicate: boolean): void;
}

let toastIds = 1;

/**
 * Owns the frame loop. Simulation runs at a fixed 60 Hz (interpolated for
 * rendering); React only receives throttled, low-frequency callbacks.
 */
export class GameRuntime {
  readonly renderer: GameRenderer;
  readonly input: InputController;
  sim: RunSimulation | null = null;
  paused = false;
  autopilot: AutoPilot | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private runId = '';
  private ticksSinceCommit = 0;
  private cuedBags = new Set<number>();
  private settings: Settings;
  private destroyed = false;
  private endHandled = false;

  constructor(
    container: HTMLElement,
    private readonly store: GameStore,
    private readonly cb: RuntimeCallbacks,
  ) {
    this.settings = store.snapshot.settings;
    this.renderer = new GameRenderer(container, { quality: this.settings.graphics, reducedMotion: this.settings.reducedMotion });
    this.input = new InputController(container);
    this.input.onPause = () => {
      if (this.sim && this.sim.phase === 'running' && !this.paused) {
        this.pause();
        this.cb.onAutoPause();
      }
    };
    const s = store.snapshot;
    this.renderer.setStudioLoadout(s.equipped, s.appearance);
    this.renderer.setPlayerLoadout(s.equipped, s.appearance);
    this.applySettings(this.settings);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', this.onPageHide);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pagehide', this.onPageHide);
    this.input.destroy();
    this.renderer.dispose();
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.renderer.setQuality(s.graphics);
    this.renderer.setReducedMotion(s.reducedMotion);
    this.input.sensitivity = s.swipeSensitivity;
    audio.setSettings({ sound: s.sound, music: s.music, soundVolume: s.soundVolume, musicVolume: s.musicVolume });
  }

  // ---------------------------------------------------------------- presentation
  showStudio(focus: StudioFocus, framing: { top: number; bottom: number }, loadout?: Loadout, appearance?: Appearance): void {
    this.renderer.setMode('studio');
    this.renderer.setStudioFocus(focus);
    this.renderer.setStudioFraming(framing.top, framing.bottom);
    if (loadout && appearance) this.renderer.setStudioLoadout(loadout, appearance);
    audio.setMusicMode('menu');
  }

  setPreview(loadout: Loadout, appearance: Appearance): void {
    this.renderer.setStudioLoadout(loadout, appearance);
  }

  rotatePreview(dYaw: number): void {
    this.renderer.rotateStudio(dYaw);
  }

  // ---------------------------------------------------------------- runs
  startRun(opts: { tutorial: boolean; autopilot?: boolean }): void {
    audio.unlock();
    if (this.sim && this.sim.phase !== 'ended') this.quitRun();
    const s = this.store.snapshot;
    this.renderer.setPlayerLoadout(s.equipped, s.appearance);
    const { runId, seed } = this.store.beginRun({ tutorial: opts.tutorial });
    this.runId = runId;
    this.sim = new RunSimulation({
      seed,
      runId,
      tutorial: opts.tutorial,
      hooks: {
        isBagDue: () => this.store.isBagDue(),
        onDistance: (m) => this.store.addDropDistance(m),
        onBagPlaced: () => {},
      },
    });
    this.autopilot = opts.autopilot ? new AutoPilot(this.sim) : null;
    this.renderer.attachRun(this.sim);
    this.renderer.setMode('game');
    this.input.clear();
    this.input.enabled = true;
    this.paused = false;
    this.acc = 0;
    this.ticksSinceCommit = 0;
    this.cuedBags.clear();
    this.endHandled = false;
    audio.setMusicMode('run');
    audio.play('go');
  }

  pause(): void {
    if (!this.sim || this.paused) return;
    this.paused = true;
    this.input.enabled = false;
    this.input.clear();
    audio.setGrinding(false);
    this.commit();
    this.store.flush();
  }

  resume(): void {
    if (!this.sim) return;
    this.paused = false;
    this.input.enabled = this.sim.phase === 'running';
    this.last = performance.now();
    this.acc = 0;
    audio.resume();
  }

  quitRun(): void {
    if (!this.sim) return;
    this.sim.quit();
    this.processEvents(this.sim.drainEvents());
  }

  /** Leave the run entirely (after results). */
  endSession(): void {
    this.sim = null;
    this.autopilot = null;
    this.input.enabled = false;
    this.renderer.attachRun(null);
    audio.setGrinding(false);
  }

  /** Development helper: advance the simulation synchronously (autopilot or no input). */
  fastForward(seconds: number): void {
    const sim = this.sim;
    if (!sim) return;
    const ticks = Math.round(seconds / SIM_DT);
    for (let i = 0; i < ticks && sim.phase === 'running'; i++) {
      sim.step(this.autopilot ? this.autopilot.next() : null);
      this.ticksSinceCommit++;
      this.processEvents(sim.drainEvents());
      if (this.ticksSinceCommit >= ECONOMY.run.commitIntervalTicks) this.commit();
    }
  }

  setAutopilot(on: boolean, routePreference?: EnvId[]): void {
    this.autopilot = on && this.sim ? new AutoPilot(this.sim, { routePreference }) : null;
  }

  private commit(): void {
    if (!this.sim || this.sim.phase === 'ended') return;
    const res = this.store.commitRun(this.runId, this.sim.progress());
    this.handleMissions(res.completed);
    this.ticksSinceCommit = 0;
  }

  private handleMissions(done: CompletedMission[]): void {
    for (const m of done) {
      audio.play('mission');
      this.cb.onToast({ id: toastIds++, kind: 'mission', title: 'Mission complete!', body: `${m.title}  +${m.reward} Mall Cash` });
    }
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;
    this.time += dt;
    const sim = this.sim;
    if (sim && !this.paused && sim.phase !== 'ended') {
      this.acc += dt * sim.timeScale;
      let steps = 0;
      while (this.acc >= SIM_DT && steps < 8) {
        const intent = this.autopilot ? this.autopilot.next() : this.input.next();
        sim.step(intent);
        this.acc -= SIM_DT;
        steps++;
        this.ticksSinceCommit++;
        this.processEvents(sim.drainEvents());
        if (this.runEnded(sim)) break;
      }
      if (steps >= 8) this.acc = 0;
      if (this.ticksSinceCommit >= ECONOMY.run.commitIntervalTicks && sim.phase === 'running') this.commit();
      this.checkBagCue();
      audio.setIntensity(sim.player.speed / 23);
    }
    const alpha = sim ? Math.min(1, this.acc / SIM_DT) : 0;
    this.renderer.render(alpha, dt, this.time);
    if (sim) this.emitHud();
  };

  private runEnded(sim: RunSimulation): boolean {
    return sim.phase === 'ended';
  }

  private emitHud(): void {
    const sim = this.sim!;
    this.cb.onHud({
      distance: sim.distance,
      style: sim.scorer.score,
      runCash: sim.cash,
      wallet: this.store.cash,
      combo: sim.scorer.combo,
      multiplier: sim.scorer.multiplier,
      comboTime: sim.scorer.comboTimeLeft,
      pressure: sim.security.ratio,
      speed: sim.player.speed,
      env: sim.currentEnv,
      phase: sim.phase,
      grinding: sim.player.mode === 'grind',
      airborne: sim.player.mode === 'air',
    });
  }

  private checkBagCue(): void {
    const sim = this.sim!;
    for (const pk of sim.course.pickups) {
      if (pk.kind !== 'bag' || pk.collected || this.cuedBags.has(pk.id)) continue;
      if (pk.s - sim.player.s < 85) {
        this.cuedBags.add(pk.id);
        audio.play('bagCue');
        haptic([20, 40, 20], this.settings.haptics);
        this.cb.onToast({ id: toastIds++, kind: 'bag', title: 'Mystery bag ahead!', body: 'Grab it before it slips past.' });
      }
    }
  }

  private processEvents(events: SimEvent[]): void {
    if (!events.length) return;
    this.renderer.handleEvents(events);
    const hap = this.settings.haptics;
    for (const e of events) {
      switch (e.type) {
        case 'player': {
          const ev = e.ev;
          if (ev.type === 'jump') audio.play('jump');
          else if (ev.type === 'land') audio.play('land');
          else if (ev.type === 'trick') audio.play('trick');
          else if (ev.type === 'laneChange') audio.play('lane');
          else if (ev.type === 'duck') audio.play('duck');
          else if (ev.type === 'grindStart') {
            audio.play('grindStart');
            audio.setGrinding(true);
          } else if (ev.type === 'grindEnd') {
                    audio.setGrinding(false);
          } else if (ev.type === 'railBump' || ev.type === 'edgeBump') haptic(15, hap);
          break;
        }
        case 'coin':
          audio.play(e.pickup.kind === 'stack' ? 'stack' : 'coin');
          break;
        case 'style':
          this.cb.onStyle(e.award);
          if (e.award.bonus) audio.play('combo');
          break;
        case 'minorHit':
          audio.play('hit');
          haptic(40, hap);
          break;
        case 'smash':
          audio.play('smash');
          haptic(30, hap);
          break;
        case 'crash':
          audio.play('crash');
          haptic([60, 40, 90], hap);
          setTimeout(() => audio.play('whistle'), 500);
          break;
        case 'captured':
          audio.play('whistle');
          haptic([30, 30, 30], hap);
          break;
        case 'sketchy':
          this.cb.onToast({ id: toastIds++, kind: 'warn', title: 'Sketchy landing', body: 'Finish the trick before you land.' });
          break;
        case 'bagCollected': {
          audio.play('bagCollect');
          haptic([25, 30, 60], hap);
          const res = this.store.collectBag(this.runId, `${e.pickup.id}`);
          if (res.ok) {
            this.cb.onBagCollected(res.value.item, res.value.duplicate);
            this.cb.onToast({ id: toastIds++, kind: 'bag', title: 'Mystery bag secured!', body: 'Saved to your collection. Reveal it after the run.' });
          }
          break;
        }
        case 'bagMissed':
          this.store.recordBagMissed(this.runId, `${e.pickup.id}`);
          break;
        case 'junction':
          audio.play('door');
          if (e.env !== 'concourse') this.cb.onToast({ id: toastIds++, kind: 'route', title: ENVIRONMENTS[e.env].name, body: ENVIRONMENTS[e.env].tradeoff });
          break;
        case 'tutorial':
          this.cb.onTutorial(e.step, e.state);
          break;
        case 'runEnd':
          this.handleRunEnd(e.summary);
          break;
      }
    }
  }

  private handleRunEnd(summary: RunSummary): void {
    if (this.endHandled) return;
    this.endHandled = true;
    this.input.enabled = false;
    audio.setGrinding(false);
    this.cb.onRunEnd(this.store.finishRun(summary));
  }

  // ---------------------------------------------------------------- lifecycle
  private onResize = (): void => {
    this.renderer.resize();
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.sim && this.sim.phase === 'running' && !this.paused) {
        this.pause();
        this.cb.onAutoPause();
      }
      this.store.flush();
      audio.suspend();
    } else {
      audio.resume();
      this.last = performance.now();
    }
  };

  private onBlur = (): void => {
    if (this.sim && this.sim.phase === 'running' && !this.paused) {
      this.pause();
      this.cb.onAutoPause();
    }
  };

  private onPageHide = (): void => {
    if (this.sim && this.sim.phase !== 'ended') this.commit();
    this.store.flush();
  };
}
