import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Variant = "v1" | "v2";

type Look = {
  background: number;
  floorNear: number;
  floorFar: number;
  wallBottom: number;
  wallMid: number;
  wallTop: number;
  shadow: number;
  /** coloured light spilled onto the floor by the glowing voxels */
  floorGlow: number;
  floorGlowStrength: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyIntensity: number;
  fillColor: number;
  fillIntensity: number;
  envIntensity: number;
  /** [hue, saturation, lightness, lightness spread] per voxel family */
  primary: [number, number, number, number];
  secondary: [number, number, number, number];
  accent: [number, number, number, number];
  accentEmissive: number;
  accentEmissiveIntensity: number;
  chrome: number;
};

const LOOKS: Record<Variant, Look> = {
  // Reference look: white / charcoal / pale-blue voxels in a light grey studio
  v1: {
    background: 0xb9babd,
    floorNear: 0xdad9dc,
    floorFar: 0xbcbdc0,
    wallBottom: 0xbcbdc0,
    wallMid: 0xb1b2b5,
    wallTop: 0xb1b2b5,
    shadow: 0.33,
    floorGlow: 0x000000,
    floorGlowStrength: 0,
    hemiSky: 0xffffff,
    hemiGround: 0xc9ccd4,
    hemiIntensity: 0.5,
    keyIntensity: 1.0,
    fillColor: 0xdfe8ff,
    fillIntensity: 0.4,
    envIntensity: 0.68,
    primary: [0.62, 0.06, 0.77, 0.1],
    secondary: [0.6, 0.07, 0.1, 0.1],
    accent: [0.595, 0.62, 0.6, 0.1],
    accentEmissive: 0x7fb2f0,
    accentEmissiveIntensity: 0.04,
    chrome: 0xe6eaf0,
  },
  // Alternative look: graphite / steel voxels with glowing amber accents
  // in a dark studio
  v2: {
    background: 0x101114,
    floorNear: 0x363940,
    floorFar: 0x121317,
    wallBottom: 0x121317,
    wallMid: 0x0c0d10,
    wallTop: 0x131418,
    shadow: 0.62,
    floorGlow: 0xff8a1f,
    floorGlowStrength: 0.05,
    hemiSky: 0xcfd8ff,
    hemiGround: 0x2a2420,
    hemiIntensity: 0.45,
    keyIntensity: 1.25,
    fillColor: 0xffb070,
    fillIntensity: 0.45,
    envIntensity: 0.7,
    primary: [0.62, 0.1, 0.045, 0.05],
    secondary: [0.6, 0.08, 0.3, 0.14],
    accent: [0.07, 1.0, 0.42, 0.06],
    accentEmissive: 0xff7a14,
    accentEmissiveIntensity: 0.42,
    chrome: 0xf2e6d8,
  },
};

export type VoxelScene = {
  render: (timeInSeconds: number) => void;
  dispose: () => void;
};

// ---------------------------------------------------------------------------
// Deterministic random numbers (never use Math.random() in Remotion)
// ---------------------------------------------------------------------------
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---------------------------------------------------------------------------
// Scene constants
// ---------------------------------------------------------------------------
const GRID = 7; // 7 x 7 x 7 voxels
const CELL = 6 / GRID; // spacing between voxel centres (cube edge = 6 units)
const VOXEL = CELL * 0.975; // voxel edge length (leaves a hairline gap)
const FLOOR_Y = -6.4;
const ROOM_RADIUS = 60;

// Scatter / re-assemble cycle, measured from the reference clip
const CYCLE_PERIOD = 6.25; // seconds between two "exploded" peaks
const CYCLE_PEAK = 2.0; // time of the first peak

type Kind = "white" | "dark" | "blue" | "chrome";

type Voxel = {
  /** integer lattice coordinates */
  i: number;
  j: number;
  k: number;
  home: THREE.Vector3;
  kind: Kind;
  shade: number;
  index: number;
};

const buildVoxels = (): Voxel[] => {
  const rand = mulberry32(20240613);
  const voxels: Voxel[] = [];
  const half = (GRID - 1) / 2;
  const counters: Record<Kind, number> = {
    white: 0,
    dark: 0,
    blue: 0,
    chrome: 0,
  };

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      for (let k = 0; k < GRID; k++) {
        const home = new THREE.Vector3(
          i - half,
          j - half,
          k - half,
        ).multiplyScalar(CELL);
        const r = rand();
        const kind: Kind =
          r < 0.58 ? "white" : r < 0.81 ? "dark" : r < 0.98 ? "blue" : "chrome";
        voxels.push({
          i,
          j,
          k,
          home,
          kind,
          shade: rand(),
          index: counters[kind]++,
        });
      }
    }
  }
  return voxels;
};

/**
 * The cube opens the way a sliding puzzle does, never by letting voxels
 * pass through each other:
 *
 *  1. every bar of voxels along the cube's X axis slides along X as a rigid
 *     piece (optionally split in two segments that drift apart), and
 *  2. every Z layer additionally slides sideways along Y as a whole slab.
 *
 * Parallel bars stay in their own lanes and layers stay in their own planes,
 * so the motion is collision-free for any combination of the two amounts.
 * The two envelopes run half a cycle apart, so the lattice is never fully
 * closed. New random offsets are drawn each cycle, exactly when the
 * respective envelope is zero, so there is never a jump.
 */
const wave = (t: number, peak: number) =>
  Math.pow(
    0.5 + 0.5 * Math.cos(((t - peak) / CYCLE_PERIOD) * Math.PI * 2),
    1.15,
  );
const cycleIndex = (t: number, peak: number) =>
  Math.floor((t - peak) / CYCLE_PERIOD + 0.5);

const BAR_PEAK = CYCLE_PEAK;
const SLAB_PEAK = CYCLE_PEAK + CYCLE_PERIOD / 2;

type BarMove = { offset: number; cut: number; gap: number };
const barMoveCache = new Map<number, BarMove>();
const barMove = (j: number, k: number, cycle: number): BarMove => {
  const key = (cycle + 8) * 4096 + j * 64 + k;
  let move = barMoveCache.get(key);
  if (!move) {
    const rand = mulberry32(key * 7919 + 13);
    rand();
    const offset = (rand() * 2 - 1) * 1.15;
    const split = rand() < 0.6;
    move = {
      offset,
      cut: split ? 1 + Math.floor(rand() * (GRID - 1)) : GRID,
      gap: split ? 0.35 + 0.75 * rand() : 0,
    };
    barMoveCache.set(key, move);
  }
  return move;
};
const slabOffset = (k: number, cycle: number) => {
  const rand = mulberry32((cycle + 8) * 131 + k * 17 + 5);
  rand();
  return (rand() * 2 - 1) * 0.8;
};
const barDelay = (j: number, k: number) => {
  const rand = mulberry32(j * 97 + k * 389 + 3);
  rand();
  return rand() * 0.7;
};

/** Displacement of a voxel from its home position, in cube space */
const scatterOffset = (v: Voxel, t: number, out: THREE.Vector3) => {
  // 1. bars sliding along X (the clip ends on a loosely closed cube, so the
  //    last peak is damped)
  const tb = t - barDelay(v.j, v.k);
  const t01 = Math.min(1, Math.max(0, (t - 16.5) / 3.5));
  const damp = 1 - 0.55 * t01 * t01 * (3 - 2 * t01);
  const sBar = wave(tb, BAR_PEAK) * damp;
  const move = barMove(v.j, v.k, cycleIndex(tb, BAR_PEAK));
  const x = move.offset + (v.i >= move.cut ? move.gap * 0.5 : -move.gap * 0.5);

  // 2. layers sliding along Y
  const ts = t - v.k * 0.09;
  const sSlab = wave(ts, SLAB_PEAK);
  const y = slabOffset(v.k, cycleIndex(ts, SLAB_PEAK));

  out.set(x * sBar * CELL, y * sSlab * CELL, 0);
  return sBar;
};

// ---------------------------------------------------------------------------
// Studio backdrop (seamless cyclorama): unlit gradient shaders
// ---------------------------------------------------------------------------
const floorMaterial = (look: Look) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uNear: { value: new THREE.Color(look.floorNear) },
      uGlow: { value: new THREE.Color(look.floorGlow) },
      uGlowStrength: { value: look.floorGlowStrength },
      uFar: { value: new THREE.Color(look.floorFar) },
      uRadius: { value: ROOM_RADIUS },
      uShadowCenter: { value: new THREE.Vector2(0, 2.6) },
      uShadowSize: { value: new THREE.Vector2(7.5, 5.0) },
      uShadowStrength: { value: 0.3 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uNear;
      uniform vec3 uFar;
      uniform vec3 uGlow;
      uniform float uGlowStrength;
      uniform float uRadius;
      uniform vec2 uShadowCenter;
      uniform vec2 uShadowSize;
      uniform float uShadowStrength;
      varying vec3 vWorld;
      void main() {
        float r = length(vWorld.xz) / uRadius;
        vec3 col = mix(uNear, uFar, smoothstep(0.08, 0.6, r));
        // soft contact shadow under the floating cube
        vec2 d = (vWorld.xz - uShadowCenter) / uShadowSize;
        float s = exp(-dot(d, d) * 1.1);
        s = s * (0.55 + 0.45 * s);
        col *= 1.0 - uShadowStrength * s;
        col += uGlow * uGlowStrength * exp(-dot(d, d) * 0.28);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        // noise dither: keeps the smooth gradients free of banding
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor.rgb += (n - 0.5) / 255.0;
      }
    `,
  });

const wallMaterial = (look: Look) =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uBottom: { value: new THREE.Color(look.wallBottom) },
      uMid: { value: new THREE.Color(look.wallMid) },
      uTop: { value: new THREE.Color(look.wallTop) },
      uFloorY: { value: FLOOR_Y },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBottom;
      uniform vec3 uMid;
      uniform vec3 uTop;
      uniform float uFloorY;
      varying vec3 vWorld;
      void main() {
        float h = vWorld.y - uFloorY;
        // blurred floor/wall seam, then a gentle lift towards the ceiling
        vec3 col = mix(uBottom, uMid, smoothstep(0.0, 4.5, h));
        col = mix(col, uTop, smoothstep(9.0, 45.0, h));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        // noise dither: keeps the smooth gradients free of banding
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor.rgb += (n - 0.5) / 255.0;
      }
    `,
  });

// ---------------------------------------------------------------------------
// Scene factory
// ---------------------------------------------------------------------------
export const createVoxelScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  variant: Variant,
): VoxelScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const look = LOOKS[variant];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.background);

  // Image-based lighting for soft studio reflections on the voxels
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = look.envIntensity;

  // Backdrop
  const floorMat = floorMaterial(look);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM_RADIUS, 96),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 140, 96, 1, true),
    wallMaterial(look),
  );
  wall.position.y = FLOOR_Y + 70 - 0.01;
  scene.add(wall);

  // Lights
  scene.add(
    new THREE.HemisphereLight(
      look.hemiSky,
      look.hemiGround,
      look.hemiIntensity,
    ),
  );
  const key = new THREE.DirectionalLight(0xffffff, look.keyIntensity);
  key.position.set(-7, 15, 13);
  scene.add(key);
  const fill = new THREE.DirectionalLight(look.fillColor, look.fillIntensity);
  fill.position.set(12, -2, 8);
  scene.add(fill);

  // Voxels
  const voxels = buildVoxels();
  const count = (kind: Kind) => voxels.filter((v) => v.kind === kind).length;
  const geometry = new RoundedBoxGeometry(VOXEL, VOXEL, VOXEL, 3, 0.018);

  const materials: Record<Kind, THREE.MeshStandardMaterial> = {
    white: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.14,
      metalness: 0.06,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.5,
    }),
    blue: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1,
      emissive: look.accentEmissive,
      emissiveIntensity: look.accentEmissiveIntensity,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: look.chrome,
      roughness: 0.06,
      metalness: 1.0,
    }),
  };

  const cube = new THREE.Group();
  scene.add(cube);

  const meshes = {} as Record<Kind, THREE.InstancedMesh>;
  (Object.keys(materials) as Kind[]).forEach((kind) => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      materials[kind],
      count(kind),
    );
    mesh.frustumCulled = false;
    meshes[kind] = mesh;
    cube.add(mesh);
  });

  const tint = new THREE.Color();
  voxels.forEach((v) => {
    if (v.kind === "white") {
      tint.setHSL(
        look.primary[0],
        look.primary[1],
        look.primary[2] + look.primary[3] * v.shade,
      );
    } else if (v.kind === "dark") {
      tint.setHSL(
        look.secondary[0],
        look.secondary[1],
        look.secondary[2] + look.secondary[3] * v.shade,
      );
    } else if (v.kind === "blue") {
      tint.setHSL(
        look.accent[0],
        look.accent[1],
        look.accent[2] + look.accent[3] * v.shade,
      );
    } else {
      tint.setRGB(1, 1, 1);
    }
    meshes[v.kind].setColorAt(v.index, tint);
  });
  (Object.keys(meshes) as Kind[]).forEach((kind) => {
    const c = meshes[kind].instanceColor;
    if (c) c.needsUpdate = true;
  });

  // Camera
  const camera = new THREE.PerspectiveCamera(24, width / height, 0.5, 400);
  const target = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const offset = new THREE.Vector3();

  const placeCamera = (t: number, duration: number) => {
    if (variant === "v1") {
      // Locked-off studio camera, exactly like the reference
      camera.position.set(0, -1.45, 36);
      target.set(0, -1.45, 0);
      camera.lookAt(target);
      return;
    }
    // Alternative version: besides the new palette, the camera drifts on a
    // slow three-quarter orbit with a gentle dolly-in
    const p = t / duration;
    const eased = p * p * (3 - 2 * p);
    const azimuth = THREE.MathUtils.degToRad(-42 + 84 * eased);
    const elevation = THREE.MathUtils.degToRad(27 - 15 * eased);
    const distance = 48 - 11 * eased;
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance - 0.6,
      Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    target.set(0, -1.1 + 0.5 * eased, 0);
    camera.lookAt(target);
  };

  const render = (t: number) => {
    // Slow, constant-rate multi-axis tumble of the whole assembly
    cube.rotation.set(0.62 + 0.17 * t, 0.7 + 0.21 * t, 0.22 + 0.1 * t, "ZXY");

    let spread = 0;
    for (const v of voxels) {
      spread += scatterOffset(v, t, offset);
      position.copy(v.home).add(offset);
      matrix.makeTranslation(position.x, position.y, position.z);
      meshes[v.kind].setMatrixAt(v.index, matrix);
    }
    spread /= voxels.length;
    (Object.keys(meshes) as Kind[]).forEach((kind) => {
      meshes[kind].instanceMatrix.needsUpdate = true;
    });

    // The contact shadow widens and softens when the cube opens up
    floorMat.uniforms.uShadowSize.value.set(
      5.0 + 1.2 * spread,
      3.4 + 0.9 * spread,
    );
    floorMat.uniforms.uShadowStrength.value = look.shadow * (1 - 0.18 * spread);

    placeCamera(t, 20);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  const dispose = () => {
    geometry.dispose();
    Object.values(materials).forEach((m) => m.dispose());
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { render, dispose };
};
