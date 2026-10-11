/**
 * Small, fast, serializable PRNG (sfc32) with cyrb128 seeding.
 *
 * Mall Rats keeps independent streams for route generation and rare-item
 * drops so that layout randomness can never influence (or be used to
 * manipulate) drop outcomes. Stream state is plain data and can be persisted.
 */
export type RngState = [number, number, number, number];

export function hashSeed(input: string | number): RngState {
  const str = String(input);
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function isRngState(value: unknown): value is RngState {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffffff)
  );
}

export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: string | number | RngState) {
    if (Array.isArray(seed)) {
      this.setState(seed);
    } else {
      this.setState(hashSeed(seed));
      // Warm up so similar seeds diverge quickly.
      for (let i = 0; i < 15; i++) this.nextU32();
    }
  }

  nextU32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty list');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Weighted pick; entries with non-positive weight are never selected. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const item of items) total += Math.max(0, weight(item));
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const item of items) {
      const w = Math.max(0, weight(item));
      if (w <= 0) continue;
      if (roll < w) return item;
      roll -= w;
    }
    // Floating point fallthrough: return last positive entry.
    for (let i = items.length - 1; i >= 0; i--) {
      if (weight(items[i]!) > 0) return items[i];
    }
    return undefined;
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(state: RngState): void {
    this.a = state[0] >>> 0;
    this.b = state[1] >>> 0;
    this.c = state[2] >>> 0;
    this.d = state[3] >>> 0;
  }

  clone(): Rng {
    return new Rng(this.getState());
  }
}

/** Cryptographically random seed when available (used for new profiles / runs). */
export function randomSeed(): string {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } };
  if (g.crypto?.getRandomValues) {
    const buf = new Uint32Array(2);
    g.crypto.getRandomValues(buf);
    return `${buf[0]!.toString(36)}${buf[1]!.toString(36)}`;
  }
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Unique-enough ID for idempotency keys (sales, purchases, rewards). */
export function makeId(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const core = g.crypto?.randomUUID ? g.crypto.randomUUID() : `${randomSeed()}-${Date.now().toString(36)}`;
  return `${prefix}_${core}`;
}
