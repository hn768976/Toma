import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { BakedTextures } from "../gfx/bake";
import type { VariantConfig } from "../config";
import { makeBoardMaterial, type BoardMaterial } from "./boardMaterial";
import { makeChipBodyMaterial, makeChipLidMaterial } from "./chipMaterial";
import { mulberry32 } from "../gfx/random";
import { buildEnvironment } from "./environment";

// World scale: the package is 3.2 units across, and the hero board plane is
// sized so the baked fan texture lands at exactly that footprint.
export const CHIP_SIZE = 3.2;
export const CHIP_H = 0.34;
export const BOARD_SIZE = CHIP_SIZE / 0.17; // ≈ 18.8
export const FIELD_SIZE = 240;
/** World distance at which the baked "distance along run" channel reads 1.0. */
export const WAVE_NORM = BOARD_SIZE * 0.75;

export type SceneParts = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  boardMat: BoardMaterial;
  fieldMat: BoardMaterial;
  chip: THREE.Group;
  chipBody: ReturnType<typeof makeChipBodyMaterial>;
  chipLid: ReturnType<typeof makeChipLidMaterial>;
  chipPins: THREE.InstancedMesh;
  socket: THREE.Group;
  socketPins: THREE.MeshStandardMaterial;
  sparks: THREE.Points;
  sparkGeo: THREE.BufferGeometry;
  ring: THREE.InstancedMesh;
  streams: THREE.Points;
  keyLight: THREE.DirectionalLight;
  chipLight: THREE.PointLight;
  waveLight: THREE.PointLight;
  dispose: () => void;
};

const SPARK_COUNT = 900;
const RING_COUNT = 520;
const STREAM_COUNT = 700;

export const buildScene = (
  cfg: VariantConfig,
  tex: BakedTextures,
  aspect: number,
  renderer: unknown,
): SceneParts => {
  const p = cfg.palette;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(p.background);
  // Fog hides the far edge of the substrate and gives the deep, receding
  // falloff the references have.
  scene.fog = new THREE.Fog(p.background, 26, 120);

  const camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 600);

  // Reflections. Without this, every metal in the scene shades to black.
  const env = buildEnvironment(renderer, p.env);
  if (env.texture) {
    scene.environment = env.texture;
    scene.environmentIntensity = cfg.palette.envIntensity;
  }

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  // ---------------------------------------------------------------- board
  const fieldMat = makeBoardMaterial({
    map: tex.field,
    color: p.board,
    roughness: p.boardRoughness,
    metalness: p.boardMetalness,
    traceDark: p.traceDark,
    traceHot: p.traceHot,
    traceEdge: p.traceEdge,
    uvRepeat: 26,
    worldDist: 1,
    worldNorm: WAVE_NORM,
  });
  track(fieldMat);
  const fieldGeo = track(new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE, 1, 1));
  const field = new THREE.Mesh(fieldGeo, fieldMat);
  field.rotation.x = -Math.PI / 2;
  field.position.y = -0.012;
  field.receiveShadow = true;
  scene.add(field);

  const boardMat = makeBoardMaterial({
    map: tex.board,
    color: p.board,
    roughness: p.boardRoughness,
    metalness: p.boardMetalness,
    traceDark: p.traceDark,
    traceHot: p.traceHot,
    traceEdge: p.traceEdge,
    uvRepeat: 1,
    worldDist: 0,
    worldNorm: WAVE_NORM,
    fadeRadius: BOARD_SIZE * 0.5,
  });
  boardMat.transparent = true;
  track(boardMat);
  const boardGeo = track(new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE, 1, 1));
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.rotation.x = -Math.PI / 2;
  board.receiveShadow = true;
  scene.add(board);

  // ----------------------------------------------------------- components
  const rng = mulberry32(cfg.id.charCodeAt(1) * 7919 + 13);
  const colors = p.components.map((c) => new THREE.Color(c));

  const addInstances = (
    count: number,
    geo: THREE.BufferGeometry,
    size: () => [number, number, number],
    minR: number,
    maxR: number,
  ) => {
    const mat = track(
      new THREE.MeshStandardMaterial({
        roughness: p.componentRoughness,
        metalness: p.componentMetalness,
      }),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 40) {
      // Bias toward the camera-visible band rather than uniformly over a huge
      // square, so density stays believable near the chip.
      const r = minR + Math.pow(rng(), 0.55) * (maxR - minR);
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Keep the socket footprint clear.
      if (Math.abs(x) < CHIP_SIZE * 1.15 && Math.abs(z) < CHIP_SIZE * 1.15) continue;
      const [sx, sy, sz] = size();
      pos.set(x, sy / 2, z);
      // Real boards align to the routing grid, so snap yaw to 90°.
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(rng() * 4) * (Math.PI / 2));
      scl.set(sx, sy, sz);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(placed, m);
      mesh.setColorAt(placed, colors[Math.floor(rng() * colors.length)]);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  // Flat SMD parts.
  addInstances(
    1500,
    unitBox,
    () => [
      0.18 + rng() * 1.5,
      (0.07 + rng() * 0.22) * p.componentHeight,
      0.18 + rng() * 0.9,
    ],
    CHIP_SIZE * 1.2,
    FIELD_SIZE * 0.32,
  );
  // Taller packages and connectors for silhouette.
  addInstances(
    260,
    unitBox,
    () => [
      0.4 + rng() * 1.1,
      (0.35 + rng() * 1.1) * p.componentHeight,
      0.4 + rng() * 1.1,
    ],
    CHIP_SIZE * 1.6,
    FIELD_SIZE * 0.3,
  );

  // --------------------------------------------------------------- socket
  const socket = new THREE.Group();
  const socketMat = track(
    new THREE.MeshStandardMaterial({
      color: p.socket,
      roughness: p.socketRoughness,
      metalness: 0.95,
    }),
  );
  const frameOuter = CHIP_SIZE * 1.18;
  const frameWall = CHIP_SIZE * 0.11;
  const frameH = 0.34;
  const barGeo = track(new THREE.BoxGeometry(frameOuter, frameH, frameWall));
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(barGeo, socketMat);
    const off = frameOuter / 2 - frameWall / 2;
    if (i === 0) bar.position.set(0, frameH / 2, -off);
    if (i === 1) bar.position.set(0, frameH / 2, off);
    if (i === 2) {
      bar.position.set(-off, frameH / 2, 0);
      bar.rotation.y = Math.PI / 2;
    }
    if (i === 3) {
      bar.position.set(off, frameH / 2, 0);
      bar.rotation.y = Math.PI / 2;
    }
    bar.castShadow = true;
    bar.receiveShadow = true;
    socket.add(bar);
  }
  // Recessed floor with a land grid of contacts.
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      color: p.board,
      roughness: 0.75,
      metalness: 0.2,
    }),
  );
  const floorGeo = track(new THREE.BoxGeometry(frameOuter - frameWall * 2, 0.06, frameOuter - frameWall * 2));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.03;
  floor.receiveShadow = true;
  socket.add(floor);

  const gridN = 26;
  const padGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const socketPins = new THREE.InstancedMesh(padGeo, socketMat, gridN * gridN);
  {
    const m = new THREE.Matrix4();
    const inner = frameOuter - frameWall * 2.4;
    const step = inner / gridN;
    let i = 0;
    for (let a = 0; a < gridN; a++) {
      for (let b = 0; b < gridN; b++) {
        m.makeScale(step * 0.5, 0.035, step * 0.5);
        m.setPosition(
          -inner / 2 + step * (a + 0.5),
          0.075,
          -inner / 2 + step * (b + 0.5),
        );
        socketPins.setMatrixAt(i++, m);
      }
    }
    socketPins.instanceMatrix.needsUpdate = true;
  }
  socket.add(socketPins);
  scene.add(socket);

  // ----------------------------------------------------------------- chip
  const chip = new THREE.Group();
  const glass = cfg.chipStyle === "glass";
  const irid = cfg.chipStyle === "iridescent";

  const chipBody = makeChipBodyMaterial({
    color: p.chipBody,
    rimColor: p.rimLight,
    holoColor: p.chipEmissive,
    transmission: glass ? 0.82 : irid ? 0.25 : 0.55,
    roughness: glass ? 0.06 : irid ? 0.14 : 0.1,
    metalness: glass ? 0.1 : irid ? 0.5 : 0.35,
    iridescence: irid ? 0.9 : 0.25,
  });
  track(chipBody);
  const bodyGeo = track(
    new RoundedBoxGeometry(CHIP_SIZE, CHIP_H, CHIP_SIZE, 3, 0.05),
  );
  const body = new THREE.Mesh(bodyGeo, chipBody);
  body.castShadow = true;
  chip.add(body);

  const chipLid = makeChipLidMaterial({
    map: tex.chipLid,
    color: p.chipTop,
    rimColor: p.rimLight,
    holoColor: p.chipEmissive,
    labelColor: p.traceHot,
    dieColor: p.chipEmissive,
    sheenA: irid ? 0x4f46d6 : p.chipTop,
    sheenB: irid ? 0xf07fc4 : p.chipEmissive,
    roughness: glass ? 0.12 : irid ? 0.16 : 0.18,
    metalness: glass ? 0.25 : irid ? 0.55 : 0.4,
    iridescence: irid ? 1 : 0.2,
  });
  track(chipLid);
  const lidGeo = track(new THREE.PlaneGeometry(CHIP_SIZE * 0.9, CHIP_SIZE * 0.9));
  const lid = new THREE.Mesh(lidGeo, chipLid);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = CHIP_H / 2 + 0.004;
  chip.add(lid);

  // Pin rows along all four edges.
  const pinMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdfe6ef,
      roughness: 0.28,
      metalness: 1,
    }),
  );
  const perSide = 30;
  const chipPins = new THREE.InstancedMesh(padGeo, pinMat, perSide * 4);
  {
    const m = new THREE.Matrix4();
    const span = CHIP_SIZE * 0.88;
    const step = span / perSide;
    let i = 0;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < perSide; k++) {
        const t = -span / 2 + step * (k + 0.5);
        const off = CHIP_SIZE / 2 + 0.015;
        m.makeScale(step * 0.45, 0.05, 0.12);
        if (side === 0) m.setPosition(t, -CHIP_H / 2 + 0.03, -off);
        if (side === 1) m.setPosition(t, -CHIP_H / 2 + 0.03, off);
        if (side === 2) {
          m.makeScale(0.12, 0.05, step * 0.45);
          m.setPosition(-off, -CHIP_H / 2 + 0.03, t);
        }
        if (side === 3) {
          m.makeScale(0.12, 0.05, step * 0.45);
          m.setPosition(off, -CHIP_H / 2 + 0.03, t);
        }
        chipPins.setMatrixAt(i++, m);
      }
    }
    chipPins.instanceMatrix.needsUpdate = true;
  }
  chip.add(chipPins);
  scene.add(chip);

  // ------------------------------------------------------------ particles
  // Impact sparks: a burst thrown outward when the package seats.
  const sparkGeo = track(new THREE.BufferGeometry());
  {
    const pos = new Float32Array(SPARK_COUNT * 3);
    const dir = new Float32Array(SPARK_COUNT * 3);
    const seed = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const a = rng() * Math.PI * 2;
      const up = Math.pow(rng(), 2.2) * 0.55;
      const sp = 0.6 + rng() * 1.5;
      dir[i * 3] = Math.cos(a) * sp;
      dir[i * 3 + 1] = up * sp;
      dir[i * 3 + 2] = Math.sin(a) * sp;
      seed[i] = rng();
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sparkGeo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    sparkGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  }
  const sparkMat = track(
    new THREE.PointsMaterial({
      color: p.traceHot,
      size: 0.05,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);

  // Energy ring: a scatter of tiny glowing squares expanding across the board
  // (V3's "ring of blue light" is explicitly square-particle based).
  const ringMat = track(
    new THREE.MeshBasicMaterial({
      color: p.traceEdge,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const quad = track(new THREE.PlaneGeometry(1, 1));
  const ring = new THREE.InstancedMesh(quad, ringMat, RING_COUNT);
  {
    const m = new THREE.Matrix4();
    for (let i = 0; i < RING_COUNT; i++) {
      m.identity();
      ring.setMatrixAt(i, m);
    }
    ring.instanceMatrix.needsUpdate = true;
  }
  ring.frustumCulled = false;
  ring.userData.seeds = Array.from({ length: RING_COUNT }, () => ({
    a: rng() * Math.PI * 2,
    jitter: rng(),
    size: 0.04 + rng() * 0.12,
    lag: rng() * 0.25,
  }));
  scene.add(ring);

  // Descent streams: digital particles shed by the chip on its way down.
  const streamGeo = track(new THREE.BufferGeometry());
  {
    const pos = new Float32Array(STREAM_COUNT * 3);
    const seed = new Float32Array(STREAM_COUNT);
    for (let i = 0; i < STREAM_COUNT; i++) {
      pos[i * 3] = (rng() - 0.5) * CHIP_SIZE * 1.05;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = (rng() - 0.5) * CHIP_SIZE * 1.05;
      seed[i] = rng();
    }
    streamGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    streamGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  }
  const streamMat = track(
    new THREE.PointsMaterial({
      color: p.chipEmissive,
      size: 0.04,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const streams = new THREE.Points(streamGeo, streamMat);
  streams.frustumCulled = false;
  scene.add(streams);

  // ------------------------------------------------------------- lighting
  const keyLight = new THREE.DirectionalLight(p.keyLight, 3.1);
  keyLight.position.set(6, 11, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 40;
  const sc = keyLight.shadow.camera;
  sc.left = -9;
  sc.right = 9;
  sc.top = 9;
  sc.bottom = -9;
  sc.updateProjectionMatrix();
  keyLight.shadow.bias = -0.0012;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const fill = new THREE.DirectionalLight(p.fillLight, 1.5);
  fill.position.set(-8, 5, -6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(p.rimLight, 1.6);
  rim.position.set(-3, 2.5, 9);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(p.ambient, p.ambientIntensity));
  scene.add(new THREE.HemisphereLight(p.rimLight, p.board, p.ambientIntensity * 1.4));

  // Animated practical lights that sell the pulse in 3D.
  const chipLight = new THREE.PointLight(p.chipEmissive, 0, 22, 2);
  chipLight.position.set(0, 1.2, 0);
  scene.add(chipLight);

  const waveLight = new THREE.PointLight(p.traceEdge, 0, 40, 2);
  waveLight.position.set(0, 0.8, 0);
  scene.add(waveLight);

  return {
    scene,
    camera,
    boardMat,
    fieldMat,
    chip,
    chipBody,
    chipLid,
    chipPins,
    socket,
    socketPins: socketMat,
    sparks,
    sparkGeo,
    ring,
    streams,
    keyLight,
    chipLight,
    waveLight,
    dispose: () => {
      env.dispose();
      for (const d of disposables) d.dispose();
    },
  };
};
