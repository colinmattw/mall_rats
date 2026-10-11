import * as THREE from 'three';
import type { CoursePickup } from '../engine/course';
import { bagStickerTexture, radialGlowTexture, tokenTexture } from './textures';

const MAX_COINS = 320;
const MAX_STACKS = 32;

/** Instanced Mall Cash tokens + stacks; one draw call each regardless of count. */
export class PickupRenderer {
  readonly group = new THREE.Group();
  private coins: THREE.InstancedMesh;
  private stacks: THREE.InstancedMesh;
  private bags: Array<{ group: THREE.Group; halo: THREE.Sprite; id: number }> = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();

  constructor() {
    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 18);
    coinGeo.rotateX(Math.PI / 2);
    const face = new THREE.MeshLambertMaterial({ map: tokenTexture(), emissive: new THREE.Color('#5a3a00') });
    const rim = new THREE.MeshLambertMaterial({ color: '#d48a00', emissive: new THREE.Color('#3a2400') });
    this.coins = new THREE.InstancedMesh(coinGeo, [rim, face, face], MAX_COINS);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.frustumCulled = false;
    this.group.add(this.coins);

    const stackGeo = new THREE.BoxGeometry(0.5, 0.26, 0.32);
    const stackMat = new THREE.MeshLambertMaterial({ color: '#58d27a', emissive: new THREE.Color('#0d4a1f') });
    this.stacks = new THREE.InstancedMesh(stackGeo, stackMat, MAX_STACKS);
    this.stacks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stacks.frustumCulled = false;
    this.group.add(this.stacks);

    for (let i = 0; i < 2; i++) this.bags.push(this.createBag());
  }

  private createBag() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), new THREE.MeshLambertMaterial({ color: '#f4f1e8', emissive: new THREE.Color('#3a2a10') }));
    body.position.y = 0;
    group.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.36), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
    band.position.y = 0.26;
    group.add(band);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshBasicMaterial({ map: bagStickerTexture() }));
    sticker.position.set(0, -0.04, 0.175);
    group.add(sticker);
    const back = sticker.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.175;
    group.add(back);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16, Math.PI), new THREE.MeshLambertMaterial({ color: '#1d1d22' }));
    handle.position.y = 0.36;
    group.add(handle);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlowTexture('#ffe27a'), transparent: true, depthWrite: false, opacity: 0.55 }));
    halo.scale.set(2.1, 2.1, 1);
    group.add(halo);
    group.visible = false;
    this.group.add(group);
    return { group, halo, id: -1 };
  }

  update(pickups: readonly CoursePickup[], playerS: number, time: number, tick: number): void {
    let c = 0;
    let st = 0;
    let bagIndex = 0;
    for (const bag of this.bags) bag.group.visible = false;
    const spin = time * 3.2;
    for (const pk of pickups) {
      if (pk.s < playerS - 4) continue;
      if (pk.s > playerS + 165) break;
      let pop = 0;
      if (pk.collected) {
        if (pk.collectedTick < 0) continue;
        pop = (tick - pk.collectedTick) / 12;
        if (pop >= 1) continue;
      }
      if (pk.kind === 'bag') {
        const bag = this.bags[bagIndex++];
        if (!bag) continue;
        bag.group.visible = true;
        bag.group.position.set(pk.x, pk.y + Math.sin(time * 2.4) * 0.08 + pop * 1.5, -pk.s);
        bag.group.rotation.y = time * 1.4;
        const s = pop > 0 ? 1 - pop : 1;
        bag.group.scale.setScalar(s);
        (bag.halo.material as THREE.SpriteMaterial).opacity = 0.4 + Math.sin(time * 3) * 0.12;
        continue;
      }
      this.p.set(pk.x, pk.y + pop * 1.2, -pk.s);
      const scale = pop > 0 ? 1 + pop * 0.6 : 1;
      this.sc.set(scale, scale, scale);
      if (pk.kind === 'stack') {
        if (st >= MAX_STACKS) continue;
        this.e.set(0, spin * 0.6 + pk.id, 0);
        this.q.setFromEuler(this.e);
        this.m.compose(this.p, this.q, this.sc);
        this.stacks.setMatrixAt(st++, this.m);
      } else {
        if (c >= MAX_COINS) continue;
        this.e.set(0, spin + pk.s * 0.15, 0);
        this.q.setFromEuler(this.e);
        this.m.compose(this.p, this.q, this.sc);
        this.coins.setMatrixAt(c++, this.m);
      }
    }
    this.coins.count = c;
    this.stacks.count = st;
    this.coins.instanceMatrix.needsUpdate = true;
    this.stacks.instanceMatrix.needsUpdate = true;
  }
}

/** Tiny pooled particle bursts (grind sparks, coin sparkles, landing dust). */
export class Particles {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private life: Float32Array;
  private colors: Float32Array;
  private next = 0;
  private readonly max = 260;

  constructor() {
    this.positions = new Float32Array(this.max * 3);
    this.velocities = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.colors = new Float32Array(this.max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size: 0.11,
      map: radialGlowTexture('#ffffff'),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** `vz` is the base velocity along the track (negative = travelling with the skater). */
  burst(x: number, y: number, z: number, count: number, color: THREE.ColorRepresentation, speed = 3, up = 2, vz = 0): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.max;
      this.positions[k * 3] = x;
      this.positions[k * 3 + 1] = y;
      this.positions[k * 3 + 2] = z;
      this.velocities[k * 3] = (Math.random() - 0.5) * speed;
      this.velocities[k * 3 + 1] = Math.random() * up;
      this.velocities[k * 3 + 2] = vz + (Math.random() - 0.5) * speed;
      this.colors[k * 3] = c.r;
      this.colors[k * 3 + 1] = c.g;
      this.colors[k * 3 + 2] = c.b;
      this.life[k] = 0.22 + Math.random() * 0.25;
    }
  }

  update(dt: number): void {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k]! <= 0) {
        this.positions[k * 3 + 1] = -100;
        continue;
      }
      this.life[k]! -= dt;
      this.velocities[k * 3 + 1]! -= 9 * dt;
      this.positions[k * 3]! += this.velocities[k * 3]! * dt;
      this.positions[k * 3 + 1]! += this.velocities[k * 3 + 1]! * dt;
      this.positions[k * 3 + 2]! += this.velocities[k * 3 + 2]! * dt;
      const fade = Math.max(0, this.life[k]! / 0.7);
      this.colors[k * 3]! *= 0.96 + 0.04 * fade;
      this.colors[k * 3 + 1]! *= 0.96 + 0.04 * fade;
      this.colors[k * 3 + 2]! *= 0.96 + 0.04 * fade;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
