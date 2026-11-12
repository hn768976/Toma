import * as THREE from "three";
import { PostPipeline } from "../lib/PostPipeline";
import {
  SceneFactory,
  clamp01,
  easeInOutCubic,
  easeOutExpo,
  lerp,
  mulberry32,
  smoothstep,
} from "../lib/ThreeStage";

export type CameraVariant = "reference" | "orbit";

/** Timeline (frames @ 30 fps, 141 frames total = 4.7 s) */
export const LAND_FRAME = 40; // module docks into the core, core ignites
const PULLBACK_FRAMES = 9; // fast dolly-out after ignition

const VOX = 8; // voxels per cube edge
const VS = 0.3; // voxel pitch
const CUBE = VOX * VS; // 2.4 units
const PLINTH_H = 0.36;
const CUBE_BASE = PLINTH_H;
const CUBE_TOP = CUBE_BASE + CUBE;
const SLOT_FLOOR = CUBE_BASE + 7 * VS;

const ORANGE_DIM = new THREE.Color().setRGB(1.0, 0.24, 0.07);
const ORANGE_HOT = new THREE.Color().setRGB(1.0, 0.5, 0.12);
const CYAN = new THREE.Color("#7fdcff");

// ---------------------------------------------------------------------------
// procedural textures
// ---------------------------------------------------------------------------
const makeCanvasTexture = (size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};

/** Glowing voxel face: soft inner gradient, thin dark seam, occasional sub-division. */
const brickTexture = () =>
  makeCanvasTexture(128, (g, s) => {
    g.fillStyle = "#2a0a03";
    g.fillRect(0, 0, s, s);
    const drawCell = (x: number, y: number, w: number, h: number, v: number) => {
      const grad = g.createRadialGradient(x + w * 0.5, y + h * 0.45, 2, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.75);
      grad.addColorStop(0, `rgb(255,${Math.round(225 * v)},${Math.round(170 * v)})`);
      grad.addColorStop(1, `rgb(${Math.round(225 * v)},${Math.round(130 * v)},${Math.round(70 * v)})`);
      g.fillStyle = grad;
      g.fillRect(x + 3, y + 3, w - 6, h - 6);
    };
    drawCell(0, 0, s, s * 0.55, 1);
    drawCell(0, s * 0.55, s * 0.6, s * 0.45, 0.88);
    drawCell(s * 0.6, s * 0.55, s * 0.4, s * 0.45, 0.94);
  });

/** Greeble / circuit texture for dark metal surfaces (used as emissive dots + roughness variation). */
const circuitTexture = (seed: number) =>
  makeCanvasTexture(256, (g, s) => {
    const rnd = mulberry32(seed);
    g.fillStyle = "#000";
    g.fillRect(0, 0, s, s);
    // dot matrices
    for (let k = 0; k < 14; k++) {
      const x0 = Math.floor(rnd() * 14) * 16 + 8;
      const y0 = Math.floor(rnd() * 14) * 16 + 8;
      const cols = 2 + Math.floor(rnd() * 5);
      const rows = 1 + Math.floor(rnd() * 3);
      const a = 0.35 + rnd() * 0.65;
      g.fillStyle = `rgba(200,235,255,${a})`;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          g.beginPath();
          g.arc(x0 + i * 6, y0 + j * 6, 1.6, 0, Math.PI * 2);
          g.fill();
        }
    }
    // thin traces
    g.strokeStyle = "rgba(120,200,255,0.35)";
    g.lineWidth = 1.2;
    for (let k = 0; k < 10; k++) {
      g.beginPath();
      let x = rnd() * s;
      let y = rnd() * s;
      g.moveTo(x, y);
      for (let j = 0; j < 3; j++) {
        if (rnd() > 0.5) x += (rnd() - 0.5) * 120;
        else y += (rnd() - 0.5) * 120;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });

const roughnessTexture = () =>
  makeCanvasTexture(256, (g, s) => {
    const rnd = mulberry32(99);
    g.fillStyle = "#6a6a6a";
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 220; k++) {
      const v = Math.floor(40 + rnd() * 160);
      g.fillStyle = `rgb(${v},${v},${v})`;
      const w = 4 + rnd() * 40;
      const h = 2 + rnd() * 18;
      g.fillRect(rnd() * s, rnd() * s, w, h);
    }
  });

// ---------------------------------------------------------------------------
// environment: cold blue sky dome used only for reflections
// ---------------------------------------------------------------------------
const buildEnvironment = (renderer: THREE.WebGLRenderer, warm: number) => {
  const envScene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uWarm: { value: warm } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      varying vec3 vDir; uniform float uWarm;
      void main(){
        vec3 d = normalize(vDir);
        float up = clamp(d.y, -1.0, 1.0);
        vec3 key = normalize(vec3(-0.85, 0.3, -0.42));
        float k = pow(max(dot(d, key), 0.0), 40.0);
        vec2 az2 = normalize(d.xz + 1e-4);
        float az = max(dot(az2, normalize(vec2(-0.85, -0.42))), 0.0);
        vec3 sky = mix(vec3(0.0,0.001,0.002), vec3(0.035,0.10,0.19), smoothstep(0.15, 0.9, up));
        sky += vec3(0.02,0.06,0.12) * smoothstep(0.1, 0.5, up) * smoothstep(0.95, 0.5, up) * (0.4 + az);
        // bright cold band low on the horizon behind the subject: only grazing
        // (distant) reflections pick it up, so near blocks stay dark
        float band = smoothstep(0.55, 0.06, up) * smoothstep(-0.03, 0.05, up);
        sky += vec3(0.25, 0.68, 1.15) * band * (0.35 + 1.6 * pow(az, 2.0)) * 3.2;
        sky += vec3(0.5, 0.85, 1.2) * k * 3.0;
        float strip = smoothstep(0.03, 0.0, abs(d.y - 0.55)) * 0.25 * az;
        sky += vec3(0.4,0.7,1.0) * strip;
        sky = mix(sky, sky + vec3(0.9,0.35,0.05) * smoothstep(0.2, -0.3, up), uWarm);
        gl_FragColor = vec4(sky, 1.0);
      }`,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  mat.dispose();
  return rt;
};

// ---------------------------------------------------------------------------
// circuit-city ground made of instanced blocks
// ---------------------------------------------------------------------------
type GroundUniforms = {
  uIgnite: { value: number };
  uRadius: { value: number };
  uTime: { value: number };
  uWarm: { value: THREE.Color };
};

const buildGround = (scene: THREE.Scene, env: THREE.Texture, rough: THREE.Texture) => {
  const rnd = mulberry32(1234);
  const cell = 0.6;
  const half = 34;
  type Block = { x: number; z: number; w: number; d: number; h: number; tone: number; seed: number };
  const blocks: Block[] = [];
  const n = Math.round((half * 2) / cell);
  const used = new Uint8Array(n * n);
  const idx = (i: number, j: number) => i * n + j;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (used[idx(i, j)]) continue;
      const x = -half + (i + 0.5) * cell;
      const z = -half + (j + 0.5) * cell;
      // clear pad around the core
      if (Math.abs(x) < 1.95 && Math.abs(z) < 1.95) continue;
      // keep "bus lanes" (gaps) on a few rows/columns so light streaks have a road to travel on
      const lane = i % 7 === 3 || j % 7 === 3;
      const r = rnd();
      const tone = 0.55 + rnd() * 0.9;
      const seed = rnd();
      if (lane) {
        blocks.push({ x, z, w: cell * 0.94, d: cell * 0.94, h: 0.03 + rnd() * 0.03, tone: tone * 0.7, seed });
        continue;
      }
      if (r < 0.16 && i + 1 < n && j + 1 < n && !used[idx(i + 1, j)] && !used[idx(i, j + 1)] && (i + 1) % 7 !== 3 && (j + 1) % 7 !== 3) {
        used[idx(i + 1, j)] = 1;
        used[idx(i, j + 1)] = 1;
        used[idx(i + 1, j + 1)] = 1;
        const h = 0.15 + Math.pow(rnd(), 2) * 0.9;
        blocks.push({ x: x + cell / 2, z: z + cell / 2, w: cell * 1.92, d: cell * 1.92, h, tone, seed });
      } else if (r < 0.55) {
        for (let a = 0; a < 2; a++)
          for (let b = 0; b < 2; b++) {
            const h = 0.04 + Math.pow(rnd(), 1.6) * 0.55;
            blocks.push({
              x: x + (a - 0.5) * cell * 0.5,
              z: z + (b - 0.5) * cell * 0.5,
              w: cell * 0.44,
              d: cell * 0.44,
              h,
              tone: 0.55 + rnd() * 0.9,
              seed: rnd(),
            });
          }
      } else if (r < 0.8) {
        const h = 0.06 + Math.pow(rnd(), 1.5) * 0.65;
        const long = rnd() > 0.5;
        blocks.push({ x, z, w: cell * (long ? 0.92 : 0.6), d: cell * (long ? 0.6 : 0.92), h, tone, seed });
      } else {
        const h = 0.05 + Math.pow(rnd(), 1.8) * 0.75;
        blocks.push({ x, z, w: cell * 0.92, d: cell * 0.92, h, tone, seed });
      }
    }
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const seeds = new Float32Array(blocks.length);
  blocks.forEach((b, i) => (seeds[i] = b.seed));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));

  const uniforms: GroundUniforms = {
    uIgnite: { value: 0 },
    uRadius: { value: 0 },
    uTime: { value: 0 },
    uWarm: { value: new THREE.Color().setRGB(1.0, 0.33, 0.06) },
  };
  const mat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    metalness: 0.9,
    roughness: 0.2,
    roughnessMap: rough,
    envMap: env,
    envMapIntensity: 0.8,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         attribute float aSeed; varying float vSeed; varying vec3 vWPos; varying float vTopFace;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
         vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
         vWPos = wp.xyz; vSeed = aSeed; vTopFace = step(0.5, normal.y);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uIgnite; uniform float uRadius; uniform float uTime; uniform vec3 uWarm;
         varying float vSeed; varying vec3 vWPos; varying float vTopFace;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         {
           float d = length(vWPos.xz);
           float front = smoothstep(uRadius, uRadius - 2.5, d);
           float near = exp(-d / 3.2);
           float lit = step(0.93, fract(vSeed * 13.7 + floor(uTime * 1.5 + vSeed * 4.0) * 0.37));
           float g = uIgnite * front * (exp(-d / 2.2) * 0.4 + lit * exp(-d / 3.0) * 0.25);
           totalEmissiveRadiance += uWarm * g * vTopFace * (0.3 + vSeed);
           // faint warm floor bounce right around the core
           totalEmissiveRadiance += uWarm * uIgnite * exp(-d / 1.4) * 0.35;
         }`,
      );
  };
  const mesh = new THREE.InstancedMesh(geo, mat, blocks.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  blocks.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d);
    m.setPosition(b.x, 0, b.z);
    mesh.setMatrixAt(i, m);
    const v = 0.05 * b.tone;
    col.setRGB(v * 0.8, v * 1.0, v * 1.2);
    mesh.setColorAt(i, col);
  });
  scene.add(mesh);

  // floor slab under everything
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: "#020406", metalness: 0.6, roughness: 0.5, envMap: env }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  return { mesh, uniforms, blocks };
};

// ---------------------------------------------------------------------------
// the core cube
// ---------------------------------------------------------------------------
const buildCore = (scene: THREE.Scene, env: THREE.Texture, rough: THREE.Texture, circuit: THREE.Texture) => {
  const group = new THREE.Group();
  scene.add(group);
  const rnd = mulberry32(42);

  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#0b1016",
    metalness: 0.9,
    roughness: 0.32,
    roughnessMap: rough,
    envMap: env,
    envMapIntensity: 1.3,
    emissive: new THREE.Color("#bfe8ff"),
    emissiveMap: circuit,
    emissiveIntensity: 0.6,
  });

  // plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(CUBE + 0.5, PLINTH_H, CUBE + 0.5), darkMetal);
  plinth.position.y = PLINTH_H / 2;
  group.add(plinth);

  // cyan light bars around the base of the cube
  const barMat = new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(3) });
  const barGeo = new THREE.BoxGeometry(1, 1, 1);
  const bars: THREE.Mesh[] = [];
  const addBar = (x: number, z: number, w: number, d: number) => {
    const b = new THREE.Mesh(barGeo, barMat);
    b.scale.set(w, 0.035, d);
    b.position.set(x, PLINTH_H + 0.02, z);
    group.add(b);
    bars.push(b);
  };
  const e = CUBE / 2 + 0.06;
  for (let k = 0; k < 4; k++) {
    const segs = 3;
    for (let s = 0; s < segs; s++) {
      const len = 0.45 + rnd() * 0.3;
      const p = -CUBE / 2 + 0.3 + (s / segs) * CUBE + rnd() * 0.2;
      if (k === 0) addBar(p, e, len, 0.04);
      if (k === 1) addBar(p, -e, len, 0.04);
      if (k === 2) addBar(e, p, 0.04, len);
      if (k === 3) addBar(-e, p, 0.04, len);
    }
  }

  // inner dark core so voxel gaps read as dark seams
  const inner = new THREE.Mesh(
    new THREE.BoxGeometry(CUBE - 0.08, SLOT_FLOOR - CUBE_BASE - 0.08, CUBE - 0.08),
    new THREE.MeshBasicMaterial({ color: "#050101" }),
  );
  inner.position.y = (CUBE_BASE + 0.05 + SLOT_FLOOR - 0.03) / 2;
  group.add(inner);

  // shell voxels
  type Vox = { x: number; y: number; z: number; kind: "glow" | "dark"; h: number };
  const voxels: Vox[] = [];
  for (let ix = 0; ix < VOX; ix++)
    for (let iy = 0; iy < VOX; iy++)
      for (let iz = 0; iz < VOX; iz++) {
        const shell = ix === 0 || iz === 0 || ix === VOX - 1 || iz === VOX - 1 || iy === VOX - 1;
        if (!shell) continue;
        const inSlot = ix >= 3 && ix <= 4 && iz >= 3 && iz <= 4 && iy >= 7;
        if (inSlot) continue;
        const kind = iy >= 1 && iy <= 5 ? "glow" : "dark";
        const topJitter = iy === VOX - 1 ? (rnd() < 0.2 ? rnd() * 0.08 : -rnd() * 0.1) : 0;
        voxels.push({
          x: (ix - VOX / 2 + 0.5) * VS,
          y: CUBE_BASE + (iy + 0.5) * VS + topJitter,
          z: (iz - VOX / 2 + 0.5) * VS,
          kind,
          h: 1,
        });
      }
  // slot walls (the 2x2 hole is 2 voxels deep) are covered by neighbours; add a dark liner
  const glowVox = voxels.filter((v) => v.kind === "glow");
  const darkVox = voxels.filter((v) => v.kind === "dark");
  const vGeo = new THREE.BoxGeometry(VS * 0.965, VS * 0.965, VS * 0.965);

  const brick = brickTexture();
  const glowMat = new THREE.MeshBasicMaterial({ color: ORANGE_DIM.clone(), map: brick });
  const glowMesh = new THREE.InstancedMesh(vGeo, glowMat, glowVox.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  glowVox.forEach((v, i) => {
    m.makeTranslation(v.x, v.y, v.z);
    glowMesh.setMatrixAt(i, m);
    const dim = rnd() < 0.12 ? 0.35 : 1;
    const k = (0.5 + rnd() * 0.75) * dim;
    c.setRGB(k, k * (0.7 + rnd() * 0.4), k * (0.6 + rnd() * 0.5));
    glowMesh.setColorAt(i, c);
  });
  group.add(glowMesh);

  const darkMesh = new THREE.InstancedMesh(vGeo, darkMat(darkMetal), darkVox.length);
  darkVox.forEach((v, i) => {
    m.makeTranslation(v.x, v.y, v.z);
    darkMesh.setMatrixAt(i, m);
    const k = 0.7 + rnd() * 0.6;
    c.setRGB(k, k, k);
    darkMesh.setColorAt(i, c);
  });
  group.add(darkMesh);

  // greebles on the roof
  const greebleGeo = new THREE.BoxGeometry(1, 1, 1);
  const greebles = new THREE.InstancedMesh(greebleGeo, darkMetal, 70);
  for (let i = 0; i < 70; i++) {
    let gx = (rnd() - 0.5) * (CUBE - 0.2);
    const gz = (rnd() - 0.5) * (CUBE - 0.2);
    if (Math.abs(gx) < 0.45 && Math.abs(gz) < 0.45) gx += gx < 0 ? -0.5 : 0.5;
    const s = 0.05 + rnd() * 0.16;
    m.makeScale(s, 0.02 + rnd() * 0.08, s * (0.5 + rnd()));
    m.setPosition(gx, CUBE_TOP, gz);
    greebles.setMatrixAt(i, m);
  }
  group.add(greebles);

  // slot floor light + rim frame
  const slotMat = new THREE.MeshBasicMaterial({ color: ORANGE_HOT.clone() });
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(VS * 2 - 0.02, VS * 2 - 0.02), slotMat);
  slot.rotation.x = -Math.PI / 2;
  slot.position.y = SLOT_FLOOR + 0.002;
  group.add(slot);
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd2a0") });
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 4, 1), rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.rotation.z = Math.PI / 4;
  rim.position.y = CUBE_TOP + 0.005;
  group.add(rim);

  // descending module
  const module = new THREE.Group();
  const modBody = new THREE.Mesh(new THREE.BoxGeometry(VS * 2 - 0.03, VS - 0.02, VS * 2 - 0.03), darkMetal);
  module.add(modBody);
  const modGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#dff4ff").multiplyScalar(4) });
  const modEdge = new THREE.Mesh(new THREE.BoxGeometry(VS * 2 - 0.02, 0.025, VS * 2 - 0.02), modGlowMat);
  modEdge.position.y = -VS / 2 + 0.02;
  module.add(modEdge);
  // little docking pins
  for (const [px, pz] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), modGlowMat);
    pin.position.set(px, -VS / 2 - 0.05, pz);
    module.add(pin);
  }
  // warm inner face showing through one side
  const modWarm = new THREE.Mesh(
    new THREE.PlaneGeometry(VS * 1.6, VS * 0.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff8a3a").multiplyScalar(0.05), map: brick }),
  );
  modWarm.position.set(0, 0, VS - 0.004);
  module.add(modWarm);
  group.add(module);

  // core light
  const coreLight = new THREE.PointLight("#ff8a2a", 0, 0, 2);
  coreLight.position.set(0, CUBE_BASE + CUBE * 0.5, 0);
  group.add(coreLight);
  const topLight = new THREE.PointLight("#ffb060", 0, 0, 2);
  topLight.position.set(0, SLOT_FLOOR + 0.3, 0);
  group.add(topLight);

  return { group, glowMat, slotMat, rimMat, module, modGlowMat, coreLight, topLight, barMat, modWarm };
};

// dark voxel material shares the dark metal look but keeps instance colour variation
const darkMat = (base: THREE.MeshStandardMaterial) => {
  const m = base.clone();
  m.emissiveIntensity = 0.75;
  return m;
};

// ---------------------------------------------------------------------------
// light streaks travelling along the lanes
// ---------------------------------------------------------------------------
type Streak = { axis: 0 | 1; lane: number; dir: 1 | -1; start: number; speed: number; len: number; delay: number; hue: number };

const buildStreaks = (scene: THREE.Scene) => {
  const rnd = mulberry32(777);
  const cell = 0.6;
  const laneCoords: number[] = [];
  for (let i = 0; i < 114; i++) if (i % 7 === 3) laneCoords.push(-34 + (i + 0.5) * cell);
  laneCoords.push(-CUBE / 2 - 0.3, CUBE / 2 + 0.3, -0.01);
  const streaks: Streak[] = [];
  for (let i = 0; i < 150; i++) {
    const lane = laneCoords[Math.floor(rnd() * laneCoords.length)];
    streaks.push({
      axis: rnd() > 0.5 ? 0 : 1,
      lane,
      dir: rnd() > 0.5 ? 1 : -1,
      start: (rnd() - 0.5) * 50,
      speed: 3 + rnd() * 9,
      len: 0.6 + rnd() * 3.2,
      delay: rnd(),
      hue: rnd(),
    });
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: true });
  const mesh = new THREE.InstancedMesh(geo, mat, streaks.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(streaks.length * 3), 3);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // long, faint static guide lines along the lanes nearest the core
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff6a20").multiplyScalar(0.25) });
  const guides = new THREE.Group();
  const guideLanes = [-CUBE / 2 - 0.3, CUBE / 2 + 0.3, ...laneCoords.filter((l) => Math.abs(l) < 9)];
  for (const l of guideLanes) {
    const a = new THREE.Mesh(geo, lineMat);
    a.scale.set(70, 0.012, 0.018);
    a.position.set(0, 0.07, l);
    guides.add(a);
    const b = new THREE.Mesh(geo, lineMat);
    b.scale.set(0.018, 0.012, 70);
    b.position.set(l, 0.07, 0);
    guides.add(b);
  }
  scene.add(guides);

  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const update = (t: number, ignite: number, pre: number) => {
    streaks.forEach((s, i) => {
      const travel = s.start + s.dir * s.speed * t;
      const wrapped = ((((travel + 30) % 60) + 60) % 60) - 30;
      const along = wrapped;
      const dist = Math.hypot(along, s.lane);
      // after ignition, streaks are strong near the core and fade with distance
      const energy = pre * 0.06 + ignite * (0.18 + 1.3 * Math.exp(-dist / 6));
      const twinkle = 0.6 + 0.4 * Math.sin(t * 7 + s.delay * 30);
      const k = energy * twinkle * (s.delay > 0.35 ? 1 : 0.4);
      const thick = 0.012 + s.hue * 0.012;
      if (s.axis === 0) {
        m.makeScale(s.len, thick, thick);
        m.setPosition(along, 0.075, s.lane);
      } else {
        m.makeScale(thick, thick, s.len);
        m.setPosition(s.lane, 0.075, along);
      }
      mesh.setMatrixAt(i, m);
      const warm = s.hue < 0.9;
      if (warm) c.setRGB(4.0 * k, 1.6 * k, 0.45 * k);
      else c.setRGB(1.6 * k, 3.2 * k, 4.2 * k);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    lineMat.color.setRGB(1.0, 0.38, 0.1).multiplyScalar(0.03 + 0.16 * ignite);
  };
  return { update };
};

// ---------------------------------------------------------------------------
// floating dot-matrix particles (render as round sprites; DOF turns them to bokeh)
// ---------------------------------------------------------------------------
const buildDots = (scene: THREE.Scene) => {
  const rnd = mulberry32(2024);
  const pos: number[] = [];
  const seed: number[] = [];
  const group: number[] = [];
  const addMatrix = (x: number, y: number, z: number, cols: number, rows: number, axis: number, step: number, g: number) => {
    const s = rnd();
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        if (rnd() < 0.18) continue;
        if (axis === 0) pos.push(x + i * step, y + j * step, z);
        else if (axis === 1) pos.push(x, y + j * step, z + i * step);
        else pos.push(x + i * step, y, z + j * step);
        seed.push(s + rnd() * 0.15);
        group.push(g);
      }
  };
  // clusters lying on the city
  for (let k = 0; k < 150; k++) {
    const r = 2.5 + Math.pow(rnd(), 0.8) * 22;
    const a = rnd() * Math.PI * 2;
    addMatrix(Math.cos(a) * r, 0.25 + rnd() * 0.6, Math.sin(a) * r, 2 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 3), 2, 0.09, 0);
  }
  // holographic matrices hugging the cube sides
  for (let k = 0; k < 22; k++) {
    const side = Math.floor(rnd() * 4);
    const off = CUBE / 2 + 0.12 + rnd() * 0.35;
    const p = (rnd() - 0.5) * (CUBE - 0.6);
    const y = CUBE_BASE + 0.1 + rnd() * (CUBE - 0.2);
    const cols = 2 + Math.floor(rnd() * 4);
    const rows = 2 + Math.floor(rnd() * 4);
    if (side === 0) addMatrix(p, y, off, cols, rows, 0, 0.07, 1);
    if (side === 1) addMatrix(p, y, -off, cols, rows, 0, 0.07, 1);
    if (side === 2) addMatrix(off, y, p, cols, rows, 1, 0.07, 1);
    if (side === 3) addMatrix(-off, y, p, cols, rows, 1, 0.07, 1);
  }
  // on the roof
  for (let k = 0; k < 10; k++) {
    const x = (rnd() - 0.5) * (CUBE - 0.4);
    const z = (rnd() - 0.5) * (CUBE - 0.4);
    if (Math.abs(x) < 0.5 && Math.abs(z) < 0.5) continue;
    addMatrix(x, CUBE_TOP + 0.03, z, 2 + Math.floor(rnd() * 4), 2 + Math.floor(rnd() * 3), 2, 0.06, 2);
  }
  // free-floating sparks around the core
  for (let k = 0; k < 160; k++) {
    const r = 1.6 + rnd() * 3.5;
    const a = rnd() * Math.PI * 2;
    pos.push(Math.cos(a) * r, 0.3 + rnd() * 4.5, Math.sin(a) * r);
    seed.push(rnd());
    group.push(3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute("aGroup", new THREE.Float32BufferAttribute(group, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIgnite: { value: 0 },
      uPx: { value: 1 },
      uColor: { value: new THREE.Color("#bfe9ff") },
      uWarm: { value: new THREE.Color("#ffb060") },
    },
    vertexShader: `
      attribute float aSeed; attribute float aGroup;
      uniform float uTime; uniform float uIgnite; uniform float uPx;
      varying float vA; varying float vWarm;
      void main(){
        vec3 p = position;
        if (aGroup > 2.5) {
          p.y += mod(uTime * (0.3 + aSeed * 0.6) + aSeed * 5.0, 5.0) * uIgnite;
          p.xz *= 1.0 + uIgnite * 0.05 * sin(uTime + aSeed * 20.0);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = step(0.25, fract(sin(floor(uTime * 6.0 + aSeed * 11.0) * 91.7 + aSeed * 13.1) * 43758.5));
        float a = mix(1.0, blink, 0.6);
        if (aGroup > 2.5) a *= 0.35 + 0.65 * uIgnite;
        vA = a; vWarm = (aGroup > 2.5) ? uIgnite * step(0.5, aSeed) : 0.0;
        gl_PointSize = clamp(0.035 * uPx / -mv.z, 1.5, 60.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uWarm; varying float vA; varying float vWarm;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        float a = smoothstep(0.5, 0.32, d);
        gl_FragColor = vec4(mix(uColor, uWarm, vWarm) * 3.2 * a * vA, 1.0);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { mat };
};

// ---------------------------------------------------------------------------
// camera rigs
// ---------------------------------------------------------------------------
type Pose = { target: THREE.Vector3; yaw: number; pitch: number; dist: number; fov: number; roll: number };
const pose = (tx: number, ty: number, tz: number, yawDeg: number, pitchDeg: number, dist: number, fov: number, roll = 0): Pose => ({
  target: new THREE.Vector3(tx, ty, tz),
  yaw: (yawDeg * Math.PI) / 180,
  pitch: (pitchDeg * Math.PI) / 180,
  dist,
  fov,
  roll,
});
const mixPose = (a: Pose, b: Pose, t: number): Pose => ({
  target: a.target.clone().lerp(b.target, t),
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), t)),
  fov: lerp(a.fov, b.fov, t),
  roll: lerp(a.roll, b.roll, t),
});

const referenceRig = (f: number): Pose => {
  // close-up: module descends, camera tilts down with it
  const tA = clamp01(f / LAND_FRAME);
  const closeStart = pose(0, CUBE_TOP + 1.45, 0, 45, 26, 10.6, 30);
  const closeEnd = pose(0, CUBE_TOP + 0.3, 0, 45.5, 27, 10.2, 30);
  const close = mixPose(closeStart, closeEnd, easeInOutCubic(tA));
  // wide: fast dolly-out on ignition then slow drift
  const wideA = pose(-0.2, 0.9, 0.3, 47, 41, 16.5, 34);
  const wideB = pose(-0.35, 0.85, 0.45, 50.5, 39.5, 17.6, 34);
  const drift = mixPose(wideA, wideB, clamp01((f - LAND_FRAME - PULLBACK_FRAMES) / (141 - LAND_FRAME - PULLBACK_FRAMES)));
  if (f < LAND_FRAME) return close;
  const tp = easeOutExpo(clamp01((f - LAND_FRAME) / PULLBACK_FRAMES));
  return mixPose(closeEnd, drift, tp);
};

const orbitRig = (f: number): Pose => {
  // alternative: low hero angle orbiting the core while the module docks,
  // then a crane-up into a near top-down orbit across the lit city
  const tA = clamp01(f / LAND_FRAME);
  const lowStart = pose(0, CUBE_TOP + 0.9, 0, -20, 4, 8.6, 38, -2);
  const lowEnd = pose(0, CUBE_TOP - 0.2, 0, 32, 9, 7.8, 38, 1.5);
  const low = mixPose(lowStart, lowEnd, easeInOutCubic(tA));
  const craneEnd = pose(0, 1.0, 0, 128, 66, 13.0, 40, 0);
  const tB = clamp01((f - LAND_FRAME) / (141 - LAND_FRAME));
  if (f < LAND_FRAME) return low;
  // crane: pitch/dist lead, yaw keeps orbiting steadily
  const lead = easeInOutCubic(clamp01(tB * 1.6));
  const p = mixPose(lowEnd, craneEnd, lead);
  p.yaw = lerp(lowEnd.yaw, craneEnd.yaw, 0.15 * easeOutExpo(tB) + 0.85 * tB);
  return p;
};

const applyPose = (cam: THREE.PerspectiveCamera, p: Pose) => {
  const x = Math.cos(p.pitch) * Math.sin(p.yaw);
  const z = Math.cos(p.pitch) * Math.cos(p.yaw);
  const y = Math.sin(p.pitch);
  cam.position.set(p.target.x + x * p.dist, p.target.y + y * p.dist, p.target.z + z * p.dist);
  cam.up.set(0, 1, 0);
  cam.lookAt(p.target);
  cam.rotateZ((p.roll * Math.PI) / 180);
  cam.fov = p.fov;
  cam.updateProjectionMatrix();
};

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------
export const createDataCubeScene =
  (variant: CameraVariant): SceneFactory =>
  (renderer, width, height) => {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const scene = new THREE.Scene();
    const fogColor = new THREE.Color().setRGB(0.03, 0.15, 0.3);
    scene.background = fogColor;
    scene.fog = new THREE.FogExp2(fogColor, 0.024);
    // sky dome: matches the fog colour at the horizon and darkens upward
    // (only visible from the low camera angle of version 2)
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(90, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        uniforms: { uHor: { value: fogColor }, uTop: { value: new THREE.Color().setRGB(0.002, 0.012, 0.03) } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uHor, uTop; varying vec3 vDir; void main(){ gl_FragColor = vec4(mix(uHor, uTop, smoothstep(0.0, 0.45, vDir.y)), 1.0); }`,
      }),
    );
    skyDome.renderOrder = -1;
    scene.add(skyDome);

    const envRT = buildEnvironment(renderer, 0.0);
    const env = envRT.texture;
    const rough = roughnessTexture();
    const circuit = circuitTexture(5);
    rough.wrapS = rough.wrapT = THREE.RepeatWrapping;

    const hemi = new THREE.HemisphereLight("#5fb6ff", "#05080c", 0.06);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#7cc8ff", 0.7);
    key.position.set(-12, 14, -10);
    scene.add(key);
    const rimL = new THREE.DirectionalLight("#2a6fb0", 0.3);
    rimL.position.set(10, 6, -14);
    scene.add(rimL);

    const ground = buildGround(scene, env, rough);
    const core = buildCore(scene, env, rough, circuit);
    const streaks = buildStreaks(scene);
    const dots = buildDots(scene);
    dots.mat.uniforms.uPx.value = height * 1.2;

    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 120);
    const post = new PostPipeline(renderer, width, height, { dof: true });
    const rig = variant === "reference" ? referenceRig : orbitRig;

    const render = (frame: number) => {
      const t = frame / 30;
      const ignite = smoothstep(LAND_FRAME - 0.5, LAND_FRAME + 4, frame);
      const flash = frame >= LAND_FRAME ? Math.exp(-(frame - LAND_FRAME) / 3.2) : 0;

      // module descent: slows as it approaches the dock
      const tA = clamp01(frame / LAND_FRAME);
      const remaining = 3.3 * Math.pow(1 - tA, 1.55);
      core.module.position.set(0, SLOT_FLOOR + VS / 2 + remaining, 0);
      core.module.rotation.y = (1 - tA) * 0.12;
      const modGlow = frame < LAND_FRAME ? 1.6 : 0.8;
      core.modGlowMat.color.setRGB(0.87, 0.95, 1).multiplyScalar(modGlow);

      // slot flicker while docking (pulses in bursts, as in the reference)
      const fl = smoothstep(4, 14, frame) * (((frame >> 1) % 2 === 0 ? 1 : 0.55) * (frame % 7 === 3 ? 0.6 : 1));
      const slotGlow = frame < LAND_FRAME ? fl * 3.0 : 0;
      core.slotMat.color.copy(ORANGE_HOT).multiplyScalar(slotGlow);
      core.topLight.intensity = slotGlow * 2.5;
      core.rimMat.color.setRGB(1, 0.36, 0.1).multiplyScalar(frame < LAND_FRAME ? 0.25 + slotGlow * 0.2 : 1.4 + flash * 2);

      // core brightness: terracotta -> incandescent amber with a flash on ignition
      const glowCol = ORANGE_DIM.clone().lerp(ORANGE_HOT, ignite);
      const pulse = 1 + 0.05 * Math.sin(t * 9.0);
      core.glowMat.color.copy(glowCol).multiplyScalar(lerp(0.62, 3.9, ignite) * pulse + flash * 3);
      (core.modWarm.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.4, 0.15).multiplyScalar(lerp(0.04, 2.2, ignite));
      core.coreLight.intensity = lerp(3, 38, ignite) + flash * 50;
      core.barMat.color.copy(CYAN).multiplyScalar(1.2 + ignite * 0.5);

      ground.uniforms.uIgnite.value = ignite;
      ground.uniforms.uRadius.value = Math.max(0, (frame - LAND_FRAME) / 30) * 26 + 1.5;
      ground.uniforms.uTime.value = t;

      streaks.update(t, smoothstep(LAND_FRAME, LAND_FRAME + 10, frame), 1);
      dots.mat.uniforms.uTime.value = t;
      dots.mat.uniforms.uIgnite.value = ignite;

      // close-up: bright wet cyan ground; after the cut the city settles darker
      const darken = smoothstep(LAND_FRAME, LAND_FRAME + 45, frame);
      (ground.mesh.material as THREE.MeshStandardMaterial).envMapIntensity = lerp(1.7, 0.75, darken);
      const p = rig(frame);
      applyPose(camera, p);
      // focus on the face of the cube nearest to camera
      const focusPoint = new THREE.Vector3(0, CUBE_BASE + CUBE * 0.6, 0);
      const focus = camera.position.distanceTo(focusPoint) - CUBE * 0.45;

      const closeness = frame < LAND_FRAME ? 1 : 1 - easeOutExpo(clamp01((frame - LAND_FRAME) / PULLBACK_FRAMES));
      const aperture = variant === "reference" ? lerp(46, 90, closeness) : lerp(40, 75, closeness);

      post.render(scene, camera, {
        focusDistance: focus,
        aperture,
        maxCoc: 24,
        bloomStrength: 0.32 + 0.08 * ignite + flash * 0.25,
        bloomRadius: 0.22,
        bloomThreshold: 1.4,
        exposure: lerp(1.15, 0.78, darken),
        vignette: 0.55,
        saturation: 1.08,
        lift: new THREE.Vector3(0.0, 0.004, 0.009),
        grain: 0.012,
        frame,
      });
    };

    return {
      render,
      dispose: () => {
        post.dispose();
        envRT.dispose();
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
      },
    };
  };
