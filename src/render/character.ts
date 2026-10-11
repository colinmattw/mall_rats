import * as THREE from 'three';
import { getItem, type Appearance, type CatalogItem, type Loadout } from '../config/catalog';
import type { TrickDef } from '../engine/player';
import { BoardMesh, DECK_HEIGHT } from './board';
import { faceTexture, patternTexture, printTexture } from './textures';

/**
 * Modular skater. Every clothing slot is a set of meshes attached to shared
 * joints (hips, knees, shoulders, head...), so outfits animate with the body
 * and change the actual silhouette, not just colours.
 */
const UL = 0.4; // upper leg
const LL = 0.38; // lower leg
const ANKLE = 0.1;
const TORSO = 0.46;
const UA = 0.27;
const FA = 0.25;

export interface RigInput {
  mode: 'ground' | 'air' | 'grind';
  ducking: boolean;
  laneDir: number;
  airT: number;
  trick: TrickDef | null;
  trickProgress: number;
  stumble: number;
  speed: number;
  ending: 'crash' | 'captured' | null;
  endT: number;
  studio?: boolean;
}

interface Joints {
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  ankleL: number;
  ankleR: number;
  spine: number;
  spineRoll: number;
  neck: number;
  shoulderLz: number;
  shoulderRz: number;
  shoulderLx: number;
  shoulderRx: number;
  elbowL: number;
  elbowR: number;
}

const ZERO: Joints = {
  hipL: 0,
  hipR: 0,
  kneeL: 0,
  kneeR: 0,
  ankleL: 0,
  ankleR: 0,
  spine: 0,
  spineRoll: 0,
  neck: 0,
  shoulderLz: 0,
  shoulderRz: 0,
  shoulderLx: 0,
  shoulderRx: 0,
  elbowL: 0,
  elbowR: 0,
};

function limbGeo(rTop: number, rBot: number, len: number, seg = 8): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  g.translate(0, -len / 2, 0);
  return g;
}

const materialCache = new Map<string, THREE.Material>();

function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = materialCache.get(key);
  if (!m) {
    m = make();
    materialCache.set(key, m);
  }
  return m;
}

const colorMat = (c: string) => mat(`c:${c}`, () => new THREE.MeshLambertMaterial({ color: c }));
const shinyMat = (c: string) => mat(`s:${c}`, () => new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: '#ffffff' }));
const glowMat = (c: string) => mat(`g:${c}`, () => new THREE.MeshBasicMaterial({ color: c }));

function itemMaterial(item: CatalogItem, which: 'primary' | 'secondary' | 'accent' = 'primary'): THREE.Material {
  const v = item.visual;
  const color = (which === 'primary' ? v.primary : which === 'secondary' ? v.secondary ?? v.primary : v.accent ?? v.secondary ?? v.primary)!;
  if (which === 'primary' && v.shimmer) {
    return mat(`holo:${item.id}`, () => new THREE.MeshPhongMaterial({ map: patternTexture('holo', v.primary, v.secondary ?? v.primary), shininess: 70, specular: '#ffffff' }));
  }
  if (which === 'primary' && v.pattern && v.pattern !== 'none') {
    return mat(`pat:${item.id}`, () => {
      const t = patternTexture(v.pattern!, v.primary, v.secondary ?? '#1d1d22', v.accent);
      const m = new THREE.MeshLambertMaterial({ map: t });
      return m;
    });
  }
  if (v.metallic) return shinyMat(color);
  return colorMat(color);
}

export class CharacterRig {
  readonly root = new THREE.Group();
  readonly board = new BoardMesh();
  readonly body = new THREE.Group();
  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private kneeL = new THREE.Group();
  private kneeR = new THREE.Group();
  private footL = new THREE.Group();
  private footR = new THREE.Group();
  private shoulderL = new THREE.Group();
  private shoulderR = new THREE.Group();
  private elbowL = new THREE.Group();
  private elbowR = new THREE.Group();
  private handL = new THREE.Group();
  private handR = new THREE.Group();
  private skinMat = new THREE.MeshLambertMaterial({ color: '#c68a5d' });
  private faceMat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.2 });
  private clothing: THREE.Object3D[] = [];
  private skinParts: Record<string, THREE.Mesh> = {};
  private joints: Joints = { ...ZERO };
  private hipHeight = 0.9;
  private shimmerMats: THREE.MeshPhongMaterial[] = [];
  private loadoutKey = '';
  private holdsBoombox = false;
  /** Body yaw relative to the board while riding (3/4 back view for the chase camera). */
  rideYaw = -2.0;

  constructor() {
    this.root.add(this.board.group);
    this.root.add(this.body);
    this.body.position.y = DECK_HEIGHT + 0.02;
    this.body.add(this.hips);
    this.hips.position.y = this.hipHeight;

    // Legs
    this.legL.position.set(-0.1, 0, 0);
    this.legR.position.set(0.1, 0, 0);
    this.hips.add(this.legL, this.legR);
    for (const [leg, knee, foot] of [
      [this.legL, this.kneeL, this.footL],
      [this.legR, this.kneeR, this.footR],
    ] as const) {
      const thigh = new THREE.Mesh(limbGeo(0.078, 0.066, UL), this.skinMat);
      leg.add(thigh);
      knee.position.y = -UL;
      leg.add(knee);
      const shin = new THREE.Mesh(limbGeo(0.062, 0.052, LL), this.skinMat);
      knee.add(shin);
      foot.position.y = -LL;
      knee.add(foot);
      const bareFoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), this.skinMat);
      bareFoot.position.set(0, -0.04, 0.05);
      foot.add(bareFoot);
      this.skinParts[leg === this.legL ? 'thighL' : 'thighR'] = thigh;
      this.skinParts[leg === this.legL ? 'shinL' : 'shinR'] = shin;
    }

    // Torso
    this.spine.position.y = 0.02;
    this.hips.add(this.spine);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, TORSO, 8), this.skinMat);
    torso.scale.z = 0.72;
    torso.position.y = TORSO / 2;
    this.spine.add(torso);
    this.skinParts.torso = torso;
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.15, 0.16, 8), this.skinMat);
    pelvis.scale.z = 0.75;
    pelvis.position.y = -0.04;
    this.hips.add(pelvis);
    this.skinParts.pelvis = pelvis;

    this.chest.position.y = TORSO;
    this.spine.add(this.chest);
    this.neck.position.y = 0.0;
    this.chest.add(this.neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.09, 8), this.skinMat);
    neckMesh.position.y = 0.04;
    this.neck.add(neckMesh);
    this.head.position.y = 0.08;
    this.neck.add(this.head);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.29), this.skinMat);
    headMesh.position.y = 0.16;
    this.head.add(headMesh);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), this.faceMat);
    face.position.set(0, 0.15, 0.1455);
    this.head.add(face);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.04), this.skinMat);
    nose.position.set(0, 0.13, 0.16);
    this.head.add(nose);
    for (const x of [-0.16, 0.16]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), this.skinMat);
      ear.position.set(x, 0.15, 0);
      this.head.add(ear);
    }

    // Arms
    this.shoulderL.position.set(-0.22, -0.05, 0);
    this.shoulderR.position.set(0.22, -0.05, 0);
    this.chest.add(this.shoulderL, this.shoulderR);
    for (const [sh, el, hand] of [
      [this.shoulderL, this.elbowL, this.handL],
      [this.shoulderR, this.elbowR, this.handR],
    ] as const) {
      const upper = new THREE.Mesh(limbGeo(0.058, 0.05, UA), this.skinMat);
      sh.add(upper);
      el.position.y = -UA;
      sh.add(el);
      const fore = new THREE.Mesh(limbGeo(0.05, 0.044, FA), this.skinMat);
      el.add(fore);
      hand.position.y = -FA;
      el.add(hand);
      const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), this.skinMat);
      handMesh.position.y = -0.04;
      hand.add(handMesh);
    }

    this.body.rotation.y = this.rideYaw;
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  // ---------------------------------------------------------------- outfit
  private attach(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, rot?: [number, number, number], scale?: [number, number, number]): THREE.Mesh {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    parent.add(m);
    this.clothing.push(m);
    return m;
  }

  setLoadout(loadout: Loadout, appearance: Appearance): void {
    const key = JSON.stringify([loadout, appearance]);
    if (key === this.loadoutKey) return;
    this.loadoutKey = key;
    for (const c of this.clothing) {
      c.parent?.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    this.clothing = [];
    this.shimmerMats = [];
    this.skinMat.color.set(appearance.skinTone);
    this.faceMat.map = faceTexture(appearance.face);
    this.faceMat.needsUpdate = true;
    this.board.setBoard(loadout.board);

    const top = getItem(loadout.top);
    const bottom = getItem(loadout.bottom);
    const shoes = getItem(loadout.shoes);
    const hat = getItem(loadout.headwear);
    const acc = getItem(loadout.accessory);
    if (top) this.buildTop(top);
    if (bottom) this.buildBottom(bottom);
    if (shoes) this.buildShoes(shoes);
    const covered = !!hat?.tags?.includes('coversHair');
    this.buildHair(appearance.hairStyle, appearance.hairColor, covered, hat?.visual.kind);
    if (hat) this.buildHeadwear(hat);
    this.holdsBoombox = acc?.visual.kind === 'boombox';
    if (acc) this.buildAccessory(acc, top);
    for (const item of [top, bottom, shoes, hat, acc]) {
      if (item?.visual.shimmer) {
        const m = materialCache.get(`holo:${item.id}`);
        if (m instanceof THREE.MeshPhongMaterial) this.shimmerMats.push(m);
      }
    }
  }

  private buildTop(item: CatalogItem): void {
    const v = item.visual;
    const main = itemMaterial(item, 'primary');
    const sec = itemMaterial(item, 'secondary');
    const acc = itemMaterial(item, 'accent');
    const kind = v.kind;
    const wide = kind === 'oversized' ? 0.055 : kind === 'bomber' || kind === 'varsity' ? 0.04 : kind === 'hoodie' || kind === 'windbreaker' ? 0.035 : 0.022;
    const len = kind === 'oversized' ? TORSO + 0.16 : kind === 'tank' ? TORSO + 0.04 : TORSO + 0.08;
    const torso = this.attach(this.spine, new THREE.CylinderGeometry(0.19 + wide, 0.15 + wide + (kind === 'oversized' ? 0.03 : 0), len, 8), kind === 'flannel' ? sec : main, 0, TORSO - len / 2 + 0.01, 0);
    torso.scale.z = 0.76;

    // Sleeves
    const sleeveMat = kind === 'varsity' ? sec : kind === 'windbreaker' ? sec : main;
    if (kind !== 'tank') {
      const long = ['hoodie', 'flannel', 'windbreaker', 'varsity', 'bomber'].includes(kind);
      const upperLen = kind === 'oversized' ? UA + 0.02 : long ? UA : 0.15;
      const r = kind === 'oversized' ? 0.088 : kind === 'bomber' ? 0.08 : 0.07;
      for (const [sh, el] of [
        [this.shoulderL, this.elbowL],
        [this.shoulderR, this.elbowR],
      ] as const) {
        this.attach(sh, limbGeo(r, r - 0.008, upperLen), sleeveMat, 0, 0.02, 0);
        if (long) {
          this.attach(el, limbGeo(r - 0.012, r - 0.018, FA - 0.03), sleeveMat);
          const cuffMat = kind === 'varsity' || kind === 'bomber' ? acc : sleeveMat;
          this.attach(el, limbGeo(r - 0.008, r - 0.008, 0.04), cuffMat, 0, -(FA - 0.06), 0);
        }
        if (kind === 'windbreaker') this.attach(sh, limbGeo(r + 0.004, r + 0.004, 0.05), acc, 0, -0.08, 0);
      }
    } else {
      for (const sh of [this.shoulderL, this.shoulderR]) this.attach(sh, new THREE.BoxGeometry(0.06, 0.03, 0.12), main, sh === this.shoulderL ? 0.04 : -0.04, 0.02, 0);
    }

    // Details per kind
    switch (kind) {
      case 'tee':
      case 'oversized': {
        if (v.print) {
          const print = this.attach(this.spine, new THREE.PlaneGeometry(0.2, 0.2), mat(`print:${item.id}`, () => new THREE.MeshLambertMaterial({ map: printTexture(v.print!, v.primary, v.accent ?? '#ff4f9a') })), 0, TORSO * 0.62, 0.15 + wide * 0.76);
          print.scale.setScalar(kind === 'oversized' ? 1.2 : 1);
        }
        this.attach(this.chest, new THREE.TorusGeometry(0.08, 0.02, 6, 12), main, 0, 0.0, 0, [Math.PI / 2, 0, 0]);
        break;
      }
      case 'tank':
        this.attach(this.spine, new THREE.BoxGeometry(0.24, 0.05, 0.02), itemMaterial(item, 'secondary'), 0, TORSO * 0.5, 0.165);
        break;
      case 'hoodie': {
        const hood = this.attach(this.chest, new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.6), main, 0, -0.02, -0.13, [-0.6, 0, 0]);
        hood.scale.set(1.1, 0.8, 0.8);
        this.attach(this.spine, new THREE.BoxGeometry(0.26, 0.12, 0.04), sec, 0, TORSO * 0.3, 0.16);
        for (const x of [-0.04, 0.04]) this.attach(this.chest, limbGeo(0.008, 0.008, 0.14), colorMat('#f4f1e8'), x, -0.02, 0.16);
        break;
      }
      case 'flannel': {
        for (const x of [-0.11, 0.11]) {
          const panel = this.attach(this.spine, new THREE.BoxGeometry(0.13, len - 0.04, 0.03), main, x, TORSO - len / 2 + 0.02, 0.16);
          panel.rotation.y = x < 0 ? 0.2 : -0.2;
        }
        this.attach(this.spine, new THREE.BoxGeometry(0.42, len - 0.04, 0.03), main, 0, TORSO - len / 2 + 0.02, -0.16);
        this.attach(this.chest, new THREE.BoxGeometry(0.3, 0.05, 0.22), main, 0, 0.0, 0.02, [0.3, 0, 0]);
        break;
      }
      case 'windbreaker':
        this.attach(this.spine, new THREE.CylinderGeometry(0.19 + wide + 0.004, 0.17 + wide, 0.12, 8), acc, 0, TORSO * 0.62, 0, undefined, [1, 1, 0.78]);
        this.attach(this.chest, new THREE.CylinderGeometry(0.1, 0.12, 0.08, 8), main, 0, 0.02, 0);
        break;
      case 'varsity':
        this.attach(this.spine, new THREE.CylinderGeometry(0.16 + wide, 0.16 + wide, 0.05, 8), acc, 0, TORSO - len + 0.04, 0, undefined, [1, 1, 0.8]);
        this.attach(this.chest, new THREE.TorusGeometry(0.09, 0.025, 6, 12), acc, 0, 0.0, 0, [Math.PI / 2, 0, 0]);
        this.attach(this.spine, new THREE.PlaneGeometry(0.11, 0.11), mat(`print:${item.id}`, () => new THREE.MeshLambertMaterial({ map: printTexture('letter-m', v.secondary ?? '#fff', v.accent ?? '#ffd23f') })), -0.09, TORSO * 0.66, 0.16 + wide * 0.75);
        break;
      case 'bomber':
        this.attach(this.spine, new THREE.CylinderGeometry(0.16 + wide, 0.15 + wide, 0.06, 8), colorMat('#2a2a40'), 0, TORSO - len + 0.05, 0, undefined, [1, 1, 0.8]);
        this.attach(this.chest, new THREE.TorusGeometry(0.095, 0.03, 6, 12), colorMat('#2a2a40'), 0, 0.0, 0, [Math.PI / 2, 0, 0]);
        break;
    }
  }

  private buildBottom(item: CatalogItem): void {
    const v = item.visual;
    const main = itemMaterial(item, 'primary');
    const kind = v.kind;
    const width =
      kind === 'parachute' ? 0.05 : kind === 'baggy' ? 0.035 : kind === 'cargo' ? 0.028 : kind === 'shorts' ? 0.03 : kind === 'track' ? 0.012 : 0.016;
    this.attach(this.hips, new THREE.CylinderGeometry(0.165 + width * 0.6, 0.165 + width * 0.6, 0.2, 8), main, 0, -0.04, 0, undefined, [1, 1, 0.78]);
    for (const [leg, knee] of [
      [this.legL, this.kneeL],
      [this.legR, this.kneeR],
    ] as const) {
      const thighLen = kind === 'shorts' ? UL + 0.05 : UL + 0.02;
      this.attach(leg, limbGeo(0.09 + width, 0.08 + width, thighLen), main, 0, 0.02, 0);
      if (kind !== 'shorts') {
        const flare = kind === 'baggy' || kind === 'parachute' ? 0.02 : 0;
        this.attach(knee, limbGeo(0.076 + width, 0.07 + width + flare, LL - 0.04), main, 0, 0, 0);
        if (kind === 'baggy' || kind === 'parachute') {
          this.attach(knee, limbGeo(0.075 + width + flare, 0.08 + width + flare, 0.06), main, 0, -(LL - 0.1), 0);
        }
        if (kind === 'chinos') this.attach(knee, limbGeo(0.08 + width, 0.08 + width, 0.04), main, 0, -(LL - 0.08), 0);
      } else {
        this.attach(leg, limbGeo(0.1 + width, 0.1 + width, 0.04), main, 0, -(UL - 0.0), 0);
      }
      const side = leg === this.legL ? -1 : 1;
      if (kind === 'cargo') {
        this.attach(leg, new THREE.BoxGeometry(0.05, 0.12, 0.1), itemMaterial(item, 'secondary'), side * (0.11 + width), -UL * 0.55, 0);
      }
      if (kind === 'track') {
        this.attach(leg, new THREE.BoxGeometry(0.012, UL, 0.03), colorMat(v.secondary ?? '#fff'), side * (0.092 + width), -UL / 2, 0);
        this.attach(knee, new THREE.BoxGeometry(0.012, LL - 0.05, 0.03), colorMat(v.secondary ?? '#fff'), side * (0.078 + width), -(LL - 0.05) / 2, 0);
      }
      if (kind === 'parachute') {
        this.attach(leg, new THREE.BoxGeometry(0.01, 0.2, 0.012), colorMat(v.secondary ?? '#6c3cf0'), side * 0.02, -0.2, 0.13);
      }
    }
  }

  private buildShoes(item: CatalogItem): void {
    const v = item.visual;
    const main = itemMaterial(item, 'primary');
    const sole = colorMat(v.secondary ?? '#f4f1e8');
    const kind = v.kind;
    for (const foot of [this.footL, this.footR]) {
      const big = kind === 'puffy' ? 1.18 : kind === 'boots' ? 1.12 : 1.04;
      this.attach(foot, new THREE.BoxGeometry(0.12 * big, 0.085 * big, 0.26 * big), main, 0, -0.035, 0.05);
      const soleMesh = this.attach(foot, new THREE.BoxGeometry(0.13 * big, kind === 'boots' ? 0.05 : 0.035, 0.27 * big), v.glow ? glowMat(v.glow) : sole, 0, -0.085, 0.05);
      soleMesh.castShadow = false;
      if (kind === 'puffy') this.attach(foot, new THREE.BoxGeometry(0.08, 0.06, 0.05), sole, 0, 0.02, 0.11, [0.5, 0, 0]);
      if (kind === 'slipon') this.attach(foot, new THREE.BoxGeometry(0.1, 0.02, 0.1), colorMat('#1d1d22'), 0, 0.012, 0.0);
      if (kind === 'lowtop') this.attach(foot, new THREE.BoxGeometry(0.125, 0.02, 0.06), sole, 0, -0.06, 0.16);
      if (kind === 'hightop' || kind === 'boots') {
        const h = kind === 'boots' ? 0.17 : 0.14;
        this.attach(foot, limbGeo(0.072, 0.07, h), main, 0, h - 0.02, -0.01);
        if (kind === 'hightop') this.attach(foot, new THREE.CylinderGeometry(0.073, 0.073, 0.03, 8), sole, 0, h - 0.03, -0.01);
        if (kind === 'boots') for (let i = 0; i < 3; i++) this.attach(foot, new THREE.BoxGeometry(0.06, 0.008, 0.01), colorMat('#d9b47a'), 0, 0.02 + i * 0.04, 0.07);
      }
    }
  }

  private buildHair(style: string, color: string, covered: boolean, hatKind?: string): void {
    const m = colorMat(color);
    const h = this.head;
    const cap = (thick = 0.04) => this.attach(h, new THREE.BoxGeometry(0.315, thick, 0.305), m, 0, 0.32 + thick / 2 - 0.01, 0);
    const back = (len = 0.18) => this.attach(h, new THREE.BoxGeometry(0.31, len, 0.04), m, 0, 0.32 - len / 2, -0.155);
    const sides = () => {
      for (const x of [-0.155, 0.155]) this.attach(h, new THREE.BoxGeometry(0.02, 0.1, 0.22), m, x, 0.26, -0.02);
    };
    if (covered) {
      switch (style) {
        case 'swoop':
          this.attach(h, new THREE.BoxGeometry(0.2, 0.05, 0.05), m, 0.04, 0.27, 0.15, [0, 0, -0.2]);
          break;
        case 'long':
          back(0.36);
          break;
        case 'afro':
          this.attach(h, new THREE.SphereGeometry(0.15, 8, 6), m, 0, 0.18, -0.15);
          break;
        case 'curly':
          for (const x of [-0.16, 0.16]) this.attach(h, new THREE.SphereGeometry(0.05, 6, 5), m, x, 0.24, -0.04);
          break;
        default:
          if (hatKind !== 'helmet') sides();
      }
      return;
    }
    switch (style) {
      case 'buzz':
        cap(0.025);
        sides();
        break;
      case 'spiky':
        cap(0.05);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          this.attach(h, new THREE.ConeGeometry(0.05, 0.14, 5), m, Math.cos(a) * 0.09, 0.39, Math.sin(a) * 0.08, [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]);
        }
        this.attach(h, new THREE.ConeGeometry(0.05, 0.16, 5), m, 0, 0.42, 0);
        break;
      case 'mohawk':
        this.attach(h, new THREE.BoxGeometry(0.3, 0.015, 0.29), colorMat('#2b2420'), 0, 0.325, 0);
        this.attach(h, new THREE.BoxGeometry(0.07, 0.17, 0.33), m, 0, 0.4, -0.01);
        break;
      case 'swoop':
        cap(0.05);
        sides();
        this.attach(h, new THREE.BoxGeometry(0.28, 0.07, 0.12), m, 0.03, 0.34, 0.12, [0.25, 0, -0.18]);
        break;
      case 'long':
        cap(0.045);
        back(0.42);
        for (const x of [-0.16, 0.16]) this.attach(h, new THREE.BoxGeometry(0.03, 0.3, 0.2), m, x, 0.2, -0.04);
        break;
      case 'afro':
        this.attach(h, new THREE.SphereGeometry(0.26, 10, 8), m, 0, 0.3, -0.03);
        break;
      case 'bun':
        cap(0.04);
        sides();
        this.attach(h, new THREE.SphereGeometry(0.085, 8, 6), m, 0, 0.42, -0.04);
        break;
      case 'curly':
        cap(0.04);
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * Math.PI * 2;
          this.attach(h, new THREE.SphereGeometry(0.06, 6, 5), m, Math.cos(a) * 0.11, 0.36 + (i % 2) * 0.03, Math.sin(a) * 0.1);
        }
        break;
      default:
        cap();
    }
  }

  private buildHeadwear(item: CatalogItem): void {
    const v = item.visual;
    const main = itemMaterial(item, 'primary');
    const sec = itemMaterial(item, 'secondary');
    const h = this.head;
    switch (v.kind) {
      case 'beanie': {
        this.attach(h, new THREE.BoxGeometry(0.33, 0.12, 0.32), main, 0, 0.33, 0);
        const dome = this.attach(h, new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0.38, 0);
        dome.scale.set(1, 0.55, 0.98);
        this.attach(h, new THREE.BoxGeometry(0.345, 0.06, 0.335), sec, 0, 0.28, 0);
        break;
      }
      case 'cap':
      case 'capBack': {
        this.attach(h, new THREE.BoxGeometry(0.325, 0.1, 0.315), main, 0, 0.35, 0);
        const dome = this.attach(h, new THREE.SphereGeometry(0.165, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0.395, 0);
        dome.scale.set(1, 0.45, 0.97);
        const back = v.kind === 'capBack';
        this.attach(h, new THREE.BoxGeometry(0.3, 0.02, 0.17), back ? sec : main, 0, 0.315, back ? -0.22 : 0.22, [back ? -0.08 : 0.08, 0, 0]);
        if (!back && v.accent) this.attach(h, new THREE.PlaneGeometry(0.1, 0.06), colorMat(v.accent), 0, 0.36, 0.159);
        if (back) this.attach(h, new THREE.BoxGeometry(0.08, 0.04, 0.01), sec, 0, 0.36, 0.16);
        break;
      }
      case 'bucket':
        this.attach(h, new THREE.BoxGeometry(0.33, 0.13, 0.32), main, 0, 0.35, 0);
        this.attach(h, new THREE.CylinderGeometry(0.25, 0.29, 0.035, 12), main, 0, 0.29, 0);
        break;
      case 'helmet': {
        const dome = this.attach(h, new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), mat(`helmet:${item.id}`, () => new THREE.MeshPhongMaterial({ map: printTexture('stickers', v.primary, v.accent ?? '#fff'), shininess: 60 })), 0, 0.22, 0);
        dome.scale.set(1, 0.95, 1);
        for (const x of [-0.15, 0.15]) this.attach(h, new THREE.BoxGeometry(0.015, 0.16, 0.02), colorMat('#1d1d22'), x, 0.1, 0.04);
        break;
      }
      case 'visor': {
        this.attach(h, new THREE.BoxGeometry(0.325, 0.05, 0.315), main, 0, 0.3, 0);
        this.attach(h, new THREE.BoxGeometry(0.3, 0.02, 0.16), main, 0, 0.29, 0.21, [0.12, 0, 0]);
        if (v.glow) this.attach(h, new THREE.BoxGeometry(0.33, 0.015, 0.32), glowMat(v.glow), 0, 0.32, 0);
        if (v.glow) this.attach(h, new THREE.BoxGeometry(0.3, 0.012, 0.012), glowMat(v.glow), 0, 0.302, 0.29);
        break;
      }
      case 'crown': {
        this.attach(h, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10, 1, true), main, 0, 0.36, 0);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.attach(h, new THREE.ConeGeometry(0.04, 0.1, 4), main, Math.cos(a) * 0.165, 0.44, Math.sin(a) * 0.165);
          if (i % 2 === 0) this.attach(h, new THREE.SphereGeometry(0.022, 6, 4), glowMat(v.accent ?? '#ff4f9a'), Math.cos(a) * 0.172, 0.36, Math.sin(a) * 0.172);
        }
        break;
      }
    }
  }

  private buildAccessory(item: CatalogItem, top?: CatalogItem): void {
    const v = item.visual;
    const main = itemMaterial(item, 'primary');
    const sec = itemMaterial(item, 'secondary');
    switch (v.kind) {
      case 'wristbands':
        for (const el of [this.elbowL, this.elbowR]) this.attach(el, limbGeo(0.058, 0.058, 0.06), main, 0, -(FA - 0.05), 0);
        break;
      case 'chain': {
        const links = 7;
        for (let i = 0; i < links; i++) {
          const t = i / (links - 1);
          const x = 0.16;
          const y = -0.08 - Math.sin(t * Math.PI) * 0.14;
          const z = 0.1 - t * 0.2;
          this.attach(this.hips, new THREE.TorusGeometry(0.018, 0.006, 4, 8), main, x, y, z, [0, Math.PI / 2, i % 2 ? Math.PI / 2 : 0]);
        }
        break;
      }
      case 'backpack': {
        const offset = top?.visual.kind === 'hoodie' ? 0.07 : 0.0;
        this.attach(this.spine, new THREE.BoxGeometry(0.3, 0.36, 0.14), main, 0, TORSO * 0.55, -0.2 - offset);
        this.attach(this.spine, new THREE.BoxGeometry(0.26, 0.12, 0.06), sec, 0, TORSO * 0.38, -0.29 - offset);
        this.attach(this.spine, new THREE.PlaneGeometry(0.2, 0.2), mat(`patches:${item.id}`, () => new THREE.MeshLambertMaterial({ map: printTexture('patches', v.primary, v.secondary ?? '#fff') })), 0, TORSO * 0.62, -0.271 - offset, [0, Math.PI, 0]);
        for (const x of [-0.1, 0.1]) this.attach(this.chest, new THREE.BoxGeometry(0.04, 0.05, 0.36), sec, x, 0.01, -0.02);
        break;
      }
      case 'shades': {
        for (const x of [-0.065, 0.065]) this.attach(this.head, new THREE.CylinderGeometry(0.05, 0.05, 0.015, 5), main, x, 0.17, 0.155, [Math.PI / 2, 0, 0]);
        this.attach(this.head, new THREE.BoxGeometry(0.26, 0.015, 0.015), sec, 0, 0.19, 0.156);
        break;
      }
      case 'headphones': {
        this.attach(this.head, new THREE.TorusGeometry(0.19, 0.018, 6, 14, Math.PI), main, 0, 0.18, 0);
        for (const x of [-0.17, 0.17]) {
          this.attach(this.head, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), main, x, 0.15, 0, [0, 0, Math.PI / 2]);
          this.attach(this.head, new THREE.CylinderGeometry(0.05, 0.05, 0.052, 10), sec, x * 1.04, 0.15, 0, [0, 0, Math.PI / 2]);
        }
        break;
      }
      case 'boombox': {
        const box = new THREE.Group();
        box.position.set(0.02, -0.02, 0.1);
        this.handR.add(box);
        this.clothing.push(box);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.12), main);
        box.add(body);
        for (const x of [-0.12, 0.12]) {
          const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 12), sec);
          sp.rotation.x = Math.PI / 2;
          sp.position.set(x, 0, 0.065);
          box.add(sp);
        }
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.02), glowMat(v.accent ?? '#ff4f9a'));
        strip.position.set(0, 0.06, 0.065);
        box.add(strip);
        box.rotation.set(0, Math.PI / 2, 0);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- animation
  private target: Joints = { ...ZERO };

  animate(input: RigInput, dt: number, time: number): void {
    const t = this.target;
    Object.assign(t, ZERO);
    let crouch = 0.32;
    let armSpread = 0.85;
    let lean = 0;
    let bodyPitch = 0;
    let boardFlip = 0;
    let boardShove = 0;
    let bodySpin = 0;
    const bob = Math.sin(time * 9) * 0.015;

    if (input.studio) {
      crouch = 0.12 + Math.sin(time * 2.2) * 0.04;
      armSpread = 0.25;
      t.elbowL = 0.3;
      t.elbowR = 0.3;
    } else if (input.ending === 'captured') {
      crouch = 0.05;
      t.shoulderLz = -2.8;
      t.shoulderRz = 2.8;
      armSpread = 0;
      t.neck = -0.2;
    } else if (input.ending === 'crash') {
      crouch = 0.6;
      t.shoulderLx = -2.2;
      t.shoulderRx = -1.8;
      bodyPitch = Math.min(1.5, input.endT * 3);
    } else if (input.mode === 'air') {
      crouch = 0.55 + Math.sin(Math.min(1, input.airT) * Math.PI) * 0.35;
      armSpread = 1.3;
      t.shoulderLx = -0.5;
      t.shoulderRx = -0.5;
      if (input.trick) {
        const p = Math.min(1, input.trickProgress);
        boardFlip = input.trick.flip * p * Math.PI * 2;
        boardShove = input.trick.shove * p * Math.PI * 2;
        bodySpin = input.trick.spin * p * Math.PI * 2;
        crouch = 0.95;
        armSpread = 1.5;
      }
    } else if (input.mode === 'grind') {
      crouch = 0.48 + Math.sin(time * 14) * 0.03;
      armSpread = 1.45;
      lean = Math.sin(time * 3.1) * 0.06;
    }
    if (input.ducking && !input.ending) {
      crouch = 1.0;
      armSpread = 0.4;
      t.shoulderLx = -0.9;
      t.shoulderRx = -0.9;
      t.neck = 0.3;
    }
    if (input.stumble > 0 && !input.ending) {
      const w = Math.sin(time * 26) * input.stumble;
      t.spineRoll = w * 0.35;
      t.shoulderLz = -0.6 - w * 1.2;
      t.shoulderRz = 0.6 + w * 1.2;
      armSpread = 0;
    }
    if (!input.ending) lean += -input.laneDir * 0.28;

    // Knees bend forward; hip height follows so the feet stay on the deck.
    const hipBend = crouch * 1.0;
    const knee = -crouch * 1.75;
    t.hipL = hipBend + 0.05;
    t.hipR = hipBend - 0.05;
    t.kneeL = knee;
    t.kneeR = knee;
    t.ankleL = crouch * 0.72;
    t.ankleR = crouch * 0.72;
    t.spine = crouch * 0.38 + (input.ducking ? 0.35 : 0);
    if (armSpread) {
      t.shoulderLz = t.shoulderLz || -armSpread;
      t.shoulderRz = t.shoulderRz || armSpread;
      t.elbowL = t.elbowL || 0.35;
      t.elbowR = t.elbowR || 0.35;
    }
    if (this.holdsBoombox && !input.ending) {
      t.shoulderRz = 2.6;
      t.shoulderRx = 0;
      t.elbowR = 2.2;
    }

    const k = 1 - Math.exp(-dt * 16);
    const j = this.joints;
    for (const key of Object.keys(j) as Array<keyof Joints>) j[key] += (t[key] - j[key]) * k;

    this.legL.rotation.x = -j.hipL;
    this.legR.rotation.x = -j.hipR;
    this.kneeL.rotation.x = -j.kneeL;
    this.kneeR.rotation.x = -j.kneeR;
    this.footL.rotation.x = -j.ankleL;
    this.footR.rotation.x = -j.ankleR;
    this.legL.rotation.z = -0.08;
    this.legR.rotation.z = 0.08;
    this.spine.rotation.x = j.spine;
    this.spine.rotation.z = j.spineRoll;
    this.neck.rotation.x = j.neck - j.spine * 0.6;
    this.shoulderL.rotation.z = j.shoulderLz;
    this.shoulderR.rotation.z = j.shoulderRz;
    this.shoulderL.rotation.x = j.shoulderLx;
    this.shoulderR.rotation.x = j.shoulderRx;
    this.elbowL.rotation.x = -j.elbowL;
    this.elbowR.rotation.x = -j.elbowR;

    const a = j.hipL;
    const b = j.hipL + j.kneeL;
    this.hipHeight = ANKLE + UL * Math.cos(a) + LL * Math.cos(b);
    this.hips.position.y = this.hipHeight + (input.studio || input.mode === 'air' ? 0 : bob);
    this.hips.position.z = -(UL * Math.sin(a) + LL * Math.sin(b)) * 0.5;

    // Head looks down the travel direction while riding.
    this.head.rotation.y = input.studio ? 0 : -this.rideYaw - Math.PI;
    if (!input.studio) this.head.rotation.y = Math.atan2(Math.sin(this.head.rotation.y), Math.cos(this.head.rotation.y));

    this.body.rotation.y = (input.studio ? -Math.PI / 2 : this.rideYaw) + bodySpin;
    this.body.rotation.x = 0;
    this.root.rotation.z += (lean - this.root.rotation.z) * k;
    this.root.rotation.x = bodyPitch * 0.4;
    this.board.spin.rotation.z = boardFlip;
    this.board.spin.rotation.y = boardShove;
    this.board.update(time);
    if (this.shimmerMats.length) {
      for (const m of this.shimmerMats) {
        if (m.map) {
          m.map.offset.x = (time * 0.2) % 1;
          m.map.offset.y = (time * 0.13) % 1;
        }
      }
    }
  }
}
