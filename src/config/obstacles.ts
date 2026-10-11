/**
 * Obstacle catalogue. Collision boxes are authored here and shared by the
 * simulation, the renderer (for sizing meshes) and the route validator.
 *
 * - minor:     knocked aside on contact. Stumble + security pressure.
 * - major:     clearly marked with hazard chevrons. A direct (front) hit ends the run.
 *              Side-swipes during a lane change bounce the skater back (minor penalty).
 * - breakable: lightweight displays. Smashing one awards style but raises pressure.
 *
 * requirement describes how to pass the obstacle while staying in its lane:
 * jump over it, duck under it, or (block) change lanes.
 */
export type ObstacleSeverity = 'minor' | 'major' | 'breakable';
export type ObstacleRequirement = 'jump' | 'duck' | 'block';

export type ObstacleTypeId =
  | 'wetFloor'
  | 'ropeLine'
  | 'bench'
  | 'mopBucket'
  | 'foodTable'
  | 'trashCan'
  | 'bannerLow'
  | 'shutterHalf'
  | 'pipeLow'
  | 'kiosk'
  | 'planter'
  | 'cleaningCart'
  | 'vending'
  | 'foodCounter'
  | 'crateStack'
  | 'fountain'
  | 'pillar'
  | 'perfumeCounter'
  | 'standee'
  | 'displayRack'
  | 'mannequin'
  | 'boxStack';

export interface ObstacleTypeDef {
  id: ObstacleTypeId;
  label: string;
  severity: ObstacleSeverity;
  requirement: ObstacleRequirement;
  /** Default length along the course (m). Chunk specs may override for long pieces. */
  depth: number;
  /** Lateral width when occupying a single lane (m). Multi-lane spans extend it. */
  width: number;
  y0: number;
  y1: number;
  stylePoints?: number;
}

const T = (def: ObstacleTypeDef) => def;

export const OBSTACLE_TYPES: Record<ObstacleTypeId, ObstacleTypeDef> = {
  wetFloor: T({ id: 'wetFloor', label: 'Wet floor sign', severity: 'minor', requirement: 'jump', depth: 0.5, width: 1.0, y0: 0, y1: 0.78 }),
  ropeLine: T({ id: 'ropeLine', label: 'Velvet rope line', severity: 'minor', requirement: 'jump', depth: 0.35, width: 1.75, y0: 0, y1: 0.92 }),
  bench: T({ id: 'bench', label: 'Hazard bench', severity: 'major', requirement: 'jump', depth: 0.9, width: 1.7, y0: 0, y1: 0.62 }),
  mopBucket: T({ id: 'mopBucket', label: 'Mop bucket', severity: 'minor', requirement: 'jump', depth: 0.6, width: 0.9, y0: 0, y1: 0.55 }),
  foodTable: T({ id: 'foodTable', label: 'Food court table', severity: 'minor', requirement: 'jump', depth: 1.2, width: 1.6, y0: 0, y1: 0.78 }),
  trashCan: T({ id: 'trashCan', label: 'Trash can', severity: 'minor', requirement: 'jump', depth: 0.7, width: 0.8, y0: 0, y1: 0.95 }),
  bannerLow: T({ id: 'bannerLow', label: 'Sale banner', severity: 'minor', requirement: 'duck', depth: 0.3, width: 1.85, y0: 1.12, y1: 2.4 }),
  shutterHalf: T({ id: 'shutterHalf', label: 'Half-closed shutter', severity: 'major', requirement: 'duck', depth: 0.4, width: 1.95, y0: 1.15, y1: 5.0 }),
  pipeLow: T({ id: 'pipeLow', label: 'Low pipe', severity: 'major', requirement: 'duck', depth: 0.5, width: 2.0, y0: 1.15, y1: 1.65 }),
  kiosk: T({ id: 'kiosk', label: 'Kiosk', severity: 'major', requirement: 'block', depth: 6, width: 1.75, y0: 0, y1: 2.7 }),
  planter: T({ id: 'planter', label: 'Planter', severity: 'major', requirement: 'block', depth: 3, width: 1.7, y0: 0, y1: 2.0 }),
  cleaningCart: T({ id: 'cleaningCart', label: 'Janitor cart', severity: 'major', requirement: 'block', depth: 1.6, width: 1.3, y0: 0, y1: 1.95 }),
  vending: T({ id: 'vending', label: 'Vending machine', severity: 'major', requirement: 'block', depth: 1.1, width: 1.4, y0: 0, y1: 2.3 }),
  foodCounter: T({ id: 'foodCounter', label: 'Food counter', severity: 'major', requirement: 'block', depth: 8, width: 1.75, y0: 0, y1: 2.1 }),
  crateStack: T({ id: 'crateStack', label: 'Crate stack', severity: 'major', requirement: 'block', depth: 1.8, width: 1.7, y0: 0, y1: 2.3 }),
  fountain: T({ id: 'fountain', label: 'Fountain', severity: 'major', requirement: 'block', depth: 6, width: 1.8, y0: 0, y1: 2.6 }),
  pillar: T({ id: 'pillar', label: 'Pillar', severity: 'major', requirement: 'block', depth: 1.4, width: 1.3, y0: 0, y1: 8 }),
  perfumeCounter: T({ id: 'perfumeCounter', label: 'Perfume counter', severity: 'major', requirement: 'block', depth: 3, width: 1.7, y0: 0, y1: 2.0 }),
  standee: T({ id: 'standee', label: 'Cardboard standee', severity: 'minor', requirement: 'block', depth: 0.3, width: 1.0, y0: 0, y1: 1.95 }),
  displayRack: T({ id: 'displayRack', label: 'Clothing rack', severity: 'breakable', requirement: 'block', depth: 1.2, width: 1.6, y0: 0, y1: 1.75, stylePoints: 120 }),
  mannequin: T({ id: 'mannequin', label: 'Mannequin display', severity: 'breakable', requirement: 'block', depth: 0.8, width: 1.1, y0: 0, y1: 1.95, stylePoints: 140 }),
  boxStack: T({ id: 'boxStack', label: 'Cardboard boxes', severity: 'breakable', requirement: 'block', depth: 1.0, width: 1.5, y0: 0, y1: 1.8, stylePoints: 100 }),
};
