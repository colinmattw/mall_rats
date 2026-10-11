import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../config/gameplay';
import { StyleScorer } from './scoring';

describe('StyleScorer', () => {
  it('builds a combo multiplier through consecutive actions', () => {
    const s = new StyleScorer();
    const first = s.award('a', 'A', 100)[0]!;
    expect(first.multiplier).toBe(1);
    s.award('b', 'B', 100);
    s.award('c', 'C', 100);
    const fourth = s.award('d', 'D', 100)[0]!;
    expect(fourth.multiplier).toBeCloseTo(1 + GAMEPLAY.combo.perAction * 3, 6);
    expect(s.combo).toBe(4);
  });

  it('caps the multiplier', () => {
    const s = new StyleScorer();
    for (let i = 0; i < 60; i++) s.award(`x${i % 5}`, 'X', 10);
    expect(s.multiplier).toBe(GAMEPLAY.combo.maxMultiplier);
  });

  it('gives diminishing credit for repeating the same trick', () => {
    const s = new StyleScorer();
    const a = s.award('kickflip', 'Kickflip', 100, { trick: true })[0]!;
    const b = s.award('kickflip', 'Kickflip', 100, { trick: true })[0]!;
    const c = s.award('kickflip', 'Kickflip', 100, { trick: true })[0]!;
    expect(b.repeatFactor).toBeLessThan(a.repeatFactor);
    expect(c.repeatFactor).toBeLessThan(b.repeatFactor);
    // Despite the growing multiplier, raw credit for spamming falls off.
    expect(c.points / c.multiplier).toBeLessThan(a.points / a.multiplier);
  });

  it('collisions break the combo', () => {
    const s = new StyleScorer();
    s.award('a', 'A', 100);
    s.award('b', 'B', 100);
    expect(s.breakCombo()).toBe(2);
    expect(s.combo).toBe(0);
    expect(s.multiplier).toBe(1);
  });

  it('combos lapse after the timeout', () => {
    const s = new StyleScorer();
    s.award('a', 'A', 100);
    let lapsed = false;
    for (let i = 0; i <= GAMEPLAY.combo.timeoutTicks + 1; i++) lapsed = s.tick() || lapsed;
    expect(lapsed).toBe(true);
    expect(s.combo).toBe(0);
  });

  it('rewards chaining varied actions and three different tricks', () => {
    const s = new StyleScorer();
    const awards = [
      ...s.award('kickflip', 'Kickflip', 100, { trick: true }),
      ...s.award('heelflip', 'Heelflip', 100, { trick: true }),
      ...s.award('treFlip', '360 Flip', 100, { trick: true }),
    ];
    expect(awards.some((a) => a.id === 'variety')).toBe(true);
    expect(awards.some((a) => a.id === 'trickChain')).toBe(true);
    expect(s.trickChains).toBe(1);
  });

  it('keeps style separate from anything else (score only grows)', () => {
    const s = new StyleScorer();
    s.award('a', 'A', 50);
    const before = s.score;
    s.breakCombo();
    expect(s.score).toBe(before);
  });
});
