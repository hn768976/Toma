import * as THREE from "three";
import { makeStudioEnv } from "../engine/env";
import {
  Batch,
  canvasTexture,
  makeCanvas,
  offsetPath,
  Pt,
  Ribbons,
  routeTraces,
  strokePath,
} from "../engine/kit";
import { clamp01, pchip, ramp, Rng } from "../engine/rng";
import type { FrameLook, World } from "../engine/types";
import {
  BOARD_SIZE,
  CameraMove,
  COUNTS,
  FPS,
  PACKAGE,
  PALETTE,
  SEED,
  TIMING,
} from "../config";
import {
  DOF,
  ENV_AMBIENT,
  ENV_LOBES,
  ENV_PANELS,
  LIGHTS,
  MATERIAL_LOOK,
} from "../look";

const rad = (d: number) => (d * Math.PI) / 180;

/* -------------------------------------------------------------------------- */
/* textures (seeded canvas drawings)                                           */
/* -------------------------------------------------------------------------- */

/**
 * The board: a dense, high-contrast silver copper pattern on black, drawn at
 * three scales (pours and blocks, routed traces and buses, pads and dots).
 */
const makeBoardTexture = (seed: number) => {
  const S = 4096;
  const { canvas, ctx } = makeCanvas(S, S);
  const rng = new Rng(seed);
  const pxPerCm = S / BOARD_SIZE;
  ctx.fillStyle = "#040404";
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const grey = (lo: number, hi: number) => {
    const v = rng.int(lo, hi);
    // dimmer copper is warmer, bright copper is neutral silver
    const warm = v < 190 ? 0.93 : 1.0;
    return `rgb(${v},${Math.round(v * (0.5 + warm / 2))},${Math.round(v * warm)})`;
  };

  // --- large: copper pours and blocks, some hatched -------------------------
  for (let i = 0; i < 26; i++) {
    const w = rng.range(0.3, 1.6) * pxPerCm;
    const h = rng.range(0.3, 1.6) * pxPerCm;
    const x = rng.range(0, S - w);
    const y = rng.range(0, S - h);
    ctx.fillStyle = grey(60, 170);
    ctx.fillRect(x, y, w, h);
    if (rng.chance(0.55)) {
      // dark slots cut into the pour
      ctx.fillStyle = "#050505";
      const n = rng.int(2, 9);
      const horiz = rng.chance(0.5);
      for (let k = 0; k < n; k++) {
        if (horiz) ctx.fillRect(x + 6, y + ((k + 0.5) * h) / n - 2, w - 12, rng.range(2, 5));
        else ctx.fillRect(x + ((k + 0.5) * w) / n - 2, y + 6, rng.range(2, 5), h - 12);
      }
    }
  }

  // --- medium: buses of parallel traces --------------------------------------
  const cols = 400;
  const cell = S / cols;
  const occ = new Uint8Array(cols * cols);
  const guides = routeTraces(rng, {
    cols,
    rows: cols,
    count: 340,
    minRun: 5,
    maxRun: 34,
    minSegs: 2,
    maxSegs: 5,
    occupied: occ,
  });
  for (const g of guides) {
    const n = rng.int(3, 9);
    const sp = rng.pick([0.5, 0.6, 0.8]);
    ctx.strokeStyle = grey(170, 250);
    ctx.lineWidth = rng.pick([2, 3, 4]);
    for (let k = 0; k < n; k++) {
      strokePath(ctx, offsetPath(g, (k - (n - 1) / 2) * sp), cell, cell, cell / 2, cell / 2);
    }
  }
  // --- medium: single routed traces with via pads ----------------------------
  const singles = routeTraces(rng, {
    cols,
    rows: cols,
    count: 6500,
    minRun: 2,
    maxRun: 16,
    minSegs: 1,
    maxSegs: 5,
    occupied: occ,
  });
  for (const p of singles) {
    ctx.strokeStyle = grey(120, 250);
    ctx.lineWidth = rng.pick([2, 3, 3, 4, 6]);
    strokePath(ctx, p, cell, cell, cell / 2, cell / 2);
    const e = p[p.length - 1];
    const ex = cell / 2 + e[0] * cell;
    const ey = cell / 2 + e[1] * cell;
    ctx.fillStyle = grey(190, 255);
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#050505";
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- fine: pad rows (chip footprints) and dot fields ------------------------
  for (let i = 0; i < 1000; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const n = rng.int(4, 16);
    const horiz = rng.chance(0.5);
    const gap = rng.range(18, 60);
    ctx.fillStyle = grey(170, 255);
    for (let k = 0; k < n; k++) {
      for (const side of [0, 1]) {
        const px = x + (horiz ? k * 12 : side * gap * 1.6);
        const py = y + (horiz ? side * gap * 1.6 : k * 12);
        ctx.fillRect(px, py, horiz ? 7 : 18, horiz ? 18 : 7);
      }
    }
  }
  for (let i = 0; i < 320; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const nx = rng.int(4, 14);
    const ny = rng.int(4, 14);
    ctx.fillStyle = grey(150, 240);
    for (let a = 0; a < nx; a++)
      for (let b2 = 0; b2 < ny; b2++) {
        ctx.beginPath();
        ctx.arc(x + a * 14, y + b2 * 14, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  // --- finest: glitter-like specks of bare solder ------------------------------
  ctx.fillStyle = "#f4f4f2";
  for (let i = 0; i < 16000; i++) {
    const r = rng.pick([2, 2, 3, 3, 4]);
    ctx.fillRect(rng.range(0, S), rng.range(0, S), r, r);
  }
  // --- large dark patches: bare, unlit board between the copper ---------------
  for (let i = 0; i < 170; i++) {
    const w = rng.range(1.2, 6.0) * pxPerCm;
    const h = rng.range(1.2, 6.0) * pxPerCm;
    const x = rng.range(0, S - w);
    const y = rng.range(0, S - h);
    ctx.fillStyle = `rgba(3,3,3,${rng.range(0.3, 0.7).toFixed(2)})`;
    ctx.fillRect(x, y, w, h);
  }
  // --- keep the area under the package dark -----------------------------------
  const half = (PACKAGE.base / 2 + 0.3) * pxPerCm;
  ctx.fillStyle = "#030303";
  ctx.fillRect(S / 2 - half, S / 2 - half, half * 2, half * 2);
  return canvas;
};

/** 3x3 atlas of etched silver dies: bright metal with dark engraved lines. */
const makeTileAtlas = (seed: number) => {
  const C = 640;
  const S = C * 3;
  const { canvas, ctx } = makeCanvas(S, S);
  const rng = new Rng(seed);
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  for (let ty = 0; ty < 3; ty++)
    for (let tx = 0; tx < 3; tx++) {
      const ox = tx * C;
      const oy = ty * C;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, C, C);
      ctx.clip();
      const base = rng.int(140, 185);
      ctx.fillStyle = `rgb(${base},${base},${base - 3})`;
      ctx.fillRect(ox, oy, C, C);
      // large blocks, lighter and darker
      for (let i = 0; i < 7; i++) {
        const v = rng.chance(0.6) ? rng.int(160, 205) : rng.int(75, 110);
        ctx.fillStyle = `rgb(${v},${v},${v - 3})`;
        ctx.fillRect(ox + rng.range(0, C), oy + rng.range(0, C), rng.range(30, 230), rng.range(30, 230));
      }
      // engraved traces
      const cols = 100;
      const cell = C / cols;
      const paths = routeTraces(rng, {
        cols,
        rows: cols,
        count: 300,
        minRun: 3,
        maxRun: 40,
        minSegs: 2,
        maxSegs: 5,
      });
      for (const p of paths) {
        const v = rng.chance(0.45) ? rng.int(40, 90) : rng.int(215, 255);
        ctx.strokeStyle = `rgb(${v},${v},${v})`;
        ctx.lineWidth = rng.pick([1.5, 2, 2, 3, 4]);
        strokePath(ctx, p, cell, cell, ox + cell / 2, oy + cell / 2);
      }
      // fine pad rows
      for (let i = 0; i < 40; i++) {
        const x = ox + rng.range(0, C);
        const y = oy + rng.range(0, C);
        const n = rng.int(4, 12);
        const horiz = rng.chance(0.5);
        ctx.fillStyle = rng.chance(0.5) ? "#1c1c1c" : "#f4f4f0";
        for (let k = 0; k < n; k++) ctx.fillRect(x + (horiz ? k * 8 : 0), y + (horiz ? 0 : k * 8), 5, 5);
      }
      // dark rim
      ctx.strokeStyle = "#101010";
      ctx.lineWidth = 10;
      ctx.strokeRect(ox + 5, oy + 5, C - 10, C - 10);
      ctx.restore();
    }
  return canvas;
};

/* -------------------------------------------------------------------------- */
/* materials with animation uniforms                                           */
/* -------------------------------------------------------------------------- */

/** Glowing lines that are revealed outwards from the package centre. */
const makeRevealMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.glow) },
      uHot: { value: new THREE.Color(PALETTE.glowHot) },
      uIntensity: { value: MATERIAL_LOOK.lineIntensity },
      uHead: { value: MATERIAL_LOOK.lineHead },
      uReveal: { value: 0 },
      uSoft: { value: 1.2 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vXY;
      void main() {
        vUv = uv;
        vXY = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vXY;
      uniform vec3 uColor, uHot;
      uniform float uIntensity, uHead, uReveal, uSoft;
      void main() {
        float d = max(abs(vXY.x), abs(vXY.y)) * 0.6 + length(vXY) * 0.4;
        float lit = 1.0 - smoothstep(uReveal - uSoft, uReveal, d);
        if (lit < 0.002) discard;
        float head = smoothstep(uReveal - uSoft * 2.5, uReveal - uSoft * 0.6, d);
        float core = 1.0 - smoothstep(0.0, 0.9, abs(vUv.y));
        vec3 c = mix(uColor, uHot, clamp(core * 0.7 + head * 0.5, 0.0, 1.0));
        c *= (0.5 + 0.8 * core) * (1.0 + head * uHead);
        gl_FragColor = vec4(c * uIntensity * lit, 1.0);
      }
    `,
  });

/** Camera-facing flare: white-hot core, wide warm halo. Additive. */
const makeFlareMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCore: { value: new THREE.Color(PALETTE.flareCore) },
      uHalo: { value: new THREE.Color(PALETTE.flareHalo) },
      uIntensity: { value: 0 },
      uCoreMix: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uCore, uHalo;
      uniform float uIntensity, uCoreMix;
      void main() {
        float r = length(vUv);
        float edge = 1.0 - smoothstep(0.6, 1.0, r);
        float core = exp(-r * r * 130.0) * uCoreMix;
        float mid = exp(-r * r * 26.0) * 0.2 * (0.35 + 0.65 * uCoreMix);
        float halo = 0.06 / (1.0 + r * r * 10.0);
        vec3 c = uCore * core + mix(uHalo, uCore, 0.3) * mid + uHalo * halo;
        gl_FragColor = vec4(c * uIntensity * edge, 1.0);
      }
    `,
  });

/* -------------------------------------------------------------------------- */
/* the world                                                                   */
/* -------------------------------------------------------------------------- */

export const createWorld = (gl: THREE.WebGLRenderer, move: CameraMove): World => {
  const rng = new Rng(SEED);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(move.fov, 16 / 9, 1, 300);
  camera.up.set(0, 0, 1);
  scene.add(camera);
  scene.background = new THREE.Color(0x000000);

  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.environment = makeStudioEnv(gl, ENV_PANELS, ENV_AMBIENT, ENV_LOBES);
  scene.environmentIntensity = LIGHTS.envIntensity;

  const ML = MATERIAL_LOOK;
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

  /* ---- board ------------------------------------------------------------- */
  const boardCanvas = makeBoardTexture(SEED + 11);
  const boardMap = canvasTexture(boardCanvas, { srgb: true, aniso: 16 });
  const boardRough = canvasTexture(boardCanvas, { srgb: false, aniso: 8 });
  const boardMat = std({
    color: ML.boardSilver,
    map: boardMap,
    metalness: 0.5,
    roughness: 0.5,
    bumpMap: boardRough,
    bumpScale: 1.2,
    envMapIntensity: 1.0,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE), boardMat);
  board.receiveShadow = true;
  scene.add(board);

  const mats: Record<string, THREE.Material> = {
    black: std({ color: "#040405", roughness: 0.3, metalness: 0.2, envMapIntensity: 0.4 }),
    blackGloss: std({ color: "#020203", roughness: 0.16, metalness: 0.5, envMapIntensity: 0.32 }),
    shroud: std({ color: "#020202", roughness: 0.6, metalness: 0.0, envMapIntensity: 0.15 }),
    gold: std({ color: PALETTE.gold, roughness: 0.25, metalness: 1, envMapIntensity: 1.2 }),
    bronze: std({ color: PALETTE.bronze, roughness: 0.4, metalness: 1, envMapIntensity: 0.9 }),
    silver: std({ color: PALETTE.silver, roughness: 0.22, metalness: 1, envMapIntensity: 1.1 }),
    plate: std({ color: "#8f8f8c", roughness: 0.6, metalness: 0.3, envMapIntensity: 0.7 }),
    capBody: std({ color: "#15130f", roughness: 0.35, metalness: 0.6, envMapIntensity: 0.7 }),
    smd: std({ color: "#ffffff", roughness: 0.45, metalness: 0.5, envMapIntensity: 0.8 }),
  };

  const b = new Batch();
  const blocked: [number, number, number, number][] = [];
  const block = (cx: number, cy: number, w: number, h: number, pad = 0.2) =>
    blocked.push([cx - w / 2 - pad, cy - h / 2 - pad, cx + w / 2 + pad, cy + h / 2 + pad]);
  const isFree = (x: number, y: number, r: number) =>
    Math.abs(x) < BOARD_SIZE / 2 - 0.5 &&
    Math.abs(y) < BOARD_SIZE / 2 - 0.5 &&
    !blocked.some((k) => x > k[0] - r && x < k[2] + r && y > k[1] - r && y < k[3] + r);

  /* ---- the package ------------------------------------------------------- */
  const P = PACKAGE;
  block(0, 0, P.base + 2.6, P.base + 2.6);
  const frameZ = P.baseH + P.midH;
  b.box("blackGloss", 0, 0, 0, P.base, P.base, P.baseH, { round: true });
  b.box("black", 0, 0, P.baseH, P.mid, P.mid, P.midH, { round: true });
  b.box("blackGloss", 0, 0, frameZ, P.top + 0.9, P.top + 0.9, 0.1, { round: true });
  // grid of bars around the 3x3 tiles
  const barH = P.topZ - frameZ;
  const outer = (P.top - (P.pitch * 2 + P.tile)) / 2; // border width
  for (const s of [-1, 1]) {
    const o = s * (P.top / 2 - outer / 2);
    b.box("blackGloss", o, 0, frameZ, outer, P.top, barH, { round: true });
    b.box("blackGloss", 0, o, frameZ, P.top, outer, barH, { round: true });
    const inner = s * (P.pitch / 2);
    const bw = P.pitch - P.tile;
    b.box("blackGloss", inner, 0, frameZ, bw, P.top - outer, barH * 0.92);
    b.box("blackGloss", 0, inner, frameZ, P.top - outer, bw, barH * 0.92);
  }
  // gold corner brackets on the top frame and screws on the base
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const cxx = sx * (P.top / 2 - 0.06);
      const cyy = sy * (P.top / 2 - 0.06);
      b.box("gold", cxx - sx * 0.7, cyy, P.topZ - 0.04, 1.6, 0.26, 0.1, { round: true });
      b.box("gold", cxx, cyy - sy * 0.7, P.topZ - 0.04, 0.26, 1.6, 0.1, { round: true });
      b.cyl("gold", sx * (P.base / 2 - 0.6), sy * (P.base / 2 - 0.6), P.baseH, 0.26, 0.1);
      b.cyl("black", sx * (P.base / 2 - 0.6), sy * (P.base / 2 - 0.6), P.baseH + 0.1, 0.1, 0.01);
    }
  // rows of upright gold fins along two sides of the base
  for (let i = 0; i < 18; i++) {
    const t = -P.base / 2 + 1.2 + i * ((P.base - 2.4) / 17);
    b.box("bronze", t, -P.base / 2 - 0.75, 0, 0.2, 1.1, 0.95, { round: true });
    b.box("bronze", -P.base / 2 - 0.75, t, 0, 1.1, 0.2, 0.95, { round: true });
  }
  // centre cell: recessed pad with a gold seat for the small chip
  b.box("black", 0, 0, frameZ, P.tile, P.tile, 0.06);
  for (const seat of [P.chip + 0.35, P.chip - 0.75]) {
    const hgt = seat > P.chip ? 0.34 : 0.24;
    for (const s of [-1, 1]) {
      b.box("gold", s * (seat / 2), 0, frameZ + 0.05, 0.16, seat + 0.16, hgt, { round: true });
      b.box("gold", 0, s * (seat / 2), frameZ + 0.05, seat + 0.16, 0.16, hgt, { round: true });
    }
  }
  b.box("gold", 0, 0, frameZ + 0.05, 0.5, 0.5, 0.05);

  /* ---- tiles (etched silver dies) ----------------------------------------- */
  const atlas = makeTileAtlas(SEED + 23);
  const tileMap = canvasTexture(atlas, { srgb: true, aniso: 16 });
  const tileBump = canvasTexture(atlas, { srgb: false, aniso: 8 });
  const tiles = new THREE.Group();
  const tileMats: THREE.MeshStandardMaterial[] = [];
  /** which corner of a tile is cut off: [tile index] -> corner 0..3, -1 none */
  const cut = [0, -1, 2, 1, -1, -1, 3, -1, 2];
  for (let ty = 0; ty < 3; ty++)
    for (let tx = 0; tx < 3; tx++) {
      if (tx === 1 && ty === 1) continue;
      const idx = ty * 3 + tx;
      const h = P.tile / 2;
      const c = 0.9;
      const corner = cut[idx];
      // outline, counter-clockwise from bottom-left, with one optional cut
      const pts: Pt[] = [];
      const add = (x: number, y: number) => pts.push([x, y]);
      if (corner === 0) { add(-h + c, -h); } else add(-h, -h);
      if (corner === 1) { add(h - c, -h); add(h, -h + c); } else add(h, -h);
      if (corner === 2) { add(h, h - c); add(h - c, h); } else add(h, h);
      if (corner === 3) { add(-h + c, h); add(-h, h - c); } else add(-h, h);
      if (corner === 0) add(-h, -h + c);
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ShapeGeometry(shape);
      const pos = g.getAttribute("position");
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (tx + (pos.getX(i) + h) / P.tile) / 3;
        uv[i * 2 + 1] = (ty + (pos.getY(i) + h) / P.tile) / 3;
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      const shade = rng.range(0.62, 1.0);
      const m = std({
        color: new THREE.Color(ML.tileSilver).multiplyScalar(shade),
        map: tileMap,
        bumpMap: tileBump,
        bumpScale: 0.8,
        metalness: 1,
        roughness: rng.range(0.18, 0.3),
        envMapIntensity: 2.0,
      });
      tileMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set((tx - 1) * P.pitch, (ty - 1) * P.pitch, P.tileZ);
      mesh.receiveShadow = true;
      tiles.add(mesh);
    }
  scene.add(tiles);

  /* ---- surroundings ------------------------------------------------------- */
  // large black shrouds (upper left), soft and out of focus in the reference
  const shrouds: [number, number, number, number, number, number][] = [
    [-23.5, 2, 13, 32, 3.4, 0.0],
    [-4, 28.5, 32, 11, 3.0, 0.0],
    [-28, -27, 12, 14, 2.6, 0.0],
  ];
  for (const [x, y, w, h, t, r] of shrouds) {
    b.box("shroud", x, y, 0, w, h, t, { rot: r, round: true });
    // ridges along the long side
    const n = 9;
    const along = w > h;
    for (let i = 0; i < n; i++) {
      const o = ((i + 0.5) / n - 0.5) * (along ? w : h) * 0.9;
      if (along) b.box("shroud", x + o, y, t, (w / n) * 0.45, h * 0.86, 0.5, { round: true });
      else b.box("shroud", x, y + o, t, w * 0.86, (h / n) * 0.45, 0.5, { round: true });
    }
    block(x, y, w + 1, h + 1, 0.4);
  }
  // bright metal plates with rectangular cut-outs (right and bottom)
  const plates: [number, number, number, number][] = [
    [25, -6, 14, 30],
    [6, -29, 26, 10],
  ];
  for (const [x, y, w, h] of plates) {
    b.box("plate", x, y, 0, w, h, 0.5, { round: false });
    const n = rng.int(3, 6);
    for (let i = 0; i < n; i++) {
      const cw = rng.range(1.2, 3.5);
      const ch = rng.range(1.0, 3.0);
      b.box("black", x + rng.range(-w / 2 + 2, w / 2 - 2), y + rng.range(-h / 2 + 2, h / 2 - 2), 0.5, cw, ch, 0.02);
    }
    block(x, y, w, h, 0.5);
  }
  // black chips
  let placed = 0;
  let guard = 0;
  while (placed < COUNTS.chips && guard++ < 6000) {
    const s = rng.range(1.5, 3.4);
    const x = rng.range(-30, 30);
    const y = rng.range(-30, 30);
    if (!isFree(x, y, s * 0.8)) continue;
    b.box("silver", x, y, 0, s + 0.3, s * 0.86, 0.06);
    b.box("silver", x, y, 0, s * 0.86, s + 0.3, 0.06);
    b.box("blackGloss", x, y, 0.04, s, s, rng.range(0.35, 0.6), { round: true });
    block(x, y, s, s, 0.35);
    placed++;
  }
  // capacitors: dark cans with bronze tops, in clusters
  const clusters: Pt[] = [[13.5, -13.5], [-12.5, 13.5], [14, 7], [-6, -15], [7, 15], [17, -18], [0, -14.5]];
  placed = 0;
  guard = 0;
  while (placed < COUNTS.capacitors && guard++ < 8000) {
    const c = rng.pick(clusters);
    const x = c[0] + rng.range(-3.2, 3.2);
    const y = c[1] + rng.range(-3.2, 3.2);
    const r = rng.range(0.24, 0.36);
    if (!isFree(x, y, r + 0.12)) continue;
    const h = rng.range(0.6, 1.0);
    b.cyl("capBody", x, y, 0, r, h, { shape: "can" });
    b.cyl("bronze", x, y, h - 0.07, r * 0.72, 0.02);
    block(x, y, r * 2, r * 2, 0.12);
    placed++;
  }
  // indicator LEDs (lower right of the package)
  const ledXY: Pt[] = [[11.9, 2.0], [13.0, 2.2], [12.1, 0.9], [13.2, 1.1], [12.6, 3.2]];
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const redMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const leds = new THREE.Group();
  for (const [x, y] of ledXY) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), ledMat);
    m.position.set(x, y, 0.4);
    leds.add(m);
    b.cyl("capBody", x, y, 0, 0.24, 0.24);
    block(x, y, 0.6, 0.6, 0.1);
  }
  for (const [x, y] of [[11.4, 5.0], [11.4, 5.5]] as Pt[]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.12), redMat);
    m.position.set(x, y, 0.2);
    leds.add(m);
    block(x, y, 1.1, 0.4, 0.1);
  }
  scene.add(leds);
  // tiny surface-mount parts
  const smdColors = ["#0c0c0d", "#0c0c0d", "#1d1d20", "#a9a9a8", "#e6e6e4", "#e6e6e4", "#4e4032", "#3a3938", "#111112"];
  placed = 0;
  guard = 0;
  while (placed < COUNTS.smallParts && guard++ < 200000) {
    const x = rng.range(-BOARD_SIZE / 2, BOARD_SIZE / 2);
    const y = rng.range(-BOARD_SIZE / 2, BOARD_SIZE / 2);
    if (!isFree(x, y, 0.2)) continue;
    const n = rng.chance(0.4) ? rng.int(2, 7) : 1;
    const horiz = rng.chance(0.5);
    const col = rng.pick(smdColors);
    const big = rng.chance(0.14);
    const l = big ? 0.62 : rng.pick([0.2, 0.26, 0.34]);
    const w = big ? 0.34 : l / 2;
    const h = big ? rng.range(0.25, 0.5) : 0.14;
    for (let k = 0; k < n; k++) {
      const px = x + (horiz ? 0 : k * (w + 0.09));
      const py = y + (horiz ? k * (w + 0.09) : 0);
      if (!isFree(px, py, 0.12)) break;
      b.box("smd", px, py, 0, horiz ? l : w, horiz ? w : l, h, { color: col });
      placed++;
    }
  }
  const parts = b.build(mats);
  scene.add(parts);

  /* ---- edge light strips of the package ----------------------------------- */
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const edges = new THREE.Group();
  {
    const g1 = new THREE.BoxGeometry(0.1, P.mid * 0.45, 0.08);
    const e1 = new THREE.Mesh(g1, edgeMat);
    e1.position.set(P.mid / 2 + 0.06, -P.mid * 0.2, P.baseH + 0.5);
    const g2 = new THREE.BoxGeometry(P.mid * 0.3, 0.1, 0.08);
    const e2 = new THREE.Mesh(g2, edgeMat);
    e2.position.set(P.mid * 0.3, -P.mid / 2 - 0.06, P.baseH + 0.5);
    edges.add(e1, e2);
  }
  scene.add(edges);

  /* ---- glowing lines: tiles ------------------------------------------------ */
  const tileRib = new Ribbons();
  {
    const z = P.tileZ + 0.012;
    const n = COUNTS.tileLines;
    for (let ty = 0; ty < 3; ty++)
      for (let tx = 0; tx < 3; tx++) {
        if (tx === 1 && ty === 1) continue;
        const ox = (tx - 1) * P.pitch;
        const oy = (ty - 1) * P.pitch;
        const h = P.tile / 2 - 0.16;
        // lines run away from the package centre across each tile
        const dx = tx - 1;
        const dy = ty - 1;
        for (let i = 0; i < n * (dx !== 0 && dy !== 0 ? 2 : 1); i++) {
          const diag = dx !== 0 && dy !== 0;
          let pts: Pt[];
          if (!diag) {
            const u = ((i + 0.5) / n - 0.5) * 2 * h;
            const jog = Math.sign(u || 1) * rng.range(0.15, 0.7);
            const a = rng.range(0.35, 0.6) * 2 * h - h;
            const a2 = a + Math.abs(jog);
            const end = Math.min(h, a2 + rng.range(0.4, 2.0));
            const l: Pt[] = [[-h, u * 0.55], [a, u * 0.55], [a2, u * 0.55 + jog], [end, u * 0.55 + jog]];
            pts = l.map(([p, q]) => (dx !== 0 ? [ox + dx * p, oy + q] : [ox + q, oy + dy * p]));
          } else {
            // corner tiles: lines leave the inner corner diagonally, then straighten
            const k = i - n + 0.5;
            const off = (k / n) * h * 1.5;
            const s0: Pt = [-h + Math.max(0, off), -h + Math.max(0, -off)];
            const dl = rng.range(0.5, 1.8);
            const s1: Pt = [s0[0] + dl, s0[1] + dl];
            const straight = rng.range(0.5, 2.4);
            const s2: Pt = off > 0 ? [Math.min(h, s1[0] + straight), s1[1]] : [s1[0], Math.min(h, s1[1] + straight)];
            if (s1[0] > h || s1[1] > h) continue;
            pts = [s0, s1, s2].map(([p, q]) => [ox + dx * p, oy + dy * q] as Pt);
          }
          tileRib.add(pts, 0.085, z);
          const e = pts[pts.length - 1];
          tileRib.dot(e[0], e[1], 0.085, z + 0.001);
        }
      }
  }
  const tileLineMat = makeRevealMaterial();
  scene.add(new THREE.Mesh(tileRib.build(), tileLineMat));

  /* ---- glowing lines: board ------------------------------------------------ */
  const boardRib = new Ribbons();
  {
    const g = 0.5;
    const cols = Math.floor(BOARD_SIZE / g) - 2;
    const occ = new Uint8Array(cols * cols);
    const gc = (i: number) => -BOARD_SIZE / 2 + g + i * g;
    const inv = (x: number) => Math.round((x + BOARD_SIZE / 2 - g) / g);
    const keep = P.base / 2 + 0.6;
    for (let y = 0; y < cols; y++)
      for (let x = 0; x < cols; x++)
        if (Math.abs(gc(x)) < keep && Math.abs(gc(y)) < keep) occ[y * cols + x] = 1;
    let side = 0;
    const paths = routeTraces(rng, {
      cols,
      rows: cols,
      count: COUNTS.boardLines,
      minRun: 5,
      maxRun: 18,
      minSegs: 2,
      maxSegs: 4,
      occupied: occ,
      start: (r) => {
        side = r.int(0, 3);
        const t = r.range(-keep, keep);
        const e = keep + 0.3;
        if (side === 0) return [inv(e), inv(t)];
        if (side === 1) return [inv(t), inv(e)];
        if (side === 2) return [inv(-e), inv(t)];
        return [inv(t), inv(-e)];
      },
      // head away from the package: E, N, W, S
      startDir: () => side * 2,
    });
    for (const p of paths) {
      const pts: Pt[] = p.map(([x, y]) => [gc(x), gc(y)]);
      const w = rng.range(0.08, 0.14);
      boardRib.add(pts, w, 0.03);
      const e = pts[pts.length - 1];
      boardRib.dot(e[0], e[1], w * 1.4, 0.031);
    }
  }
  const boardLineMat = makeRevealMaterial();
  boardLineMat.uniforms.uSoft.value = 2.5;
  boardLineMat.uniforms.uIntensity.value = ML.boardLineIntensity;
  boardLineMat.uniforms.uColor.value.set(PALETTE.boardGlow);
  scene.add(new THREE.Mesh(boardRib.build(), boardLineMat));

  /* ---- the small chip that comes down -------------------------------------- */
  const chip = new THREE.Group();
  const chipTopMat = std({
    color: "#e4e3df",
    roughness: 0.3,
    metalness: 1,
    envMapIntensity: 1.3,
    emissive: new THREE.Color(PALETTE.chipGlow),
    emissiveIntensity: 0,
  });
  {
    const cb = new Batch();
    const c = P.chip;
    cb.box("black", 0, 0, 0, c, c, 0.42, { round: true });
    cb.box("gold", 0, 0, -0.04, c - 0.2, c - 0.2, 0.05);
    cb.box("blackGloss", -c * 0.13, 0, 0.5, c * 0.07, c * 0.42, 0.012);
    cb.box("blackGloss", c * 0.13, 0, 0.5, c * 0.07, c * 0.42, 0.012);
    chip.add(cb.build(mats));
    const top = new THREE.Mesh(new THREE.BoxGeometry(c - 0.3, c - 0.3, 0.08), chipTopMat);
    top.position.z = 0.46;
    top.castShadow = true;
    chip.add(top);
  }
  const seatZ = frameZ + 0.1;
  scene.add(chip);

  /* ---- flare and ignition light --------------------------------------------- */
  const flareMat = makeFlareMaterial();
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flareMat);
  flare.renderOrder = 20;
  flare.frustumCulled = false;
  scene.add(flare);
  const ignite = new THREE.PointLight(PALETTE.ignitionLight, 0, 10.5, 2);
  ignite.position.set(0, 0, P.topZ + 1.6);
  scene.add(ignite);

  /* ---- lights ---------------------------------------------------------------- */
  const key = new THREE.DirectionalLight(LIGHTS.key.color, LIGHTS.key.intensity);
  key.position.set(...LIGHTS.key.pos);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera;
  sc.left = -40;
  sc.right = 40;
  sc.top = 40;
  sc.bottom = -40;
  sc.near = 5;
  sc.far = 140;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 2.5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(LIGHTS.fill.color, LIGHTS.fill.intensity);
  fill.position.set(...LIGHTS.fill.pos);
  scene.add(fill);

  /* ---- animation: a pure function of the frame -------------------------------- */
  const target = new THREE.Vector3();
  const glowCol = new THREE.Color(PALETTE.led);
  const redCol = new THREE.Color(PALETTE.ledRed);
  const edgeCol = new THREE.Color(PALETTE.glow);
  const zAxis = new THREE.Vector3(0, 0, 1);

  const apply = (f: number): FrameLook => {
    const t = f / FPS;

    // camera
    const az = rad(pchip(t, move.azimuth));
    const el = rad(pchip(t, move.elevation));
    const dist = pchip(t, move.distance);
    target.set(pchip(t, move.targetX), pchip(t, move.targetY), 2.6);
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y - dist * Math.cos(el) * Math.cos(az),
      target.z + dist * Math.sin(el),
    );
    camera.up.set(0, 0, 1);
    camera.lookAt(target);
    camera.rotateZ(rad(pchip(t, move.roll)));
    camera.updateMatrixWorld(true);

    // the small chip comes down and settles
    const drop = pchip(t, TIMING.chipDrop);
    chip.position.set(0, 0, seatZ + drop);
    chip.setRotationFromAxisAngle(zAxis, rad(drop * 3.2));

    // LEDs
    const led = ramp(t, TIMING.ledsFrom, TIMING.ledsTo);
    ledMat.color.copy(glowCol).multiplyScalar(led * ML.ledIntensity);
    redMat.color.copy(redCol).multiplyScalar(led * ML.ledIntensity * 0.5);

    // ignition: glow -> flare -> steady burn with a slow, small breathing
    const glow = ramp(t, TIMING.glowFrom, TIMING.glowTo);
    const burst = ramp(t, TIMING.flareFrom, TIMING.flarePeak);
    const settle = 1 - 0.22 * ramp(t, TIMING.flarePeak, TIMING.flarePeak + 1.2);
    const breathe = 1 + 0.045 * Math.sin(t * 5.3) + 0.03 * Math.sin(t * 8.9 + 1.3);
    const flareAmt = burst * settle * breathe;
    // after the burst the flare keeps building up to the end of the film
    const swell = t < TIMING.swell[0][0] ? 1 : pchip(t, TIMING.swell);
    const build = (swell - 1) / (TIMING.swell[TIMING.swell.length - 1][1] - 1);
    chipTopMat.emissiveIntensity = glow * ML.chipGlow * (1 - 0.85 * burst);
    chipTopMat.envMapIntensity = 1.3 * (1 - 0.93 * glow);
    chipTopMat.color.setScalar(0.85 * (1 - 0.95 * glow) + 0.01);
    flareMat.uniforms.uIntensity.value =
      flareAmt * ML.flareIntensity * (0.8 + 0.2 * build) + glow * (1 - burst) * 0.8;
    flareMat.uniforms.uCoreMix.value = burst * (0.3 + 0.7 * build);
    // the flare is a camera-facing card whose size is tied to the frame height
    const flarePos = chip.position;
    const dCam = camera.position.distanceTo(flarePos);
    const frameH = 2 * dCam * Math.tan(rad(move.fov) / 2);
    flare.position.copy(flarePos).addScaledVector(zAxis, 0.5);
    flare.quaternion.copy(camera.quaternion);
    flare.scale.setScalar(frameH * ML.flareSize * 2);
    ignite.intensity = LIGHTS.ignition * (0.3 * glow + flareAmt * swell);
    tileLineMat.uniforms.uIntensity.value = ML.lineIntensity * (0.7 + 0.3 * swell);

    // lines spreading over the tiles and then the board
    tileLineMat.uniforms.uReveal.value = t < TIMING.tileReveal[0][0] ? 0 : pchip(t, TIMING.tileReveal);
    boardLineMat.uniforms.uReveal.value = t < TIMING.boardReveal[0][0] ? 0 : pchip(t, TIMING.boardReveal);
    const edge = ramp(t, TIMING.edgeFrom, TIMING.edgeTo);
    edgeMat.color.copy(edgeCol).multiplyScalar(edge * ML.edgeIntensity * breathe);

    return {
      focus: dist,
      bokehScale: DOF.bokeh,
      focusRange: DOF.range,
      bloomMul: 1 + 0.8 * clamp01(flareAmt),
    };
  };

  return { scene, camera, apply };
};
