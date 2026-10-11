import * as THREE from 'three';
import { GAMEPLAY } from '../config/gameplay';
import type { ObstacleTypeId } from '../config/obstacles';
import { GeoBuilder, MATERIALS } from './geo';
import { bannerTexture, hazardTexture } from './textures';

/**
 * Obstacle visuals. Geometry is merged per (type, width, depth) and cached;
 * meshes are pooled. Local origin: centre of the footprint on the floor,
 * front face (the side the skater approaches) toward +Z.
 *
 * Major obstacles carry red/white hazard chevrons so a run-ending hit is
 * always readable; minor ones use friendly yellows; breakables look flimsy.
 */
export interface ObstacleVisual {
  group: THREE.Group;
  key: string;
}

const geoCache = new Map<string, { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null }>();
const pick = <T,>(arr: T[], i: number): T => arr[((Math.floor(i) % arr.length) + arr.length) % arr.length]!;
const hazardMat = new THREE.MeshBasicMaterial({ map: hazardTexture(), side: THREE.DoubleSide });
const hazardYellowMat = new THREE.MeshBasicMaterial({ map: hazardTexture('#1d1d22', '#ffd23f'), side: THREE.DoubleSide });

function buildGeometry(type: ObstacleTypeId, w: number, d: number) {
  const s = new GeoBuilder();
  const glow = new GeoBuilder();
  const glass = new GeoBuilder();
  const hz = d / 2;
  switch (type) {
    case 'wetFloor': {
      for (const sgn of [-1, 1]) s.box(0.62, 0.8, 0.03, 0, 0.4, sgn * 0.12, '#ffd23f', { rx: sgn * 0.26 });
      s.box(0.5, 0.06, 0.01, 0, 0.55, 0.235, '#e8293b', { rx: 0.26 });
      s.box(0.2, 0.2, 0.01, 0, 0.36, 0.205, '#1d1d22', { rx: 0.26 });
      break;
    }
    case 'ropeLine': {
      const half = w / 2 - 0.12;
      for (const x of [-half, half, ...(w > 3 ? [0] : [])]) {
        s.cyl(0.045, 0.045, 0.92, 8, x, 0.46, 0, '#d8dde3');
        s.cyl(0.16, 0.18, 0.05, 10, x, 0.025, 0, '#b9c0c8');
        s.sphere(0.07, x, 0.95, 0, '#e8c26b');
      }
      const span = w > 3 ? w / 2 - 0.12 : half * 2;
      const starts = w > 3 ? [-half, 0] : [-half];
      for (const x0 of starts) {
        for (let i = 0; i < 8; i++) {
          const t0 = i / 8;
          const x = x0 + span * (t0 + 0.0625);
          const y = 0.84 - Math.sin((t0 + 0.0625) * Math.PI) * 0.16;
          s.cyl(0.035, 0.035, span / 8 + 0.02, 6, x, y, 0, '#b3122e', { rz: Math.PI / 2 });
        }
      }
      break;
    }
    case 'bench': {
      s.box(w - 0.1, 0.08, 0.5, 0, 0.45, 0, '#b07a45');
      s.box(w - 0.1, 0.3, 0.06, 0, 0.62 - 0.15, -0.22, '#9a6a3a');
      for (const x of [-(w / 2 - 0.25), w / 2 - 0.25]) s.box(0.1, 0.45, 0.45, x, 0.225, 0, '#e8293b');
      break;
    }
    case 'mopBucket':
      s.cyl(0.32, 0.27, 0.42, 10, 0, 0.21, 0, '#ffd23f');
      s.box(0.5, 0.06, 0.2, 0, 0.45, 0, '#c99a00');
      s.cyl(0.02, 0.02, 1.3, 5, 0.1, 0.8, -0.05, '#9a6a3a', { rz: -0.3 });
      s.cyl(0.08, 0.12, 0.12, 6, -0.08, 0.36, -0.05, '#e9e4d8');
      break;
    case 'foodTable':
      s.cyl(0.62, 0.62, 0.05, 12, 0, 0.75, 0, '#f4f1e8');
      s.cyl(0.05, 0.05, 0.72, 6, 0, 0.37, 0, '#9aa3ad');
      s.cyl(0.3, 0.3, 0.04, 10, 0, 0.02, 0, '#9aa3ad');
      for (const x of [-0.62, 0.62]) {
        s.box(0.34, 0.05, 0.34, x, 0.45, 0, '#ff6b3d');
        s.box(0.34, 0.3, 0.05, x, 0.62, x < 0 ? 0.15 : -0.15, '#ff6b3d', { ry: Math.PI / 2 });
        s.box(0.04, 0.45, 0.04, x, 0.225, 0, '#9aa3ad');
      }
      s.box(0.22, 0.04, 0.16, 0.1, 0.79, 0.05, '#e84a5f');
      s.cyl(0.05, 0.04, 0.12, 6, -0.18, 0.84, -0.1, '#29e3d4');
      break;
    case 'trashCan':
      s.cyl(0.33, 0.3, 0.88, 10, 0, 0.44, 0, '#2f6b4f');
      s.cyl(0.36, 0.36, 0.08, 10, 0, 0.92, 0, '#245a41');
      s.box(0.3, 0.06, 0.02, 0, 0.6, 0.31, '#f4f1e8');
      break;
    case 'bannerLow': {
      const y0 = 1.12;
      s.cyl(0.03, 0.03, w, 6, 0, y0 + 0.02, 0, '#d8dde3', { rz: Math.PI / 2 });
      s.box(w - 0.1, 1.2, 0.03, 0, y0 + 0.65, 0, '#ff4f9a');
      s.box(w - 0.1, 0.1, 0.035, 0, y0 + 0.06, 0, '#ffd23f');
      for (const x of [-(w / 2 - 0.2), w / 2 - 0.2]) s.cyl(0.01, 0.01, 4, 4, x, y0 + 3.2, 0, '#9aa3ad');
      break;
    }
    case 'shutterHalf': {
      const y0 = 1.15;
      const h = 3.6;
      for (let i = 0; i < 18; i++) s.box(w - 0.1, h / 18 - 0.015, 0.06, 0, y0 + h - (i + 0.5) * (h / 18), 0, i % 2 ? '#8e98a3' : '#a6b0ba');
      for (const x of [-(w / 2), w / 2]) s.box(0.12, 5.2, 0.16, x, 2.6, 0, '#4a5060');
      s.box(w - 0.06, 0.12, 0.09, 0, y0 + 0.06, 0, '#30353d');
      break;
    }
    case 'pipeLow': {
      const y = 1.4;
      s.cyl(0.25, 0.25, w + 0.4, 10, 0, y, 0, '#7f8a96', { rz: Math.PI / 2 });
      for (const x of [-(w / 2) + 0.3, 0, w / 2 - 0.3]) {
        s.cyl(0.27, 0.27, 0.14, 10, x, y, 0, '#ffd23f', { rz: Math.PI / 2 });
        s.box(0.06, 3.5, 0.06, x, y + 1.9, 0, '#4a5258');
      }
      break;
    }
    case 'kiosk': {
      s.box(w, 1.05, d, 0, 0.525, 0, '#2a2350');
      s.box(w + 0.08, 0.08, d + 0.08, 0, 1.07, 0, '#f4f1e8');
      glass.box(w - 0.15, 0.95, d - 0.3, 0, 1.6, 0, '#9fe8ff');
      for (const z of [-hz + 0.1, hz - 0.1]) for (const x of [-(w / 2) + 0.08, w / 2 - 0.08]) s.box(0.08, 1.1, 0.08, x, 1.6, z, '#f4f1e8');
      s.box(w + 0.3, 0.2, d + 0.3, 0, 2.2, 0, '#ff4f9a');
      s.box(w + 0.1, 0.4, d + 0.1, 0, 2.5, 0, '#29e3d4');
      glow.box(w + 0.32, 0.05, d + 0.32, 0, 2.31, 0, '#ffd23f');
      for (let z = -hz + 0.6, i = 0; z < hz - 0.4; z += 1.1, i++) s.box(0.25, 0.22, 0.25, w * 0.2, 1.25, z, pick(['#ffd23f', '#7dff6a', '#a46bff'], i));
      break;
    }
    case 'planter': {
      s.box(w, 0.9, d, 0, 0.45, 0, '#c6b8a2');
      s.box(w + 0.1, 0.08, d + 0.1, 0, 0.92, 0, '#a99a84');
      for (let i = 0; i < 5; i++) {
        const z = -hz + 0.3 + (i * (d - 0.6)) / 4;
        s.sphere(0.45 + (i % 2) * 0.1, (i % 2 ? -0.2 : 0.25) * (w / 1.7), 1.35 + (i % 3) * 0.12, z, i % 2 ? '#3f9e4d' : '#2f7d3c');
      }
      s.cone(0.18, 0.9, 6, 0, 1.6, 0, '#4fb85c');
      break;
    }
    case 'cleaningCart':
      s.box(w * 0.75, 0.9, d * 0.8, 0, 0.55, 0, '#ffd23f');
      s.box(w * 0.7, 0.05, d * 0.7, 0, 1.02, 0, '#c99a00');
      s.box(w * 0.5, 0.5, d * 0.4, 0, 1.3, -0.1, '#3d8bff');
      for (const x of [-0.25, 0.1, 0.35]) s.cyl(0.02, 0.02, 1.9, 4, x, 1.05, -hz * 0.5, '#9a6a3a', { rz: x * 0.2 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.cyl(0.08, 0.08, 0.06, 8, sx * w * 0.3, 0.08, sz * d * 0.3, '#1d1d22', { rz: Math.PI / 2 });
      s.box(0.6, 0.6, 0.6, -0.2, 1.65, 0.1, '#2f6b4f');
      break;
    case 'vending':
      s.box(w, 2.3, d, 0, 1.15, 0, '#e8293b');
      glow.box(w * 0.62, 1.5, 0.02, -w * 0.12, 1.3, hz + 0.01, '#bff7ff');
      s.box(w * 0.22, 0.6, 0.03, w * 0.32, 1.4, hz + 0.01, '#1d1d22');
      s.box(w * 0.6, 0.2, 0.03, -w * 0.1, 0.3, hz + 0.01, '#1d1d22');
      break;
    case 'foodCounter': {
      s.box(w, 1.1, d, 0, 0.55, 0, '#5a2340');
      s.box(w + 0.06, 0.06, d + 0.06, 0, 1.13, 0, '#ffd23f');
      glass.box(w * 0.85, 0.45, d - 0.4, 0, 1.4, 0, '#d8f7ff');
      s.box(w * 0.3, 0.9, 0.08, 0, 1.6, hz - 0.1, '#ff6b3d');
      s.box(w + 0.4, 0.15, d + 0.2, 0, 2.05, 0, '#ffd23f');
      for (let z = -hz + 0.5, i = 0; z < hz - 0.3; z += 0.9, i++) s.cyl(0.12, 0.1, 0.18, 8, 0, 1.25, z, pick(['#ff9f1c', '#7dff6a', '#ff4f9a', '#f4f1e8'], i));
      break;
    }
    case 'crateStack': {
      const c = '#b4824e';
      s.box(w * 0.9, 1.0, d * 0.9, 0, 0.5, 0, c);
      s.box(w * 0.8, 0.9, d * 0.8, 0.05, 1.45, -0.05, '#a87642');
      s.box(w * 0.55, 0.45, d * 0.6, -0.15, 2.1, 0.05, c);
      for (const y of [0.25, 0.75, 1.2, 1.7]) s.box(w * 0.92, 0.05, d * 0.92, 0, y, 0, '#6e4a26');
      break;
    }
    case 'fountain': {
      s.box(w, 0.6, d, 0, 0.3, 0, '#d9e2ec');
      s.box(w + 0.12, 0.08, d + 0.12, 0, 0.62, 0, '#b8c6d4');
      glow.box(w - 0.2, 0.04, d - 0.2, 0, 0.56, 0, '#6fd8ff');
      for (let z = -hz + 1.2; z < hz - 0.8; z += 2.2) {
        s.cyl(0.18, 0.25, 1.6, 8, 0, 1.4, z, '#d9e2ec');
        s.cyl(0.5, 0.35, 0.12, 10, 0, 2.2, z, '#b8c6d4');
        glow.cone(0.22, 0.6, 8, 0, 2.55, z, '#bff3ff');
      }
      break;
    }
    case 'pillar':
      s.cyl(w / 2, w / 2, 8, 12, 0, 4, 0, '#e9e4d8');
      s.cyl(w / 2 + 0.06, w / 2 + 0.06, 0.3, 12, 0, 0.15, 0, '#b9a68f');
      glow.cyl(w / 2 + 0.02, w / 2 + 0.02, 0.06, 12, 0, 2.6, 0, '#29e3d4');
      break;
    case 'perfumeCounter':
      s.box(w, 0.95, d, 0, 0.475, 0, '#f4f1e8');
      glass.box(w - 0.1, 0.4, d - 0.1, 0, 1.15, 0, '#ffe6f2');
      s.box(w * 0.5, 0.7, d * 0.5, 0, 1.7, 0, '#e8c26b');
      for (let i = 0; i < 6; i++) s.cyl(0.05, 0.06, 0.18, 6, (i % 3) * 0.3 - 0.3, 1.1, (i < 3 ? -1 : 1) * d * 0.2, ['#ff8fb8', '#a46bff', '#29e3d4'][i % 3]!);
      break;
    case 'standee':
      s.box(0.9, 1.9, 0.04, 0, 0.95, 0, '#d9b47a');
      s.box(0.55, 0.7, 0.05, 0, 1.15, 0.005, '#ff4f9a');
      s.box(0.3, 0.32, 0.05, 0, 1.68, 0.005, '#eac09e');
      s.box(0.36, 0.12, 0.05, 0, 1.86, 0.005, '#a46bff');
      s.box(0.5, 0.65, 0.05, 0, 0.45, 0.005, '#3d5a8a');
      s.box(0.4, 0.04, 0.4, 0, 0.02, -0.15, '#9a6a3a');
      break;
    case 'displayRack': {
      for (const x of [-(w / 2) + 0.1, w / 2 - 0.1]) s.cyl(0.025, 0.025, 1.6, 5, x, 0.8, 0, '#d8dde3');
      s.cyl(0.025, 0.025, w - 0.1, 5, 0, 1.58, 0, '#d8dde3', { rz: Math.PI / 2 });
      const colors = ['#ff4f9a', '#29e3d4', '#ffd23f', '#a46bff', '#7dff6a', '#ff6b3d', '#f4f1e8'];
      const n = Math.max(4, Math.floor(w / 0.2));
      for (let i = 0; i < n; i++) s.box(0.06, 0.62, 0.42, -(w / 2) + 0.25 + (i * (w - 0.5)) / (n - 1), 1.22, 0, colors[i % colors.length]!);
      s.box(w, 0.04, 0.4, 0, 0.1, 0, '#9aa3ad');
      break;
    }
    case 'mannequin':
      s.cyl(0.2, 0.22, 0.04, 10, 0, 0.02, 0, '#d8dde3');
      s.cyl(0.02, 0.02, 0.5, 5, 0, 0.27, 0, '#d8dde3');
      s.cyl(0.13, 0.09, 0.5, 8, 0, 0.75, 0, '#3d8bff');
      s.cyl(0.19, 0.15, 0.55, 8, 0, 1.27, 0, '#ff4f9a');
      s.sphere(0.13, 0, 1.75, 0, '#f4f1e8');
      for (const x of [-0.24, 0.24]) s.cyl(0.04, 0.035, 0.55, 6, x, 1.25, 0, '#f4f1e8', { rz: x * 0.6 });
      s.box(0.32, 0.12, 0.3, 0, 1.88, 0, '#ffd23f');
      break;
    case 'boxStack':
      s.box(w * 0.55, 0.55, d * 0.8, -0.25, 0.275, 0, '#c9a06a');
      s.box(w * 0.45, 0.5, d * 0.7, 0.32, 0.25, 0.05, '#bf955f');
      s.box(w * 0.5, 0.5, d * 0.7, 0.02, 0.8, 0, '#d1aa75');
      s.box(w * 0.35, 0.3, d * 0.5, -0.05, 1.2, -0.05, '#c9a06a');
      s.box(w * 0.56, 0.05, d * 0.81, -0.25, 0.4, 0, '#8a6a3a');
      break;
  }
  return { solid: s.build(), glow: glow.empty ? null : glow.build(), glass: glass.empty ? null : glass.build() };
}

const MAJOR_DECALS: Partial<Record<ObstacleTypeId, { y: number; h: number; mat: THREE.Material }>> = {
  bench: { y: 0.32, h: 0.18, mat: hazardMat },
  kiosk: { y: 0.5, h: 0.32, mat: hazardMat },
  planter: { y: 0.5, h: 0.3, mat: hazardMat },
  cleaningCart: { y: 0.55, h: 0.25, mat: hazardMat },
  vending: { y: 0.05, h: 0.0, mat: hazardMat },
  foodCounter: { y: 0.5, h: 0.32, mat: hazardMat },
  crateStack: { y: 0.5, h: 0.3, mat: hazardMat },
  fountain: { y: 0.3, h: 0.24, mat: hazardMat },
  pillar: { y: 0.65, h: 0.4, mat: hazardMat },
  perfumeCounter: { y: 0.5, h: 0.3, mat: hazardMat },
  shutterHalf: { y: 1.2, h: 0.14, mat: hazardMat },
  pipeLow: { y: 1.12, h: 0.1, mat: hazardYellowMat },
};

export function obstacleKey(type: ObstacleTypeId, width: number, depth: number): string {
  return `${type}|${width.toFixed(2)}|${depth.toFixed(2)}`;
}

export function createObstacleVisual(type: ObstacleTypeId, width: number, depth: number): ObstacleVisual {
  const key = obstacleKey(type, width, depth);
  let geo = geoCache.get(key);
  if (!geo) {
    geo = buildGeometry(type, width, depth);
    geoCache.set(key, geo);
  }
  const group = new THREE.Group();
  const solid = new THREE.Mesh(geo.solid, MATERIALS.vc);
  solid.castShadow = false;
  group.add(solid);
  if (geo.glow) group.add(new THREE.Mesh(geo.glow, MATERIALS.vcGlow));
  if (geo.glass) group.add(new THREE.Mesh(geo.glass, MATERIALS.vcGlass));
  const decal = MAJOR_DECALS[type];
  if (decal && decal.h > 0) {
    const planeGeo = new THREE.PlaneGeometry(type === 'pillar' ? width * 1.02 : width + 0.02, decal.h);
    const uv = planeGeo.getAttribute('uv') as THREE.BufferAttribute;
    const repeats = Math.max(1, Math.round(width * 2));
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * repeats);
    const plane = new THREE.Mesh(planeGeo, decal.mat);
    plane.position.set(0, decal.y, depth / 2 + (type === 'pillar' ? width / 2 - depth / 2 + 0.01 : 0.02));
    group.add(plane);
  }
  if (type === 'bannerLow') {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(width - 0.2, 3.2), 0.9),
      new THREE.MeshBasicMaterial({ map: bannerTexture('SALE!', '#ffd23f', '#ff4f9a', 'everything must go'), transparent: false }),
    );
    label.position.set(0, 1.77, 0.02);
    group.add(label);
  }
  return { group, key };
}

/** Grind rail with a hazard-striped kicker ramp. Origin at the kicker start, rail runs toward -Z. */
const railGeoCache = new Map<string, { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry }>();

export function createRailVisual(length: number): THREE.Group {
  const key = length.toFixed(2);
  let geo = railGeoCache.get(key);
  if (!geo) {
    const s = new GeoBuilder();
    const g = new GeoBuilder();
    const kl = GAMEPLAY.kickerLength;
    const h = GAMEPLAY.railHeight;
    const slope = Math.atan2(h, kl);
    const plank = Math.hypot(kl, h);
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const t = (i + 0.5) / stripes;
      s.box(0.95, 0.06, plank / stripes, 0, t * h - 0.02, -t * kl, i % 2 ? '#1d1d22' : '#ffd23f', { rx: slope });
    }
    s.box(0.95, h, 0.06, 0, h / 2, -kl + 0.03, '#30353d');
    const railLen = length - kl;
    g.cyl(0.05, 0.05, railLen, 8, 0, h - 0.05, -kl - railLen / 2, '#29e3d4', { rx: Math.PI / 2 });
    for (let z = 0; z <= railLen; z += Math.max(2.5, railLen / Math.ceil(railLen / 3))) {
      s.box(0.07, h - 0.05, 0.07, 0, (h - 0.05) / 2, -kl - z, '#4a5060');
      s.box(0.3, 0.03, 0.3, 0, 0.015, -kl - z, '#30353d');
    }
    s.box(0.07, h - 0.05, 0.07, 0, (h - 0.05) / 2, -length + 0.05, '#4a5060');
    geo = { solid: s.build(), glow: g.build() };
    railGeoCache.set(key, geo);
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo.solid, MATERIALS.vc));
  group.add(new THREE.Mesh(geo.glow, MATERIALS.vcGlow));
  return group;
}
