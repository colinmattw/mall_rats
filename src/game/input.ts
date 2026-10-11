import type { Intent } from '../engine/player';

/**
 * Touch + keyboard input. A swipe fires exactly one intent as soon as it
 * crosses the distance threshold (responsive, and one gesture can never
 * trigger two conflicting actions). Taps do nothing.
 */
export class InputController {
  private queue: Intent[] = [];
  private pointers = new Map<number, { x: number; y: number; t: number; fired: boolean }>();
  sensitivity = 1;
  enabled = false;
  onPause: (() => void) | null = null;
  onAnyInput: (() => void) | null = null;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('keydown', this.key);
  }

  destroy(): void {
    this.el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('keydown', this.key);
  }

  /** Next queued intent (one per simulation tick). */
  next(): Intent | null {
    return this.queue.shift() ?? null;
  }

  clear(): void {
    this.queue.length = 0;
    this.pointers.clear();
  }

  push(intent: Intent): void {
    if (!this.enabled) return;
    if (this.queue.length < 4) this.queue.push(intent);
    this.onAnyInput?.();
  }

  private threshold(): number {
    const min = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(16, min * 0.045) / this.sensitivity;
  }

  private down = (e: PointerEvent): void => {
    if (!this.enabled) return;
    if ((e.target as HTMLElement | null)?.closest('button, a, input, [data-no-swipe]')) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), fired: false });
    e.preventDefault();
  };

  private classify(dx: number, dy: number): Intent {
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  private move = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p || p.fired) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) >= this.threshold()) {
      p.fired = true;
      this.push(this.classify(dx, dy));
    }
    e.preventDefault();
  };

  private up = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.fired) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const quick = performance.now() - p.t < 260;
    if (quick && Math.hypot(dx, dy) >= this.threshold() * 0.6) this.push(this.classify(dx, dy));
  };

  private cancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private key = (e: KeyboardEvent): void => {
    if (!this.enabled || e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    let intent: Intent | null = null;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        intent = 'left';
        break;
      case 'ArrowRight':
      case 'KeyD':
        intent = 'right';
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        intent = 'up';
        break;
      case 'ArrowDown':
      case 'KeyS':
        intent = 'down';
        break;
      case 'KeyQ':
        intent = 'trickLeft';
        break;
      case 'KeyE':
        intent = 'trickRight';
        break;
      case 'Escape':
      case 'KeyP':
        this.onPause?.();
        e.preventDefault();
        return;
    }
    if (intent) {
      this.push(intent);
      e.preventDefault();
    }
  };
}
