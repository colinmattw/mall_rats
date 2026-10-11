/**
 * Core gameplay tuning. Everything here is data: the simulation, the route
 * validator and the tests all read the same values, so changing a timing
 * automatically re-validates every authored route chunk.
 */

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
export const LANE_COUNT = 3;

export interface GameplayConfig {
  laneWidth: number;
  speed: {
    /** Starting forward speed in m/s. */
    start: number;
    /** Hard cap; validated as controllable by the route tests. */
    max: number;
    /** Distance constant (m) of the exponential approach towards max speed. */
    rampDistance: number;
  };
  /** Ticks needed to move one lane (60 ticks = 1 s). */
  laneChangeTicks: number;
  jump: {
    /** Apex height above take-off (m). */
    height: number;
    /** Air time of a ground jump, in ticks. Defines gravity. */
    airTicks: number;
  };
  /** Vertical launch speed when hopping sideways off a rail (m/s). */
  railHopLaunch: number;
  /** Vertical launch speed of the automatic pop at the end of a rail (m/s). */
  railEndPopLaunch: number;
  duckTicks: number;
  fastFallSpeed: number;
  railHeight: number;
  kickerLength: number;
  /** A lateral distance from a lane centre within which a rail is "under" the player. */
  railCatchHalfWidth: number;
  stepUpHeight: number;
  player: {
    halfWidth: number;
    halfDepth: number;
    height: number;
    duckHeight: number;
    airHeight: number;
  };
  /** Obstacles shrink by this much in-game (forgiving hitboxes). */
  collisionMargin: number;
  /** Obstacles grow by this much in the route validator (stricter than play). */
  validatorPadding: number;
  inputBufferTicks: number;
  trick: { ticks: number; cleanFraction: number };
  stumble: { speedFactor: number; recoverTicks: number; graceTicks: number };
  pressure: {
    max: number;
    minorHit: number;
    sideBump: number;
    breakable: number;
    decayPerSecond: number;
    decayDelayTicks: number;
  };
  nearMiss: { lateral: number; vertical: number };
  pickupRadius: { cash: number; bag: number };
  combo: { timeoutTicks: number; maxMultiplier: number; perAction: number; repeatDecay: number; historySize: number };
  /** Ticks that the crash / capture animation plays before the run summary is produced. */
  endSequenceTicks: number;
  /** How far ahead (m) the course is generated. Kept beyond the fog distance. */
  generationLookahead: number;
  /** How far behind the player (m) old chunks are kept before recycling. */
  recycleBehind: number;
  /** Difficulty reaches 1.0 at this distance (m). */
  difficultyDistance: number;
}

export const GAMEPLAY: GameplayConfig = {
  laneWidth: 2.0,
  speed: { start: 11, max: 23, rampDistance: 2600 },
  laneChangeTicks: 11,
  jump: { height: 1.55, airTicks: 39 },
  railHopLaunch: 4.6,
  railEndPopLaunch: 3.2,
  duckTicks: 36,
  fastFallSpeed: 19,
  railHeight: 0.62,
  kickerLength: 2.8,
  railCatchHalfWidth: 0.55,
  stepUpHeight: 0.3,
  player: { halfWidth: 0.32, halfDepth: 0.3, height: 1.75, duckHeight: 0.85, airHeight: 1.3 },
  collisionMargin: 0.12,
  validatorPadding: 0.05,
  inputBufferTicks: 10,
  trick: { ticks: 20, cleanFraction: 0.7 },
  stumble: { speedFactor: 0.72, recoverTicks: 90, graceTicks: 30 },
  pressure: {
    max: 100,
    minorHit: 34,
    sideBump: 26,
    breakable: 16,
    decayPerSecond: 5,
    decayDelayTicks: 120,
  },
  nearMiss: { lateral: 0.42, vertical: 0.3 },
  pickupRadius: { cash: 0.75, bag: 1.0 },
  combo: { timeoutTicks: 240, maxMultiplier: 5, perAction: 0.25, repeatDecay: 0.6, historySize: 6 },
  endSequenceTicks: 84,
  generationLookahead: 175,
  recycleBehind: 30,
  difficultyDistance: 3200,
};

export function laneX(lane: number, cfg: GameplayConfig = GAMEPLAY): number {
  return (lane - (LANE_COUNT - 1) / 2) * cfg.laneWidth;
}

export function gravity(cfg: GameplayConfig = GAMEPLAY): number {
  const t = cfg.jump.airTicks * SIM_DT;
  return (8 * cfg.jump.height) / (t * t);
}

export function jumpLaunch(cfg: GameplayConfig = GAMEPLAY): number {
  const t = cfg.jump.airTicks * SIM_DT;
  return (4 * cfg.jump.height) / t;
}

/** Base forward speed at a distance along the course (before stumble slow-downs). */
export function speedAtDistance(distance: number, cfg: GameplayConfig = GAMEPLAY): number {
  const { start, max, rampDistance } = cfg.speed;
  return max - (max - start) * Math.exp(-Math.max(0, distance) / rampDistance);
}

export function difficultyAtDistance(distance: number, cfg: GameplayConfig = GAMEPLAY): number {
  return Math.min(1, Math.max(0, distance / cfg.difficultyDistance));
}

/** Air time (s) when launching at `launch` m/s from height `fromY`, landing at y = 0. */
export function airTimeToGround(fromY: number, launch: number, cfg: GameplayConfig = GAMEPLAY): number {
  const g = gravity(cfg);
  return (launch + Math.sqrt(launch * launch + 2 * g * fromY)) / g;
}

/** Longest time the player can be committed to being airborne (rail ollie to floor). */
export function maxAirTime(cfg: GameplayConfig = GAMEPLAY): number {
  return Math.max(
    cfg.jump.airTicks * SIM_DT,
    airTimeToGround(cfg.railHeight, jumpLaunch(cfg), cfg),
    airTimeToGround(cfg.railHeight, cfg.railHopLaunch, cfg),
  );
}

/**
 * Time a player may need to "settle" (land / finish a duck) after the last
 * obstacle of a chunk before the next chunk's obstacles may begin.
 */
export function settleTime(cfg: GameplayConfig = GAMEPLAY): number {
  return Math.max(maxAirTime(cfg), cfg.duckTicks * SIM_DT) + 0.1;
}
