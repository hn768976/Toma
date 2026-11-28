import * as THREE from "three";
import { makeStudioEnv } from "../engine/env";
import {
  Batch,
  canvasTexture,
  makeCanvas,
  Pt,
  Ribbons,
  routeTraces,
  strokePath,
} from "../engine/kit";
import { makeFullscreenTriangle } from "../engine/output";
import { easeInOutCubic, pchip, ramp, Rng } from "../engine/rng";
import type { FrameLook, World } from "../engine/types";
import {
  ASSEMBLY,
  BOARD,
  COUNTS,
  FPS,
  MOTION,
  Palette,
  SEED,
  SOCKET,
  TIMING,
} from "../config";
import {
  BACKDROP,
  DOF,
  ENV_AMBIENT,
  ENV_LOBES,
  ENV_PANELS,
  LIGHTS,
  LOOK,
  MATERIAL_LOOK,
} from "../look";

const rad = (d: number) => (d * Math.PI) / 180;

/* -------------------------------------------------------------------------- */
/* textures                                                                    */
/* -------------------------------------------------------------------------- */

/** Fine, low-contrast copper pattern for the board surface (3 detail scales). */
const makeBoardTexture = (seed: number) => {
  const S = 2048;
  const { canvas, ctx } = makeCanvas(S, S);
  const rng = new Rng(seed);
  ctx.fillStyle = "#1c1c1e";
  ctx.fillRect(0, 0, S, S);
  // large: ground pours, slightly lighter or darker regions
  for (let i = 0; i < 60; i++) {
    const w = rng.range(80, 420);
    const h = rng.range(80, 420);
    const v = rng.int(18, 40);
    ctx.fillStyle = `rgb(${v},${v},${v + 1})`;
    ctx.fillRect(rng.range(0, S), rng.range(0, S), w, h);
  }
  // medium: thin routed traces
  const cols = 256;
  const paths = routeTraces(rng, {
    cols,
    rows: cols,
    count: 900,
    minRun: 3,
    maxRun: 26,
    minSegs: 2,
    maxSegs: 6,
  });
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of paths) {
    const v = rng.int(48, 92);
    ctx.strokeStyle = `rgb(${v},${v},${v + 2})`;
    ctx.lineWidth = rng.pick([1.5, 2, 2, 3]);
    strokePath(ctx, p, S / cols, S / cols, 4, 4);
    const e = p[p.length - 1];
    ctx.fillStyle = `rgb(${v + 30},${v + 30},${v + 30})`;
    ctx.beginPath();
    ctx.arc(4 + e[0] * (S / cols), 4 + e[1] * (S / cols), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine: pad rows and silk-screen dots
  for (let i = 0; i < 520; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const n = rng.int(2, 9);
    const horiz = rng.chance(0.5);
    const v = rng.chance(0.25) ? rng.int(170, 235) : rng.int(70, 120);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    for (let k = 0; k < n; k++) {
      const px = x + (horiz ? k * 7 : 0);
      const py = y + (horiz ? 0 : k * 7);
      ctx.fillRect(px, py, 4, 4);
    }
  }
  return canvas;
};

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Rectangular frame made of four bars. */
const frame = (
  b: Batch,
  mat: string,
  cx: number,
  cy: number,
  z0: number,
  ow: number,
  oh: number,
  bar: number,
  h: number,
  round = true,
) => {
  b.box(mat, cx, cy + oh / 2 - bar / 2, z0, ow, bar, h, { round });
  b.box(mat, cx, cy - oh / 2 + bar / 2, z0, ow, bar, h, { round });
  b.box(mat, cx - ow / 2 + bar / 2, cy, z0, bar, oh - bar * 2, h, { round });
  b.box(mat, cx + ow / 2 - bar / 2, cy, z0, bar, oh - bar * 2, h, { round });
};

/** Original block lettering "AI" as extruded shapes, centred on the origin. */
const makeLetters = (height: number, depth: number) => {
  const s = height / 1.2;
  const a = new THREE.Shape();
  a.moveTo(0, 0);
  a.lineTo(0.27, 0);
  a.lineTo(0.335, 0.26);
  a.lineTo(0.665, 0.26);
  a.lineTo(0.73, 0);
  a.lineTo(1.0, 0);
  a.lineTo(0.645, 1.2);
  a.lineTo(0.355, 1.2);
  a.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0.395, 0.5);
  hole.lineTo(0.5, 0.92);
  hole.lineTo(0.605, 0.5);
  hole.closePath();
  a.holes.push(hole);
  const i = new THREE.Shape();
  i.moveTo(1.16, 0);
  i.lineTo(1.43, 0);
  i.lineTo(1.43, 1.2);
  i.lineTo(1.16, 1.2);
  i.closePath();
  const g = new THREE.ExtrudeGeometry([a, i], {
    depth: depth / s,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(-0.715, -0.6, 0);
  g.scale(s, s, s);
  return g;
};

/** Emissive material for glowing lines; hotter along the centre of a line. */
const makeGlowMaterial = (color: string, hot: string, intensity: number) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uHot: { value: new THREE.Color(hot) },
      uIntensity: { value: intensity },
      /** 0 = every line fully lit (close-up), 1 = only some lines glow (wide) */
      uSelect: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo;
      varying vec2 vUv;
      varying float vPick;
      void main() {
        vUv = uv;
        vPick = aInfo.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying float vPick;
      uniform vec3 uColor, uHot;
      uniform float uIntensity, uSelect;
      void main() {
        float core = 1.0 - smoothstep(0.0, 0.9, abs(vUv.y));
        // slow brightness variation along a line, so lines are not uniform
        float vary = 0.78 + 0.22 * sin(vUv.x * 1.7 + 1.3) * sin(vUv.x * 0.43 + 0.5);
        // in the wide shot each line has its own level: a few bright, most dim
        float pick = mix(1.0, 0.1 + 1.5 * smoothstep(0.3, 0.95, vPick), uSelect);
        vec3 c = mix(uColor, uHot, core * 0.85) * (0.55 + 0.75 * core) * vary * pick;
        gl_FragColor = vec4(c * uIntensity, 1.0);
      }
    `,
  });

/* -------------------------------------------------------------------------- */
/* the world                                                                   */
/* -------------------------------------------------------------------------- */

export const createWorld = (
  gl: THREE.WebGLRenderer,
  palette: Palette,
): World => {
  const rng = new Rng(SEED);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(MOTION.fov, 16 / 9, 1, 400);
  scene.add(camera);

  // (shadow maps are switched on by the <ThreeCanvas shadows> prop in Stage.tsx)

  scene.environment = makeStudioEnv(gl, ENV_PANELS, ENV_AMBIENT, ENV_LOBES);
  scene.environmentIntensity = LIGHTS.envIntensity;

  /* ---- materials --------------------------------------------------------- */
  const ML = MATERIAL_LOOK;
  const boardCanvas = makeBoardTexture(SEED + 1);
  const boardMap = canvasTexture(boardCanvas, { srgb: true, aniso: 8 });
  const boardBump = canvasTexture(boardCanvas, { srgb: false, aniso: 4 });
  const std = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial(p);
  const mats: Record<string, THREE.Material> = {
    // Lambert: the bare board has no specular, so the small coloured lights
    // pool softly on it instead of showing up as sharp glints
    pcb: new THREE.MeshLambertMaterial({
      color: ML.pcb,
      map: boardMap,
      bumpMap: boardBump,
      bumpScale: 0.15,
    }),
    pcbEdge: std({
      color: "#050506",
      roughness: 0.5,
      metalness: 0.2,
      envMapIntensity: 0.2,
    }),
    back: std({
      color: ML.back,
      roughness: 0.3,
      metalness: 0.75,
      emissive: "#ffffff",
      emissiveIntensity: 0,
      envMapIntensity: 0.08,
    }),
    gunmetal: std({
      color: "#404248",
      roughness: 0.36,
      metalness: 1,
      envMapIntensity: 1.0,
    }),
    heatsink: std({
      color: "#5d6068",
      roughness: 0.4,
      metalness: 1,
      envMapIntensity: 1.0,
    }),
    steel: std({ color: "#c4c8cf", roughness: 0.24, metalness: 1 }),
    alu: std({
      color: "#b9bcc3",
      roughness: 0.2,
      metalness: 1,
      envMapIntensity: 0.85,
    }),
    black: std({
      color: "#17171a",
      roughness: 0.5,
      metalness: 0.0,
      envMapIntensity: 0.3,
    }),
    blackGloss: std({
      color: "#060607",
      roughness: 0.22,
      metalness: 0.3,
      envMapIntensity: 0.4,
    }),
    grey: std({
      color: "#46474d",
      roughness: 0.55,
      metalness: 0.3,
      envMapIntensity: 0.5,
    }),
    white: std({
      color: "#c9ccd2",
      roughness: 0.5,
      metalness: 0,
      emissive: "#f2f5ff",
      emissiveIntensity: ML.whiteEmissive,
    }),
    gold: std({
      color: palette.pin,
      roughness: 0.28,
      metalness: 1,
      envMapIntensity: 0.3,
    }),
    substrate: std({
      color: palette.chipFace,
      roughness: 0.5,
      metalness: 0.3,
      envMapIntensity: 0.4,
    }),
    capTop: std({
      color: "#5c5f66",
      roughness: 0.3,
      metalness: 1,
      envMapIntensity: 1.0,
    }),
    smd: std({
      color: "#ffffff",
      roughness: 0.5,
      metalness: 0.35,
      envMapIntensity: 0.5,
    }),
    bar: std({
      color: "#0b0b0d",
      roughness: 0.55,
      metalness: 0.0,
      envMapIntensity: 0.1,
    }),
    latch: std({
      color: "#33353a",
      roughness: 0.5,
      metalness: 0.2,
      envMapIntensity: 0.4,
    }),
    dot: std({
      color: "#26272b",
      roughness: 0.5,
      metalness: 0.5,
      envMapIntensity: 0.4,
    }),
    leg: std({
      color: "#7d8088",
      roughness: 0.4,
      metalness: 0.9,
      envMapIntensity: 0.5,
    }),
  };
  const traceMat = makeGlowMaterial(
    palette.trace,
    palette.traceHot,
    ML.traceIntensity,
  );
  const chipTraceMat = makeGlowMaterial(
    palette.chipTrace,
    palette.traceHot,
    ML.chipTraceIntensity,
  );
  // extruded metal letters that also glow, so their sides catch the light
  const lettersMat = std({
    color: palette.pin,
    roughness: 0.3,
    metalness: 1,
    emissive: new THREE.Color(palette.letters),
    emissiveIntensity: ML.lettersIntensity,
  });

  /* ---- board ------------------------------------------------------------- */
  const board = new THREE.Group();
  scene.add(board);
  const { w: BW, h: BH, t: BT } = BOARD;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BT), [
    mats.pcbEdge,
    mats.pcbEdge,
    mats.pcbEdge,
    mats.pcbEdge,
    mats.pcb,
    mats.back,
  ]);
  slab.position.z = -BT / 2;
  slab.receiveShadow = true;
  slab.castShadow = true;
  board.add(slab);

  // Parts are collected into named groups; each group floats off the board
  // during the spin and settles back on its own schedule (config ASSEMBLY).
  const batches = new Map<string, Batch>();
  let b = new Batch();
  const intoGroup = (name: string) => {
    let x = batches.get(name);
    if (!x) {
      x = new Batch();
      batches.set(name, x);
    }
    b = x;
  };
  intoGroup("socket");
  /** footprints of big parts, so small parts do not overlap them */
  const blocked: [number, number, number, number][] = [];
  const block = (cx: number, cy: number, w: number, h: number, pad = 0.2) =>
    blocked.push([
      cx - w / 2 - pad,
      cy - h / 2 - pad,
      cx + w / 2 + pad,
      cy + h / 2 + pad,
    ]);
  const isFree = (x: number, y: number, r: number) =>
    Math.abs(x) < BW / 2 - 0.4 - r &&
    Math.abs(y) < BH / 2 - 0.4 - r &&
    !blocked.some(
      (k) => x > k[0] - r && x < k[2] + r && y > k[1] - r && y < k[3] + r,
    );

  /* ---- CPU socket -------------------------------------------------------- */
  const cx = SOCKET.x;
  const cy = SOCKET.y;
  block(cx, cy, 6.4, 8.6);
  frame(b, "black", cx, cy, 0, 5.7, 5.9, 0.46, 0.5);
  frame(b, "gunmetal", cx, cy - 0.1, 0.5, 5.95, 7.5, 0.5, 0.14);
  b.box("gunmetal", cx, cy + 3.95, 0.52, 1.5, 0.5, 0.22, { round: true });
  b.box("gunmetal", cx - 1.7, cy + 3.95, 0.5, 0.8, 0.45, 0.26, { round: true });
  b.box("gunmetal", cx + 1.7, cy + 3.95, 0.5, 0.8, 0.45, 0.26, { round: true });
  b.box("steel", cx, cy - 4.0, 0.3, 5.2, 0.18, 0.18, { round: true });
  b.box("gunmetal", cx - 2.3, cy - 4.0, 0, 1.1, 0.8, 0.5, { round: true });
  b.box("gunmetal", cx + 2.3, cy - 4.0, 0, 1.1, 0.8, 0.5, { round: true });
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      b.cyl("steel", cx + sx * 2.35, cy - 0.1 + sy * 3.5, 0.64, 0.2, 0.12);
      b.cyl("capTop", cx + sx * 2.35, cy - 0.1 + sy * 3.5, 0.76, 0.1, 0.02);
    }
  // the chip
  const chipSize = 4.75;
  b.box("substrate", cx, cy, 0.1, chipSize, chipSize, 0.3, { round: false });
  const chipTop = 0.4;
  const N = COUNTS.pinGrid;
  const hole = COUNTS.pinHole;
  const pitch = 4.3 / (N - 1);
  const lo = (N - hole) / 2;
  for (let iy = 0; iy < N; iy++)
    for (let ix = 0; ix < N; ix++) {
      if (ix >= lo && ix < N - lo && iy >= lo && iy < N - lo) continue;
      const px = cx + (ix - (N - 1) / 2) * pitch;
      const py = cy + (iy - (N - 1) / 2) * pitch;
      b.cyl("gold", px, py, chipTop, 0.086, 0.1, { shape: "ring" });
    }

  /* ---- chip circuit pattern + letters ------------------------------------ */
  const chipRibbons = new Ribbons();
  {
    // fan-out: lines leave the letter block on all four sides, jog 45 degrees
    // away from the centre and run on between the pins, each ending in a dot
    const bw = 0.62; // half size of the letter block
    const bh = 0.5;
    const z = chipTop + 0.012;
    const nSide = COUNTS.chipLines;
    for (let side = 0; side < 4; side++) {
      const horiz = side < 2; // lines leave left/right
      const sgn = side % 2 === 0 ? 1 : -1;
      const half = horiz ? bh : bw;
      const out0 = horiz ? bw : bh;
      for (let i = 0; i < nSide; i++) {
        const u = ((i + 0.5) / nSide - 0.5) * 2; // -1..1 along the rim
        const l1 = 0.1 + (1 - Math.abs(u)) * 0.34 + rng.range(0, 0.08);
        const l2 = Math.abs(u) * rng.range(0.5, 0.95) + 0.06;
        const l3 = rng.range(0.15, 1.0);
        const s1 = u * half;
        const a0 = out0 + 0.02;
        const a1 = a0 + l1;
        const a2 = a1 + l2;
        const s2 = s1 + Math.sign(u || 1) * l2;
        const a3 = Math.min(2.2, a2 + l3);
        const local: Pt[] = [
          [a0, s1],
          [a1, s1],
          [a2, s2],
          [a3, s2],
        ];
        const pts: Pt[] = local.map(([a, t]) =>
          horiz ? [cx + sgn * a, cy + t] : [cx + t, cy + sgn * a],
        );
        chipRibbons.add(pts, 0.026, z, [1, 0, 0]);
        const e = pts[pts.length - 1];
        chipRibbons.dot(e[0], e[1], 0.042, z + 0.001, [1, 0, 0]);
        // every third line gets a short branch
        if (i % 3 === 1) {
          const b0: Pt = local[2];
          const bl = rng.range(0.2, 0.5);
          const br: Pt[] = [
            b0,
            [b0[0] + bl * 0.4, b0[1] + Math.sign(u || 1) * bl],
          ];
          const bp: Pt[] = br.map(([a, t]) =>
            horiz ? [cx + sgn * a, cy + t] : [cx + t, cy + sgn * a],
          );
          chipRibbons.add(bp, 0.022, z, [1, 0, 0]);
          chipRibbons.dot(bp[1][0], bp[1][1], 0.036, z + 0.001, [1, 0, 0]);
        }
      }
    }
  }
  const chipTraces = new THREE.Mesh(chipRibbons.build(), chipTraceMat);
  const letters = new THREE.Mesh(makeLetters(0.7, 0.26), lettersMat);
  letters.position.set(cx, cy, chipTop + 0.01);

  /* ---- left of the socket: white blocks and capacitors -------------------- */
  intoGroup("blocks");
  for (let i = 0; i < COUNTS.whiteBlocks; i++) {
    const y = cy - 4.4 + i * 1.46;
    b.box("white", cx - 7.0, y, 0, 1.5, 1.08, 1.05, { round: true });
    b.box("gunmetal", cx - 7.0, y, 0, 1.62, 1.2, 0.12);
  }
  block(cx - 7.0, cy, 1.9, 10.6);
  intoGroup("caps");
  const capXY: [number, number][] = [];
  for (let i = 0; i < COUNTS.capacitors; i++)
    capXY.push([cx - 5.4, cy - 4.6 + i * 1.3]);
  capXY.push(
    [cx - 4.45, cy + 1.25],
    [cx - 4.45, cy + 2.55],
    [cx - 4.45, cy - 0.05],
  );
  for (const [x, y] of capXY) {
    b.cyl("alu", x, y, 0, 0.43, 1.25, { shape: "can" });
    b.cyl("capTop", x, y, 1.246, 0.24, 0.01);
    b.cyl("black", x, y, 0, 0.47, 0.08);
  }
  block(cx - 4.95, cy, 2.0, 10.8);

  /* ---- right of the socket: tall bars ------------------------------------ */
  intoGroup("bars");
  for (let i = 0; i < COUNTS.sideBars; i++) {
    const x = cx + 4.34 + i * 0.89;
    const y0 = cy - 3.3;
    const len = 10.0;
    b.box("bar", x, y0 + len / 2, 0, 0.6, len, 1.2, { round: false });
    b.box("blackGloss", x, y0 + len / 2, 1.2, 0.2, len - 0.6, 0.03);
    // contact dots along both sides of the groove
    for (let k = 0; k < 42; k++) {
      const y = y0 + 0.5 + (k * (len - 1.0)) / 41;
      b.box("dot", x - 0.19, y, 1.2, 0.07, 0.09, 0.02);
      b.box("dot", x + 0.19, y, 1.2, 0.07, 0.09, 0.02);
    }
    b.box("latch", x, y0 - 0.2, 0, 0.64, 0.7, 1.5, { round: true });
    b.box("grey", x, y0 + len + 0.2, 0, 0.64, 0.6, 1.4, { round: true });
  }
  block(cx + 4.34 + 1.33, cy + 1.7, 3.6, 11.6);

  /* ---- top-left: connector blocks ---------------------------------------- */
  intoGroup("io");
  const io: [number, number, number, number, number][] = [
    [-10.6, 11.2, 2.2, 2.6, 2.2],
    [-10.6, 8.3, 2.2, 2.2, 1.7],
    [-10.6, 5.6, 2.2, 2.4, 2.6],
    [-10.6, 2.9, 2.2, 1.8, 1.4],
  ];
  for (const [x, y, w, h, t] of io) {
    b.box("gunmetal", x, y, 0, w, h, t, { round: true });
    b.box("black", x - 0.2, y, t, w * 0.7, h * 0.7, 0.03);
    block(x, y, w, h);
  }

  /* ---- lower half: long parallel slots ----------------------------------- */
  for (let i = 0; i < COUNTS.slots; i++) {
    intoGroup(i % 2 === 0 ? "slotsA" : "slotsB");
    const x = -8.9 + i * (17.8 / (COUNTS.slots - 1));
    const len = 9.4;
    const yTop = -3.0;
    const yc = yTop - len / 2;
    b.box("black", x, yc, 0, 0.72, len, 1.05, { round: false });
    b.box("grey", x, yc, 1.05, 0.16, len - 0.5, 0.025);
    b.box("grey", x, yTop + 0.25, 0, 0.8, 0.5, 1.25, { round: true });
    b.box("grey", x, yTop - len - 0.2, 0, 0.8, 0.45, 0.9, { round: true });
    block(x, yc, 0.9, len + 1.0, 0.15);
  }

  /* ---- medium parts: chips, heat sink, white squares ---------------------- */
  // large finned heat sink, upper right
  intoGroup("heatsink");
  {
    const hx = 9.9;
    const hy = 9.4;
    b.box("heatsink", hx, hy, 0, 3.4, 5.6, 0.35, { round: true });
    for (let i = 0; i < 10; i++)
      b.box("heatsink", hx - 1.44 + i * 0.32, hy, 0.35, 0.13, 5.4, 1.3);
    block(hx, hy, 3.6, 5.8);
  }
  intoGroup("whites");
  for (let i = 0; i < 4; i++) {
    b.box("white", 6.4 + i * 1.15, 1.9, 0, 0.85, 0.85, 0.7, { round: true });
  }
  block(8.1, 1.9, 4.6, 1.1);
  for (let i = 0; i < 5; i++) {
    b.box("white", -11.0, 0.6 - i * 1.05, 0, 0.8, 0.8, 0.65, { round: true });
  }
  block(-11.0, -1.5, 1.0, 5.4);
  // square ICs
  intoGroup("chips");
  let placed = 0;
  let guard = 0;
  while (placed < COUNTS.chips && guard++ < 4000) {
    const s = rng.range(0.7, 1.7);
    const x = rng.range(-BW / 2, BW / 2);
    const y = rng.range(-BH / 2, BH / 2);
    if (!isFree(x, y, s * 0.75)) continue;
    const r = rng.chance(0.2) ? Math.PI / 4 : 0;
    b.box("leg", x, y, 0, s + 0.16, s * 0.82, 0.05, { rot: r });
    b.box("leg", x, y, 0, s * 0.82, s + 0.16, 0.05, { rot: r });
    b.box("black", x, y, 0.03, s, s, 0.16, { rot: r, round: true });
    block(x, y, s, s, 0.25);
    placed++;
  }
  // small cans and inductors
  intoGroup("cans");
  placed = 0;
  guard = 0;
  const canClusters: Pt[] = [
    [-1.5, 11.4],
    [-9.6, -5.5],
    [3.2, -1.2],
  ];
  while (placed < COUNTS.cans && guard++ < 4000) {
    const c = rng.pick(canClusters);
    const x = c[0] + rng.range(-1.6, 1.6);
    const y = c[1] + rng.range(-1.1, 1.1);
    const r = rng.range(0.22, 0.32);
    if (!isFree(x, y, r + 0.06)) continue;
    b.cyl("alu", x, y, 0, r, rng.range(0.55, 0.95), { shape: "can" });
    block(x, y, r * 2, r * 2, 0.06);
    placed++;
  }
  // bottom edge header row
  intoGroup("header");
  for (let i = 0; i < 14; i++) {
    const x = -10.6 + i * 1.62;
    b.box("black", x, -BH / 2 + 0.55, 0, 1.3, 0.55, 0.75, { round: true });
    for (let k = 0; k < 5; k++)
      b.cyl("gold", x - 0.48 + k * 0.24, -BH / 2 + 0.55, 0.75, 0.035, 0.22);
  }
  block(0, -BH / 2 + 0.55, BW, 0.9);

  /* ---- tiny surface-mount parts ------------------------------------------ */
  const smdColors = [
    "#1b1b1e",
    "#1b1b1e",
    "#2a2a2e",
    "#b9aa8d",
    "#d9d9dc",
    "#6b6d73",
    "#111113",
  ];
  placed = 0;
  guard = 0;
  while (placed < COUNTS.smallParts && guard++ < 40000) {
    const x = rng.range(-BW / 2, BW / 2);
    const y = rng.range(-BH / 2, BH / 2);
    if (!isFree(x, y, 0.16)) continue;
    const n = rng.chance(0.35) ? rng.int(2, 6) : 1;
    const horiz = rng.chance(0.5);
    const col = rng.pick(smdColors);
    intoGroup(rng.pick(["smdA", "smdA", "smdB", "smdC"]));
    for (let k = 0; k < n; k++) {
      const px = x + (horiz ? 0 : k * 0.19);
      const py = y + (horiz ? k * 0.19 : 0);
      if (!isFree(px, py, 0.1)) break;
      b.box("smd", px, py, 0, horiz ? 0.3 : 0.13, horiz ? 0.13 : 0.3, 0.1, {
        color: col,
      });
      b.box("leg", px, py, 0, horiz ? 0.36 : 0.11, horiz ? 0.11 : 0.36, 0.06);
      placed++;
    }
  }

  const groups: Record<string, THREE.Group> = {};
  for (const [name, batch] of batches) {
    const g = batch.build(mats);
    g.name = name;
    groups[name] = g;
    board.add(g);
  }
  groups.socket.add(chipTraces, letters);

  /* ---- glowing traces ---------------------------------------------------- */
  const ribbons = new Ribbons();
  const tz = 0.03;
  // hero traces fanning out of the socket
  {
    const exits: { p: Pt; d: Pt }[] = [];
    const D = Math.SQRT1_2;
    for (const k of [-2.6, -1.2, 0.3, 2.2]) {
      exits.push({ p: [cx - 2.9, cy + k], d: [-1, 0] });
      exits.push({ p: [cx + 2.9, cy + k * 0.9 + 0.4], d: [1, 0] });
    }
    for (const k of [-2.0, -1.0, 1.1, 2.1]) {
      exits.push({ p: [cx + k * 0.4, cy + 3.8], d: [0, 1] });
      exits.push({ p: [cx + k, cy - 3.8], d: [0, -1] });
    }
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        exits.push({ p: [cx + sx * 2.9, cy + sy * 3.7], d: [sx * D, sy * D] });
    for (const e of exits) {
      const pts: Pt[] = [e.p];
      let x = e.p[0];
      let y = e.p[1];
      let dx = e.d[0];
      let dy = e.d[1];
      const segs = rng.int(2, 4);
      for (let s = 0; s < segs; s++) {
        const len = rng.range(1.6, 5.5);
        x += dx * len;
        y += dy * len;
        x = Math.max(-BW / 2 + 0.3, Math.min(BW / 2 - 0.3, x));
        y = Math.max(-BH / 2 + 0.3, Math.min(BH / 2 - 0.3, y));
        pts.push([x, y]);
        // 45 degree bend, alternating between axis and diagonal
        const turn = rng.sign();
        if (dx !== 0 && dy !== 0) {
          if (rng.chance(0.5)) dx = 0;
          else dy = 0;
        } else if (dx !== 0) dy = turn;
        else dx = turn;
        const l = Math.hypot(dx, dy);
        dx /= l;
        dy /= l;
      }
      // lines that start at the socket stay among the bright ones
      ribbons.add(pts, rng.range(0.28, 0.38), tz, [rng.range(0.6, 1), 0, 0]);
    }
  }
  // routed traces over the whole board
  {
    const g = 0.5;
    const cols = Math.floor(BW / g) - 1;
    const rows = Math.floor(BH / g) - 1;
    const occ = new Uint8Array(cols * rows);
    const gx = (x: number) => -BW / 2 + g + x * g;
    const gy = (y: number) => -BH / 2 + g + y * g;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (Math.abs(gx(x) - cx) < 3.6 && Math.abs(gy(y) - cy) < 3.9)
          occ[y * cols + x] = 1;
    const paths = routeTraces(rng, {
      cols,
      rows,
      count: COUNTS.traces,
      minRun: 3,
      maxRun: 15,
      minSegs: 2,
      maxSegs: 5,
      ortho: 0.75,
      occupied: occ,
      // mostly vertical runs, as on the lower half of the reference board
      startDir: (r) => (r.chance(0.7) ? r.pick([2, 6]) : r.pick([0, 4, 1, 3])),
      start: (r) => [
        r.int(0, cols - 1),
        r.chance(0.72) ? r.int(0, Math.floor(rows * 0.52)) : r.int(0, rows - 1),
      ],
    });
    for (const p of paths) {
      const pts: Pt[] = p.map(([x, y]) => [gx(x), gy(y)]);
      const w = rng.range(0.11, 0.18);
      const pick = rng.next();
      ribbons.add(pts, w, tz, [pick, 0, 0]);
      const e = pts[pts.length - 1];
      ribbons.dot(e[0], e[1], w * 0.95, tz + 0.001, [pick, 0, 0]);
    }
  }
  const traces = new THREE.Mesh(ribbons.build(), traceMat);
  board.add(traces);

  /* ---- lights ------------------------------------------------------------ */
  const key = new THREE.DirectionalLight(
    LIGHTS.key.color,
    LIGHTS.key.intensity,
  );
  key.position.set(...LIGHTS.key.pos);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -22;
  sc.right = 22;
  sc.top = 22;
  sc.bottom = -22;
  sc.near = 5;
  sc.far = 140;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(palette.fill, LIGHTS.fill.intensity);
  fill.position.set(...LIGHTS.fill.pos);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(
    LIGHTS.rim.color,
    LIGHTS.rim.intensity,
  );
  rim.position.set(...LIGHTS.rim.pos);
  scene.add(rim);
  for (const [x, y] of [
    [cx - 4.2, cy],
    [cx + 4.0, cy + 1.5],
    [cx, cy - 4.6],
    [cx, cy + 4.6],
  ]) {
    const p = new THREE.PointLight(palette.spill, LIGHTS.spillIntensity, 9, 2);
    p.position.set(x, y, 0.9);
    board.add(p);
  }
  // soft pools of glow colour between the parts of the lower half
  const poolLights: THREE.PointLight[] = [];
  for (const [x, y] of [
    [-7, -4],
    [0, -5.5],
    [7, -4.5],
    [-4, -10],
    [4.5, -10.5],
    [-9, 2],
  ]) {
    const p = new THREE.PointLight(palette.spill, LIGHTS.poolIntensity, 8, 2);
    p.position.set(x, y, 1.4);
    board.add(p);
    poolLights.push(p);
  }
  // glow of the letters on the chip face
  const letterLight = new THREE.PointLight(
    palette.letters,
    LIGHTS.spillIntensity * 0.04,
    5,
    2,
  );
  letterLight.position.set(cx, cy, 1.1);
  board.add(letterLight);

  /* ---- backdrop: grey void with a soft pool of light ---------------------- */
  // The pool is specified in display-linear values and run backwards through
  // the ACES curve here, so the grey levels survive tone mapping exactly.
  const backdropMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uCenter: { value: new THREE.Vector2(0.7, BACKDROP.centerY) },
      uPeak: { value: BACKDROP.peak },
      uRadius: { value: BACKDROP.radius },
      uPower: { value: BACKDROP.power },
      uExposure: { value: LOOK.exposure },
      uContrast: { value: LOOK.grade.contrast },
      uGamma: { value: LOOK.grade.gamma },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 uCenter;
      uniform float uPeak, uRadius, uPower, uExposure, uContrast, uGamma;
      // inverse of the ACES fit used by the output pass, for neutral grey
      float invAces(float y) {
        const float a = 0.0245786, b = 0.000090537, c = 0.983729, d = 0.432951, e = 0.238081;
        float A = 1.0 - c * y;
        float B = a - d * y;
        float C = -(b + e * y);
        float v = (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
        return v * 0.6;
      }
      void main() {
        vec2 dd = (vUv - uCenter) * vec2(16.0 / 9.0, 1.0);
        float r = length(dd) / uRadius;
        float y = uPeak / (1.0 + pow(r, uPower));
        // undo the output grade (contrast, gamma), then the tone curve
        float s = y <= 0.0031308 ? y * 12.92 : 1.055 * pow(y, 1.0 / 2.4) - 0.055;
        s = (s - 0.5) / uContrast + 0.5;
        s = pow(max(s, 0.0), 1.0 / uGamma);
        y = s <= 0.04045 ? s / 12.92 : pow((s + 0.055) / 1.055, 2.4);
        gl_FragColor = vec4(vec3(invAces(y) / uExposure), 1.0);
      }
    `,
  });
  const backdrop = new THREE.Mesh(makeFullscreenTriangle(), backdropMat);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -10;
  scene.add(backdrop);

  /* ---- animation: a pure function of the frame ---------------------------- */
  const socketLocal = new THREE.Vector3(cx, cy + MOTION.closeUpLift, 0.3);
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const backMat = mats.back as THREE.MeshStandardMaterial;
  const whiteMat = mats.white as THREE.MeshStandardMaterial;

  const apply = (f: number): FrameLook => {
    const t = f / FPS;
    const spin = pchip(t, MOTION.spin);
    board.rotation.set(rad(pchip(t, MOTION.tilt)), rad(spin), 0);

    // assembly: groups float off the board during the spin, then settle
    const out = ramp(t, ASSEMBLY.out[0], ASSEMBLY.out[1]);
    for (const name in groups) {
      const a = ASSEMBLY.groups[name] ?? ASSEMBLY.fallback;
      const k =
        out *
        (1 - easeInOutCubic((t - a.settle[0]) / (a.settle[1] - a.settle[0])));
      groups[name].position.set(a.off[0] * k, a.off[1] * k, a.off[2] * k);
    }
    board.updateMatrixWorld(true);

    const dist = pchip(t, MOTION.distance);
    const az = rad(pchip(t, MOTION.azimuth));
    const el = rad(pchip(t, MOTION.elevation));
    const blend = pchip(t, MOTION.targetBlend);
    tmp.copy(socketLocal).applyMatrix4(board.matrixWorld);
    target.set(0, 0, 0).lerp(tmp, 1 - blend);
    camera.position.set(
      target.x + dist * Math.sin(az) * Math.cos(el),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld(true);

    backdropMat.uniforms.uCenter.value.x = pchip(t, MOTION.poolX);

    // the back plate catches the key light once per turn
    const a = ((spin % 360) + 360) % 360;
    backMat.emissiveIntensity =
      ML.backFlash * Math.exp(-Math.pow((a - 228) / 10, 2));

    const g = Math.exp(-Math.pow((t - TIMING.flashAt) / TIMING.flashWidth, 2));
    const wide = ramp(t, TIMING.whipStart, TIMING.whipStart + 0.5);
    const fade = pchip(t, TIMING.fade);
    traceMat.uniforms.uIntensity.value =
      ML.traceIntensity * (1 - wide + wide * ML.traceWide) * fade;
    for (const l of poolLights)
      l.intensity = LIGHTS.poolIntensity * fade * fade;
    traceMat.uniforms.uSelect.value = wide;
    whiteMat.emissiveIntensity =
      ML.whiteEmissive * (1 - wide + wide * ML.whiteWide);
    lettersMat.emissiveIntensity =
      ML.lettersIntensity * (1 - wide + wide * ML.lettersWide);
    chipTraceMat.uniforms.uIntensity.value =
      ML.chipTraceIntensity * (1 - wide + wide * ML.chipTraceWide);
    key.intensity =
      LIGHTS.key.intensity *
      (1 - wide + wide * ML.keyWide) *
      (0.6 + 0.4 * fade);
    const wideExposure = 1 - wide + wide * ML.exposureWide;
    backdropMat.uniforms.uExposure.value = LOOK.exposure * wideExposure;
    const moving = t >= TIMING.motionBlurFrom && t <= TIMING.motionBlurTo;
    return {
      focus: dist,
      bokehScale:
        (DOF.startBokeh + (DOF.closeBokeh - DOF.startBokeh) * ramp(t, 0, 1.5)) *
          (1 - wide) +
        DOF.wideBokeh * wide,
      grainMul: 1 - wide,
      focusRange: DOF.closeRange,
      exposureMul: (1 + ML.flashExposure * g) * wideExposure,
      bloomMul: 1 + 2.0 * g + wide * (ML.bloomWide - 1),
      motionSamples: moving ? ML.motionSamples : 1,
      shutter: ML.shutter,
    };
  };

  return { scene, camera, apply };
};
