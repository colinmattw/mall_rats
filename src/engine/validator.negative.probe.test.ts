import { describe, expect, it } from 'vitest';
import type { ChunkTemplate } from '../config/routes';
import { validateTemplate } from './validator';

const base = (over: Partial<ChunkTemplate>): ChunkTemplate => ({
  id: 'probe',
  name: 'probe',
  env: 'concourse',
  kind: 'chunk',
  length: 60,
  weight: 1,
  minDifficulty: 0,
  mirror: false,
  obstacles: [],
  rails: [],
  coins: [],
  bagSlots: [],
  ...over,
});

describe('validator negative probes', () => {
  it('rejects a wall of kiosks', () => {
    const r = validateTemplate(base({ obstacles: [{ t: 'kiosk', l: [0, 1, 2], s: 20, len: 4 }] }), {
      speed: 15,
      difficulty: 1,
      mirror: false,
    });
    expect(r.passableFrom).toEqual([false, false, false]);
  });
  it('rejects an immediate kiosk only for its own lane', () => {
    const r = validateTemplate(base({ obstacles: [{ t: 'kiosk', l: 1, s: 0.6, len: 6 }] }), {
      speed: 15,
      difficulty: 1,
      mirror: false,
    });
    expect(r.passableFrom).toEqual([true, false, true]);
  });
  it('accepts a jumpable wall and a duckable wall', () => {
    const r = validateTemplate(
      base({
        obstacles: [
          { t: 'ropeLine', l: [0, 1, 2], s: 15 },
          { t: 'bannerLow', l: [0, 1, 2], s: 40 },
        ],
      }),
      { speed: 23, difficulty: 1, mirror: false },
    );
    expect(r.passableFrom).toEqual([true, true, true]);
  });
  it('rejects a jump wall followed too closely by a duck wall', () => {
    const r = validateTemplate(
      base({
        obstacles: [
          { t: 'ropeLine', l: [0, 1, 2], s: 15 },
          { t: 'bannerLow', l: [0, 1, 2], s: 17 },
        ],
      }),
      { speed: 23, difficulty: 1, mirror: false },
    );
    expect(r.passableFrom).toEqual([false, false, false]);
  });
  it('rejects an unreachable bag behind a kiosk wall gap', () => {
    const r = validateTemplate(
      base({
        obstacles: [{ t: 'kiosk', l: [1, 2], s: 0.8, len: 50 }],
        bagSlots: [{ l: 2, s: 30 }],
      }),
      { speed: 15, difficulty: 1, mirror: false, bagSlot: 0 },
    );
    expect(r.passableFrom).toEqual([true, false, false]);
    expect(r.bagReachableFrom).toEqual([false, false, false]);
  });
});
