import * as THREE from 'three';
import { ENVIRONMENTS, type EnvId } from '../config/environments';
import { laneX } from '../config/gameplay';
import { Rng } from '../engine/rng';
import { GeoBuilder, MATERIALS } from './geo';
import { bannerTexture, floorTexture, signAtlas } from './textures';

export const BAY_LENGTH = 8;

export const ENV_HALF_WIDTH: Record<EnvId, number> = {
  concourse: 8,
  foodcourt: 9.5,
  deptstore: 6.5,
  maintenance: 4.2,
  atrium: 11,
};

const floorMats = new Map<EnvId, THREE.MeshPhongMaterial>();
const floorGeos = new Map<EnvId, THREE.PlaneGeometry>();
let signMat: THREE.MeshBasicMaterial | null = null;

function floorMaterial(env: EnvId): THREE.MeshPhongMaterial {
  let m = floorMats.get(env);
  if (!m) {
    const shiny = env !== 'maintenance';
    m = new THREE.MeshPhongMaterial({
      map: floorTexture(env),
      shininess: shiny ? 70 : 8,
      specular: shiny ? new THREE.Color('#6a6a7a') : new THREE.Color('#111111'),
    });
    floorMats.set(env, m);
  }
  return m;
}

function floorGeometry(env: EnvId): THREE.PlaneGeometry {
  let g = floorGeos.get(env);
  if (!g) {
    const w = ENV_HALF_WIDTH[env] * 2;
    g = new THREE.PlaneGeometry(w, BAY_LENGTH);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -BAY_LENGTH / 2);
    const tile = 2;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
    floorGeos.set(env, g);
  }
  return g;
}

function signMaterial(): THREE.MeshBasicMaterial {
  if (!signMat) signMat = new THREE.MeshBasicMaterial({ map: signAtlas().texture });
  return signMat;
}

export interface Bay {
  env: EnvId;
  group: THREE.Group;
  signs: THREE.Mesh[];
  index: number;
}

interface SideDecorCtx {
  s: GeoBuilder;
  g: GeoBuilder;
  rng: Rng;
  sgn: number;
}

function decorBench(c: SideDecorCtx, x: number, z: number): void {
  c.s.box(1.6, 0.08, 0.5, x, 0.45, z, '#b07a45', { ry: Math.PI / 2 });
  c.s.box(0.1, 0.45, 0.45, x, 0.225, z - 0.65, '#30353d');
  c.s.box(0.1, 0.45, 0.45, x, 0.225, z + 0.65, '#30353d');
}

function decorTree(c: SideDecorCtx, x: number, z: number): void {
  c.s.cyl(0.55, 0.5, 0.7, 8, x, 0.35, z, '#c6b8a2');
  c.s.cyl(0.08, 0.1, 1.8, 6, x, 1.5, z, '#7a5230');
  c.s.sphere(0.8, x, 2.6, z, '#3f9e4d');
  c.s.sphere(0.55, x + 0.3, 3.1, z - 0.2, '#4fb85c');
}

function decorLamp(c: SideDecorCtx, x: number, z: number, color: string): void {
  c.s.cyl(0.06, 0.08, 3.2, 6, x, 1.6, z, '#30353d');
  c.g.sphere(0.22, x, 3.3, z, color);
}

function buildConcourse(rng: Rng, env: EnvId) {
  const def = ENVIRONMENTS[env];
  const W = ENV_HALF_WIDTH[env];
  const s = new GeoBuilder();
  const g = new GeoBuilder();
  const gl = new GeoBuilder();
  const signs: Array<{ x: number; y: number; z: number; ry: number; w: number; h: number }> = [];
  for (const sgn of [-1, 1]) {
    const xw = sgn * W;
    const neon = rng.pick(def.neon);
    s.box(0.3, 5, BAY_LENGTH, xw + sgn * 0.15, 2.5, -4, def.wall);
    gl.box(0.05, 2.7, 5.6, xw - sgn * 0.05, 1.65, -4, '#7fd3ff');
    s.box(0.12, 0.12, 5.8, xw - sgn * 0.08, 3.02, -4, def.trim);
    s.box(0.12, 0.3, 5.8, xw - sgn * 0.08, 0.15, -4, '#1d1d22');
    for (let i = 0; i < 3; i++) {
      s.box(0.5, 0.6 + rng.next() * 0.9, 0.6, xw + sgn * 0.6, 0.6, -2 - i * 2, rng.pick(['#ff4f9a', '#ffd23f', '#29e3d4', '#a46bff', '#f4f1e8']));
    }
    g.box(0.06, 0.08, 5.4, xw - sgn * 0.1, 3.2, -4, neon);
    signs.push({ x: xw - sgn * 0.12, y: 3.8, z: -4, ry: -sgn * Math.PI / 2, w: 5, h: 1.15 });
    s.box(0.7, 8.6, 0.7, xw - sgn * 0.25, 4.3, -0.01, '#e9e4d8');
    s.box(0.74, 0.25, 0.74, xw - sgn * 0.25, 0.12, -0.01, def.trim);
    // Upper level balcony and shopfronts
    s.box(2.4, 0.35, BAY_LENGTH, xw - sgn * 1.2, 5.2, -4, '#d9cfc0');
    s.box(2.4, 0.08, BAY_LENGTH, xw - sgn * 1.2, 5.0, -4, def.trim);
    gl.box(0.04, 1.0, BAY_LENGTH, xw - sgn * 2.4, 5.9, -4, '#bfe9ff');
    s.box(0.08, 0.07, BAY_LENGTH, xw - sgn * 2.4, 6.42, -4, '#d8dde3');
    s.box(0.25, 3.4, BAY_LENGTH, xw + sgn * 0.12, 7.0, -4, '#1f1a3d');
    g.box(0.05, 0.12, 4, xw - sgn * 0.02, 7.6, -4, rng.pick(def.neon));
    // Floor-side decor
    const c: SideDecorCtx = { s, g, rng, sgn };
    const pickDecor = rng.next();
    const dx = sgn * (4.4 + rng.next() * 1.6);
    const dz = -2 - rng.next() * 4;
    if (pickDecor < 0.3) decorBench(c, dx, dz);
    else if (pickDecor < 0.55) decorTree(c, dx, dz);
    else if (pickDecor < 0.75) decorLamp(c, dx, dz, rng.pick(def.neon));
    else if (pickDecor < 0.85) s.cyl(0.3, 0.27, 0.9, 8, dx, 0.45, dz, '#2f6b4f');
  }
  s.box(W * 2, 0.3, BAY_LENGTH, 0, def.ceilingHeight + 0.15, -4, def.ceiling);
  g.box(4.2, 0.05, BAY_LENGTH - 0.8, 0, def.ceilingHeight - 0.02, -4, '#cdefff');
  s.box(W * 2, 0.35, 0.3, 0, def.ceilingHeight - 0.15, -0.15, '#3a3366');
  if (rng.chance(0.35)) {
    const x = rng.pick([-4.6, 4.6]);
    s.box(0.04, 2.2, 1.0, x, 6.4, -4, rng.pick(def.neon));
    s.cyl(0.02, 0.02, 1.1, 4, x, def.ceilingHeight - 0.6, -4, '#9aa3ad', { rz: Math.PI / 2 });
  }
  return { s, g, gl, signs };
}

function buildFoodcourt(rng: Rng) {
  const def = ENVIRONMENTS.foodcourt;
  const W = ENV_HALF_WIDTH.foodcourt;
  const s = new GeoBuilder();
  const g = new GeoBuilder();
  const gl = new GeoBuilder();
  const signs: Array<{ x: number; y: number; z: number; ry: number; w: number; h: number }> = [];
  for (const sgn of [-1, 1]) {
    const xw = sgn * W;
    const color = rng.pick(['#ff6b3d', '#29e3d4', '#ff4f9a', '#7dff6a', '#a46bff']);
    s.box(0.3, 6, BAY_LENGTH, xw + sgn * 0.15, 3, -4, def.wall);
    s.box(1.2, 1.1, 7, xw - sgn * 0.7, 0.55, -4, color);
    s.box(1.3, 0.08, 7.1, xw - sgn * 0.7, 1.12, -4, '#f4f1e8');
    gl.box(0.6, 0.45, 6.6, xw - sgn * 0.75, 1.4, -4, '#d8f7ff');
    g.box(0.06, 1.1, 5.6, xw - sgn * 0.18, 2.75, -4, '#fff2c4');
    for (let i = 0; i < 4; i++) s.box(1.7, 0.12, 1.8, xw - sgn * 0.95, 3.75 - (i % 2) * 0.02, -0.95 - i * 2, i % 2 ? '#f4f1e8' : color, { rz: sgn * 0.25 });
    signs.push({ x: xw - sgn * 0.12, y: 4.75, z: -4, ry: -sgn * Math.PI / 2, w: 5.2, h: 1.2 });
    s.box(0.7, 9, 0.7, xw - sgn * 0.3, 4.5, 0, '#f4e4c8');
    const tables = 1 + (rng.next() < 0.5 ? 1 : 0);
    for (let t = 0; t < tables; t++) {
      const x = sgn * (4.6 + rng.next() * 2.4);
      const z = -1.6 - t * 3.6 - rng.next() * 1.2;
      const uc = rng.pick(def.neon);
      s.cyl(0.55, 0.55, 0.05, 10, x, 0.75, z, '#f4f1e8');
      s.cyl(0.05, 0.05, 2.2, 5, x, 1.1, z, '#9aa3ad');
      s.cone(1.2, 0.6, 8, x, 2.3, z, uc);
      for (const dx of [-0.6, 0.6]) s.box(0.34, 0.45, 0.34, x + dx, 0.225, z, '#ff6b3d');
    }
  }
  s.box(W * 2, 0.3, BAY_LENGTH, 0, def.ceilingHeight + 0.15, -4, def.ceiling);
  for (const x of [-3.5, 0, 3.5]) {
    s.cyl(0.02, 0.02, 2.0, 4, x, def.ceilingHeight - 1, -4, '#9aa3ad');
    g.sphere(0.35, x, def.ceilingHeight - 2.1, -4, '#ffe8a8');
  }
  return { s, g, gl, signs };
}

function buildDeptstore(rng: Rng) {
  const def = ENVIRONMENTS.deptstore;
  const W = ENV_HALF_WIDTH.deptstore;
  const s = new GeoBuilder();
  const g = new GeoBuilder();
  const gl = new GeoBuilder();
  const signs: Array<{ x: number; y: number; z: number; ry: number; w: number; h: number }> = [];
  const clothes = ['#ff4f9a', '#29e3d4', '#ffd23f', '#a46bff', '#f4f1e8', '#3d5a8a', '#e84a5f', '#7dff6a'];
  for (const sgn of [-1, 1]) {
    const xw = sgn * W;
    s.box(0.3, def.ceilingHeight, BAY_LENGTH, xw + sgn * 0.15, def.ceilingHeight / 2, -4, '#efe6d8');
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = 0.6 + shelf * 1.0;
      s.box(0.6, 0.06, 7.4, xw - sgn * 0.3, y, -4, '#8a6a4a');
      for (let i = 0; i < 9; i++) s.box(0.45, 0.32, 0.6, xw - sgn * 0.32, y + 0.19, -0.6 - i * 0.8, rng.pick(clothes));
    }
    signs.push({ x: xw - sgn * 0.05, y: 4.4, z: -4, ry: -sgn * Math.PI / 2, w: 4.2, h: 0.9 });
    s.box(0.6, def.ceilingHeight, 0.6, xw - sgn * 0.6, def.ceilingHeight / 2, 0, '#f6efe3');
    s.box(0.64, 0.2, 0.64, xw - sgn * 0.6, def.ceilingHeight - 0.4, 0, def.trim);
    // Floor racks and mannequins beside the aisle
    const x = sgn * (3.7 + rng.next() * 1.2);
    if (rng.chance(0.6)) {
      s.cyl(0.02, 0.02, 1.6, 4, x, 0.8, -2, '#d8dde3');
      s.cyl(0.02, 0.02, 1.6, 4, x, 0.8, -4.5, '#d8dde3');
      s.cyl(0.02, 0.02, 2.5, 4, x, 1.58, -3.25, '#d8dde3', { rx: Math.PI / 2 });
      for (let i = 0; i < 9; i++) s.box(0.4, 0.6, 0.06, x, 1.22, -2.2 - i * 0.26, rng.pick(clothes));
    } else {
      s.cyl(0.18, 0.2, 0.04, 8, x, 0.02, -3, '#d8dde3');
      s.cyl(0.12, 0.08, 0.5, 8, x, 0.75, -3, rng.pick(clothes));
      s.cyl(0.18, 0.14, 0.55, 8, x, 1.27, -3, rng.pick(clothes));
      s.sphere(0.12, x, 1.72, -3, '#f4f1e8');
    }
  }
  s.box(W * 2, 0.3, BAY_LENGTH, 0, def.ceilingHeight + 0.15, -4, def.ceiling);
  for (const x of [-3, 0, 3]) for (const z of [-2, -6]) g.box(0.8, 0.04, 0.8, x, def.ceilingHeight - 0.02, z, '#fff3d6');
  return { s, g, gl, signs };
}

function buildMaintenance(rng: Rng) {
  const def = ENVIRONMENTS.maintenance;
  const W = ENV_HALF_WIDTH.maintenance;
  const s = new GeoBuilder();
  const g = new GeoBuilder();
  const gl = new GeoBuilder();
  const signs: Array<{ x: number; y: number; z: number; ry: number; w: number; h: number }> = [];
  for (const sgn of [-1, 1]) {
    const xw = sgn * W;
    s.box(0.3, def.ceilingHeight, BAY_LENGTH, xw + sgn * 0.15, def.ceilingHeight / 2, -4, def.wall);
    for (let i = 0; i < 8; i++) s.box(0.04, 0.32, 1.0, xw - sgn * 0.02, 0.16, -0.5 - i, i % 2 ? '#1d1d22' : '#ffcc00');
    if (rng.chance(0.4)) {
      s.box(0.08, 2.3, 1.2, xw - sgn * 0.05, 1.15, -4, '#5d6a74');
      signs.push({ x: xw - sgn * 0.1, y: 2.75, z: -4, ry: -sgn * Math.PI / 2, w: 1.8, h: 0.45 });
    }
    s.cyl(0.18, 0.18, BAY_LENGTH, 8, xw - sgn * 0.5, def.ceilingHeight - 0.5, -4, sgn < 0 ? '#b33a3a' : '#3a6db3', { rx: Math.PI / 2 });
    s.cyl(0.1, 0.1, BAY_LENGTH, 6, xw - sgn * 0.9, def.ceilingHeight - 0.3, -4, '#8a9299', { rx: Math.PI / 2 });
    if (rng.chance(0.5)) s.box(0.7, 0.7, 0.7, sgn * (W - 0.55), 0.35, -2 - rng.next() * 4, '#a87642');
    if (rng.chance(0.3)) s.cyl(0.08, 0.08, def.ceilingHeight, 6, xw - sgn * 0.4, def.ceilingHeight / 2, -6, '#8a9299');
  }
  s.box(W * 2, 0.3, BAY_LENGTH, 0, def.ceilingHeight + 0.15, -4, def.ceiling);
  for (const z of [-2, -6]) {
    g.box(0.5, 0.12, 0.3, 0, def.ceilingHeight - 0.08, z, '#fff6c8');
    s.box(0.56, 0.04, 0.36, 0, def.ceilingHeight - 0.16, z, '#30353d');
  }
  return { s, g, gl, signs };
}

function buildAtrium(rng: Rng) {
  const def = ENVIRONMENTS.atrium;
  const W = ENV_HALF_WIDTH.atrium;
  const s = new GeoBuilder();
  const g = new GeoBuilder();
  const gl = new GeoBuilder();
  const signs: Array<{ x: number; y: number; z: number; ry: number; w: number; h: number }> = [];
  for (const sgn of [-1, 1]) {
    const xw = sgn * W;
    s.box(0.3, def.ceilingHeight, BAY_LENGTH, xw + sgn * 0.15, def.ceilingHeight / 2, -4, def.wall);
    gl.box(0.05, 2.8, 6, xw - sgn * 0.05, 1.7, -4, '#9fe8ff');
    signs.push({ x: xw - sgn * 0.12, y: 3.8, z: -4, ry: -sgn * Math.PI / 2, w: 5, h: 1.15 });
    for (const level of [5, 10]) {
      s.box(3.2, 0.4, BAY_LENGTH, xw - sgn * 1.6, level, -4, '#e9eef5');
      s.box(3.2, 0.1, BAY_LENGTH, xw - sgn * 1.6, level - 0.25, -4, def.trim);
      gl.box(0.04, 1.0, BAY_LENGTH, xw - sgn * 3.2, level + 0.7, -4, '#bfe9ff');
      s.box(0.08, 0.07, BAY_LENGTH, xw - sgn * 3.2, level + 1.22, -4, '#d8dde3');
      g.box(0.04, 0.1, 5, xw - sgn * 0.05, level + 2.4, -4, rng.pick(def.neon));
    }
    s.box(0.8, def.ceilingHeight, 0.8, xw - sgn * 3.2, def.ceilingHeight / 2, 0, '#f4f7fb');
    const x = sgn * (5 + rng.next() * 2.5);
    if (rng.chance(0.55)) {
      s.cyl(0.9, 0.8, 0.8, 10, x, 0.4, -4, '#c6b8a2');
      s.cyl(0.12, 0.16, 4.2, 6, x, 2.9, -4, '#8a6a3a');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s.box(2.2, 0.06, 0.5, x + Math.cos(a) * 1.0, 4.9, -4 + Math.sin(a) * 1.0, '#3f9e4d', { ry: -a, rz: -0.35 });
      }
    } else decorBench({ s, g, rng, sgn }, x, -4);
  }
  for (let x = -6; x <= 6; x += 3) g.box(0.12, 0.05, BAY_LENGTH, x, def.ceilingHeight - 0.05, -4, '#e8f8ff');
  g.box(13, 0.05, 0.12, 0, def.ceilingHeight - 0.05, -4, '#e8f8ff');
  s.box(W * 2, 0.3, BAY_LENGTH, 0, def.ceilingHeight + 0.2, -4, '#7fb8e0');
  if (rng.chance(0.4)) {
    const bx = rng.pick([-3.6, 3.6]);
    s.box(0.05, 3.5, 1.4, bx, 11, -4, rng.pick(def.neon));
  }
  return { s, g, gl, signs };
}

const BUILDERS: Record<EnvId, (rng: Rng) => ReturnType<typeof buildConcourse>> = {
  concourse: (rng) => buildConcourse(rng, 'concourse'),
  foodcourt: buildFoodcourt,
  deptstore: buildDeptstore,
  maintenance: buildMaintenance,
  atrium: buildAtrium,
};

let bayCounter = 0;

export function createBay(env: EnvId): Bay {
  const rng = new Rng(`bay-${env}-${bayCounter++}`);
  const { s, g, gl, signs } = BUILDERS[env](rng);
  const group = new THREE.Group();
  const floor = new THREE.Mesh(floorGeometry(env), floorMaterial(env));
  floor.receiveShadow = true;
  group.add(floor);
  group.add(new THREE.Mesh(s.build(), MATERIALS.vc));
  if (!g.empty) group.add(new THREE.Mesh(g.build(), MATERIALS.vcGlow));
  if (!gl.empty) group.add(new THREE.Mesh(gl.build(), MATERIALS.vcGlass));
  const signMeshes: THREE.Mesh[] = [];
  for (const sp of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sp.w, sp.h), signMaterial());
    m.position.set(sp.x, sp.y, sp.z);
    m.rotation.y = sp.ry;
    group.add(m);
    signMeshes.push(m);
  }
  return { env, group, signs: signMeshes, index: -1 };
}

/** Point each sign of a bay at a store name from the atlas (deterministic per bay index). */
export function assignBaySigns(bay: Bay, index: number): void {
  const { slots } = signAtlas();
  const list = slots[bay.env];
  bay.signs.forEach((m, i) => {
    const slot = list[Math.abs(index * 7 + i * 3) % list.length]!;
    const uv = m.geometry.getAttribute('uv') as THREE.BufferAttribute;
    // PlaneGeometry UV order: (0,1) (1,1) (0,0) (1,0)
    uv.setXY(0, slot.u0, slot.v1);
    uv.setXY(1, slot.u1, slot.v1);
    uv.setXY(2, slot.u0, slot.v0);
    uv.setXY(3, slot.u1, slot.v0);
    uv.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ set pieces

export class JunctionFacade {
  readonly group = new THREE.Group();
  private doors: Array<{ pivotL: THREE.Group; pivotR: THREE.Group; open: number; target: number }> = [];

  constructor(options: [EnvId, EnvId, EnvId]) {
    const W = ENV_HALF_WIDTH.concourse;
    const H = ENVIRONMENTS.concourse.ceilingHeight;
    const s = new GeoBuilder();
    const g = new GeoBuilder();
    const doorH = 3.3;
    const half = 0.92;
    const wallColor = '#2a2350';
    s.box(W * 2, H - doorH, 0.6, 0, doorH + (H - doorH) / 2, 0, wallColor);
    const edges = [-W, laneX(0) - half, laneX(0) + half, laneX(1) - half, laneX(1) + half, laneX(2) - half, laneX(2) + half, W];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i]!;
      const b = edges[i + 1]!;
      if (b - a > 0.01) s.box(b - a, doorH, 0.6, (a + b) / 2, doorH / 2, 0, wallColor);
    }
    g.box(W * 2, 0.08, 0.62, 0, doorH + 0.05, 0, '#ff4f9a');
    this.group.add(new THREE.Mesh(s.build(), MATERIALS.vc));
    this.group.add(new THREE.Mesh(g.build(), MATERIALS.vcGlow));

    options.forEach((env, lane) => {
      const def = ENVIRONMENTS[env];
      const x = laneX(lane);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.62), new THREE.MeshBasicMaterial({ map: bannerTexture(def.signLabel, def.trim, '#15102b') }));
      sign.position.set(x, doorH + 0.55, 0.31);
      this.group.add(sign);
      const doorMat = new THREE.MeshLambertMaterial({ color: def.trim });
      const winMat = new THREE.MeshBasicMaterial({ color: '#15102b' });
      const pivotL = new THREE.Group();
      const pivotR = new THREE.Group();
      pivotL.position.set(x - half, 0, 0.05);
      pivotR.position.set(x + half, 0, 0.05);
      const leaf = new THREE.BoxGeometry(half, doorH - 0.05, 0.08);
      leaf.translate(half / 2, (doorH - 0.05) / 2, 0);
      const leafR = leaf.clone();
      leafR.translate(-half, 0, 0);
      const l = new THREE.Mesh(leaf, doorMat);
      const r = new THREE.Mesh(leafR, doorMat);
      const wl = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), winMat);
      wl.position.set(half / 2, 2.0, 0.045);
      const wr = wl.clone();
      wr.position.set(-half / 2, 2.0, 0.045);
      pivotL.add(l, wl);
      pivotR.add(r, wr);
      this.group.add(pivotL, pivotR);
      this.doors.push({ pivotL, pivotR, open: 0, target: 0 });
    });
    const header = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.5), new THREE.MeshBasicMaterial({ map: bannerTexture('PICK A DOOR', '#ffd23f', '#15102b', 'every route leads back to the concourse') }));
    header.position.set(0, doorH + 2.4, 0.31);
    this.group.add(header);
  }

  /** Swing open the door closest to the skater once they are close. */
  update(distanceToFacade: number, playerX: number, dt: number): void {
    this.doors.forEach((d, lane) => {
      const close = distanceToFacade < 2.2 && Math.abs(playerX - laneX(lane)) < 1.1;
      if (close) d.target = 1;
      d.open += (d.target - d.open) * (1 - Math.exp(-dt * 18));
      d.pivotL.rotation.y = -d.open * 1.75;
      d.pivotR.rotation.y = d.open * 1.75;
    });
  }
}

export function createDirectoryGantry(options: [EnvId, EnvId, EnvId]): THREE.Group {
  const group = new THREE.Group();
  const s = new GeoBuilder();
  const W = ENV_HALF_WIDTH.concourse;
  for (const x of [-W + 1, W - 1]) s.box(0.25, 6.8, 0.25, x, 3.4, 0, '#30353d');
  s.box(W * 2 - 2, 0.25, 0.25, 0, 6.6, 0, '#30353d');
  group.add(new THREE.Mesh(s.build(), MATERIALS.vc));
  options.forEach((env, lane) => {
    const def = ENVIRONMENTS[env];
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.95, 0.75),
      new THREE.MeshBasicMaterial({ map: bannerTexture(def.signLabel, def.trim, '#15102b', def.tradeoff.replace(/\.$/, '')) }),
    );
    panel.position.set(laneX(lane), 5.6, 0.14);
    group.add(panel);
    const arrow = new GeoBuilder().cone(0.22, 0.4, 3, laneX(lane), 4.95, 0.15, def.trim, { rz: Math.PI }).build();
    group.add(new THREE.Mesh(arrow, MATERIALS.vcGlow));
  });
  return group;
}

export function createArch(label: string, color: string, env: EnvId): THREE.Group {
  const group = new THREE.Group();
  const W = ENV_HALF_WIDTH[env];
  const H = Math.min(ENVIRONMENTS[env].ceilingHeight, 7);
  const s = new GeoBuilder();
  for (const x of [-W + 0.4, W - 0.4]) s.box(0.8, H, 0.8, x, H / 2, 0, '#2a2350');
  s.box(W * 2, 1.0, 0.8, 0, H - 0.5, 0, '#2a2350');
  group.add(new THREE.Mesh(s.build(), MATERIALS.vc));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.9), new THREE.MeshBasicMaterial({ map: bannerTexture(label, color, '#15102b') }));
  sign.position.set(0, H - 0.5, 0.41);
  group.add(sign);
  return group;
}

export function createWelcomeSign(env: EnvId): THREE.Group {
  const def = ENVIRONMENTS[env];
  const group = new THREE.Group();
  const H = Math.min(def.ceilingHeight - 0.6, 5.2);
  const s = new GeoBuilder();
  s.cyl(0.02, 0.02, def.ceilingHeight - H, 4, -2.4, H + (def.ceilingHeight - H) / 2, 0, '#9aa3ad');
  s.cyl(0.02, 0.02, def.ceilingHeight - H, 4, 2.4, H + (def.ceilingHeight - H) / 2, 0, '#9aa3ad');
  group.add(new THREE.Mesh(s.build(), MATERIALS.vc));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: bannerTexture(def.name.toUpperCase(), def.trim, '#15102b', def.tradeoff.replace(/\.$/, '')) }));
  sign.position.set(0, H - 0.3, 0);
  group.add(sign);
  return group;
}

export function createEscalators(): THREE.Group {
  const group = new THREE.Group();
  const s = new GeoBuilder();
  const g = new GeoBuilder();
  for (const sgn of [-1, 1]) {
    const x = sgn * 5.6;
    const len = 9;
    const rise = 5;
    const angle = Math.atan2(rise, len);
    const slant = Math.hypot(len, rise);
    s.box(1.2, 0.3, slant, x, rise / 2, -len / 2, '#30353d', { rx: sgn < 0 ? angle : -angle });
    for (const dx of [-0.65, 0.65]) {
      s.box(0.08, 1.0, slant, x + dx, rise / 2 + 0.6, -len / 2, '#bfe9ff', { rx: sgn < 0 ? angle : -angle });
      s.box(0.1, 0.08, slant, x + dx, rise / 2 + 1.1, -len / 2, '#1d1d22', { rx: sgn < 0 ? angle : -angle });
    }
    g.box(1.1, 0.03, slant - 0.4, x, rise / 2 + 0.17, -len / 2, '#ffd23f', { rx: sgn < 0 ? angle : -angle });
  }
  group.add(new THREE.Mesh(s.build(), MATERIALS.vc));
  group.add(new THREE.Mesh(g.build(), MATERIALS.vcGlow));
  return group;
}
