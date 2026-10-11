import type { EnvId } from './environments';

/**
 * Missions. Ordinary missions never require rare drops. Rewards are Mall Cash
 * and occasionally a cosmetic badge (recognition only, no gameplay effect).
 *
 * scope 'run':   progress is the best single-run value.
 * scope 'total': progress accumulates across runs while the mission is active.
 */
export type MissionKind =
  | 'cleanJumps'
  | 'grindDistance'
  | 'collectCash'
  | 'reachDistance'
  | 'trickChain'
  | 'routeVisit'
  | 'noHitTime'
  | 'tricks'
  | 'nearMisses'
  | 'runs'
  | 'style'
  | 'grinds';

export interface MissionDef {
  id: string;
  kind: MissionKind;
  scope: 'run' | 'total';
  target: number;
  env?: EnvId;
  title: string;
  reward: { cash: number; badge?: string };
}

export const BADGES: Record<string, { name: string; description: string }> = {
  firstFlip: { name: 'First Flip', description: 'Landed your first airborne tricks.' },
  railRat: { name: 'Rail Rat', description: 'Grinds like the rails owe them money.' },
  foodCourtPhantom: { name: 'Food Court Phantom', description: 'Slipped through the lunch rush.' },
  cleanMachine: { name: 'Clean Machine', description: 'A full minute without a single bump.' },
  comboKid: { name: 'Combo Kid', description: 'Chained three different tricks in one combo.' },
  mallLegend: { name: 'Mall Legend', description: 'Skated two kilometres in one run.' },
  shortcutSage: { name: 'Shortcut Sage', description: 'Knows every back door in Mertz & Gable.' },
  skylightSoarer: { name: 'Skylight Soarer', description: 'Owned the Grand Atrium rails.' },
};

export const MISSION_SEQUENCE: MissionDef[] = [
  { id: 'm01', kind: 'cleanJumps', scope: 'total', target: 5, title: 'Jump 5 obstacles cleanly', reward: { cash: 100 } },
  { id: 'm02', kind: 'collectCash', scope: 'total', target: 150, title: 'Collect 150 Mall Cash', reward: { cash: 100 } },
  { id: 'm03', kind: 'reachDistance', scope: 'run', target: 500, title: 'Skate 500 m in one run', reward: { cash: 120 } },
  { id: 'm04', kind: 'tricks', scope: 'total', target: 8, title: 'Land 8 air tricks', reward: { cash: 120, badge: 'firstFlip' } },
  { id: 'm05', kind: 'grindDistance', scope: 'total', target: 60, title: 'Grind 60 m of rail', reward: { cash: 150 } },
  { id: 'm06', kind: 'routeVisit', scope: 'total', target: 1, env: 'foodcourt', title: 'Skate through the Food Court', reward: { cash: 150, badge: 'foodCourtPhantom' } },
  { id: 'm07', kind: 'noHitTime', scope: 'run', target: 30, title: 'Survive 30 s without a collision', reward: { cash: 150 } },
  { id: 'm08', kind: 'trickChain', scope: 'total', target: 1, title: 'Chain 3 different tricks in one combo', reward: { cash: 200, badge: 'comboKid' } },
  { id: 'm09', kind: 'nearMisses', scope: 'total', target: 5, title: 'Pull off 5 near misses', reward: { cash: 150 } },
  { id: 'm10', kind: 'runs', scope: 'total', target: 5, title: 'Play 5 runs', reward: { cash: 120 } },
  { id: 'm11', kind: 'reachDistance', scope: 'run', target: 1000, title: 'Skate 1,000 m in one run', reward: { cash: 200 } },
  { id: 'm12', kind: 'routeVisit', scope: 'total', target: 1, env: 'atrium', title: 'Skate through the Grand Atrium', reward: { cash: 180, badge: 'skylightSoarer' } },
  { id: 'm13', kind: 'grindDistance', scope: 'total', target: 200, title: 'Grind 200 m of rail', reward: { cash: 250, badge: 'railRat' } },
  { id: 'm14', kind: 'style', scope: 'run', target: 5000, title: 'Score 5,000 style in one run', reward: { cash: 200 } },
  { id: 'm15', kind: 'routeVisit', scope: 'total', target: 1, env: 'deptstore', title: 'Take the department store shortcut', reward: { cash: 180, badge: 'shortcutSage' } },
  { id: 'm16', kind: 'collectCash', scope: 'run', target: 120, title: 'Collect 120 Mall Cash in one run', reward: { cash: 250 } },
  { id: 'm17', kind: 'routeVisit', scope: 'total', target: 1, env: 'maintenance', title: 'Sneak through a maintenance corridor', reward: { cash: 150 } },
  { id: 'm18', kind: 'noHitTime', scope: 'run', target: 60, title: 'Survive 60 s without a collision', reward: { cash: 300, badge: 'cleanMachine' } },
  { id: 'm19', kind: 'cleanJumps', scope: 'total', target: 40, title: 'Jump 40 obstacles cleanly', reward: { cash: 250 } },
  { id: 'm20', kind: 'grinds', scope: 'total', target: 25, title: 'Start 25 grinds', reward: { cash: 250 } },
  { id: 'm21', kind: 'reachDistance', scope: 'run', target: 2000, title: 'Skate 2,000 m in one run', reward: { cash: 400, badge: 'mallLegend' } },
  { id: 'm22', kind: 'style', scope: 'run', target: 15000, title: 'Score 15,000 style in one run', reward: { cash: 400 } },
  { id: 'm23', kind: 'trickChain', scope: 'total', target: 5, title: 'Chain 3 different tricks, 5 times', reward: { cash: 350 } },
  { id: 'm24', kind: 'collectCash', scope: 'total', target: 2000, title: 'Collect 2,000 Mall Cash', reward: { cash: 400 } },
];

export const ACTIVE_MISSION_SLOTS = 3;

/** Endless repeatable missions after the curated list (deterministic by index). */
export function repeatableMission(index: number): MissionDef {
  const tier = Math.floor(index / 6) + 1;
  const kinds: Array<() => MissionDef> = [
    () => ({ id: `r${index}`, kind: 'cleanJumps', scope: 'total', target: 20 * tier, title: `Jump ${20 * tier} obstacles cleanly`, reward: { cash: 150 + 25 * tier } }),
    () => ({ id: `r${index}`, kind: 'grindDistance', scope: 'total', target: 150 * tier, title: `Grind ${150 * tier} m of rail`, reward: { cash: 175 + 25 * tier } }),
    () => ({ id: `r${index}`, kind: 'reachDistance', scope: 'run', target: Math.min(4000, 1200 + 300 * tier), title: `Skate ${Math.min(4000, 1200 + 300 * tier).toLocaleString('en-US')} m in one run`, reward: { cash: 200 + 25 * tier } }),
    () => ({ id: `r${index}`, kind: 'collectCash', scope: 'total', target: 400 * tier, title: `Collect ${(400 * tier).toLocaleString('en-US')} Mall Cash`, reward: { cash: 150 + 25 * tier } }),
    () => ({ id: `r${index}`, kind: 'tricks', scope: 'total', target: 25 * tier, title: `Land ${25 * tier} air tricks`, reward: { cash: 150 + 25 * tier } }),
    () => ({ id: `r${index}`, kind: 'nearMisses', scope: 'total', target: 10 * tier, title: `Pull off ${10 * tier} near misses`, reward: { cash: 150 + 25 * tier } }),
  ];
  return kinds[index % kinds.length]!();
}

export function missionByIndex(index: number): MissionDef {
  return index < MISSION_SEQUENCE.length ? MISSION_SEQUENCE[index]! : repeatableMission(index - MISSION_SEQUENCE.length);
}
