import type { EnvId } from './environments';
import type { ObstacleTypeId } from './obstacles';

/**
 * Authored route chunks. Positions are metres from the chunk start, lanes are
 * 0 (left) .. 2 (right). Elements tagged with `d` only appear once the run's
 * difficulty reaches that value, so a single chunk ramps up over a run.
 *
 * Every chunk (every difficulty layer, mirrored and not, across the whole
 * speed range) is proven passable from every entry lane by the route
 * validator in `src/engine/routes.test.ts`, and bag slots are proven reachable.
 */
export interface ObstacleSpec {
  t: ObstacleTypeId;
  l: number | number[];
  s: number;
  len?: number;
  d?: number;
}

export interface RailSpec {
  l: number;
  /** Start of the kicker ramp. The grindable rail begins after the kicker. */
  s: number;
  /** Total length including the kicker. */
  len: number;
  d?: number;
}

export interface CoinSpec {
  l: number;
  s: number;
  n: number;
  gap?: number;
  /** Peak height of a jump arc (coins follow a parabola). */
  arc?: number;
  /** Coins float along a rail at grind height. */
  rail?: boolean;
  /** High-value cash stack instead of single tokens. */
  stack?: boolean;
  d?: number;
}

export interface BagSlotSpec {
  l: number;
  s: number;
  rail?: boolean;
}

export type ChunkKind = 'chunk' | 'junction' | 'lobby' | 'exit' | 'filler' | 'start' | 'tutorial';

export interface ChunkTemplate {
  id: string;
  name: string;
  env: EnvId;
  kind: ChunkKind;
  length: number;
  weight: number;
  minDifficulty: number;
  mirror: boolean;
  obstacles: ObstacleSpec[];
  rails: RailSpec[];
  coins: CoinSpec[];
  bagSlots: BagSlotSpec[];
  /** Decorative set pieces the renderer adds (escalators, skylights...). */
  features?: string[];
}

const chunk = (t: Omit<ChunkTemplate, 'kind' | 'rails' | 'bagSlots' | 'mirror' | 'weight' | 'minDifficulty'> &
  Partial<Pick<ChunkTemplate, 'rails' | 'bagSlots' | 'mirror' | 'weight' | 'minDifficulty' | 'kind'>>): ChunkTemplate => ({
  kind: 'chunk',
  rails: [],
  bagSlots: [],
  mirror: true,
  weight: 1,
  minDifficulty: 0,
  ...t,
});

export const ROUTE_CHUNKS: ChunkTemplate[] = [
  // ---------------------------------------------------------------- Concourse
  chunk({
    id: 'concourse-window-shopping',
    name: 'Window Shopping',
    env: 'concourse',
    length: 64,
    weight: 1.3,
    obstacles: [
      { t: 'wetFloor', l: 1, s: 14 },
      { t: 'kiosk', l: 2, s: 22, len: 7 },
      { t: 'ropeLine', l: 0, s: 32, d: 0.2 },
      { t: 'bench', l: 1, s: 44, d: 0.35 },
      { t: 'trashCan', l: 2, s: 44, d: 0.6 },
    ],
    coins: [
      { l: 0, s: 6, n: 5 },
      { l: 1, s: 20, n: 5 },
      { l: 2, s: 33, n: 5 },
      { l: 1, s: 41.6, n: 5, gap: 1.4, arc: 1.15, d: 0.35 },
      { l: 0, s: 50, n: 4 },
    ],
    bagSlots: [{ l: 0, s: 54 }, { l: 1, s: 56 }],
  }),
  chunk({
    id: 'concourse-kiosk-slalom',
    name: 'Kiosk Slalom',
    env: 'concourse',
    length: 78,
    minDifficulty: 0.08,
    obstacles: [
      { t: 'kiosk', l: 0, s: 8, len: 8 },
      { t: 'kiosk', l: 2, s: 22, len: 8 },
      { t: 'kiosk', l: 1, s: 36, len: 8, d: 0.3 },
      { t: 'kiosk', l: 0, s: 50, len: 7, d: 0.5 },
      { t: 'wetFloor', l: 2, s: 52, d: 0.7 },
      { t: 'bannerLow', l: 1, s: 64, d: 0.7 },
    ],
    coins: [
      { l: 1, s: 6, n: 6 },
      { l: 0, s: 20, n: 5 },
      { l: 2, s: 34, n: 5 },
      { l: 1, s: 50, n: 4 },
      { l: 2, s: 62, n: 5 },
    ],
    bagSlots: [{ l: 2, s: 40 }, { l: 1, s: 72 }],
  }),
  chunk({
    id: 'concourse-banner-sale',
    name: 'Banner Sale',
    env: 'concourse',
    length: 68,
    minDifficulty: 0.15,
    obstacles: [
      { t: 'bannerLow', l: [0, 1], s: 12 },
      { t: 'wetFloor', l: 2, s: 12 },
      { t: 'kiosk', l: 0, s: 26, len: 8 },
      { t: 'shutterHalf', l: 1, s: 30, d: 0.3 },
      { t: 'ropeLine', l: 2, s: 30, d: 0.5 },
      { t: 'bannerLow', l: 2, s: 46 },
      { t: 'bench', l: 0, s: 46, d: 0.6 },
    ],
    coins: [
      { l: 1, s: 4, n: 4 },
      { l: 1, s: 15, n: 5 },
      { l: 2, s: 19, n: 4 },
      { l: 1, s: 36, n: 4 },
      { l: 1, s: 50, n: 6 },
    ],
    bagSlots: [{ l: 1, s: 58 }],
  }),
  chunk({
    id: 'concourse-planter-rails',
    name: 'Planter Rails',
    env: 'concourse',
    length: 76,
    minDifficulty: 0.2,
    obstacles: [
      { t: 'planter', l: 0, s: 10 },
      { t: 'planter', l: 2, s: 20 },
      { t: 'bench', l: 0, s: 30, d: 0.35 },
      { t: 'wetFloor', l: 2, s: 38 },
      { t: 'kiosk', l: 1, s: 49, len: 8, d: 0.5 },
    ],
    rails: [{ l: 1, s: 12, len: 22 }],
    coins: [
      { l: 1, s: 4, n: 3 },
      { l: 1, s: 16, n: 7, rail: true },
      { l: 0, s: 15, n: 4 },
      { l: 2, s: 42, n: 5 },
      { l: 0, s: 50, n: 5 },
    ],
    bagSlots: [{ l: 1, s: 25, rail: true }],
    features: ['planters'],
  }),
  chunk({
    id: 'concourse-security-checkpoint',
    name: 'Security Checkpoint',
    env: 'concourse',
    length: 72,
    minDifficulty: 0.25,
    obstacles: [
      { t: 'kiosk', l: 2, s: 8, len: 10 },
      { t: 'shutterHalf', l: [0, 1], s: 16 },
      { t: 'planter', l: 0, s: 32 },
      { t: 'ropeLine', l: [1, 2], s: 34 },
      { t: 'bannerLow', l: 0, s: 50, d: 0.5 },
      { t: 'bench', l: 1, s: 50, d: 0.5 },
      { t: 'cleaningCart', l: 2, s: 56, d: 0.7 },
    ],
    coins: [
      { l: 1, s: 4, n: 4 },
      { l: 0, s: 20, n: 4 },
      { l: 2, s: 22, n: 4 },
      { l: 1, s: 31.4, n: 5, gap: 1.4, arc: 1.15 },
      { l: 1, s: 40, n: 4 },
    ],
    bagSlots: [{ l: 2, s: 44 }],
  }),
  chunk({
    id: 'concourse-escalator-run',
    name: 'Escalator Run',
    env: 'concourse',
    length: 80,
    minDifficulty: 0.3,
    obstacles: [
      { t: 'cleaningCart', l: 1, s: 18 },
      { t: 'wetFloor', l: 1, s: 40 },
      { t: 'kiosk', l: 0, s: 47, len: 8, d: 0.45 },
      { t: 'kiosk', l: 2, s: 47, len: 8, d: 0.45 },
      { t: 'bannerLow', l: 1, s: 51, d: 0.65 },
    ],
    rails: [
      { l: 0, s: 8, len: 26 },
      { l: 2, s: 8, len: 26 },
    ],
    coins: [
      { l: 0, s: 13, n: 7, rail: true },
      { l: 2, s: 13, n: 7, rail: true },
      { l: 1, s: 24, n: 5 },
      { l: 1, s: 58, n: 5 },
    ],
    bagSlots: [{ l: 1, s: 64 }],
    features: ['escalators'],
  }),

  // ---------------------------------------------------------------- Food court
  chunk({
    id: 'foodcourt-lunch-rush',
    name: 'Lunch Rush',
    env: 'foodcourt',
    length: 72,
    obstacles: [
      { t: 'foodTable', l: 0, s: 12 },
      { t: 'foodTable', l: 2, s: 12 },
      { t: 'foodTable', l: 1, s: 24 },
      { t: 'foodCounter', l: 2, s: 30, len: 10 },
      { t: 'foodTable', l: 0, s: 36, d: 0.3 },
      { t: 'trashCan', l: 1, s: 46, d: 0.5 },
      { t: 'foodTable', l: 0, s: 56, d: 0.6 },
      { t: 'foodTable', l: 1, s: 56, d: 0.6 },
    ],
    coins: [
      { l: 1, s: 3, n: 7, gap: 2 },
      { l: 0, s: 9.8, n: 5, gap: 1.4, arc: 1.15 },
      { l: 2, s: 9.8, n: 5, gap: 1.4, arc: 1.15 },
      { l: 0, s: 18, n: 6, gap: 2 },
      { l: 1, s: 30, n: 5, gap: 2 },
      { l: 1, s: 36, n: 1, stack: true },
      { l: 0, s: 42, n: 5, gap: 2 },
      { l: 2, s: 44, n: 7, gap: 2 },
      { l: 2, s: 60, n: 5, gap: 2 },
    ],
    bagSlots: [{ l: 2, s: 64 }],
    features: ['foodstalls'],
  }),
  chunk({
    id: 'foodcourt-tray-return',
    name: 'Tray Return',
    env: 'foodcourt',
    length: 70,
    minDifficulty: 0.1,
    obstacles: [
      { t: 'foodCounter', l: 0, s: 8, len: 14 },
      { t: 'mopBucket', l: 1, s: 16 },
      { t: 'trashCan', l: 2, s: 26 },
      { t: 'foodCounter', l: 2, s: 36, len: 12 },
      { t: 'bannerLow', l: 1, s: 43, d: 0.4 },
      { t: 'foodTable', l: 0, s: 52, d: 0.6 },
    ],
    coins: [
      { l: 1, s: 4, n: 5, gap: 2 },
      { l: 2, s: 8, n: 7, gap: 2 },
      { l: 1, s: 14, n: 5, gap: 1.2, arc: 1.0 },
      { l: 0, s: 26, n: 7, gap: 2 },
      { l: 1, s: 30, n: 1, stack: true },
      { l: 1, s: 48, n: 5, gap: 2 },
      { l: 2, s: 52, n: 6, gap: 2 },
    ],
    bagSlots: [{ l: 1, s: 60 }],
    features: ['foodstalls'],
  }),

  // ---------------------------------------------------------- Department store
  chunk({
    id: 'deptstore-rack-maze',
    name: 'Rack Maze',
    env: 'deptstore',
    length: 66,
    obstacles: [
      { t: 'displayRack', l: 0, s: 10 },
      { t: 'displayRack', l: 1, s: 10 },
      { t: 'mannequin', l: 2, s: 22 },
      { t: 'mannequin', l: 1, s: 22 },
      { t: 'perfumeCounter', l: 2, s: 32, len: 4 },
      { t: 'displayRack', l: 0, s: 34, d: 0.3 },
      { t: 'bannerLow', l: 1, s: 46 },
      { t: 'mannequin', l: 0, s: 48, d: 0.5 },
    ],
    coins: [
      { l: 2, s: 5, n: 6, gap: 1.6 },
      { l: 0, s: 16, n: 6, gap: 1.6 },
      { l: 1, s: 28, n: 8, gap: 1.4 },
      { l: 1, s: 38, n: 1, stack: true },
      { l: 2, s: 44, n: 6, gap: 1.6 },
    ],
    bagSlots: [{ l: 1, s: 57 }],
    features: ['racks'],
  }),
  chunk({
    id: 'deptstore-mannequin-alley',
    name: 'Mannequin Alley',
    env: 'deptstore',
    length: 70,
    minDifficulty: 0.15,
    obstacles: [
      { t: 'mannequin', l: 1, s: 10 },
      { t: 'perfumeCounter', l: 0, s: 14 },
      { t: 'displayRack', l: 2, s: 20 },
      { t: 'standee', l: 1, s: 28 },
      { t: 'perfumeCounter', l: 2, s: 34 },
      { t: 'bannerLow', l: [0, 1], s: 41 },
      { t: 'displayRack', l: 0, s: 51, d: 0.4 },
      { t: 'mannequin', l: 2, s: 51, d: 0.4 },
    ],
    coins: [
      { l: 1, s: 3, n: 4, gap: 1.6 },
      { l: 2, s: 9, n: 6, gap: 1.6 },
      { l: 0, s: 22, n: 7, gap: 1.4 },
      { l: 1, s: 34, n: 6, gap: 1.4 },
      { l: 1, s: 48, n: 1, stack: true },
      { l: 1, s: 52, n: 5, gap: 1.6 },
    ],
    bagSlots: [{ l: 2, s: 62 }],
    features: ['racks'],
  }),

  // --------------------------------------------------------- Maintenance
  chunk({
    id: 'maintenance-pipe-run',
    name: 'Pipe Run',
    env: 'maintenance',
    length: 64,
    obstacles: [
      { t: 'pipeLow', l: [0, 1, 2], s: 16 },
      { t: 'mopBucket', l: 1, s: 30 },
      { t: 'crateStack', l: 0, s: 36 },
      { t: 'pipeLow', l: [1, 2], s: 47, d: 0.4 },
    ],
    coins: [
      { l: 1, s: 6, n: 4 },
      { l: 2, s: 26, n: 3 },
      { l: 0, s: 50, n: 3 },
    ],
    bagSlots: [{ l: 2, s: 56 }],
    features: ['pipes'],
  }),
  chunk({
    id: 'maintenance-crate-corridor',
    name: 'Crate Corridor',
    env: 'maintenance',
    length: 62,
    minDifficulty: 0.1,
    obstacles: [
      { t: 'crateStack', l: 1, s: 12 },
      { t: 'crateStack', l: 0, s: 26 },
      { t: 'crateStack', l: 2, s: 26 },
      { t: 'boxStack', l: 1, s: 40 },
      { t: 'mopBucket', l: 0, s: 48, d: 0.4 },
    ],
    coins: [
      { l: 0, s: 8, n: 4 },
      { l: 1, s: 30, n: 3 },
      { l: 2, s: 44, n: 3 },
    ],
    bagSlots: [{ l: 0, s: 55 }],
    features: ['pipes'],
  }),

  // --------------------------------------------------------- Atrium
  chunk({
    id: 'atrium-triple-rails',
    name: 'Triple Rails',
    env: 'atrium',
    length: 82,
    obstacles: [
      { t: 'bench', l: 0, s: 42, d: 0.3 },
      { t: 'wetFloor', l: 2, s: 42 },
      { t: 'pillar', l: 1, s: 50, d: 0.5 },
    ],
    rails: [
      { l: 0, s: 8, len: 22 },
      { l: 1, s: 14, len: 24 },
      { l: 2, s: 8, len: 22 },
    ],
    coins: [
      { l: 0, s: 13, n: 6, rail: true },
      { l: 1, s: 19, n: 7, rail: true },
      { l: 2, s: 13, n: 6, rail: true },
      { l: 1, s: 58, n: 5 },
    ],
    bagSlots: [{ l: 1, s: 27, rail: true }],
    features: ['skylight', 'balconies'],
  }),
  chunk({
    id: 'atrium-fountain-gap',
    name: 'Fountain Gap',
    env: 'atrium',
    length: 80,
    minDifficulty: 0.25,
    obstacles: [
      { t: 'fountain', l: 1, s: 12, len: 10 },
      { t: 'planter', l: 0, s: 44, d: 0.4 },
      { t: 'planter', l: 2, s: 44, d: 0.6 },
      { t: 'bench', l: 1, s: 54, d: 0.5 },
    ],
    rails: [
      { l: 0, s: 6, len: 28 },
      { l: 2, s: 6, len: 28 },
    ],
    coins: [
      { l: 0, s: 11, n: 8, rail: true },
      { l: 2, s: 11, n: 8, rail: true },
      { l: 1, s: 30, n: 5 },
      { l: 1, s: 62, n: 5 },
    ],
    bagSlots: [{ l: 1, s: 36 }],
    features: ['skylight', 'balconies', 'fountain'],
  }),
  chunk({
    id: 'atrium-balcony-rails',
    name: 'Balcony Rails',
    env: 'atrium',
    length: 86,
    minDifficulty: 0.4,
    obstacles: [
      { t: 'pillar', l: 0, s: 16 },
      { t: 'pillar', l: 2, s: 16 },
      { t: 'kiosk', l: 1, s: 48, len: 8 },
      { t: 'shutterHalf', l: 0, s: 52, d: 0.6 },
    ],
    rails: [
      { l: 1, s: 6, len: 30 },
      { l: 0, s: 24, len: 16, d: 0.5 },
      { l: 2, s: 24, len: 16, d: 0.5 },
    ],
    coins: [
      { l: 1, s: 11, n: 9, rail: true },
      { l: 0, s: 29, n: 4, rail: true, d: 0.5 },
      { l: 2, s: 29, n: 4, rail: true, d: 0.5 },
      { l: 2, s: 50, n: 5 },
    ],
    bagSlots: [{ l: 1, s: 28, rail: true }],
    features: ['skylight', 'balconies', 'escalators'],
  }),
];

/** The approach to a branch point. The facade with per-lane doors sits at the end. */
export const JUNCTION_CHUNK: ChunkTemplate = chunk({
  id: 'junction-mall-directory',
  name: 'Mall Directory',
  env: 'concourse',
  kind: 'junction',
  length: 66,
  mirror: true,
  obstacles: [
    { t: 'wetFloor', l: 1, s: 12, d: 0.3 },
    { t: 'kiosk', l: 0, s: 16, len: 6, d: 0.3 },
  ],
  coins: [
    { l: 2, s: 8, n: 5 },
    { l: 1, s: 30, n: 6 },
  ],
  bagSlots: [],
  features: ['directory'],
});

export const START_CHUNK: ChunkTemplate = chunk({
  id: 'start-runway',
  name: 'Start Runway',
  env: 'concourse',
  kind: 'start',
  length: 44,
  mirror: false,
  obstacles: [],
  coins: [{ l: 1, s: 16, n: 8 }],
  bagSlots: [],
});

export function lobbyChunk(env: EnvId, length: number): ChunkTemplate {
  return chunk({
    id: `lobby-${env}`,
    name: 'Entrance',
    env,
    kind: 'lobby',
    length,
    mirror: false,
    obstacles: [],
    coins: [{ l: 1, s: Math.max(6, length - 18), n: 5 }],
    bagSlots: [],
  });
}

export function exitChunk(env: EnvId): ChunkTemplate {
  return chunk({
    id: `exit-${env}`,
    name: 'Back to the Concourse',
    env,
    kind: 'exit',
    length: 26,
    mirror: false,
    obstacles: [],
    coins: [{ l: 1, s: 6, n: 4 }],
    bagSlots: [],
  });
}

export function fillerChunk(env: EnvId, length: number, coinLane: number | null): ChunkTemplate {
  return chunk({
    id: `filler-${env}`,
    name: 'Open Floor',
    env,
    kind: 'filler',
    length,
    mirror: false,
    obstacles: [],
    coins: coinLane === null || length < 10 ? [] : [{ l: coinLane, s: 2, n: Math.max(1, Math.floor((length - 4) / 2.5)) }],
    bagSlots: length >= 24 ? [{ l: 1, s: length - 8 }] : [],
  });
}

/** A bag-only runway, used if a bag is due but the upcoming chunk has no slot. */
export function bagRunwayChunk(env: EnvId, length: number, lane: number): ChunkTemplate {
  return chunk({
    id: `bag-runway-${env}`,
    name: 'Lucky Aisle',
    env,
    kind: 'filler',
    length,
    mirror: false,
    obstacles: [],
    coins: [],
    bagSlots: [{ l: lane, s: length - 8 }],
  });
}

/** Junction branch options: which environment each lane's door leads to. */
export const JUNCTION_OPTIONS: Array<[EnvId, EnvId, EnvId]> = [
  ['foodcourt', 'concourse', 'concourse'],
  ['concourse', 'concourse', 'foodcourt'],
  ['deptstore', 'concourse', 'maintenance'],
  ['maintenance', 'concourse', 'deptstore'],
  ['atrium', 'atrium', 'concourse'],
  ['concourse', 'atrium', 'atrium'],
  ['foodcourt', 'concourse', 'atrium'],
  ['atrium', 'concourse', 'deptstore'],
  ['maintenance', 'concourse', 'foodcourt'],
];

export const ROUTE_RULES = {
  /** Distance range (m) between junctions on the main concourse. */
  junctionSpacing: [360, 620] as [number, number],
  /** Number of themed chunks in a branch before it reconnects. */
  branchChunks: [2, 3] as [number, number],
  /** Do not repeat a chunk template within this many picks. */
  noRepeatWindow: 2,
};

/** Fixed, slow tutorial course. */
export const TUTORIAL_CHUNK: ChunkTemplate = chunk({
  id: 'tutorial-course',
  name: 'Tutorial',
  env: 'concourse',
  kind: 'tutorial',
  length: 300,
  mirror: false,
  obstacles: [
    { t: 'kiosk', l: 1, s: 34, len: 10 },
    { t: 'ropeLine', l: [0, 1, 2], s: 82 },
    { t: 'bannerLow', l: [0, 1, 2], s: 124 },
    { t: 'planter', l: 0, s: 166, len: 4 },
    { t: 'planter', l: 2, s: 166, len: 4 },
    { t: 'ropeLine', l: [0, 1, 2], s: 214 },
    { t: 'wetFloor', l: 0, s: 252 },
    { t: 'bench', l: 2, s: 252 },
  ],
  rails: [{ l: 1, s: 162, len: 22 }],
  coins: [
    { l: 1, s: 8, n: 6 },
    { l: 0, s: 40, n: 5 },
    { l: 2, s: 40, n: 5 },
    { l: 1, s: 78.6, n: 5, gap: 1.4, arc: 1.15 },
    { l: 1, s: 168, n: 6, rail: true },
    { l: 1, s: 258, n: 6 },
  ],
  bagSlots: [],
});

export interface TutorialStep {
  id: string;
  /** Course distance where the prompt appears and time slows down. */
  at: number;
  /** Distance where the step is considered failed / passed if not completed. */
  until: number;
  title: string;
  body: string;
  /** Action that completes the step. */
  expect: 'lane' | 'jump' | 'duck' | 'grind' | 'trick' | 'none';
  slowMotion: boolean;
  /**
   * If false, clearing the step's obstacle without a collision also completes
   * it (the player may have reacted before the prompt appeared).
   */
  mustPerform?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'lanes',
    at: 14,
    until: 33,
    title: 'Change lanes',
    body: 'Swipe left or right (or press A / D, Left / Right) to dodge the kiosk.',
    expect: 'lane',
    slowMotion: true,
  },
  {
    id: 'jump',
    at: 66,
    until: 81,
    title: 'Jump',
    body: 'Swipe up (or Space / Up) to jump the rope line.',
    expect: 'jump',
    slowMotion: true,
  },
  {
    id: 'duck',
    at: 110,
    until: 123,
    title: 'Duck',
    body: 'Swipe down (or S / Down) to duck under the banner.',
    expect: 'duck',
    slowMotion: true,
  },
  {
    id: 'grind',
    at: 140,
    until: 166,
    title: 'Grind',
    body: 'Get in the middle lane. Roll onto the striped kicker, or land on the glowing rail, to grind automatically.',
    expect: 'grind',
    slowMotion: false,
    mustPerform: true,
  },
  {
    id: 'trick',
    at: 196,
    until: 222,
    title: 'Air tricks',
    body: 'Jump, then swipe left or right while in the air (or Q / E) to flip the board. Air swipes never change your lane.',
    expect: 'trick',
    slowMotion: true,
    mustPerform: true,
  },
  {
    id: 'security',
    at: 234,
    until: 270,
    title: 'Security',
    body: 'Bumping small stuff fills the security meter. Red-striped obstacles end your run instantly. Skate clean to cool off.',
    expect: 'none',
    slowMotion: false,
  },
];
