import * as THREE from 'three';
import { getItem, type BoardParts } from '../config/catalog';
import { boardGraphic, gripTexture } from './textures';

export const BOARD_LENGTH = 1.02;
export const BOARD_WIDTH = 0.28;
export const DECK_THICKNESS = 0.035;
export const DECK_HEIGHT = 0.14; // deck top above the floor

function deckShape(): THREE.Shape {
  const L = BOARD_LENGTH / 2;
  const W = BOARD_WIDTH / 2;
  const r = W;
  const s = new THREE.Shape();
  s.moveTo(-L + r, -W);
  s.lineTo(L - r, -W);
  s.absarc(L - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-L + r, W);
  s.absarc(-L + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return s;
}

let sharedShapeGeo: THREE.ShapeGeometry | null = null;
let sharedEdgeGeo: THREE.ExtrudeGeometry | null = null;
let sharedWheelGeo: THREE.CylinderGeometry | null = null;
let sharedTruckGeo: THREE.BoxGeometry | null = null;

function shapeGeo(): THREE.ShapeGeometry {
  if (!sharedShapeGeo) {
    const g = new THREE.ShapeGeometry(deckShape(), 10);
    // Normalise UVs to 0..1 across the deck so graphics map edge to edge.
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / BOARD_LENGTH + 0.5, pos.getY(i) / BOARD_WIDTH + 0.5);
    }
    sharedShapeGeo = g;
  }
  return sharedShapeGeo;
}

/**
 * Skateboard as a group: deck (grip top, graphic bottom, wood edge), trucks
 * and wheels. The deck's long axis is local Z (nose toward -Z).
 */
export class BoardMesh {
  readonly group = new THREE.Group();
  /** Inner group that tricks rotate (flip / shove-it). */
  readonly spin = new THREE.Group();
  private gripMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  private graphicMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  private edgeMat = new THREE.MeshLambertMaterial({ color: '#d9b47a' });
  private wheelMat = new THREE.MeshLambertMaterial({ color: '#f4f1e8' });
  private truckMat = new THREE.MeshLambertMaterial({ color: '#b9c0c8' });
  private shimmer = false;
  private itemId = '';

  constructor() {
    this.group.add(this.spin);
    const top = new THREE.Mesh(shapeGeo(), this.gripMat);
    top.rotation.x = -Math.PI / 2;
    top.rotation.z = Math.PI / 2;
    top.position.y = DECK_THICKNESS / 2 + 0.001;
    const bottom = new THREE.Mesh(shapeGeo(), this.graphicMat);
    bottom.rotation.x = Math.PI / 2;
    bottom.rotation.z = Math.PI / 2;
    bottom.position.y = -DECK_THICKNESS / 2 - 0.001;
    if (!sharedEdgeGeo) {
      sharedEdgeGeo = new THREE.ExtrudeGeometry(deckShape(), { depth: DECK_THICKNESS, bevelEnabled: false, curveSegments: 10 });
      sharedEdgeGeo.translate(0, 0, -DECK_THICKNESS / 2);
    }
    const edge = new THREE.Mesh(sharedEdgeGeo, this.edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = Math.PI / 2;
    const deck = new THREE.Group();
    deck.add(top, bottom, edge);
    deck.position.y = DECK_HEIGHT - DECK_THICKNESS / 2;
    this.spin.add(deck);

    if (!sharedWheelGeo) {
      sharedWheelGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.045, 10);
      sharedWheelGeo.rotateZ(Math.PI / 2);
      sharedTruckGeo = new THREE.BoxGeometry(0.22, 0.03, 0.05);
    }
    for (const z of [-0.33, 0.33]) {
      const truck = new THREE.Mesh(sharedTruckGeo!, this.truckMat);
      truck.position.set(0, 0.075, z);
      this.spin.add(truck);
      for (const x of [-0.12, 0.12]) {
        const wheel = new THREE.Mesh(sharedWheelGeo, this.wheelMat);
        wheel.position.set(x, 0.042, z);
        this.spin.add(wheel);
      }
    }
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  setBoard(itemId: string): void {
    if (itemId === this.itemId) return;
    this.itemId = itemId;
    const item = getItem(itemId);
    const parts: BoardParts = item?.visual.board ?? { graphic: 'shop', wheels: '#f4f1e8', grip: '#1d1d22', trucks: '#b9c0c8' };
    const primary = item?.visual.primary ?? '#ff4f9a';
    this.graphicMat.map = boardGraphic(parts.graphic, primary);
    this.graphicMat.needsUpdate = true;
    this.gripMat.map = gripTexture(parts.grip);
    this.gripMat.needsUpdate = true;
    this.wheelMat.color.set(parts.wheels);
    this.truckMat.color.set(parts.trucks);
    this.shimmer = !!item?.visual.shimmer;
    this.graphicMat.emissive.set(item?.visual.metallic ? '#2a2000' : '#000000');
  }

  update(time: number): void {
    if (this.shimmer && this.graphicMat.map) {
      this.graphicMat.map.offset.x = (time * 0.15) % 1;
      this.graphicMat.map.wrapS = THREE.RepeatWrapping;
      this.graphicMat.emissive.setHSL((time * 0.2) % 1, 0.6, 0.12);
    }
  }
}
