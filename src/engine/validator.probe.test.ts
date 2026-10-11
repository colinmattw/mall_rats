import { describe, it } from 'vitest';
import { ROUTE_CHUNKS, JUNCTION_CHUNK } from '../config/routes';
import { GAMEPLAY } from '../config/gameplay';
import { difficultyLayers, validateTemplate } from './validator';

describe('probe', () => {
  it('measures', () => {
    const speeds = [GAMEPLAY.speed.start, 17, GAMEPLAY.speed.max];
    for (const t of [...ROUTE_CHUNKS, JUNCTION_CHUNK]) {
      for (const layer of difficultyLayers(t)) {
        for (const mirror of [false]) {
          for (const v of speeds) {
            const t0 = performance.now();
            const r = validateTemplate(t, { speed: v, difficulty: layer, mirror, bagSlot: t.bagSlots.length ? 0 : null });
            const ms = performance.now() - t0;
            const ok = r.passableFrom.every(Boolean);
            const bag = r.bagReachableFrom ? r.bagReachableFrom.every(Boolean) : true;
            if (!ok || !bag || ms > 40 || process.env.PROBE_ALL)
              process.stdout.write(
                `${t.id} d=${layer} v=${v} pass=${r.passableFrom.map((b) => (b ? 1 : 0)).join('')} bag=${r.bagReachableFrom?.map((b) => (b ? 1 : 0)).join('') ?? '-'} states=${r.statesExplored} peak=${r.peakStates} ${ms.toFixed(1)}ms\n`,
              );
          }
        }
      }
    }
  });
});
