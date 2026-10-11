import * as THREE from 'three';
import { GeoBuilder, MATERIALS } from './geo';

/**
 * Original mall-security character: a very serious officer on a very slow
 * patrol scooter. Purely comedic — capture is a whistle, a pointed finger and
 * a "BUSTED" stamp.
 */
export class GuardMesh {
  readonly group = new THREE.Group();
  private rider = new THREE.Group();
  private armR = new THREE.Group();
  private armL = new THREE.Group();
  private head = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private beacon: THREE.Mesh;

  constructor() {
    const scooter = new GeoBuilder()
      .box(0.5, 0.08, 0.9, 0, 0.18, 0, '#2b2f3a')
      .box(0.52, 0.03, 0.92, 0, 0.23, 0, '#4a5060')
      .cyl(0.035, 0.035, 1.0, 6, 0, 0.7, -0.38, '#9aa3ad', { rx: -0.15 })
      .box(0.6, 0.05, 0.05, 0, 1.18, -0.45, '#2b2f3a')
      .box(0.12, 0.08, 0.06, -0.3, 1.18, -0.45, '#1d1d22')
      .box(0.12, 0.08, 0.06, 0.3, 1.18, -0.45, '#1d1d22')
      .box(0.36, 0.06, 0.02, 0, 0.3, -0.46, '#f4f1e8')
      .build();
    this.group.add(new THREE.Mesh(scooter, MATERIALS.vc));
    const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const z of [-0.38, 0.38]) {
      const w = new THREE.Mesh(wheelGeo, new THREE.MeshLambertMaterial({ color: '#1d1d22' }));
      w.position.set(0, 0.17, z);
      this.group.add(w);
      this.wheels.push(w);
    }
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3355' }));
    this.beacon.position.set(0, 1.32, -0.42);
    this.group.add(this.beacon);

    this.rider.position.set(0, 0.25, 0.05);
    this.group.add(this.rider);
    const body = new GeoBuilder()
      // legs (navy trousers) and boots
      .box(0.15, 0.62, 0.17, -0.11, 0.33, 0, '#1f2a4d')
      .box(0.15, 0.62, 0.17, 0.11, 0.33, 0, '#1f2a4d')
      .box(0.16, 0.08, 0.26, -0.11, 0.04, -0.04, '#111111')
      .box(0.16, 0.08, 0.26, 0.11, 0.04, -0.04, '#111111')
      // belly + shirt
      .box(0.5, 0.58, 0.36, 0, 0.95, 0, '#8fb3e8')
      .sphere(0.24, 0, 0.86, -0.08, '#8fb3e8', { sx: 1.05, sy: 0.9, sz: 0.9 })
      // hi-vis vest with reflective stripes
      .box(0.53, 0.42, 0.39, 0, 1.0, 0, '#c8f031')
      .box(0.54, 0.04, 0.4, 0, 0.92, 0, '#e8edf2')
      .box(0.54, 0.04, 0.4, 0, 1.08, 0, '#e8edf2')
      // belt, radio, flashlight
      .box(0.52, 0.06, 0.38, 0, 0.66, 0, '#111111')
      .box(0.08, 0.14, 0.06, 0.24, 0.72, -0.12, '#2b2b2b')
      .cyl(0.03, 0.03, 0.22, 6, -0.27, 0.6, 0, '#3a3a3a')
      // badge
      .box(0.08, 0.08, 0.02, -0.12, 1.12, -0.2, '#ffd23f')
      .build();
    this.rider.add(new THREE.Mesh(body, MATERIALS.vc));

    this.head.position.set(0, 1.32, 0);
    this.rider.add(this.head);
    const head = new GeoBuilder()
      .box(0.28, 0.3, 0.28, 0, 0.15, 0, '#e2a679')
      .box(0.2, 0.05, 0.03, 0, 0.08, -0.15, '#5a3a22')
      .box(0.22, 0.05, 0.03, 0, 0.18, -0.145, '#1d1d22')
      .box(0.31, 0.08, 0.31, 0, 0.33, 0, '#1f2a4d')
      .box(0.3, 0.02, 0.16, 0, 0.29, -0.2, '#111a33')
      .box(0.07, 0.06, 0.01, 0, 0.35, -0.157, '#ffd23f')
      .build();
    this.head.add(new THREE.Mesh(head, MATERIALS.vc));

    for (const [arm, x] of [
      [this.armL, -0.3],
      [this.armR, 0.3],
    ] as const) {
      arm.position.set(x, 1.15, 0);
      this.rider.add(arm);
      const g = new GeoBuilder()
        .box(0.12, 0.5, 0.13, 0, -0.25, 0, '#8fb3e8')
        .box(0.11, 0.11, 0.11, 0, -0.55, 0, '#e2a679')
        .build();
      arm.add(new THREE.Mesh(g, MATERIALS.vc));
    }
    // Whistle in the right hand.
    const whistle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.1), new THREE.MeshLambertMaterial({ color: '#c0c6cc' }));
    whistle.position.set(0, -0.6, -0.06);
    this.armR.add(whistle);

    // Faces the skater: forward is -Z like everything else.
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  /**
   * @param closeness 0 (far) .. 1 (right behind the skater)
   * @param busted    capture celebration (arm out, whistle up)
   */
  animate(time: number, speed: number, closeness: number, busted: boolean): void {
    for (const w of this.wheels) w.rotation.x -= speed * 0.016 * 5;
    this.rider.rotation.x = -0.12 - closeness * 0.12;
    this.rider.position.y = 0.25 + Math.sin(time * 7) * 0.012;
    const wave = busted ? 1 : Math.max(0, closeness - 0.55) * 2.2;
    this.armR.rotation.x = -wave * 2.4 + Math.sin(time * 16) * 0.15 * wave;
    this.armL.rotation.x = busted ? -1.4 : -0.9;
    this.armL.rotation.z = busted ? -0.4 : 0;
    this.head.rotation.y = Math.sin(time * 1.7) * 0.15;
    const blink = Math.sin(time * 12) > 0;
    (this.beacon.material as THREE.MeshBasicMaterial).color.set(blink ? '#ff3355' : '#3366ff');
  }
}
