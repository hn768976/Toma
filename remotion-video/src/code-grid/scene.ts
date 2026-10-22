import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  COLS,
  CUBE_DEPTH,
  DURATION_IN_FRAMES,
  FPS,
  PANEL_H,
  PANEL_W,
  PITCH_X,
  PITCH_Y,
  ROWS,
  SHEET_COUNT,
  SHEET_WINDOW,
} from "./constants";
import { drawCodeSheet, mulberry32 } from "./code-sheets";
import type { Palette } from "./palettes";

const col = (hex: string) => new THREE.Color(hex);

// Every animated quantity is a pure function of `time`, so any frame can
// be rendered in isolation (Remotion renders frames out of order across
// several tabs).
export type CodeGridScene = {
  render: (frame: number) => void;
  dispose: () => void;
};

/* ------------------------------------------------------------------ */
/* Panels: portrait glass screens with scrolling code                  */
/* ------------------------------------------------------------------ */

const panelVertex = /* glsl */ `
  attribute vec4 aParams; // scrollSpeed, phase, seed, mode
  varying vec2 vUv;
  varying vec4 vParams;
  varying float vDepth;
  void main() {
    vUv = uv;
    vParams = aParams;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const panelFragment = /* glsl */ `
  uniform sampler2D uSheet;
  uniform sampler2D uGhost;
  uniform float uTime;
  uniform float uWindow;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uText;
  uniform vec3 uHot;
  uniform vec3 uFrame;
  uniform vec3 uBg;
  varying vec2 vUv;
  varying vec4 vParams;
  varying float vDepth;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float speed = vParams.x;
    float phase = vParams.y;
    float seed = vParams.z;
    float mode = vParams.w;

    // Scroll position: smooth crawl, or a crawl plus periodic page jumps.
    float scroll = phase + uTime * speed;
    if (mode > 0.5) {
      float period = 2.2 + seed * 2.5;
      float k = floor((uTime + seed * 7.0) / period);
      float f = fract((uTime + seed * 7.0) / period);
      float jump = k + smoothstep(0.0, 0.12, f);
      scroll += jump * 0.19;
    }

    vec2 tuv = vec2(vUv.x, 1.0 - (scroll + (1.0 - vUv.y) * uWindow));
    vec3 m = texture2D(uSheet, tuv).rgb;

    // Ghost of code from "deeper" glass layers, softened via mip bias.
    vec2 guv = vec2(vUv.x * 0.92 + 0.04 + seed * 0.3, 1.0 - (scroll * 0.6 + phase + (1.0 - vUv.y) * uWindow * 1.25));
    vec3 g = texture2D(uGhost, guv, 2.5).rgb;

    // Glass body: vertical gradient + soft vertical light streaks.
    vec3 bg = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    float streakX = vUv.x * 9.0 + seed * 13.0;
    float streak = smoothstep(0.55, 1.0, sin(streakX) * 0.5 + 0.5) * 0.35
                 + smoothstep(0.7, 1.0, sin(vUv.x * 23.0 + seed * 5.0 + uTime * 0.15) * 0.5 + 0.5) * 0.2;
    bg *= 0.75 + streak * (0.6 + 0.4 * vUv.y);
    // Faint horizontal haze band near the panel's top.
    bg += uFrame * 0.08 * exp(-pow((vUv.y - 0.86) * 9.0, 2.0));

    // Fine scanlines.
    float scan = 0.93 + 0.07 * sin(vUv.y * 900.0);

    // Text: fade near panel edges so lines never hard-cut.
    float edgeFade = smoothstep(0.0, 0.035, vUv.y) * smoothstep(1.0, 0.965, vUv.y)
                   * smoothstep(0.0, 0.02, vUv.x) * smoothstep(1.0, 0.98, vUv.x);
    // Per-panel brightness flicker + rare dropout.
    float t8 = floor(uTime * 12.0);
    float flick = 0.88 + 0.12 * hash(t8 + seed * 91.0);
    float drop = step(0.985, hash(floor(uTime * 6.0) + seed * 37.0));
    flick *= 1.0 - 0.55 * drop;

    vec3 textCol = uText * m.r * 1.15 + (uHot - uText) * m.g * 1.25;
    vec3 sel = uFrame * m.b * 0.55;
    vec3 ghost = uText * g.r * 0.22;

    vec3 c = bg * scan + (textCol + sel) * edgeFade * flick + ghost;

    // Thin bright inner border, hottest along the top edge.
    float bx = min(vUv.x, 1.0 - vUv.x) * ${PANEL_W.toFixed(3)};
    float by = min(vUv.y, 1.0 - vUv.y) * ${PANEL_H.toFixed(3)};
    float b = min(bx, by);
    float border = smoothstep(0.009, 0.0, b);
    float topBoost = 0.6 + 0.8 * smoothstep(0.5, 1.0, vUv.y);
    c += uFrame * border * 1.1 * topBoost;
    c += uFrame * smoothstep(0.06, 0.0, b) * 0.12;

    // Distance haze toward the void color.
    float fog = smoothstep(3.0, 9.0, vDepth);
    c = mix(c, uBg, fog * 0.85);

    gl_FragColor = vec4(c, 0.94);
  }
`;

/* ------------------------------------------------------------------ */
/* Side glass walls between cubes                                      */
/* ------------------------------------------------------------------ */

const wallVertex = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDepth;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

// uv.x runs back (0) -> front (1) along the cube depth.
const wallFragment = /* glsl */ `
  uniform vec3 uFrame;
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDepth;
  void main() {
    float front = pow(vUv.x, 1.6);
    float lines = 0.6 + 0.4 * sin(vUv.y * 140.0 + vSeed * 20.0);
    float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + vSeed * 6.28);
    float a = (0.05 + 0.22 * front) * lines * pulse;
    float fog = 1.0 - smoothstep(3.0, 9.0, vDepth) * 0.8;
    gl_FragColor = vec4(uFrame * a * fog, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Light rays along the lattice's depth axis                           */
/* ------------------------------------------------------------------ */

const rayVertex = /* glsl */ `
  attribute vec3 aRay; // intensity, phase, speed
  varying vec2 vUv;
  varying vec3 vRay;
  void main() {
    vUv = uv;
    vRay = aRay;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// uv.y runs from the lattice (0) toward the camera (1).
const rayFragment = /* glsl */ `
  uniform vec3 uRay;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vRay;
  void main() {
    float along = vUv.y;
    float across = abs(vUv.x - 0.5) * 2.0;
    float core = exp(-across * across * 6.0);
    float fade = smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.55, 1.0, along));
    // Breathing intensity plus a bright packet sliding toward the camera.
    float breathe = 0.55 + 0.45 * sin(uTime * vRay.z + vRay.y * 6.28);
    float head = fract(uTime * 0.18 * vRay.z + vRay.y);
    float packet = exp(-pow((along - head) * 9.0, 2.0)) * 1.4;
    float i = vRay.x * core * fade * (breathe + packet);
    gl_FragColor = vec4(uRay * i, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Dust motes                                                          */
/* ------------------------------------------------------------------ */

const dustVertex = /* glsl */ `
  attribute vec4 aDust; // phase, speed, size, seed
  uniform float uTime;
  uniform float uPx;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * aDust.y + aDust.x;
    p.x += sin(t * 0.7 + aDust.w * 10.0) * 0.12;
    p.y += mod(t * 0.08 + aDust.w * 3.0, 3.0) - 1.5;
    p.z += cos(t * 0.5 + aDust.w * 4.0) * 0.1;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aDust.z * uPx / max(-mv.z, 0.3);
    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * 2.3 + aDust.w * 30.0));
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(uColor * a * a * vAlpha, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Final grade: chromatic fringe, vignette, grain                      */
/* ------------------------------------------------------------------ */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
    uTint: { value: new THREE.Color() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      vec2 off = c * 0.0012 * r2;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // Soft horizontal light leak across the middle band.
      col += uTint * 0.05 * exp(-pow(c.y * 3.2, 2.0));
      float vig = smoothstep(1.35, 0.25, r2);
      col *= mix(0.45, 1.0, vig);
      float g = hash(vUv * 1000.0 + fract(uTime * 7.13)) - 0.5;
      col += g * 0.025;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ */

const easeInOut = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

export const createCodeGridScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: Palette,
): CodeGridScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(col(palette.background), 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, width / height, 0.05, 60);
  const rand = mulberry32(2024);
  const disposables: { dispose: () => void }[] = [];

  const halfCols = (COLS - 1) / 2;
  const halfRows = (ROWS - 1) / 2;
  const cellX = (i: number) => (i - halfCols) * PITCH_X;
  const cellY = (j: number) => (j - halfRows) * PITCH_Y;

  /* ---- code sheet textures ---- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const sheets: THREE.CanvasTexture[] = [];
  for (let s = 0; s < SHEET_COUNT; s++) {
    const tex = new THREE.CanvasTexture(drawCodeSheet(s + 1));
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAniso;
    tex.generateMipmaps = true;
    sheets.push(tex);
    disposables.push(tex);
  }

  /* ---- panels (one instanced mesh per sheet) ---- */
  const panelGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
  disposables.push(panelGeo);
  const panelSlots: { i: number; j: number }[][] = Array.from({ length: SHEET_COUNT }, () => []);
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      // Avoid identical neighbours by hashing the cell to a sheet.
      const s = (i * 3 + j * 5 + Math.floor(rand() * 2)) % SHEET_COUNT;
      panelSlots[s].push({ i, j });
    }
  }
  const panelMaterials: THREE.ShaderMaterial[] = [];
  const dummy = new THREE.Object3D();
  panelSlots.forEach((slots, s) => {
    const geo = panelGeo.clone();
    const params = new Float32Array(slots.length * 4);
    slots.forEach((_, k) => {
      params[k * 4 + 0] = 0.006 + rand() * 0.02; // sheet-fraction / s
      params[k * 4 + 1] = rand();
      params[k * 4 + 2] = rand();
      params[k * 4 + 3] = rand() < 0.45 ? 1 : 0;
    });
    geo.setAttribute("aParams", new THREE.InstancedBufferAttribute(params, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: panelVertex,
      fragmentShader: panelFragment,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uSheet: { value: sheets[s] },
        uGhost: { value: sheets[(s + 3) % SHEET_COUNT] },
        uTime: { value: 0 },
        uWindow: { value: SHEET_WINDOW },
        uTop: { value: col(palette.panelTop) },
        uBottom: { value: col(palette.panelBottom) },
        uText: { value: col(palette.text) },
        uHot: { value: col(palette.textHot) },
        uFrame: { value: col(palette.frame) },
        uBg: { value: col(palette.background) },
      },
    });
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    slots.forEach(({ i, j }, k) => {
      dummy.position.set(cellX(i), cellY(j), -CUBE_DEPTH);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    mesh.frustumCulled = false;
    scene.add(mesh);
    panelMaterials.push(mat);
    disposables.push(geo, mat);
  });

  /* ---- lattice bars ---- */
  type Bar = { x: number; y: number; z: number; sx: number; sy: number; sz: number; glow: number };
  const bars: Bar[] = [];
  const spanX = COLS * PITCH_X;
  const spanY = ROWS * PITCH_Y;
  const front = 0.05;
  const back = 0.022;
  for (let i = 0; i <= COLS; i++) {
    const x = (i - COLS / 2) * PITCH_X;
    bars.push({ x, y: 0, z: 0, sx: front, sy: spanY, sz: front, glow: 1.0 });
    bars.push({ x, y: 0, z: -CUBE_DEPTH, sx: back, sy: spanY, sz: back, glow: 0.55 });
  }
  for (let j = 0; j <= ROWS; j++) {
    const y = (j - ROWS / 2) * PITCH_Y;
    bars.push({ x: 0, y, z: 0, sx: spanX, sy: front, sz: front, glow: 1.0 });
    bars.push({ x: 0, y, z: -CUBE_DEPTH, sx: spanX, sy: back, sz: back, glow: 0.55 });
  }
  for (let i = 0; i <= COLS; i++) {
    for (let j = 0; j <= ROWS; j++) {
      const x = (i - COLS / 2) * PITCH_X;
      const y = (j - ROWS / 2) * PITCH_Y;
      bars.push({ x, y, z: -CUBE_DEPTH / 2, sx: 0.03, sy: 0.03, sz: CUBE_DEPTH, glow: 0.8 });
    }
  }
  const barGeo = new THREE.BoxGeometry(1, 1, 1);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const barMesh = new THREE.InstancedMesh(barGeo, barMat, bars.length);
  const frameCol = col(palette.frame);
  const hotCol = col(palette.frameHot);
  bars.forEach((b, k) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    barMesh.setMatrixAt(k, dummy.matrix);
    const c = frameCol.clone().lerp(hotCol, 0.12 * b.glow).multiplyScalar(0.35 + 0.95 * b.glow * (0.85 + 0.3 * rand()));
    barMesh.setColorAt(k, c);
  });
  barMesh.frustumCulled = false;
  scene.add(barMesh);
  disposables.push(barGeo, barMat);

  // Thin hot cores on the front bars (bloom turns them into the bright
  // white-cyan lines seen in the reference).
  const coreBars = bars.filter((b) => b.glow === 1.0);
  const coreMat = new THREE.MeshBasicMaterial({ color: hotCol.clone().multiplyScalar(1.5), toneMapped: false });
  const coreMesh = new THREE.InstancedMesh(barGeo, coreMat, coreBars.length);
  coreBars.forEach((b, k) => {
    dummy.position.set(b.x, b.y, b.z + 0.03);
    dummy.scale.set(b.sx === front ? 0.012 : b.sx, b.sy === front ? 0.012 : b.sy, 0.01);
    dummy.updateMatrix();
    coreMesh.setMatrixAt(k, dummy.matrix);
  });
  coreMesh.frustumCulled = false;
  scene.add(coreMesh);
  disposables.push(coreMat);
  dummy.scale.set(1, 1, 1);

  /* ---- side glass walls ---- */
  const wallGeo = new THREE.PlaneGeometry(1, 1);
  const wallMat = new THREE.ShaderMaterial({
    vertexShader: wallVertex,
    fragmentShader: wallFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uFrame: { value: frameCol.clone() }, uTime: { value: 0 } },
  });
  const wallCount = (COLS + 1) * ROWS + (ROWS + 1) * COLS;
  const wallSeeds = new Float32Array(wallCount);
  const wallMesh = new THREE.InstancedMesh(wallGeo.clone(), wallMat, wallCount);
  let w = 0;
  // Vertical walls (YZ plane): plane's local X -> world Z.
  for (let i = 0; i <= COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      dummy.position.set((i - COLS / 2) * PITCH_X, cellY(j), -CUBE_DEPTH / 2);
      dummy.rotation.set(0, -Math.PI / 2, 0);
      dummy.scale.set(CUBE_DEPTH, PITCH_Y, 1);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(w, dummy.matrix);
      wallSeeds[w++] = rand();
    }
  }
  // Horizontal walls (XZ plane).
  for (let j = 0; j <= ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      dummy.position.set(cellX(i), (j - ROWS / 2) * PITCH_Y, -CUBE_DEPTH / 2);
      dummy.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      dummy.scale.set(CUBE_DEPTH, PITCH_X, 1);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(w, dummy.matrix);
      wallSeeds[w++] = rand();
    }
  }
  wallMesh.geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(wallSeeds, 1));
  wallMesh.frustumCulled = false;
  wallMesh.renderOrder = 2;
  scene.add(wallMesh);
  disposables.push(wallGeo, wallMesh.geometry, wallMat);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);

  /* ---- rays toward the camera from lattice nodes ---- */
  const rayNodes: [number, number][] = [];
  const nodeCandidates: [number, number][] = [];
  for (let i = 3; i <= COLS - 3; i++) {
    for (let j = 2; j <= ROWS - 2; j++) nodeCandidates.push([i, j]);
  }
  while (rayNodes.length < 24 && nodeCandidates.length) {
    const k = Math.floor(rand() * nodeCandidates.length);
    rayNodes.push(nodeCandidates.splice(k, 1)[0]);
  }
  const RAY_LEN = 3.2;
  const rayGeo = new THREE.PlaneGeometry(1, 1);
  const rayParams = new Float32Array(rayNodes.length * 3 * 2);
  const rayMat = new THREE.ShaderMaterial({
    vertexShader: rayVertex,
    fragmentShader: rayFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uRay: { value: col(palette.ray).multiplyScalar(1.6) }, uTime: { value: 0 } },
  });
  // Each ray = two crossed quads (XZ and YZ) so it reads from any angle.
  const rayMesh = new THREE.InstancedMesh(rayGeo.clone(), rayMat, rayNodes.length * 2);
  rayNodes.forEach(([i, j], k) => {
    const x = (i - COLS / 2) * PITCH_X;
    const y = (j - ROWS / 2) * PITCH_Y;
    const intensity = 0.5 + rand() * 0.9;
    const phase = rand();
    const speed = 0.6 + rand() * 1.4;
    for (let q = 0; q < 2; q++) {
      dummy.position.set(x, y, RAY_LEN / 2);
      dummy.rotation.set(Math.PI / 2, q === 0 ? 0 : Math.PI / 2, 0);
      dummy.scale.set(0.014, RAY_LEN, 1);
      dummy.updateMatrix();
      rayMesh.setMatrixAt(k * 2 + q, dummy.matrix);
      rayParams.set([intensity, phase, speed], (k * 2 + q) * 3);
    }
  });
  rayMesh.geometry.setAttribute("aRay", new THREE.InstancedBufferAttribute(rayParams, 3));
  rayMesh.frustumCulled = false;
  rayMesh.renderOrder = 3;
  scene.add(rayMesh);
  disposables.push(rayGeo, rayMesh.geometry, rayMat);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);

  /* ---- dust ---- */
  const DUST = 700;
  const dustPos = new Float32Array(DUST * 3);
  const dustAttr = new Float32Array(DUST * 4);
  for (let k = 0; k < DUST; k++) {
    dustPos.set([(rand() - 0.5) * 7, (rand() - 0.5) * 4.5, -0.2 + rand() * 2.2], k * 3);
    dustAttr.set([rand() * 100, 0.4 + rand() * 0.8, 0.008 + rand() * 0.02, rand()], k * 4);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aDust", new THREE.BufferAttribute(dustAttr, 4));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: height },
      uColor: { value: col(palette.haze).multiplyScalar(1.4) },
    },
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 4;
  scene.add(dust);
  disposables.push(dustGeo, dustMat);

  /* ---- post ---- */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.75, 0.45, 0.5);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uAspect.value = width / height;
  grade.uniforms.uTint.value = col(palette.haze);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  disposables.push(composer, bloom);

  const render = (frame: number) => {
    const time = frame / FPS;
    const p = frame / (DURATION_IN_FRAMES - 1);
    const e = easeInOut(p);

    // Slow drift + gentle push, like the reference's floating camera.
    const camX = -0.12 + 0.2 * e + 0.025 * Math.sin(time * 0.55);
    const camY = 0.06 - 0.1 * e + 0.018 * Math.sin(time * 0.43 + 1.2);
    const camZ = 2.55 - 0.22 * e;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(camX * 0.35, camY * 0.35, -2);
    camera.rotateZ(0.006 * Math.sin(time * 0.3));

    for (const m of panelMaterials) m.uniforms.uTime.value = time;
    wallMat.uniforms.uTime.value = time;
    rayMat.uniforms.uTime.value = time;
    dustMat.uniforms.uTime.value = time;
    grade.uniforms.uTime.value = time;

    composer.render();
  };

  return {
    render,
    dispose: () => {
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
};
