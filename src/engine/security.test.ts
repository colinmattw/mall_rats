import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../config/gameplay';
import { SecurityMeter } from './security';

describe('SecurityMeter', () => {
  it('fills to capture and never exceeds the max', () => {
    const m = new SecurityMeter();
    m.add(GAMEPLAY.pressure.minorHit);
    m.add(GAMEPLAY.pressure.minorHit);
    expect(m.captured).toBe(false);
    m.add(GAMEPLAY.pressure.minorHit);
    expect(m.captured).toBe(true);
    expect(m.pressure).toBe(GAMEPLAY.pressure.max);
    m.add(50);
    expect(m.pressure).toBe(GAMEPLAY.pressure.max);
  });

  it('does not decay until the delay elapses, then bleeds off', () => {
    const m = new SecurityMeter();
    m.add(40);
    for (let i = 0; i < GAMEPLAY.pressure.decayDelayTicks; i++) m.tick();
    expect(m.pressure).toBe(40);
    for (let i = 0; i < 60; i++) m.tick();
    expect(m.pressure).toBeCloseTo(40 - GAMEPLAY.pressure.decayPerSecond, 5);
  });

  it('closes the guard gap as pressure rises', () => {
    const m = new SecurityMeter();
    const far = m.guardGap();
    m.add(80);
    expect(m.guardGap()).toBeLessThan(far);
    expect(m.guardGap()).toBeGreaterThan(0);
  });
});
