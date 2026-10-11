import { describe, expect, it } from 'vitest';
import { BADGES, MISSION_SEQUENCE, missionByIndex, repeatableMission } from './missions';

describe('missions', () => {
  it('ships a curated sequence of ordinary goals that never require rare bags', () => {
    expect(MISSION_SEQUENCE.length).toBeGreaterThanOrEqual(20);
    expect(new Set(MISSION_SEQUENCE.map((m) => m.id)).size).toBe(MISSION_SEQUENCE.length);
    for (const m of MISSION_SEQUENCE) {
      expect(m.target).toBeGreaterThan(0);
      expect(m.reward.cash).toBeGreaterThan(0);
      expect(JSON.stringify(m).toLowerCase()).not.toMatch(/bag|drop|loot|mystery/);
      expect(m.kind).not.toBe('bag' as typeof m.kind);
    }
  });

  it('badges are recognition only', () => {
    for (const [id, b] of Object.entries(BADGES)) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(0);
      expect(id).toMatch(/^[a-zA-Z]+$/);
    }
    const used = MISSION_SEQUENCE.map((m) => m.reward.badge).filter(Boolean) as string[];
    for (const id of used) expect(BADGES[id]).toBeTruthy();
  });

  it('continues with deterministic repeatable missions after the curated list', () => {
    const first = missionByIndex(MISSION_SEQUENCE.length);
    const again = repeatableMission(0);
    expect(first).toEqual(again);
    expect(missionByIndex(0).id).toBe('m01');
    const later = missionByIndex(MISSION_SEQUENCE.length + 12);
    expect(later.reward.cash).toBeGreaterThan(repeatableMission(0).reward.cash);
    expect(later.target).toBeGreaterThan(repeatableMission(0).target);
  });
});
