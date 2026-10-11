/**
 * Mall environments (route types). Store names are original and fictional.
 */
export type EnvId = 'concourse' | 'foodcourt' | 'deptstore' | 'maintenance' | 'atrium';

export interface EnvironmentDef {
  id: EnvId;
  name: string;
  signLabel: string;
  /** One-line description of the route tradeoff, shown on junction signage and in help. */
  tradeoff: string;
  floor: { a: string; b: string; grout: string; pattern: 'tile' | 'checker' | 'terrazzo' | 'concrete' | 'parquet' };
  wall: string;
  trim: string;
  ceiling: string;
  ceilingHeight: number;
  fog: string;
  neon: string[];
  storeNames: string[];
}

export const ENVIRONMENTS: Record<EnvId, EnvironmentDef> = {
  concourse: {
    id: 'concourse',
    name: 'Main Concourse',
    signLabel: 'MAIN CONCOURSE',
    tradeoff: 'Straightforward lines and readable obstacles.',
    floor: { a: '#f2e9dc', b: '#d9c9b4', grout: '#b9a68f', pattern: 'tile' },
    wall: '#2a2350',
    trim: '#ff4f9a',
    ceiling: '#1b1838',
    ceilingHeight: 8.5,
    fog: '#2b2550',
    neon: ['#ff4f9a', '#29e3d4', '#ffd23f', '#a46bff', '#7dff6a'],
    storeNames: [
      'RAD THREADS',
      'CASSETTE CASTLE',
      'SOLE PATROL',
      'BYTE BARN',
      'GLOW GETTERS',
      'THRIFT LORD',
      'DENIM DIMENSION',
      'PAGER PARADISE',
      'VHS VAULT',
      'HAT TRICK CAPS',
      'BOARD ROOM SKATE',
      'FROSTED TIPS',
      'CANDY COMET',
      'GNARLY GADGETS',
    ],
  },
  foodcourt: {
    id: 'foodcourt',
    name: 'Food Court',
    signLabel: 'FOOD COURT',
    tradeoff: 'Plenty of Mall Cash, but furniture everywhere.',
    floor: { a: '#ffe3a3', b: '#ff9f6b', grout: '#d77b4c', pattern: 'checker' },
    wall: '#5a2340',
    trim: '#ffd23f',
    ceiling: '#3a1730',
    ceilingHeight: 9,
    fog: '#5b2a3e',
    neon: ['#ffd23f', '#ff6b3d', '#29e3d4', '#ff4f9a'],
    storeNames: [
      'PRETZEL PLANET',
      'WOK THIS WAY',
      'TACO TSUNAMI',
      'MEGA MALT',
      'PIZZA ORBIT',
      'JUICE JUNCTION',
      'CORN DOG COSMOS',
      'BUBBLE TEA BOP',
    ],
  },
  deptstore: {
    id: 'deptstore',
    name: 'Department Store Shortcut',
    signLabel: 'MERTZ & GABLE',
    tradeoff: 'Tight aisles with concentrated pickups.',
    floor: { a: '#f5f1ea', b: '#e1d6c6', grout: '#cbbfae', pattern: 'parquet' },
    wall: '#3b2f2a',
    trim: '#e8c26b',
    ceiling: '#2a211d',
    ceilingHeight: 6.5,
    fog: '#3d322b',
    neon: ['#e8c26b', '#ffffff', '#ff8fb8'],
    storeNames: ['FRAGRANCE HALL', 'JUNIORS', 'MENSWEAR', 'SHOES & SOCKS', 'HOME GOODS', 'CLEARANCE', 'DENIM BAR'],
  },
  maintenance: {
    id: 'maintenance',
    name: 'Maintenance Corridor',
    signLabel: 'STAFF ONLY',
    tradeoff: 'Fewer rewards, simpler obstacles.',
    floor: { a: '#8a8f94', b: '#7a7f85', grout: '#5d6166', pattern: 'concrete' },
    wall: '#4a5258',
    trim: '#ffcc00',
    ceiling: '#2d3236',
    ceilingHeight: 4.8,
    fog: '#2f3438',
    neon: ['#ffcc00', '#9df3ff'],
    storeNames: ['LOADING DOCK B', 'BOILER ROOM', 'JANITORIAL', 'ELECTRICAL', 'STOCK ROOM'],
  },
  atrium: {
    id: 'atrium',
    name: 'Grand Atrium',
    signLabel: 'GRAND ATRIUM',
    tradeoff: 'Rail lines for big tricks, with demanding landings.',
    floor: { a: '#e9eef5', b: '#9fb3c8', grout: '#7d93aa', pattern: 'terrazzo' },
    wall: '#1f3b57',
    trim: '#29e3d4',
    ceiling: '#9fd8ff',
    ceilingHeight: 16,
    fog: '#3b5a78',
    neon: ['#29e3d4', '#ff4f9a', '#ffd23f'],
    storeNames: ['SKYLIGHT COURT', 'FOUNTAIN PLAZA', 'MALL RAT RECORDS', 'GLAM SLAM', 'PIXEL PALACE ARCADE'],
  },
};

export const ENV_IDS: EnvId[] = ['concourse', 'foodcourt', 'deptstore', 'maintenance', 'atrium'];
