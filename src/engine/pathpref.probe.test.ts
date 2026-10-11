import { expect, it } from 'vitest';
import { createPlayer } from './player';
import { validateCourse } from './validator';

it('reconstructs a path that ends in the preferred lane', () => {
  const p = createPlayer(0, 1);
  const r = validateCourse({ obstacles: [], rails: [], sStart: 0, sEnd: 40 }, { speed: 15, startStates: [p], recordPath: true, preferLane: 2 });
  const actions = (r.path ?? []).filter(Boolean);
  process.stdout.write(`path length=${r.path?.length} actions=${actions.join(',')}\n`);
  expect(actions).toContain('right');
});
