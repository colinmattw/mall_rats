import * as THREE from 'three';

/**
 * Accumulates low-poly primitives with per-vertex colours into one
 * BufferGeometry, so a whole prop (or a whole mall bay) is a single draw call.
 */
export interface PartOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();

export class GeoBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private uvs: number[] = [];

  add(geo: THREE.BufferGeometry, x: number, y: number, z: number, color: THREE.ColorRepresentation, o: PartOpts = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    tmpEuler.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(x, y, z);
    tmpScale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    g.applyMatrix4(tmpMatrix);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nor = g.getAttribute('normal') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    tmpColor.set(color);
    // Store linear colours so vertex colours match material colours.
    for (let i = 0; i < pos.count; i++) {
      this.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      this.normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      this.colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
      if (uv) this.uvs.push(uv.getX(i), uv.getY(i));
      else this.uvs.push(0, 0);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
    return this;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o?: PartOpts): this {
    return this.add(new THREE.BoxGeometry(w, h, d), x, y, z, color, o);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o?: PartOpts): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), x, y, z, color, o);
  }

  sphere(r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o?: PartOpts & { w?: number; h?: number }): this {
    return this.add(new THREE.SphereGeometry(r, o?.w ?? 8, o?.h ?? 6), x, y, z, color, o);
  }

  cone(r: number, h: number, seg: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o?: PartOpts): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), x, y, z, color, o);
  }

  torus(r: number, tube: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o?: PartOpts & { arc?: number }): this {
    return this.add(new THREE.TorusGeometry(r, tube, 6, 12, o?.arc ?? Math.PI * 2), x, y, z, color, o);
  }

  /** Flat quad facing +z (rotate with opts). */
  plane(w: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o?: PartOpts): this {
    return this.add(new THREE.PlaneGeometry(w, h), x, y, z, color, o);
  }

  get empty(): boolean {
    return this.positions.length === 0;
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.computeBoundingSphere();
    return geo;
  }
}

/** Shared materials (one instance each, reused everywhere). */
export const MATERIALS = {
  vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
  vcGlow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  vcGlass: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }),
};

export function lambert(color: THREE.ColorRepresentation, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}
