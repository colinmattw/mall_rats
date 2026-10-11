import { describe, expect, it } from 'vitest';
import { Rng, hashSeed, isRngState } from './rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng('mall');
    const b = new Rng('mall');
    for (let i = 0; i < 50; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('diverges for different seeds', () => {
    const a = new Rng('mall-1');
    const b = new Rng('mall-2');
    const same = Array.from({ length: 20 }, () => a.nextU32() === b.nextU32()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });

  it('round-trips its state (persistable streams)', () => {
    const a = new Rng('drops');
    for (let i = 0; i < 10; i++) a.next();
    const state = a.getState();
    expect(isRngState(state)).toBe(true);
    const restored = new Rng(JSON.parse(JSON.stringify(state)));
    for (let i = 0; i < 30; i++) expect(restored.next()).toBe(a.next());
  });

  it('produces uniform-ish floats and inclusive ints', () => {
    const r = new Rng('uniform');
    let sum = 0;
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
      counts[r.int(0, 2)]!++;
    }
    expect(sum / 30000).toBeCloseTo(0.5, 1);
    for (const c of counts) expect(c / 30000).toBeCloseTo(1 / 3, 1);
  });

  it('weighted picks respect weights and skip zero weights', () => {
    const r = new Rng('weights');
    const tally: Record<string, number> = { a: 0, b: 0, c: 0 };
    const items = [
      { id: 'a', w: 1 },
      { id: 'b', w: 3 },
      { id: 'c', w: 0 },
    ];
    for (let i = 0; i < 40000; i++) tally[r.weighted(items, (x) => x.w)!.id]!++;
    expect(tally.c).toBe(0);
    expect(tally.b! / tally.a!).toBeGreaterThan(2.7);
    expect(tally.b! / tally.a!).toBeLessThan(3.3);
  });

  it('hashSeed yields 4 unsigned 32-bit words', () => {
    const s = hashSeed('x');
    expect(s).toHaveLength(4);
    expect(isRngState(s)).toBe(true);
  });
});
