import * as THREE from 'three';
import { ENVIRONMENTS, type EnvId } from '../config/environments';
import { GAMEPLAY, laneX, SIM_DT } from '../config/gameplay';
import type { Appearance, Loadout } from '../config/catalog';
import type { ChunkInstance, CourseObstacle, CourseRail } from '../engine/course';
import { TRICKS } from '../engine/player';
import type { RunSimulation, SimEvent } from '../engine/simulation';
import type { GraphicsQuality } from '../economy/saveSchema';
import { BoardMesh } from './board';
import { CharacterRig, type RigInput } from './character';
import {
  BAY_LENGTH,
  JunctionFacade,
  assignBaySigns,
  createArch,
  createBay,
  createDirectoryGantry,
  createEscalators,
  createWelcomeSign,
  type Bay,
} from './environment';
import { GuardMesh } from './guard';
import { createObstacleVisual, createRailVisual, obstacleKey, type ObstacleVisual } from './obstacles';
import { Particles, PickupRenderer } from './pickups';
import { bannerTexture, shadowTexture, stickerWallTexture } from './textures';

export type RenderMode = 'studio' | 'game';
export type StudioFocus = 'character' | 'board';

const PIXEL_RATIO: Record<GraphicsQuality, number> = { low: 1, medium: 1.5, high: 2 };
const FOG_FAR: Record<GraphicsQuality, number> = { low: 115, medium: 150, high: 160 };

interface SetPiece {
  objects: THREE.Object3D[];
  facade?: JunctionFacade;
  facadeS?: number;
}

const STUDIO_ORIGIN = new THREE.Vector3(2000, 0, 0);

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  private worldRoot = new THREE.Group();
  private studioRoot = new THREE.Group();
  private hemi = new THREE.HemisphereLight('#fff4e6', '#3a2d5a', 1.5);
  private sun = new THREE.DirectionalLight('#ffffff', 1.5);
  private fog: THREE.Fog;
  private mode: RenderMode = 'studio';
  private quality: GraphicsQuality = 'medium';
  private reducedMotion = false;
  private width = 1;
  private height = 1;

  // gameplay
  private sim: RunSimulation | null = null;
  readonly player = new CharacterRig();
  private guard = new GuardMesh();
  private playerShadow: THREE.Mesh;
  private guardShadow: THREE.Mesh;
  private bays = new Map<number, Bay>();
  private bayPools = new Map<EnvId, Bay[]>();
  private obstacleVisuals = new Map<number, ObstacleVisual>();
  private obstaclePools = new Map<string, ObstacleVisual[]>();
  private railVisuals = new Map<number, { group: THREE.Group; key: string }>();
  private railPools = new Map<string, THREE.Group[]>();
  private setPieces = new Map<number, SetPiece>();
  private pickups = new PickupRenderer();
  private particles = new Particles();
  private guardGap = 4;
  private camX = 0;
  private camY = 3;
  private shake = 0;
  private fovBase = 60;
  private currentEnv: EnvId = 'concourse';
  private fogColor = new THREE.Color(ENVIRONMENTS.concourse.fog);
  private targetFog = new THREE.Color(ENVIRONMENTS.concourse.fog);

  // studio
  readonly preview = new CharacterRig();
  private previewBoard = new BoardMesh();
  private studioFocus: StudioFocus = 'character';
  private studioYaw = 0.35;
  private studioYawTarget = 0.35;
  private framingTop = 0.12;
  private framingBottom = 0.3;
  private autoSpin = true;
  private swayTime = 0;

  constructor(container: HTMLElement, opts: { quality: GraphicsQuality; reducedMotion: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: opts.quality === 'high', powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.fog = new THREE.Fog(this.fogColor, 40, FOG_FAR.medium);
    this.scene.fog = this.fog;
    this.scene.background = this.fogColor;
    this.scene.add(this.hemi);
    this.sun.position.set(4, 12, 6);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    this.scene.add(this.worldRoot, this.studioRoot);

    this.worldRoot.add(this.player.root, this.guard.group, this.pickups.group, this.particles.points);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
    this.playerShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.guardShadow = this.playerShadow.clone();
    this.worldRoot.add(this.playerShadow, this.guardShadow);

    this.buildStudio();
    this.setQuality(opts.quality);
    this.setReducedMotion(opts.reducedMotion);
    this.resize();
  }

  // ---------------------------------------------------------------- settings
  setQuality(q: GraphicsQuality): void {
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[q]));
    this.renderer.shadowMap.enabled = q === 'high';
    this.sun.castShadow = q === 'high';
    if (q === 'high') {
      this.sun.shadow.mapSize.set(1024, 1024);
      const cam = this.sun.shadow.camera;
      cam.left = -4;
      cam.right = 4;
      cam.top = 4;
      cam.bottom = -4;
      cam.near = 1;
      cam.far = 30;
      cam.updateProjectionMatrix();
    }
    this.playerShadow.visible = q !== 'high';
    this.fog.far = FOG_FAR[q];
    this.resize();
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  resize(): void {
    const el = this.renderer.domElement.parentElement;
    const w = Math.max(1, el?.clientWidth ?? window.innerWidth);
    const h = Math.max(1, el?.clientHeight ?? window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep ~50 degrees of horizontal view in portrait so all three lanes stay visible.
    const aspect = w / h;
    const hFov = aspect < 1 ? 58 : 70;
    const vFov = (2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hFov) / 2) / aspect) * 180) / Math.PI;
    this.fovBase = THREE.MathUtils.clamp(vFov, 46, 92);
    this.camera.fov = this.fovBase;
    this.camera.updateProjectionMatrix();
    this.applyStudioFraming();
  }

  setMode(mode: RenderMode): void {
    this.mode = mode;
    this.worldRoot.visible = mode === 'game';
    this.studioRoot.visible = mode === 'studio';
    if (mode === 'game') this.camera.clearViewOffset();
    else this.applyStudioFraming();
    this.renderer.shadowMap.enabled = mode === 'game' && this.quality === 'high';
  }

  // ---------------------------------------------------------------- studio
  private buildStudio(): void {
    const root = this.studioRoot;
    root.position.copy(STUDIO_ORIGIN);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: stickerWallTexture(), fog: false }));
    wall.position.set(0, 3.6, -3.4);
    root.add(wall);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshLambertMaterial({ color: '#2a2350' }));
    floor.rotation.x = -Math.PI / 2;
    root.add(floor);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.12, 32), new THREE.MeshLambertMaterial({ color: '#ff4f9a' }));
    disc.position.y = 0.06;
    root.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: '#ffd23f', fog: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.125;
    root.add(ring);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.2), new THREE.MeshBasicMaterial({ map: bannerTexture('BOARD ROOM SKATE', '#29e3d4', '#15102b', 'est. in the mall'), fog: false }));
    sign.position.set(0, 5.6, -3.3);
    root.add(sign);
    const graphics = ['board_graffiti', 'board_sunset_grid', 'board_flame', 'board_galaxy', 'board_checkerboard'];
    graphics.forEach((id, i) => {
      const b = new BoardMesh();
      b.setBoard(id);
      b.group.rotation.set(Math.PI / 2, 0, 0);
      b.group.position.set(-4.6 + i * 2.3 + (i >= 2 ? 0.0 : 0), 2.3 + (i % 2) * 0.25, -3.25);
      b.group.rotation.z = (i - 2) * 0.12;
      b.spin.rotation.z = Math.PI;
      if (i === 2) b.group.visible = false;
      root.add(b.group);
    });
    this.preview.root.position.set(0, 0.12, 0);
    root.add(this.preview.root);
    this.previewBoard.group.position.set(0, 1.25, 0);
    // Stand the deck up first, then spin about the world vertical axis.
    this.previewBoard.group.rotation.order = 'YXZ';
    this.previewBoard.group.visible = false;
    root.add(this.previewBoard.group);
    const spot = new THREE.PointLight('#ffffff', 18, 12, 1.6);
    spot.position.set(1.5, 4, 3);
    root.add(spot);
  }

  setStudioFocus(focus: StudioFocus): void {
    this.studioFocus = focus;
    this.preview.root.visible = focus === 'character';
    this.previewBoard.group.visible = focus === 'board';
    this.applyStudioFraming();
  }

  /** Fractions of the screen height covered by UI at the top and bottom. */
  setStudioFraming(top: number, bottom: number): void {
    this.framingTop = top;
    this.framingBottom = bottom;
    this.applyStudioFraming();
  }

  private applyStudioFraming(): void {
    if (this.mode !== 'studio') return;
    const freeTop = this.framingTop;
    const freeBottom = 1 - this.framingBottom;
    const center = (freeTop + freeBottom) / 2;
    const offsetY = (0.5 - center) * this.height;
    this.camera.setViewOffset(this.width, this.height, 0, offsetY, this.width, this.height);
  }

  setStudioLoadout(loadout: Loadout, appearance: Appearance): void {
    this.preview.setLoadout(loadout, appearance);
    this.previewBoard.setBoard(loadout.board);
  }

  setPlayerLoadout(loadout: Loadout, appearance: Appearance): void {
    this.player.setLoadout(loadout, appearance);
  }

  rotateStudio(deltaYaw: number): void {
    this.studioYawTarget += deltaYaw;
    this.autoSpin = false;
  }

  setAutoSpin(v: boolean): void {
    if (v && !this.autoSpin) this.swayTime = Math.asin(Math.max(-1, Math.min(1, this.studioYaw / 0.75))) / 0.45;
    this.autoSpin = v;
  }

  // ---------------------------------------------------------------- gameplay world
  attachRun(sim: RunSimulation | null): void {
    this.sim = sim;
    for (const [, bay] of this.bays) this.releaseBay(bay);
    this.bays.clear();
    for (const [id, v] of this.obstacleVisuals) this.releaseObstacle(id, v);
    for (const [id, r] of this.railVisuals) this.releaseRail(id, r);
    for (const [uid] of this.setPieces) this.removeSetPiece(uid);
    this.guardGap = 3.5;
    this.camX = 0;
    this.camY = 3;
    this.shake = 0;
    this.currentEnv = 'concourse';
    this.targetFog.set(ENVIRONMENTS.concourse.fog);
  }

  handleEvents(events: SimEvent[]): void {
    const sim = this.sim;
    if (!sim) return;
    const p = sim.player;
    const vz = -p.speed * 0.75;
    for (const e of events) {
      switch (e.type) {
        case 'coin':
          this.particles.burst(e.pickup.x, e.pickup.y, -e.pickup.s, 6, e.pickup.kind === 'stack' ? '#7dff6a' : '#ffd23f', 2, 2, vz);
          break;
        case 'bagCollected':
          this.particles.burst(e.pickup.x, e.pickup.y, -e.pickup.s, 40, '#fff1a8', 4, 4, vz);
          break;
        case 'minorHit':
          this.shake = Math.max(this.shake, 0.35);
          this.particles.burst(p.x, p.y + 0.8, -p.s - 0.4, 10, '#c8c8d8', 2.5, 2, vz);
          break;
        case 'smash':
          this.shake = Math.max(this.shake, 0.3);
          this.particles.burst(p.x, 1.0, -p.s - 0.8, 26, '#ff4f9a', 4, 3, vz);
          break;
        case 'crash':
          this.shake = Math.max(this.shake, 0.9);
          break;
        case 'envChange':
          this.currentEnv = e.env;
          this.targetFog.set(ENVIRONMENTS[e.env].fog);
          break;
        case 'player':
          if (e.ev.type === 'land') this.particles.burst(p.x, 0.05 + p.y, -p.s - 0.3, 6, '#8a8478', 1.6, 0.6, vz);
          if (e.ev.type === 'grindStart') this.particles.burst(p.x, p.y, -p.s - 0.3, 10, '#ffd23f', 2.5, 1.6, vz);
          break;
      }
    }
  }

  private envAt(s: number): EnvId | null {
    const sim = this.sim;
    if (!sim) return 'concourse';
    if (s < 0) return 'concourse';
    const c = sim.course.chunkAt(s);
    return c ? c.env : null;
  }

  private acquireBay(env: EnvId): Bay {
    const pool = this.bayPools.get(env);
    const bay = pool?.pop() ?? createBay(env);
    bay.group.visible = true;
    this.worldRoot.add(bay.group);
    return bay;
  }

  private releaseBay(bay: Bay): void {
    bay.group.visible = false;
    this.worldRoot.remove(bay.group);
    let pool = this.bayPools.get(bay.env);
    if (!pool) this.bayPools.set(bay.env, (pool = []));
    pool.push(bay);
  }

  private syncBays(ps: number): void {
    const i0 = Math.floor((ps - 26) / BAY_LENGTH);
    const i1 = Math.floor((ps + FOG_FAR[this.quality] + 8) / BAY_LENGTH);
    const end = this.sim ? this.sim.course.end : Infinity;
    for (const [i, bay] of this.bays) {
      if (i < i0 || i > i1) {
        this.releaseBay(bay);
        this.bays.delete(i);
      }
    }
    for (let i = i0; i <= i1; i++) {
      const s = i * BAY_LENGTH;
      if (s >= end) {
        const existing = this.bays.get(i);
        if (existing) {
          this.releaseBay(existing);
          this.bays.delete(i);
        }
        continue;
      }
      const env = this.envAt(s + 0.5) ?? this.currentEnv;
      const existing = this.bays.get(i);
      if (existing && existing.env === env) continue;
      if (existing) this.releaseBay(existing);
      const bay = this.acquireBay(env);
      bay.group.position.set(0, 0, -s);
      bay.index = i;
      assignBaySigns(bay, i);
      this.bays.set(i, bay);
    }
  }

  private releaseObstacle(id: number, v: ObstacleVisual): void {
    v.group.visible = false;
    this.worldRoot.remove(v.group);
    let pool = this.obstaclePools.get(v.key);
    if (!pool) this.obstaclePools.set(v.key, (pool = []));
    pool.push(v);
    this.obstacleVisuals.delete(id);
  }

  private releaseRail(id: number, r: { group: THREE.Group; key: string }): void {
    r.group.visible = false;
    this.worldRoot.remove(r.group);
    let pool = this.railPools.get(r.key);
    if (!pool) this.railPools.set(r.key, (pool = []));
    pool.push(r.group);
    this.railVisuals.delete(id);
  }

  private syncObstacles(ps: number, tick: number): void {
    const sim = this.sim!;
    const far = ps + FOG_FAR[this.quality] + 10;
    const seen = new Set<number>();
    for (const o of sim.course.obstacles) {
      if (o.s1 < ps - 20 || o.s0 > far) continue;
      seen.add(o.id);
      let v = this.obstacleVisuals.get(o.id);
      const width = o.x1 - o.x0;
      const depth = o.s1 - o.s0;
      if (!v) {
        const key = obstacleKey(o.def.id, width, depth);
        v = this.obstaclePools.get(key)?.pop() ?? createObstacleVisual(o.def.id, width, depth);
        v.group.visible = true;
        this.worldRoot.add(v.group);
        this.obstacleVisuals.set(o.id, v);
      }
      this.poseObstacle(v, o, tick);
    }
    for (const [id, v] of this.obstacleVisuals) if (!seen.has(id)) this.releaseObstacle(id, v);

    const seenRails = new Set<number>();
    for (const r of sim.course.rails) {
      if (r.s1 < ps - 20 || r.kickerS0 > far) continue;
      seenRails.add(r.id);
      if (!this.railVisuals.has(r.id)) {
        const key = (r.s1 - r.kickerS0).toFixed(2);
        const group = this.railPools.get(key)?.pop() ?? createRailVisual(r.s1 - r.kickerS0);
        group.visible = true;
        this.worldRoot.add(group);
        this.railVisuals.set(r.id, { group, key });
        this.poseRail(group, r);
      }
    }
    for (const [id, r] of this.railVisuals) if (!seenRails.has(id)) this.releaseRail(id, r);
  }

  private poseRail(group: THREE.Group, r: CourseRail): void {
    group.position.set(r.x, 0, -r.kickerS0);
  }

  private poseObstacle(v: ObstacleVisual, o: CourseObstacle, tick: number): void {
    const g = v.group;
    const cx = (o.x0 + o.x1) / 2;
    const cz = -(o.s0 + o.s1) / 2;
    if (o.disabled && o.hitTick >= 0) {
      const t = Math.min(1, (tick - o.hitTick) / 28);
      if (o.def.severity === 'breakable') {
        g.position.set(cx + o.hitDir * t * 1.2, t * 1.2 - t * t * 1.4, cz - t * 3);
        g.rotation.set(t * 2.2, t * 3, o.hitDir * t * 2);
        g.scale.setScalar(Math.max(0.01, 1 - t * 0.9));
      } else {
        g.position.set(cx + o.hitDir * t * 1.8, Math.sin(t * Math.PI) * 0.6, cz - t * 2.5);
        g.rotation.set(-t * 1.2, 0, -o.hitDir * t * 1.5);
        g.scale.setScalar(1);
      }
      g.visible = t < 1;
      return;
    }
    g.visible = true;
    g.position.set(cx, 0, cz);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
  }

  private removeSetPiece(uid: number): void {
    const sp = this.setPieces.get(uid);
    if (!sp) return;
    for (const o of sp.objects) this.worldRoot.remove(o);
    this.setPieces.delete(uid);
  }

  private syncSetPieces(ps: number, dt: number): void {
    const sim = this.sim!;
    const alive = new Set<number>();
    for (const c of sim.course.chunks) {
      alive.add(c.uid);
      if (!this.setPieces.has(c.uid) && c.s0 < ps + 200) this.setPieces.set(c.uid, this.buildSetPiece(c));
      const sp = this.setPieces.get(c.uid);
      if (sp?.facade && sp.facadeS !== undefined) sp.facade.update(sp.facadeS - ps, sim.player.x, dt);
    }
    for (const uid of [...this.setPieces.keys()]) if (!alive.has(uid)) this.removeSetPiece(uid);
  }

  private buildSetPiece(c: ChunkInstance): SetPiece {
    const sp: SetPiece = { objects: [] };
    const add = (o: THREE.Object3D, s: number) => {
      o.position.z = -s;
      this.worldRoot.add(o);
      sp.objects.push(o);
    };
    if (c.kind === 'junction' && c.junction) {
      add(createDirectoryGantry(c.junction.options), c.s0 + 18);
      const facade = new JunctionFacade(c.junction.options);
      add(facade.group, c.junction.facadeS);
      sp.facade = facade;
      sp.facadeS = c.junction.facadeS;
    }
    if (c.kind === 'exit') add(createArch(ENVIRONMENTS.concourse.signLabel, ENVIRONMENTS.concourse.trim, c.env), c.s1);
    if (c.kind === 'lobby' && c.env !== 'concourse') add(createWelcomeSign(c.env), c.s0 + 9);
    if (c.features.includes('escalators') && (c.env === 'concourse' || c.env === 'atrium')) add(createEscalators(), c.s0 + 14);
    return sp;
  }

  // ---------------------------------------------------------------- frame
  render(alpha: number, dt: number, time: number): void {
    if (this.mode === 'game' && this.sim) this.updateGame(alpha, dt, time);
    else this.updateStudio(dt, time);
    this.renderer.render(this.scene, this.camera);
  }

  private rigInputFor(sim: RunSimulation): RigInput {
    const p = sim.player;
    const laneDir = p.lane !== p.targetLane ? Math.sign(p.targetLane - p.lane) : 0;
    const airTotal = GAMEPLAY.jump.airTicks;
    const trick = p.trickTick > 0 ? TRICKS[p.trickId] ?? null : null;
    let ending: RigInput['ending'] = null;
    if (sim.phase !== 'running') ending = sim.endReason === 'captured' ? 'captured' : sim.endReason === 'crash' ? 'crash' : null;
    return {
      mode: p.mode,
      ducking: p.duckTick > 0,
      laneDir,
      airT: p.airTick / airTotal,
      trick,
      trickProgress: p.trickTick / GAMEPLAY.trick.ticks,
      stumble: p.stumbleTick / GAMEPLAY.stumble.recoverTicks,
      speed: p.speed,
      ending,
      endT: sim.endTick * SIM_DT,
    };
  }

  private updateGame(alpha: number, dt: number, time: number): void {
    const sim = this.sim!;
    const p = sim.player;
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    let s = lerp(p.prevS, p.s);
    let x = lerp(p.prevX, p.x);
    let y = lerp(p.prevY, p.y);
    if (sim.phase !== 'running') {
      s = p.s;
      x = p.x;
      y = p.y;
    }
    const tick = sim.tick;

    this.syncBays(s);
    this.syncObstacles(s, tick);
    this.syncSetPieces(s, dt);
    this.pickups.update(sim.course.pickups, s, time, tick);
    this.particles.update(dt);

    // Player
    const input = this.rigInputFor(sim);
    this.player.root.position.set(x, y, -s);
    if (input.ending === 'crash') {
      const t = input.endT;
      this.player.root.position.y = Math.max(0, y + Math.sin(Math.min(1, t * 2) * Math.PI) * 0.8);
      this.player.board.group.position.set(Math.sin(t * 3) * 0.6, Math.max(0, 1.6 * t - 2.5 * t * t) + 0.2 * t, -t * 3.5);
      this.player.board.group.rotation.set(t * 9, t * 5, 0);
    } else {
      this.player.board.group.position.set(0, 0, 0);
      this.player.board.group.rotation.set(0, 0, 0);
    }
    this.player.animate(input, dt, time);
    if (p.mode === 'grind' && Math.random() < 0.6) this.particles.burst(x + (Math.random() - 0.5) * 0.2, y, -s - 0.2, 2, '#ffb84d', 1.8, 1.2, -p.speed * 0.8);
    this.playerShadow.position.set(x, 0.02, -s);
    const sh = Math.max(0.35, 1 - y * 0.35);
    this.playerShadow.scale.set(sh, sh, sh);

    // Guard follows at a distance driven by security pressure.
    const ending = sim.phase !== 'running';
    let gapTarget = sim.security.guardGap();
    if (sim.tick < 150) gapTarget = Math.min(gapTarget, 2.4 + sim.tick * 0.09);
    if (ending && sim.endReason === 'captured') gapTarget = 0.9;
    if (ending && sim.endReason === 'crash') gapTarget = Math.max(1.6, 4 - sim.endTick * 0.08);
    this.guardGap += (gapTarget - this.guardGap) * (1 - Math.exp(-dt * 2.2));
    const gx = this.guard.group.position.x + (x * 0.85 - this.guard.group.position.x) * (1 - Math.exp(-dt * 3));
    this.guard.group.position.set(gx, 0, -(s - this.guardGap));
    this.guard.animate(time, p.speed, 1 - Math.min(1, (this.guardGap - 1) / 12), ending && (sim.endReason === 'captured' || sim.endTick > 30));
    this.guardShadow.position.set(gx, 0.02, -(s - this.guardGap));
    this.guard.group.visible = this.guardGap < 16;

    // Environment tint
    this.fogColor.lerp(this.targetFog, 1 - Math.exp(-dt * 1.5));
    const env = ENVIRONMENTS[this.currentEnv];
    this.hemi.groundColor.lerp(new THREE.Color(env.wall), 1 - Math.exp(-dt * 1.5));

    // Chase camera
    const portrait = this.camera.aspect < 1;
    const camBack = portrait ? 6.3 : 5.4;
    const camHeight = portrait ? 4.0 : 3.1;
    const k = 1 - Math.exp(-dt * 7);
    this.camX += (x * 0.6 - this.camX) * k;
    this.camY += (camHeight + Math.max(0, y) * 0.45 - this.camY) * (1 - Math.exp(-dt * 5));
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      if (!this.reducedMotion) {
        sx = (Math.random() - 0.5) * this.shake * 0.3;
        sy = (Math.random() - 0.5) * this.shake * 0.3;
      }
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.position.set(this.camX + sx, this.camY + sy, -s + camBack);
    this.camera.lookAt(x * 0.75, (portrait ? 0.7 : 1.0) + y * 0.5, -s - (portrait ? 5.5 : 7));
    const speedFov = this.reducedMotion ? 0 : Math.max(0, p.speed - GAMEPLAY.speed.start) * 0.35;
    const fov = this.fovBase + speedFov;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }

    this.sun.position.set(x + 4, 12, -s + 6);
    this.sun.target.position.set(x, 0, -s - 2);
  }

  private updateStudio(dt: number, time: number): void {
    this.swayTime += dt;
    if (this.autoSpin) this.studioYawTarget = Math.sin(this.swayTime * 0.45) * 0.75;
    this.studioYaw += (this.studioYawTarget - this.studioYaw) * (1 - Math.exp(-dt * 8));
    const focusBoard = this.studioFocus === 'board';
    if (focusBoard) {
      // Graphic side faces the camera at rest; drag to see the grip.
      this.previewBoard.group.rotation.set(-Math.PI / 2 + 0.22, this.studioYaw * 1.6 + 0.35, 0);
      this.previewBoard.update(time);
    } else {
      this.preview.root.rotation.y = Math.PI / 2 + this.studioYaw;
      this.preview.animate(
        { mode: 'ground', ducking: false, laneDir: 0, airT: 0, trick: null, trickProgress: 0, stumble: 0, speed: 0, ending: null, endT: 0, studio: true },
        dt,
        time,
      );
    }
    const aspect = this.camera.aspect;
    const free = 1 - this.framingTop - this.framingBottom;
    const subjectH = focusBoard ? 1.25 : 2.05;
    const fill = 0.86;
    const vfov = THREE.MathUtils.degToRad(this.fovBase > 60 ? 44 : 40);
    const visibleH = subjectH / (Math.max(0.25, free) * fill);
    let dist = visibleH / 2 / Math.tan(vfov / 2);
    const minDist = (1.4 / Math.tan(vfov / 2)) / Math.max(0.6, aspect);
    dist = Math.max(dist, focusBoard ? 2.2 : minDist * 0.9);
    this.camera.fov = THREE.MathUtils.radToDeg(vfov);
    this.camera.updateProjectionMatrix();
    const target = STUDIO_ORIGIN.clone().add(new THREE.Vector3(0, focusBoard ? 1.25 : 1.05, 0));
    this.camera.position.set(target.x, target.y + 0.35, target.z + dist);
    this.camera.lookAt(target);
    this.fogColor.set('#1b1838');
    this.sun.position.set(STUDIO_ORIGIN.x + 3, 8, 6);
    this.sun.target.position.copy(STUDIO_ORIGIN);
  }

  /** Lane centre x helper for UI hit-testing. */
  laneX(l: number): number {
    return laneX(l);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
