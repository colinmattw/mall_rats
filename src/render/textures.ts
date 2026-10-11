import * as THREE from 'three';
import { ENVIRONMENTS, ENV_IDS, type EnvId } from '../config/environments';
import { Rng } from '../engine/rng';

/**
 * All textures are drawn procedurally at runtime (original art, no external
 * assets). Results are cached so each texture is created once.
 */
const cache = new Map<string, THREE.Texture>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function toTexture(canvas: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined;
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

export const DISPLAY_FONT = '"Bungee", "Arial Black", Impact, sans-serif';
export const MARKER_FONT = '"Permanent Marker", "Comic Sans MS", cursive';
export const BODY_FONT = '"Rubik", system-ui, sans-serif';

// ------------------------------------------------------------------ floors

export function floorTexture(env: EnvId): THREE.CanvasTexture {
  return cached(`floor:${env}`, () => {
    const def = ENVIRONMENTS[env].floor;
    const size = 256;
    const [c, g] = makeCanvas(size, size);
    const rng = new Rng(`floor-${env}`);
    g.fillStyle = def.a;
    g.fillRect(0, 0, size, size);
    switch (def.pattern) {
      case 'checker': {
        const n = 4;
        const s = size / n;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            g.fillStyle = (x + y) % 2 ? def.b : def.a;
            g.fillRect(x * s, y * s, s, s);
          }
        break;
      }
      case 'terrazzo': {
        for (let i = 0; i < 900; i++) {
          g.fillStyle = rng.pick([def.b, def.grout, '#ffffff', '#f4b6c2', '#9fd8ff']);
          g.globalAlpha = 0.5 + rng.next() * 0.5;
          const r = 1 + rng.next() * 3;
          g.beginPath();
          g.arc(rng.next() * size, rng.next() * size, r, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        break;
      }
      case 'concrete': {
        for (let i = 0; i < 2400; i++) {
          g.fillStyle = rng.chance(0.5) ? def.b : def.grout;
          g.globalAlpha = 0.15 + rng.next() * 0.25;
          g.fillRect(rng.next() * size, rng.next() * size, 2, 2);
        }
        g.globalAlpha = 1;
        g.fillStyle = '#ffcc00';
        g.fillRect(0, 0, 10, size);
        g.fillRect(size - 10, 0, 10, size);
        break;
      }
      case 'parquet': {
        const w = size / 8;
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            g.fillStyle = (x + y) % 2 ? def.b : def.a;
            g.fillRect(x * w, y * w, w, w);
          }
        break;
      }
      default: {
        const n = 2;
        const s = size / n;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            g.fillStyle = (x + y) % 2 ? def.b : def.a;
            g.fillRect(x * s, y * s, s, s);
          }
      }
    }
    if (def.pattern !== 'concrete' && def.pattern !== 'terrazzo') {
      g.strokeStyle = def.grout;
      g.lineWidth = 3;
      const lines = def.pattern === 'parquet' ? 8 : def.pattern === 'checker' ? 4 : 2;
      for (let i = 0; i <= lines; i++) {
        const p = (i / lines) * size;
        g.beginPath();
        g.moveTo(p, 0);
        g.lineTo(p, size);
        g.moveTo(0, p);
        g.lineTo(size, p);
        g.stroke();
      }
    }
    // Soft specular sheen streak for a glossy, polished floor read.
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0.06)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return toTexture(c, { repeat: true, aniso: 8 });
  });
}

// ------------------------------------------------------------------ signs atlas

export const SIGN_ATLAS_COLS = 4;
export const SIGN_ATLAS_ROWS = 16;

export interface SignSlot {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

let signSlots: Record<EnvId, SignSlot[]> | null = null;

/** One atlas holding every store sign, so a whole street of signs is one material. */
export function signAtlas(): { texture: THREE.CanvasTexture; slots: Record<EnvId, SignSlot[]> } {
  const texture = cached('signAtlas', () => {
    const W = 1024;
    const H = 1024;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = '#111';
    g.fillRect(0, 0, W, H);
    const cw = W / SIGN_ATLAS_COLS;
    const ch = H / SIGN_ATLAS_ROWS;
    const slots = {} as Record<EnvId, SignSlot[]>;
    let index = 0;
    for (const env of ENV_IDS) {
      const def = ENVIRONMENTS[env];
      slots[env] = [];
      def.storeNames.forEach((name, i) => {
        const col = index % SIGN_ATLAS_COLS;
        const row = Math.floor(index / SIGN_ATLAS_COLS);
        index++;
        const x = col * cw;
        const y = row * ch;
        const color = def.neon[i % def.neon.length]!;
        const bg = env === 'maintenance' ? '#2b3036' : env === 'deptstore' ? '#2a1f19' : '#15102b';
        g.fillStyle = bg;
        g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        g.strokeStyle = color;
        g.lineWidth = 3;
        g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
        let size = 30;
        g.font = `${size}px ${DISPLAY_FONT}`;
        while (g.measureText(name).width > cw - 26 && size > 12) {
          size -= 1;
          g.font = `${size}px ${DISPLAY_FONT}`;
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = color;
        g.shadowBlur = 12;
        g.fillStyle = color;
        g.fillText(name, x + cw / 2, y + ch / 2 + 2);
        g.shadowBlur = 0;
        g.fillStyle = '#ffffff';
        g.globalAlpha = 0.55;
        g.fillText(name, x + cw / 2, y + ch / 2 + 2);
        g.globalAlpha = 1;
        slots[env].push({ u0: (x + 2) / W, v0: 1 - (y + ch - 2) / H, u1: (x + cw - 2) / W, v1: 1 - (y + 2) / H });
      });
    }
    signSlots = slots;
    return toTexture(c, { aniso: 8 });
  });
  return { texture, slots: signSlots! };
}

/** Large single-use sign (junction gantries, facades). */
export function bannerTexture(text: string, color: string, bg = '#15102b', sub?: string): THREE.CanvasTexture {
  return cached(`banner:${text}:${color}:${bg}:${sub ?? ''}`, () => {
    const [c, g] = makeCanvas(512, 160);
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = color;
    g.lineWidth = 8;
    g.strokeRect(8, 8, 496, 144);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 54;
    g.font = `${size}px ${DISPLAY_FONT}`;
    while (g.measureText(text).width > 460 && size > 16) {
      size -= 2;
      g.font = `${size}px ${DISPLAY_FONT}`;
    }
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillStyle = color;
    g.fillText(text, 256, sub ? 64 : 82);
    g.shadowBlur = 0;
    if (sub) {
      g.font = `22px ${BODY_FONT}`;
      g.fillStyle = '#ffffff';
      g.fillText(sub, 256, 118);
    }
    return toTexture(c);
  });
}

// ------------------------------------------------------------------ patterns

export function patternTexture(kind: string, a: string, b: string, accent?: string): THREE.CanvasTexture {
  return cached(`pattern:${kind}:${a}:${b}:${accent ?? ''}`, () => {
    const size = 128;
    const [c, g] = makeCanvas(size, size);
    g.fillStyle = a;
    g.fillRect(0, 0, size, size);
    const rng = new Rng(`pattern-${kind}-${a}`);
    switch (kind) {
      case 'stripes':
        g.fillStyle = b;
        for (let y = 0; y < size; y += 32) g.fillRect(0, y, size, 14);
        break;
      case 'plaid':
        g.globalAlpha = 0.55;
        g.fillStyle = b;
        for (let i = 0; i < size; i += 42) {
          g.fillRect(i, 0, 18, size);
          g.fillRect(0, i, size, 18);
        }
        g.globalAlpha = 0.7;
        g.fillStyle = accent ?? '#ffffff';
        for (let i = 9; i < size; i += 42) {
          g.fillRect(i + 24, 0, 3, size);
          g.fillRect(0, i + 24, size, 3);
        }
        g.globalAlpha = 1;
        break;
      case 'checker': {
        const s = size / 8;
        g.fillStyle = b;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * s, y * s, s, s);
        break;
      }
      case 'denim':
        for (let i = 0; i < 1400; i++) {
          g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
          g.fillRect(rng.next() * size, rng.next() * size, 1 + rng.next() * 3, 1);
        }
        break;
      case 'camo':
        for (let i = 0; i < 30; i++) {
          g.fillStyle = rng.pick([b, accent ?? '#333', '#556b2f']);
          g.beginPath();
          g.ellipse(rng.next() * size, rng.next() * size, 6 + rng.next() * 16, 4 + rng.next() * 10, rng.next() * 3, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'holo': {
        const grad = g.createLinearGradient(0, 0, size, size);
        ['#b8f3ff', '#ff9be8', '#fff4a8', '#a8ffcf', '#b8f3ff'].forEach((col, i, arr) => grad.addColorStop(i / (arr.length - 1), col));
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        break;
      }
    }
    return toTexture(c, { repeat: true });
  });
}

/** Chest print / patch graphics drawn onto a square. */
export function printTexture(kind: string, base: string, accent: string): THREE.CanvasTexture {
  return cached(`print:${kind}:${base}:${accent}`, () => {
    const size = 128;
    const [c, g] = makeCanvas(size, size);
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    g.save();
    g.translate(size / 2, size / 2);
    switch (kind) {
      case 'rat-logo':
        drawRatFace(g, 0, 4, 30, accent);
        break;
      case 'pizza':
        g.fillStyle = '#ffcf5a';
        g.beginPath();
        g.moveTo(0, 40);
        g.lineTo(-32, -26);
        g.quadraticCurveTo(0, -40, 32, -26);
        g.closePath();
        g.fill();
        g.fillStyle = '#d9472b';
        for (const [x, y] of [
          [-10, -12],
          [10, -8],
          [0, 10],
        ])
          g.beginPath(), g.arc(x!, y!, 6, 0, Math.PI * 2), g.fill();
        g.strokeStyle = accent;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(0, 0, 50, 0, Math.PI * 2);
        g.stroke();
        break;
      case 'smiley-star':
        g.fillStyle = accent;
        star(g, 0, 0, 40, 18, 5);
        g.fillStyle = '#1d1d22';
        g.beginPath();
        g.arc(-9, -4, 4, 0, Math.PI * 2);
        g.arc(9, -4, 4, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#1d1d22';
        g.beginPath();
        g.arc(0, 4, 10, 0.2, Math.PI - 0.2);
        g.stroke();
        break;
      case 'letter-m':
        g.fillStyle = accent;
        g.font = `84px ${DISPLAY_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('M', 0, 6);
        break;
      case 'stickers':
      case 'patches': {
        const rng = new Rng(kind);
        for (let i = 0; i < 7; i++) {
          g.fillStyle = rng.pick(['#ff4f9a', '#ffd23f', '#29e3d4', '#a46bff', '#ffffff', '#7dff6a']);
          const x = (rng.next() - 0.5) * 90;
          const y = (rng.next() - 0.5) * 90;
          if (rng.chance(0.5)) star(g, x, y, 14, 6, 5);
          else {
            g.beginPath();
            g.arc(x, y, 9 + rng.next() * 6, 0, Math.PI * 2);
            g.fill();
          }
        }
        break;
      }
    }
    g.restore();
    return toTexture(c);
  });
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, n: number): void {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
}

/** The Mall Rats mascot: a round-eared rat face built from simple shapes. */
export function drawRatFace(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, eyes = '#1d1d22'): void {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x - r * 0.75, y - r * 0.7, r * 0.45, 0, Math.PI * 2);
  g.arc(x + r * 0.75, y - r * 0.7, r * 0.45, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(x, y, r * 0.85, r * 0.75, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - r * 0.35, y + r * 0.3);
  g.lineTo(x, y + r * 1.05);
  g.lineTo(x + r * 0.35, y + r * 0.3);
  g.fill();
  g.fillStyle = eyes;
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.05, r * 0.12, 0, Math.PI * 2);
  g.arc(x + r * 0.3, y - r * 0.05, r * 0.12, 0, Math.PI * 2);
  g.arc(x, y + r * 0.95, r * 0.12, 0, Math.PI * 2);
  g.fill();
}

// ------------------------------------------------------------------ faces

export function faceTexture(face: string): THREE.CanvasTexture {
  return cached(`face:${face}`, () => {
    const [c, g] = makeCanvas(128, 128);
    g.clearRect(0, 0, 128, 128);
    const ink = '#1d1414';
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineCap = 'round';
    const eye = (x: number, y: number, rx = 7, ry = 9) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x, y, rx + 2, ry + 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ink;
      g.beginPath();
      g.ellipse(x + 1, y + 1, rx * 0.6, ry * 0.65, 0, 0, Math.PI * 2);
      g.fill();
    };
    const brow = (x: number, y: number, tilt: number) => {
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x - 10, y + tilt);
      g.lineTo(x + 10, y - tilt);
      g.stroke();
    };
    switch (face) {
      case 'smirk':
        eye(42, 58);
        eye(86, 58);
        brow(42, 40, 2);
        brow(86, 38, -3);
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(48, 92);
        g.quadraticCurveTo(70, 98, 86, 84);
        g.stroke();
        break;
      case 'chill':
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(32, 60);
        g.lineTo(52, 60);
        g.moveTo(76, 60);
        g.lineTo(96, 60);
        g.stroke();
        g.beginPath();
        g.moveTo(52, 92);
        g.quadraticCurveTo(64, 98, 78, 92);
        g.stroke();
        break;
      case 'determined':
        eye(42, 60, 6, 7);
        eye(86, 60, 6, 7);
        brow(42, 44, -4);
        brow(86, 44, 4);
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(50, 92);
        g.lineTo(80, 92);
        g.stroke();
        break;
      case 'surprised':
        eye(42, 56, 8, 11);
        eye(86, 56, 8, 11);
        brow(42, 34, 0);
        brow(86, 34, 0);
        g.beginPath();
        g.ellipse(64, 94, 8, 10, 0, 0, Math.PI * 2);
        g.fill();
        break;
      case 'wink':
        eye(42, 58);
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(76, 60);
        g.quadraticCurveTo(86, 52, 96, 60);
        g.stroke();
        g.beginPath();
        g.moveTo(46, 86);
        g.quadraticCurveTo(64, 102, 84, 86);
        g.stroke();
        break;
      default:
        eye(42, 58);
        eye(86, 58);
        brow(42, 40, 0);
        brow(86, 40, 0);
        g.fillStyle = ink;
        g.beginPath();
        g.moveTo(44, 84);
        g.quadraticCurveTo(64, 108, 84, 84);
        g.closePath();
        g.fill();
        g.fillStyle = '#ffffff';
        g.fillRect(52, 84, 24, 5);
    }
    // cheeks
    g.fillStyle = 'rgba(255,90,110,0.25)';
    g.beginPath();
    g.arc(28, 80, 8, 0, Math.PI * 2);
    g.arc(100, 80, 8, 0, Math.PI * 2);
    g.fill();
    return toTexture(c);
  });
}

// ------------------------------------------------------------------ boards

export function boardGraphic(graphic: string, primary: string): THREE.CanvasTexture {
  return cached(`board:${graphic}:${primary}`, () => {
    const W = 512;
    const H = 144;
    const [c, g] = makeCanvas(W, H);
    const rng = new Rng(`board-${graphic}`);
    g.fillStyle = primary;
    g.fillRect(0, 0, W, H);
    switch (graphic) {
      case 'shop': {
        g.fillStyle = '#1d1d22';
        g.fillRect(0, H / 2 - 22, W, 44);
        drawRatFace(g, 96, H / 2, 34, '#f4f1e8');
        g.font = `40px ${DISPLAY_FONT}`;
        g.fillStyle = '#f4f1e8';
        g.textBaseline = 'middle';
        g.fillText('MALL RATS', 160, H / 2 + 2);
        break;
      }
      case 'maple': {
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(120,70,30,${0.08 + rng.next() * 0.12})`;
          g.lineWidth = 1 + rng.next() * 3;
          g.beginPath();
          const y = rng.next() * H;
          g.moveTo(0, y);
          for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 6);
          g.stroke();
        }
        g.font = `28px ${MARKER_FONT}`;
        g.fillStyle = 'rgba(80,45,20,0.6)';
        g.fillText('board room', W - 190, H - 24);
        break;
      }
      case 'graffiti': {
        for (let i = 0; i < 26; i++) {
          g.strokeStyle = rng.pick(['#ff4f9a', '#ffd23f', '#1d1d22', '#a46bff', '#f4f1e8']);
          g.lineWidth = 6 + rng.next() * 10;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(rng.next() * W, rng.next() * H);
          g.bezierCurveTo(rng.next() * W, rng.next() * H, rng.next() * W, rng.next() * H, rng.next() * W, rng.next() * H);
          g.stroke();
        }
        g.font = `70px ${MARKER_FONT}`;
        g.fillStyle = '#1d1d22';
        g.fillText('RAD!', 150, 100);
        g.fillStyle = '#ffd23f';
        g.fillText('RAD!', 144, 94);
        break;
      }
      case 'checker': {
        const s = 24;
        g.fillStyle = '#f4f1e8';
        for (let y = 0; y < Math.ceil(H / s); y++)
          for (let x = 0; x < Math.ceil(W / s); x++) if ((x + y) % 2) g.fillRect(x * s, y * s, s, s);
        break;
      }
      case 'foodcourt': {
        const icons = ['pizza', 'fries', 'malt'];
        for (let i = 0; i < 9; i++) {
          const x = 40 + i * 56;
          const y = H / 2 + (i % 2 ? -22 : 22);
          const kind = icons[i % 3];
          if (kind === 'pizza') {
            g.fillStyle = '#ffcf5a';
            g.beginPath();
            g.moveTo(x, y + 22);
            g.lineTo(x - 18, y - 16);
            g.lineTo(x + 18, y - 16);
            g.fill();
            g.fillStyle = '#d9472b';
            g.beginPath();
            g.arc(x, y - 4, 4, 0, Math.PI * 2);
            g.fill();
          } else if (kind === 'fries') {
            g.fillStyle = '#e84a5f';
            g.fillRect(x - 14, y - 2, 28, 24);
            g.fillStyle = '#ffd23f';
            for (let f = -10; f <= 10; f += 5) g.fillRect(x + f - 2, y - 20, 4, 20);
          } else {
            g.fillStyle = '#f4f1e8';
            g.fillRect(x - 12, y - 14, 24, 32);
            g.fillStyle = '#ff8fc8';
            g.beginPath();
            g.arc(x, y - 14, 14, Math.PI, 0);
            g.fill();
            g.fillStyle = '#e84a5f';
            g.beginPath();
            g.arc(x, y - 30, 5, 0, Math.PI * 2);
            g.fill();
          }
        }
        break;
      }
      case 'flame': {
        g.fillStyle = '#1d1d22';
        g.fillRect(0, 0, W, H);
        for (let layer = 0; layer < 3; layer++) {
          g.fillStyle = ['#ff3d1f', '#ff9f1c', '#ffe066'][layer]!;
          g.beginPath();
          g.moveTo(0, 0);
          for (let y = 0; y <= H; y += 12) {
            const x = 300 - layer * 70 + Math.sin(y / 9 + layer) * 30 + rng.next() * 30;
            g.lineTo(x, y);
            g.lineTo(x - 50 - rng.next() * 40, y + 6);
          }
          g.lineTo(0, H);
          g.closePath();
          g.fill();
        }
        break;
      }
      case 'cassette': {
        g.fillStyle = '#1d1d22';
        g.fillRect(60, 20, W - 120, H - 40);
        g.fillStyle = '#ff4f9a';
        g.fillRect(80, 34, W - 160, 40);
        g.fillStyle = '#f4f1e8';
        g.beginPath();
        g.arc(190, 98, 18, 0, Math.PI * 2);
        g.arc(W - 190, 98, 18, 0, Math.PI * 2);
        g.fill();
        g.font = `24px ${MARKER_FONT}`;
        g.fillStyle = '#1d1d22';
        g.fillText('MALL MIX VOL. 1', 110, 62);
        break;
      }
      case 'bubblegum': {
        g.fillStyle = '#ff5fa8';
        for (let x = 0; x < W; x += 34) {
          const len = 30 + rng.next() * 70;
          g.fillRect(x, 0, 26, len);
          g.beginPath();
          g.arc(x + 13, len, 13, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.arc(W - 120, H - 50, 34, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'synth': {
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#2b1055');
        grad.addColorStop(0.55, '#ff4f9a');
        grad.addColorStop(1, '#ffd23f');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.arc(W / 2, H * 0.55, 46, Math.PI, 0);
        g.fill();
        g.strokeStyle = '#29e3d4';
        g.lineWidth = 2;
        for (let y = H * 0.6; y < H; y += 10) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(W, y);
          g.stroke();
        }
        for (let x = -W; x < W * 2; x += 40) {
          g.beginPath();
          g.moveTo(W / 2, H * 0.6);
          g.lineTo(x, H);
          g.stroke();
        }
        break;
      }
      case 'security': {
        g.fillStyle = '#ffd23f';
        star(g, 90, H / 2, 46, 30, 6);
        g.fillStyle = '#23366b';
        g.font = `22px ${DISPLAY_FONT}`;
        g.textAlign = 'center';
        g.fillText('MP', 90, H / 2 + 8);
        g.textAlign = 'left';
        g.fillStyle = '#f4f1e8';
        g.font = `26px ${DISPLAY_FONT}`;
        g.fillText('PLEASE WALK', 170, 58);
        g.fillText('YOUR BOARD', 170, 96);
        g.strokeStyle = '#e84a5f';
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(160, 112);
        g.lineTo(470, 30);
        g.stroke();
        break;
      }
      case 'galaxy': {
        const grad = g.createRadialGradient(W * 0.6, H * 0.5, 4, W * 0.6, H * 0.5, W * 0.6);
        grad.addColorStop(0, '#a46bff');
        grad.addColorStop(0.4, '#3b1d8f');
        grad.addColorStop(1, '#0b0820');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 160; i++) {
          g.fillStyle = `rgba(255,255,255,${0.3 + rng.next() * 0.7})`;
          g.fillRect(rng.next() * W, rng.next() * H, 2, 2);
        }
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.arc(110, 60, 18, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#f4f1e8';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(110, 60, 32, 8, -0.3, 0, Math.PI * 2);
        g.stroke();
        break;
      }
      case 'holo': {
        const grad = g.createLinearGradient(0, 0, W, H);
        ['#b8f3ff', '#ff9be8', '#fff4a8', '#a8ffcf', '#b8f3ff', '#d6b8ff'].forEach((col, i, arr) => grad.addColorStop(i / (arr.length - 1), col));
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 0.35;
        for (let i = 0; i < 12; i++) {
          g.fillStyle = '#ffffff';
          g.save();
          g.translate(i * 48, 0);
          g.rotate(0.5);
          g.fillRect(0, -40, 10, H * 2);
          g.restore();
        }
        g.globalAlpha = 1;
        drawRatFace(g, W / 2, H / 2, 30, 'rgba(255,255,255,0.7)', 'rgba(60,40,90,0.8)');
        break;
      }
      case 'ratking': {
        g.fillStyle = '#0f0f1a';
        g.fillRect(0, 0, W, H);
        g.shadowColor = '#7dff6a';
        g.shadowBlur = 18;
        drawRatFace(g, W / 2, H / 2 + 10, 38, '#7dff6a', '#0f0f1a');
        g.fillStyle = '#ffd23f';
        g.shadowColor = '#ffd23f';
        g.beginPath();
        const cx = W / 2;
        g.moveTo(cx - 44, 30);
        g.lineTo(cx - 30, 4);
        g.lineTo(cx - 12, 24);
        g.lineTo(cx, 0);
        g.lineTo(cx + 12, 24);
        g.lineTo(cx + 30, 4);
        g.lineTo(cx + 44, 30);
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = '#ff4f9a';
        g.lineWidth = 4;
        g.strokeRect(14, 14, W - 28, H - 28);
        break;
      }
      case 'blackgold': {
        g.fillStyle = '#0d0d0d';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = '#ffcf3a';
        g.lineWidth = 3;
        for (let i = 1; i < 4; i++) {
          g.strokeRect(i * 10, i * 10, W - i * 20, H - i * 20);
        }
        g.fillStyle = '#ffcf3a';
        g.font = `34px ${DISPLAY_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('MALL RATS', W / 2, H / 2 + 2);
        star(g, 70, H / 2, 16, 7, 5);
        star(g, W - 70, H / 2, 16, 7, 5);
        break;
      }
    }
    return toTexture(c, { aniso: 8 });
  });
}

const dataUrls = new Map<string, string>();

/** PNG data URL of a deck graphic, for catalogue cards. */
export function boardGraphicDataUrl(graphic: string, primary: string): string {
  const key = `${graphic}:${primary}`;
  let url = dataUrls.get(key);
  if (!url) {
    const canvas = boardGraphic(graphic, primary).image as HTMLCanvasElement;
    url = canvas.toDataURL('image/png');
    dataUrls.set(key, url);
  }
  return url;
}

export function gripTexture(color: string): THREE.CanvasTexture {
  return cached(`grip:${color}`, () => {
    const [c, g] = makeCanvas(128, 64);
    g.fillStyle = color;
    g.fillRect(0, 0, 128, 64);
    const rng = new Rng(`grip-${color}`);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)';
      g.fillRect(rng.next() * 128, rng.next() * 64, 1, 1);
    }
    return toTexture(c);
  });
}

// ------------------------------------------------------------------ misc

export function radialGlowTexture(color = '#ffffff'): THREE.CanvasTexture {
  return cached(`glow:${color}`, () => {
    const [c, g] = makeCanvas(128, 128);
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + '88');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return toTexture(c);
  });
}

export function shadowTexture(): THREE.CanvasTexture {
  return cached('blobShadow', () => {
    const [c, g] = makeCanvas(128, 128);
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return toTexture(c, { srgb: false });
  });
}

export function tokenTexture(): THREE.CanvasTexture {
  return cached('token', () => {
    const [c, g] = makeCanvas(128, 128);
    const grad = g.createRadialGradient(54, 50, 6, 64, 64, 64);
    grad.addColorStop(0, '#fff6b0');
    grad.addColorStop(0.6, '#ffc53d');
    grad.addColorStop(1, '#d48a00');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#a86400';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(64, 64, 48, 0, Math.PI * 2);
    g.stroke();
    drawRatFace(g, 64, 62, 26, '#a86400', '#fff6b0');
    return toTexture(c);
  });
}

export function bagStickerTexture(): THREE.CanvasTexture {
  return cached('bagSticker', () => {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#1d1d22';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffd23f';
    star(g, 64, 58, 44, 20, 5);
    g.fillStyle = '#1d1d22';
    g.font = `40px ${DISPLAY_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 64, 62);
    g.fillStyle = '#f4f1e8';
    g.font = `16px ${DISPLAY_FONT}`;
    g.fillText('MYSTERY', 64, 112);
    return toTexture(c);
  });
}

export function hazardTexture(a = '#e8293b', b = '#f4f1e8'): THREE.CanvasTexture {
  return cached(`hazard:${a}:${b}`, () => {
    const [c, g] = makeCanvas(128, 32);
    g.fillStyle = b;
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = a;
    for (let x = -32; x < 160; x += 32) {
      g.beginPath();
      g.moveTo(x, 32);
      g.lineTo(x + 16, 32);
      g.lineTo(x + 32, 0);
      g.lineTo(x + 16, 0);
      g.closePath();
      g.fill();
    }
    return toTexture(c, { repeat: true });
  });
}

export function stickerWallTexture(): THREE.CanvasTexture {
  return cached('stickerWall', () => {
    const W = 2048;
    const H = 1024;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = '#1b1838';
    g.fillRect(0, 0, W, H);
    // pegboard dots
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) g.fillRect(x, y, 3, 3);
    const rng = new Rng('sticker-wall');
    const words = ['SKATE THE MALL', 'NO LOITERING?', 'RAD', 'MALL RATS', 'GRIND', 'KICKFLIP', 'FOOD COURT', 'BOARD ROOM', 'SALE!!', 'STAY RAD'];
    for (let i = 0; i < 150; i++) {
      g.save();
      g.translate(rng.next() * W, rng.next() * H);
      g.rotate((rng.next() - 0.5) * 0.8);
      const col = rng.pick(['#ff4f9a', '#ffd23f', '#29e3d4', '#a46bff', '#7dff6a', '#f4f1e8', '#ff6b3d']);
      if (rng.chance(0.45)) {
        const word = rng.pick(words);
        g.font = `${18 + rng.int(0, 16)}px ${rng.chance(0.5) ? DISPLAY_FONT : MARKER_FONT}`;
        const w = g.measureText(word).width + 18;
        g.fillStyle = col;
        g.fillRect(-w / 2, -18, w, 34);
        g.fillStyle = '#1d1d22';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(word, 0, 0);
      } else if (rng.chance(0.5)) {
        g.fillStyle = col;
        star(g, 0, 0, 22, 10, 5);
      } else {
        g.fillStyle = col;
        g.beginPath();
        g.arc(0, 0, 22, 0, Math.PI * 2);
        g.fill();
        drawRatFace(g, 0, 0, 12, '#1d1d22', col);
      }
      g.restore();
    }
    return toTexture(c);
  });
}
