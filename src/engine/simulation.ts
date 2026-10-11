import { GAMEPLAY, SIM_DT, speedAtDistance, type GameplayConfig } from '../config/gameplay';
import type { EnvId } from '../config/environments';
import { ECONOMY } from '../config/economy';
import { TUTORIAL_CHUNK, TUTORIAL_STEPS, type ChunkTemplate, type TutorialStep } from '../config/routes';
import { Course, lateralOverlap, overlapsObstacle, type ChunkInstance, type CourseObstacle, type CoursePickup, type PlayerBox } from './course';
import { RouteGenerator } from './generator';
import {
  bounceBack,
  createPlayer,
  createStepContext,
  isChangingLanes,
  playerBox,
  prevPlayerBox,
  stepPlayer,
  stumble,
  type Intent,
  type PlayerEvent,
  type PlayerState,
  type StepContext,
} from './player';
import { STYLE_POINTS, StyleScorer, type StyleAward } from './scoring';
import { SecurityMeter } from './security';
import { touchesPoint } from './validator';

export type EndReason = 'crash' | 'captured' | 'quit' | 'tutorialComplete';

export interface RunProgress {
  cash: number;
  distance: number;
  style: number;
  cleanJumps: number;
  tricks: number;
  grinds: number;
  grindDistance: number;
  nearMisses: number;
  smashes: number;
  minorHits: number;
  bagsCollected: number;
  bagsMissed: number;
  trickChains: number;
  maxNoHitSeconds: number;
  envsVisited: EnvId[];
}

export interface RunSummary extends RunProgress {
  runId: string;
  seed: string;
  tutorial: boolean;
  endReason: EndReason;
  durationSeconds: number;
  bestCombo: number;
}

export type SimEvent =
  | { type: 'player'; ev: PlayerEvent }
  | { type: 'coin'; pickup: CoursePickup; value: number }
  | { type: 'bagCollected'; pickup: CoursePickup }
  | { type: 'bagMissed'; pickup: CoursePickup }
  | { type: 'bagPlaced'; chunk: ChunkInstance }
  | { type: 'style'; award: StyleAward }
  | { type: 'comboEnd'; combo: number; broken: boolean }
  | { type: 'minorHit'; obstacle: CourseObstacle; side: boolean }
  | { type: 'smash'; obstacle: CourseObstacle }
  | { type: 'crash'; obstacle: CourseObstacle }
  | { type: 'captured' }
  | { type: 'sketchy' }
  | { type: 'junction'; env: EnvId; lane: number }
  | { type: 'envChange'; env: EnvId }
  | { type: 'tutorial'; step: TutorialStep; state: 'show' | 'done' | 'retry' }
  | { type: 'runEnd'; summary: RunSummary };

export interface RunHooks {
  isBagDue(): boolean;
  onBagPlaced(): void;
  onDistance(meters: number): void;
}

export interface RunOptions {
  seed: string;
  runId: string;
  tutorial?: boolean;
  cfg?: GameplayConfig;
  hooks?: Partial<RunHooks>;
  /** Fixed chunk list instead of procedural generation (tests / fixtures). */
  fixedCourse?: ChunkTemplate[];
  /** Constant forward speed override (tests / fixtures). */
  constantSpeed?: number;
}

/** Distance before a junction facade at which the door choice is locked in. */
export const JUNCTION_DECISION_LEAD = 2.5;
export const TUTORIAL_SPEED = 9;

/**
 * One endless run. Pure simulation: no rendering, no DOM, no timers.
 * Advance with step(); read state directly for rendering / HUD.
 */
export class RunSimulation {
  readonly cfg: GameplayConfig;
  readonly runId: string;
  readonly seed: string;
  readonly tutorial: boolean;
  tick = 0;
  phase: 'running' | 'ending' | 'ended' = 'running';
  endReason: EndReason | null = null;
  endTick = 0;
  crashObstacle: CourseObstacle | null = null;
  readonly player: PlayerState;
  readonly course: Course;
  readonly generator: RouteGenerator;
  readonly scorer: StyleScorer;
  readonly security: SecurityMeter;
  readonly ctx: StepContext;
  events: SimEvent[] = [];
  cash = 0;
  currentEnv: EnvId = 'concourse';
  timeScale = 1;
  tutorialIndex = 0;
  tutorialActive: TutorialStep | null = null;
  private tutorialHit = false;
  private pEvents: PlayerEvent[] = [];
  private box: PlayerBox = { x0: 0, x1: 0, s0: 0, s1: 0, y0: 0, y1: 0 };
  private prevBox: PlayerBox = { x0: 0, x1: 0, s0: 0, s1: 0, y0: 0, y1: 0 };
  private bumpObstacleId = -1;
  private bumpTicks = 0;
  private noHitTicks = 0;
  private hooks: RunHooks;
  private summaryCache: RunSummary | null = null;
  counters = {
    cleanJumps: 0,
    tricks: 0,
    grinds: 0,
    grindDistance: 0,
    nearMisses: 0,
    smashes: 0,
    minorHits: 0,
    bagsCollected: 0,
    bagsMissed: 0,
    maxNoHitTicks: 0,
    envsVisited: new Set<EnvId>(),
  };

  constructor(opts: RunOptions) {
    this.cfg = opts.cfg ?? GAMEPLAY;
    this.runId = opts.runId;
    this.seed = opts.seed;
    this.tutorial = !!opts.tutorial;
    this.hooks = {
      isBagDue: () => false,
      onBagPlaced: () => {},
      onDistance: () => {},
      ...opts.hooks,
    };
    this.course = new Course(this.cfg);
    this.generator = new RouteGenerator(this.seed, this.cfg, { tutorial: this.tutorial, fixed: opts.fixedCourse });
    this.generator.start(this.course);
    this.player = createPlayer(0, 1, this.cfg);
    const fixedSpeed = opts.constantSpeed ?? (this.tutorial ? TUTORIAL_SPEED : null);
    const speedFn = fixedSpeed !== null ? () => fixedSpeed : (s: number) => speedAtDistance(s, this.cfg);
    this.ctx = createStepContext(this.course.rails, speedFn, { buffering: true, cfg: this.cfg });
    this.player.speed = speedFn(0);
    this.scorer = new StyleScorer(this.cfg);
    this.security = new SecurityMeter(this.cfg);
    this.security.enabled = !this.tutorial;
    this.fillCourse();
  }

  get distance(): number {
    return Math.max(0, this.player.s);
  }

  get seconds(): number {
    return this.tick * SIM_DT;
  }

  /** Drain queued events (renderer / audio / UI consume them once per frame). */
  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  quit(): void {
    if (this.phase === 'ended') return;
    this.endReason = this.endReason ?? 'quit';
    this.phase = 'ended';
    this.events.push({ type: 'runEnd', summary: this.summary() });
  }

  step(intent: Intent | null = null): void {
    if (this.phase === 'ended') return;
    if (this.phase === 'ending') {
      this.endTick++;
      if (this.endTick >= this.cfg.endSequenceTicks) {
        this.phase = 'ended';
        this.events.push({ type: 'runEnd', summary: this.summary() });
      }
      return;
    }

    this.tick++;
    this.pEvents.length = 0;
    const prevS = this.player.s;
    // Rails list may have been rebuilt by generation / recycling.
    this.ctx.rails = this.course.rails;
    stepPlayer(this.player, this.ctx, intent, this.pEvents);
    const ds = this.player.s - prevS;
    if (!this.tutorial) this.hooks.onDistance(ds);

    this.handlePlayerEvents();
    if (this.phase === 'running') this.handleCollisions();
    if (this.phase === 'running') this.handlePasses();
    this.handlePickups();

    this.security.tick();
    if (this.bumpTicks > 0) this.bumpTicks--;
    if (this.security.captured && this.phase === 'running') this.beginEnd('captured');

    if (this.scorer.tick()) this.events.push({ type: 'comboEnd', combo: 0, broken: false });
    this.noHitTicks++;
    this.counters.maxNoHitTicks = Math.max(this.counters.maxNoHitTicks, this.noHitTicks);

    this.trackEnvironment();
    this.handleJunction();
    if (this.tick % 6 === 0) this.fillCourse();
    if (this.tick % 30 === 0) this.course.recycleBefore(this.player.s - this.cfg.recycleBehind);
    if (this.tutorial) this.updateTutorial();
  }

  private fillCourse(): void {
    if (this.tutorial) return;
    this.generator.fill(this.course, this.player.s + this.cfg.generationLookahead, {
      isBagDue: () => this.hooks.isBagDue(),
      onBagPlaced: (chunk) => {
        this.hooks.onBagPlaced();
        this.events.push({ type: 'bagPlaced', chunk });
      },
    });
    this.ctx.rails = this.course.rails;
  }

  private emitAwards(awards: StyleAward[]): void {
    for (const a of awards) this.events.push({ type: 'style', award: a });
  }

  private handlePlayerEvents(): void {
    for (const ev of this.pEvents) {
      this.events.push({ type: 'player', ev });
      switch (ev.type) {
        case 'trick':
          this.counters.tricks++;
          break;
        case 'trickDone':
          if (ev.clean) {
            this.emitAwards(this.scorer.award(ev.trick.id, ev.trick.name, ev.trick.points, { trick: true }));
          } else {
            const lost = this.scorer.breakCombo();
            this.events.push({ type: 'sketchy' });
            if (lost) this.events.push({ type: 'comboEnd', combo: lost, broken: true });
          }
          break;
        case 'land':
          if (ev.tricks > 0 && !ev.sketchy) {
            this.emitAwards(this.scorer.award('cleanLanding', 'Clean Landing', STYLE_POINTS.cleanLanding * Math.min(3, ev.tricks)));
          }
          break;
        case 'grindStart':
          this.counters.grinds++;
          if (ev.entry === 'transfer') this.emitAwards(this.scorer.award('railTransfer', 'Rail Transfer', STYLE_POINTS.railTransfer));
          break;
        case 'grindEnd': {
          this.counters.grindDistance += ev.distance;
          const m = Math.round(ev.distance);
          this.emitAwards(this.scorer.award('grind', `Grind ${m}m`, STYLE_POINTS.grindBase + STYLE_POINTS.grindPerMeter * ev.distance));
          break;
        }
        case 'railBump': {
          this.minorCollision(null, true);
          break;
        }
        default:
          break;
      }
    }
  }

  private minorCollision(o: CourseObstacle | null, side: boolean): void {
    if (this.tutorial) {
      this.tutorialHit = true;
      stumble(this.player, this.cfg);
      if (o) this.events.push({ type: 'minorHit', obstacle: o, side });
      return;
    }
    this.security.add(side ? this.cfg.pressure.sideBump : this.cfg.pressure.minorHit);
    stumble(this.player, this.cfg);
    this.counters.minorHits++;
    this.noHitTicks = 0;
    const lost = this.scorer.breakCombo();
    if (lost) this.events.push({ type: 'comboEnd', combo: lost, broken: true });
    if (o) this.events.push({ type: 'minorHit', obstacle: o, side });
  }

  private knock(o: CourseObstacle): void {
    o.disabled = true;
    o.hitTick = this.tick;
    const cx = (o.x0 + o.x1) / 2;
    o.hitDir = cx === this.player.x ? (this.tick % 2 ? 1 : -1) : Math.sign(cx - this.player.x);
  }

  private handleCollisions(): void {
    const p = this.player;
    const box = playerBox(p, this.cfg, this.box);
    const prev = prevPlayerBox(p, this.cfg, this.prevBox);
    const m = this.cfg.collisionMargin;
    for (const o of this.course.obstacles) {
      if (o.s0 > box.s1 + 1) break;
      if (o.disabled || o.s1 < box.s0 - 0.5) continue;
      if (this.bumpTicks > 0 && o.id === this.bumpObstacleId) continue;
      if (!overlapsObstacle(box, o, m)) continue;
      const sev = o.def.severity;
      if (sev === 'breakable') {
        this.knock(o);
        this.counters.smashes++;
        if (this.tutorial) this.tutorialHit = true;
        this.emitAwards(this.scorer.award('smash', `Smashed ${o.def.label}`, o.def.stylePoints ?? 100, { noCombo: true }));
        const lost = this.scorer.breakCombo();
        if (lost) this.events.push({ type: 'comboEnd', combo: lost, broken: true });
        if (!this.tutorial) this.security.add(this.cfg.pressure.breakable);
        stumble(p, this.cfg);
        this.noHitTicks = 0;
        this.events.push({ type: 'smash', obstacle: o });
        continue;
      }
      const side = !lateralOverlap(prev, o, m);
      if (sev === 'major' && !side) {
        if (this.tutorial) {
          this.tutorialRetry();
          return;
        }
        this.crashObstacle = o;
        this.events.push({ type: 'crash', obstacle: o });
        this.beginEnd('crash');
        return;
      }
      if (sev === 'minor') {
        this.knock(o);
        if (p.graceTick > 0) continue;
        this.minorCollision(o, side);
        continue;
      }
      // Side-swipe against a major obstacle: bounce back to the lane we came from.
      if (side && isChangingLanes(p)) bounceBack(p, this.cfg);
      this.bumpObstacleId = o.id;
      this.bumpTicks = 30;
      if (p.graceTick > 0) continue;
      this.minorCollision(o, true);
    }
  }

  private handlePasses(): void {
    const p = this.player;
    const box = playerBox(p, this.cfg, this.box);
    const m = this.cfg.collisionMargin;
    for (const o of this.course.obstacles) {
      if (o.s0 > box.s1 + 0.2) break;
      if (o.resolved || o.disabled) continue;
      if (o.s1 < box.s0 - 3) {
        o.resolved = true;
        continue;
      }
      const sOverlap = box.s1 > o.s0 && box.s0 < o.s1;
      if (sOverlap) {
        const lat = box.x1 > o.x0 + m && box.x0 < o.x1 - m;
        if (lat) {
          if (o.def.requirement === 'jump' && p.mode !== 'ground') {
            o.wasAirborneOver = true;
            o.minVertical = Math.min(o.minVertical, box.y0 - o.y1);
          } else if (o.def.requirement === 'duck' && p.duckTick > 0) {
            o.wasDuckedUnder = true;
          }
        } else {
          const gap = box.x0 >= o.x1 ? box.x0 - o.x1 : o.x0 - box.x1;
          o.minClearance = Math.min(o.minClearance, gap);
        }
      } else if (box.s0 >= o.s1) {
        o.resolved = true;
        if (o.wasAirborneOver) {
          this.counters.cleanJumps++;
          this.emitAwards(this.scorer.award('cleanJump', 'Clean Jump', STYLE_POINTS.cleanJump));
          if (o.minVertical < this.cfg.nearMiss.vertical) this.emitAwards(this.scorer.award('closeCall', 'Close Call', STYLE_POINTS.closeCall));
        } else if (o.wasDuckedUnder) {
          this.emitAwards(this.scorer.award('duckUnder', 'Limbo', STYLE_POINTS.duckUnder));
        } else if (o.def.severity !== 'breakable' && o.minClearance < this.cfg.nearMiss.lateral && o.minClearance > -m - 0.01) {
          this.counters.nearMisses++;
          this.emitAwards(this.scorer.award('nearMiss', 'Near Miss', STYLE_POINTS.nearMiss));
        }
      }
    }
  }

  private handlePickups(): void {
    const box = playerBox(this.player, this.cfg, this.box);
    for (const pk of this.course.pickups) {
      if (pk.s > box.s1 + 1.5) break;
      if (pk.collected) continue;
      if (pk.s < box.s0 - 2) {
        if (pk.kind === 'bag') {
          pk.collected = true;
          pk.collectedTick = -2;
          this.counters.bagsMissed++;
          this.generator.bagResolved();
          this.events.push({ type: 'bagMissed', pickup: pk });
        }
        continue;
      }
      const r = pk.kind === 'bag' ? this.cfg.pickupRadius.bag : this.cfg.pickupRadius.cash;
      if (!touchesPoint(box, pk.x, pk.s, pk.y, r)) continue;
      if (this.phase !== 'running') continue;
      pk.collected = true;
      pk.collectedTick = this.tick;
      if (pk.kind === 'bag') {
        this.counters.bagsCollected++;
        this.generator.bagResolved();
        this.events.push({ type: 'bagCollected', pickup: pk });
      } else {
        const value = ECONOMY.pickupValues[pk.kind];
        this.cash += value;
        this.events.push({ type: 'coin', pickup: pk, value });
      }
    }
  }

  private trackEnvironment(): void {
    const c = this.course.chunkAt(this.player.s);
    if (!c) return;
    if (c.env !== this.currentEnv) {
      this.currentEnv = c.env;
      this.events.push({ type: 'envChange', env: c.env });
    }
    if (c.kind === 'chunk' && !this.counters.envsVisited.has(c.env)) this.counters.envsVisited.add(c.env);
  }

  private handleJunction(): void {
    const j = this.generator.waitingJunction;
    if (!j?.junction || j.junction.decided) return;
    if (this.player.s < j.junction.facadeS - JUNCTION_DECISION_LEAD) return;
    const lane = this.player.targetLane;
    const env = this.generator.decideJunction(this.course, lane);
    this.events.push({ type: 'junction', env, lane });
    this.fillCourse();
  }

  private beginEnd(reason: EndReason): void {
    if (this.phase !== 'running') return;
    this.phase = 'ending';
    this.endReason = reason;
    this.endTick = 0;
    if (reason === 'captured') this.events.push({ type: 'captured' });
    const lost = this.scorer.breakCombo();
    if (lost) this.events.push({ type: 'comboEnd', combo: lost, broken: true });
  }

  // ------------------------------------------------------------- tutorial
  private tutorialRetry(): void {
    const step = this.tutorialActive ?? TUTORIAL_STEPS[this.tutorialIndex];
    const checkpoint = Math.max(0, (step?.at ?? this.player.s) - 10);
    const fresh = createPlayer(checkpoint, 1, this.cfg);
    Object.assign(this.player, fresh);
    for (const o of this.course.obstacles) {
      if (o.s0 >= checkpoint - 1 && o.s0 <= checkpoint + 60) {
        o.disabled = false;
        o.resolved = false;
        o.hitTick = -1;
        o.wasAirborneOver = false;
        o.wasDuckedUnder = false;
        o.minClearance = Infinity;
        o.minVertical = Infinity;
      }
    }
    this.tutorialActive = null;
    this.timeScale = 1;
    if (step) this.events.push({ type: 'tutorial', step, state: 'retry' });
  }

  private updateTutorial(): void {
    const p = this.player;
    const step = TUTORIAL_STEPS[this.tutorialIndex];
    if (!step) {
      if (p.s >= TUTORIAL_CHUNK.length - 14 && this.phase === 'running') {
        this.endReason = 'tutorialComplete';
        this.phase = 'ended';
        this.timeScale = 1;
        this.events.push({ type: 'runEnd', summary: this.summary() });
      }
      return;
    }
    if (!this.tutorialActive && p.s >= step.at) {
      this.tutorialActive = step;
      this.tutorialHit = false;
      this.timeScale = step.slowMotion ? 0.3 : 1;
      this.events.push({ type: 'tutorial', step, state: 'show' });
    }
    if (!this.tutorialActive) return;
    const done = this.pEvents.some((ev) => {
      switch (step.expect) {
        case 'lane':
          return ev.type === 'laneChange';
        case 'jump':
          return ev.type === 'jump' && ev.kind === 'jump';
        case 'duck':
          return ev.type === 'duck';
        case 'grind':
          return ev.type === 'grindStart';
        case 'trick':
          return ev.type === 'trick';
        default:
          return false;
      }
    });
    const clearedCleanly = p.s >= step.until && !step.mustPerform && !this.tutorialHit;
    if (done || clearedCleanly || (step.expect === 'none' && p.s >= step.until)) {
      this.events.push({ type: 'tutorial', step, state: 'done' });
      this.tutorialActive = null;
      this.tutorialIndex++;
      this.timeScale = 1;
      return;
    }
    if (p.s >= step.until) this.tutorialRetry();
  }

  // ------------------------------------------------------------- summary
  progress(): RunProgress {
    return {
      cash: this.cash,
      distance: Math.floor(this.distance),
      style: this.scorer.score,
      cleanJumps: this.counters.cleanJumps,
      tricks: this.counters.tricks,
      grinds: this.counters.grinds,
      grindDistance: Math.floor(this.counters.grindDistance),
      nearMisses: this.counters.nearMisses,
      smashes: this.counters.smashes,
      minorHits: this.counters.minorHits,
      bagsCollected: this.counters.bagsCollected,
      bagsMissed: this.counters.bagsMissed,
      trickChains: this.scorer.trickChains,
      maxNoHitSeconds: Math.floor(this.counters.maxNoHitTicks * SIM_DT),
      envsVisited: [...this.counters.envsVisited],
    };
  }

  summary(): RunSummary {
    if (this.summaryCache && this.phase === 'ended') return this.summaryCache;
    const s: RunSummary = {
      ...this.progress(),
      runId: this.runId,
      seed: this.seed,
      tutorial: this.tutorial,
      endReason: this.endReason ?? 'quit',
      durationSeconds: Math.round(this.seconds),
      bestCombo: this.scorer.bestCombo,
    };
    if (this.phase === 'ended') this.summaryCache = s;
    return s;
  }
}
