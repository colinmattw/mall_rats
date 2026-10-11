import { ECONOMY } from '../config/economy';
import { GAMEPLAY, LANE_COUNT, SIM_DT, difficultyAtDistance, settleTime, speedAtDistance, type GameplayConfig } from '../config/gameplay';
import type { EnvId } from '../config/environments';
import {
  JUNCTION_CHUNK,
  JUNCTION_OPTIONS,
  ROUTE_CHUNKS,
  ROUTE_RULES,
  START_CHUNK,
  TUTORIAL_CHUNK,
  bagRunwayChunk,
  exitChunk,
  fillerChunk,
  lobbyChunk,
  type ChunkTemplate,
} from '../config/routes';
import { templateTailClear, type ChunkInstance, type Course } from './course';
import { Rng } from './rng';
import { activeLayer } from './validator';

export interface GeneratorHooks {
  /** True when the drop director wants a bag opportunity placed. */
  isBagDue(): boolean;
  onBagPlaced(chunk: ChunkInstance): void;
}

export interface RouteLogEntry {
  s0: number;
  s1: number;
  env: EnvId;
  templateId: string;
  kind: string;
  mirrored: boolean;
  difficulty: number;
  speed: number;
  gapBefore: number;
}

/**
 * Seeded route generator. Chunks are authored templates (proven fair by the
 * route validator tests); the generator stitches them together while keeping
 * every transition fair for the current speed:
 *
 *   tail clearance of the previous chunk + filler >= speed * settleTime
 *
 * where settleTime covers the longest committed air time / duck, so the skater
 * can always be grounded in their lane of choice when the next chunk begins.
 */
export class RouteGenerator {
  readonly rng: Rng;
  readonly log: RouteLogEntry[] = [];
  private recent: string[] = [];
  private mode: 'main' | 'branch' = 'main';
  private branchEnv: EnvId = 'concourse';
  private branchRemaining = 0;
  private sinceJunction = 0;
  private nextJunctionIn: number;
  private tailClear = Number.POSITIVE_INFINITY;
  private bagPending = false;
  waitingJunction: ChunkInstance | null = null;
  readonly tutorial: boolean;
  /** Fixed list of chunks (tests / fixtures): no procedural generation. */
  private readonly fixed: ChunkTemplate[] | null;

  constructor(
    seed: string,
    private readonly cfg: GameplayConfig = GAMEPLAY,
    opts: { tutorial?: boolean; fixed?: ChunkTemplate[] } = {},
  ) {
    this.rng = new Rng(`route:${seed}`);
    this.tutorial = !!opts.tutorial;
    this.fixed = opts.fixed ?? null;
    this.nextJunctionIn = this.rollJunctionSpacing();
  }

  private rollJunctionSpacing(): number {
    const [lo, hi] = ROUTE_RULES.junctionSpacing;
    return this.rng.range(lo, hi);
  }

  get currentEnv(): EnvId {
    return this.mode === 'branch' ? this.branchEnv : 'concourse';
  }

  start(course: Course): void {
    course.reset(0);
    if (this.tutorial) {
      this.add(course, TUTORIAL_CHUNK, { mirror: false, difficulty: 0 });
      return;
    }
    if (this.fixed) {
      for (const t of this.fixed) this.add(course, t, { mirror: false, difficulty: 1, bagSlot: t.bagSlots.length ? 0 : null });
      return;
    }
    this.add(course, START_CHUNK, { mirror: false, difficulty: 0 });
  }

  /** Generate until the course reaches `upTo` (or a junction awaits a decision). */
  fill(course: Course, upTo: number, hooks: GeneratorHooks): void {
    if (this.tutorial || this.fixed) return;
    let guard = 0;
    while (course.end < upTo && !this.waitingJunction && guard++ < 32) {
      this.appendNext(course, hooks);
    }
  }

  /** Called when a bag opportunity has been presented (collected or missed). */
  bagResolved(): void {
    this.bagPending = false;
  }

  /** Reset pending state at run end so an unreached bag carries over. */
  get hasPendingBag(): boolean {
    return this.bagPending;
  }

  /**
   * The skater committed to a door at a junction facade. Returns the chosen
   * environment and appends the entrance lobby for it.
   */
  decideJunction(course: Course, lane: number): EnvId {
    const chunk = this.waitingJunction;
    if (!chunk?.junction) return this.currentEnv;
    const clamped = Math.max(0, Math.min(LANE_COUNT - 1, lane));
    const env = chunk.junction.options[clamped];
    chunk.junction.decided = env;
    chunk.junction.decidedLane = clamped;
    this.waitingJunction = null;
    this.sinceJunction = 0;
    this.nextJunctionIn = this.rollJunctionSpacing();
    if (env !== 'concourse') {
      this.mode = 'branch';
      this.branchEnv = env;
      const [lo, hi] = ROUTE_RULES.branchChunks;
      this.branchRemaining = this.rng.int(lo, hi);
    } else {
      this.mode = 'main';
    }
    const speed = speedAtDistance(course.end, this.cfg);
    const laneChange = this.cfg.laneChangeTicks * SIM_DT;
    const lobbyLength = Math.ceil(Math.max(26, speed * (settleTime(this.cfg) + 2 * laneChange) + 8));
    this.add(course, lobbyChunk(env, lobbyLength), { mirror: false, difficulty: 0 });
    return env;
  }

  private pickTemplate(env: EnvId, difficulty: number): ChunkTemplate {
    const pool = ROUTE_CHUNKS.filter((t) => t.env === env && t.minDifficulty <= difficulty + 1e-9);
    const candidates = pool.length ? pool : ROUTE_CHUNKS.filter((t) => t.env === env);
    const window = Math.min(ROUTE_RULES.noRepeatWindow, Math.max(0, candidates.length - 1));
    const recent = new Set(this.recent.slice(-window));
    const fresh = candidates.filter((t) => !recent.has(t.id));
    const list = fresh.length ? fresh : candidates;
    // Favour templates designed for the current difficulty without excluding easier ones.
    return (
      this.rng.weighted(list, (t) => t.weight * (1 + 1.5 * Math.max(0, 1 - Math.abs(difficulty - t.minDifficulty - 0.25) * 2))) ??
      list[0]!
    );
  }

  private appendNext(course: Course, hooks: GeneratorHooks): void {
    const s = course.end;
    const difficulty = difficultyAtDistance(s, this.cfg);
    const envNow = this.currentEnv;
    let template: ChunkTemplate;
    let exitTo: EnvId | null = null;
    let junctionOptions: [EnvId, EnvId, EnvId] | undefined;

    if (this.mode === 'branch') {
      if (this.branchRemaining > 0) {
        template = this.pickTemplate(this.branchEnv, difficulty);
        this.branchRemaining--;
      } else {
        template = exitChunk(this.branchEnv);
        exitTo = 'concourse';
        this.mode = 'main';
      }
    } else if (this.sinceJunction >= this.nextJunctionIn) {
      template = JUNCTION_CHUNK;
      junctionOptions = this.rng.pick(JUNCTION_OPTIONS);
    } else {
      template = this.pickTemplate('concourse', difficulty);
    }

    // Fair transition: make sure the skater can settle before the next chunk.
    const speed = speedAtDistance(s, this.cfg);
    const required = speed * settleTime(this.cfg) + 0.5;
    let gapBefore = Number.isFinite(this.tailClear) ? this.tailClear : required;
    if (gapBefore < required) {
      const len = Math.ceil(required - gapBefore);
      const coinLane = this.rng.chance(0.6) ? this.rng.int(0, LANE_COUNT - 1) : null;
      this.add(course, fillerChunk(envNow, len, coinLane), { mirror: false, difficulty: 0 }, len);
      gapBefore += len;
    }

    // Rare bag: place it in this chunk if it has a slot, otherwise on a clear runway.
    let bagSlot: number | null = null;
    if (!this.bagPending && hooks.isBagDue()) {
      if (template.kind === 'chunk' && template.bagSlots.length > 0) {
        bagSlot = this.rng.int(0, template.bagSlots.length - 1);
      } else if (template.kind !== 'junction') {
        const runwayLen = Math.ceil(Math.max(30, speed * (2 * this.cfg.laneChangeTicks * SIM_DT + 0.8) + 10));
        const chunk = this.add(course, bagRunwayChunk(envNow, runwayLen, this.rng.int(0, LANE_COUNT - 1)), { mirror: false, difficulty: 0, bagSlot: 0 }, runwayLen);
        this.bagPending = true;
        hooks.onBagPlaced(chunk);
      }
    }

    const mirror = template.mirror && this.rng.chance(0.5);
    const layer = template.kind === 'chunk' || template.kind === 'junction' ? activeLayer(template, difficulty) : 0;
    const chunk = this.add(course, template, { mirror, difficulty: layer, bagSlot, junctionOptions, exitTo }, undefined, gapBefore);
    if (bagSlot !== null) {
      this.bagPending = true;
      hooks.onBagPlaced(chunk);
    }
    if (template.kind === 'junction') this.waitingJunction = chunk;
    if (this.mode === 'main' && template.kind !== 'junction') this.sinceJunction += template.length;
    if (template.kind === 'chunk') {
      this.recent.push(template.id);
      if (this.recent.length > 8) this.recent.shift();
    }
  }

  private add(
    course: Course,
    template: ChunkTemplate,
    opts: { mirror: boolean; difficulty: number; bagSlot?: number | null; junctionOptions?: [EnvId, EnvId, EnvId]; exitTo?: EnvId | null },
    clearLength?: number,
    gapBefore = 0,
  ): ChunkInstance {
    const coinScale = this.tutorial || this.fixed ? 1 : ECONOMY.coinDensity[template.env];
    const chunk = course.addChunk(template, { ...opts, decorSeed: this.rng.nextU32(), coinScale });
    const tail = templateTailClear(template, opts.difficulty);
    this.tailClear = clearLength !== undefined ? this.tailClear + clearLength : tail;
    if (template.kind === 'start' || template.kind === 'lobby' || template.kind === 'exit') this.tailClear = template.length;
    if (!Number.isFinite(this.tailClear)) this.tailClear = tail;
    this.log.push({
      s0: chunk.s0,
      s1: chunk.s1,
      env: chunk.env,
      templateId: template.id,
      kind: template.kind,
      mirrored: opts.mirror,
      difficulty: opts.difficulty,
      speed: speedAtDistance(chunk.s0, this.cfg),
      gapBefore,
    });
    if (this.log.length > 400) this.log.shift();
    return chunk;
  }
}
