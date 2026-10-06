import { Color, Group, PerspectiveCamera, Scene, ShaderMaterial, Vector3, WebGLRenderer } from "three";
import { FONT } from "../lib/assets";
import { canvasTexture, makeCanvas } from "../lib/canvas";
import { periodicSeries } from "../lib/charts";
import { TAU } from "../lib/ease";
import { landGrid } from "../lib/geo";
import { CellDraw, LabelSpec, makeAtlas, makeLabels } from "../lib/labels";
import { LookFactory } from "../lib/LookCanvas";
import { attr, makeBackground, makeDots, makeSegments, makeTexPlane } from "../lib/materials";
import { defaultPost } from "../lib/postfx";
import { mulberry32, SEEDS } from "../lib/rand";

export interface MapTickerParams {
  map: string; // dot colour
  bg: string;
  up: string; // green candles / ▲
  down: string; // red candles / ▼
}

const LOOP = 600;
// Board (map plane) local units: x along the map, y up the map.
const MAP_K = 0.095; // units per degree
const N_CANDLES = 300;
const DX = 0.14;
const L = N_CANDLES * DX; // one data period = the full band length (60 units)

// Invented index names only.
const NAMES = ["IDX-30", "GLB-500", "MKT-A", "MKT-B", "NRG-40", "TEC-90", "FIN-25", "IND-60", "CMD-12", "VAL-75"];

const flareTexture = (gl: WebGLRenderer) => {
  const W = 1024;
  const H = 128;
  const { c, ctx } = makeCanvas(W, H);
  ctx.save();
  ctx.scale(1, H / W);
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(220,235,255,0.6)");
  g.addColorStop(0.35, "rgba(120,170,255,0.15)");
  g.addColorStop(1, "rgba(80,140,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  ctx.restore();
  return canvasTexture(c, gl);
};

/** Soft horizontal band (translucent row backing). */
const bandTexture = (gl: WebGLRenderer) => {
  const W = 64;
  const H = 128;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.45, "rgba(255,255,255,0.9)");
  g.addColorStop(0.55, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return canvasTexture(c, gl);
};

export const mapTicker: LookFactory<MapTickerParams> = ({ gl, assets, shared, params, width, height }) => {
  const opaque = new Scene();
  const overlay = new Scene();
  const camera = new PerspectiveCamera(30, width / height, 0.3, 300);
  const rng = mulberry32(SEEDS.mapTicker);
  const upC = new Color(params.up);
  const downC = new Color(params.down);

  opaque.add(
    makeBackground(
      /* glsl */ `
      col = uBg * (0.5 + 0.9 * smoothstep(0.0, 0.75, vUv.y)) ;
      col += vec3(0.01, 0.03, 0.12) * exp(-pow((vUv.y - 0.72) * 4.0, 2.0));
      `,
      { uBg: { value: new Color(params.bg) } },
      shared,
    ),
  );

  // The board: a big plane tilted back ~50° and turned so it recedes to the right.
  const board = new Group();
  board.rotation.order = "YXZ";
  board.rotation.set(-0.95, -0.3, -0.12);
  overlay.add(board);

  // ── Map dots ──────────────────────────────────────────────────────────
  const grid = landGrid(assets, 0.6, { minLat: -58, maxLat: 78 });
  const mp: number[] = [];
  for (let i = 0; i < grid.length; i += 2) mp.push((grid[i] - 20) * MAP_K, (grid[i + 1] - 18) * MAP_K, 0);
  const mapDots = makeDots({
    count: mp.length / 3,
    attrs: { iPos: attr(3, mp) },
    shared,
    square: true,
    uniforms: { uC: { value: new Color(params.map) }, uGlide: { value: 0 } },
    hook: /* glsl */ `
      sizeW = 0.03;
      minPx = 1.0;
      col = uC * 0.75;
      alpha = 1.0;
    `,
  });
  mapDots.name = "map";
  board.add(mapDots);

  // ── Candle band (wicks + bodies), snaking, scrolls one data period per loop ─
  const series = periodicSeries(rng, N_CANDLES, { harmonics: 5, noise: 2.0 });
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const ca: number[] = [];
  const cb: number[] = [];
  const ck: number[] = []; // x0, isBody, up, width
  for (let i = 0; i < N_CANDLES; i++) {
    const c = (series[i] - lo) / (hi - lo);
    const o = (series[(i - 1 + N_CANDLES) % N_CANDLES] - lo) / (hi - lo);
    const amp = 5.2;
    const yc = (c - 0.5) * amp;
    const yo = (o - 0.5) * amp;
    const top = Math.max(yc, yo);
    const bot = Math.min(yc, yo);
    const wick = 0.08 + rng() * 0.25;
    const up = c >= o ? 1 : 0;
    const x = i * DX;
    // wick
    ca.push(x, bot - wick, 0.02);
    cb.push(x, top + wick, 0.02);
    ck.push(x, 0, up, 0.016);
    // body
    ca.push(x, bot - 0.02, 0.025);
    cb.push(x, Math.max(top, bot + 0.06), 0.025);
    ck.push(x, 1, up, 0.095);
  }
  const candles = makeSegments({
    count: ca.length / 3,
    attrs: { iA: attr(3, ca), iB: attr(3, cb), iK: attr(4, ck) },
    shared,
    uniforms: { uUp: { value: upC }, uDown: { value: downC }, uOffset: { value: 0 }, uBandY: { value: -0.6 } },
    hook: /* glsl */ `
      float x = mod(iK.x - uOffset, ${L.toFixed(2)}) - ${(L / 2).toFixed(2)};
      // the band itself meanders gently across the map
      float bend = sin(x * 0.16 + 0.6) * 1.1;
      a.x = x; b.x = x;
      a.y += uBandY + bend; b.y += uBandY + bend;
      widthW = iK.w;
      minPx = 0.9;
      col = (iK.z > 0.5 ? uUp : uDown) * (iK.y > 0.5 ? 2.2 : 1.6);
      alpha = smoothstep(${(L / 2).toFixed(2)}, ${(L / 2 - 4).toFixed(2)}, abs(x));
    `,
  });
  candles.name = "candles";
  board.add(candles);

  // thin white trend line through the closes
  const la: number[] = [];
  const lb: number[] = [];
  const lk: number[] = [];
  for (let i = 0; i < N_CANDLES; i++) {
    const c0 = (series[i] - lo) / (hi - lo);
    const c1 = (series[(i + 1) % N_CANDLES] - lo) / (hi - lo);
    la.push(0, (c0 - 0.5) * 5.2 + 1.0, 0.03);
    lb.push(0, (c1 - 0.5) * 5.2 + 1.0, 0.03);
    lk.push(i * DX);
  }
  const trend = makeSegments({
    count: la.length / 3,
    attrs: { iA: attr(3, la), iB: attr(3, lb), iX: attr(1, lk) },
    shared,
    uniforms: { uOffset: { value: 0 }, uBandY: { value: -0.6 } },
    hook: /* glsl */ `
      float x0 = mod(iX - uOffset, ${L.toFixed(2)}) - ${(L / 2).toFixed(2)};
      float x1 = x0 + ${DX.toFixed(3)};
      a.x = x0; b.x = x1;
      a.y += uBandY + sin(x0 * 0.16 + 0.6) * 1.1;
      b.y += uBandY + sin(x1 * 0.16 + 0.6) * 1.1;
      widthW = 0.018;
      col = vec3(0.7, 0.85, 1.0) * 0.6;
      alpha = x1 > x0 + 0.5 * ${DX.toFixed(3)} && abs(x0) < ${(L / 2 - 0.3).toFixed(2)} ? smoothstep(${(L / 2).toFixed(2)}, ${(L / 2 - 5).toFixed(2)}, abs(x0)) : 0.0;
    `,
  });
  trend.name = "candles";
  board.add(trend);

  // ── Label rows ─────────────────────────────────────────────────────────
  // Atlas cells: "NAME ▲ value" items (×4 tick variants each) and big numbers.
  const cells: CellDraw[] = [];
  const itemCells: number[] = [];
  for (let i = 0; i < 40; i++) {
    const name = NAMES[i % NAMES.length];
    const base = 100 + rng() * 900;
    itemCells.push(cells.length);
    for (let v = 0; v < 4; v++) {
      const val = (base + (rng() - 0.5) * 6).toFixed(2);
      const upv = rng() < 0.62;
      cells.push((ctx, x, y, w, h) => {
        ctx.font = `600 40px "${FONT.inter}"`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        const nm = ctx.measureText(name + " ").width;
        ctx.fillText(name, x + 14, y + h / 2);
        ctx.fillStyle = upv ? params.up : params.down;
        ctx.fillText(upv ? "▲" : "▼", x + 14 + nm, y + h / 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(val, x + 14 + nm + 46, y + h / 2);
      });
    }
  }
  const bigCells: number[] = [];
  for (let i = 0; i < 24; i++) {
    bigCells.push(cells.length);
    const base = 10 + rng() * 90;
    for (let v = 0; v < 4; v++) {
      const val = (base + (rng() - 0.5) * 0.4).toFixed(3);
      cells.push((ctx, x, y, w, h) => {
        ctx.font = `600 64px "${FONT.inter}"`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(val, x + w / 2, y + h / 2);
      });
    }
  }
  const atlas = makeAtlas(gl, cells, { cellW: 512, cellH: 112, font: `600 40px "${FONT.inter}"` });

  type Row = { y: number; z: number; h: number; spacing: number; big: boolean; speed: number; bright: number };
  // rows on the board (y), slightly lifted toward the viewer (z) — bottom rows nearest
  const rows: Row[] = [
    { y: 8.8, z: 0.15, h: 0.6, spacing: 3.4, big: false, speed: 1, bright: 1.0 },
    { y: 7.8, z: 0.15, h: 0.85, spacing: 4.4, big: true, speed: 1, bright: 1.05 },
    { y: 6.9, z: 0.15, h: 0.55, spacing: 3.3, big: false, speed: 2, bright: 0.95 },
    { y: 6.0, z: 0.15, h: 0.55, spacing: 3.4, big: false, speed: 1, bright: 0.9 },
    { y: 4.0, z: 0.2, h: 0.45, spacing: 3.6, big: false, speed: 1, bright: 0.75 },
    { y: -2.4, z: 0.25, h: 0.4, spacing: 3.2, big: false, speed: 1, bright: 0.7 },
    { y: -3.3, z: 0.3, h: 0.46, spacing: 3.2, big: false, speed: 2, bright: 0.9 },
    { y: -4.4, z: 0.4, h: 0.9, spacing: 4.6, big: true, speed: 1, bright: 1.0 },
    { y: -5.6, z: 0.6, h: 0.6, spacing: 3.6, big: false, speed: 2, bright: 1.0 },
    { y: -7.0, z: 0.9, h: 1.3, spacing: 5.8, big: true, speed: 1, bright: 1.0 },
  ];
  const WRAP = 48;
  const labelMeshes: { mesh: ReturnType<typeof makeLabels>; speed: number }[] = [];
  rows.forEach((r) => {
    const specs: LabelSpec[] = [];
    const n = Math.floor(WRAP / r.spacing);
    const sp = WRAP / n;
    for (let i = 0; i < n; i++) {
      const pool = r.big ? bigCells : itemCells;
      specs.push({
        pos: [-WRAP / 2 + i * sp + (rng() - 0.5) * 0.6, r.y + (rng() - 0.5) * 0.25, r.z],
        cell: pool[Math.floor(rng() * pool.length)],
        variants: 4,
        period: 30, // 600 / 30 = 20 ticks; 20 % 4 = 0 → loops
        phase: Math.floor(rng() * 4) * 30,
        height: r.h,
        color: [r.bright * 1.25, r.bright * 1.3, r.bright * 1.4],
      });
    }
    const mesh = makeLabels(atlas, specs, shared, { billboard: false, wrapLen: WRAP });
    mesh.name = "labels";
    board.add(mesh);
    labelMeshes.push({ mesh, speed: r.speed });
  });

  // translucent light bands behind the label rows
  const bTex = bandTexture(gl);
  for (const [y, h, k] of [
    [7.8, 1.4, 0.06],
    [-4.4, 1.6, 0.05],
    [-7.0, 2.2, 0.05],
    [4.0, 0.7, 0.03],
  ] as const) {
    const b = makeTexPlane({ map: bTex, shared, width: 80, height: h, color: new Color(0.45, 0.6, 1.0).multiplyScalar(k * 3) });
    b.position.set(0, y, 0.1);
    b.name = "bands";
    board.add(b);
  }

  // ── Flare: horizontal streak drifting across the upper frame ────────────
  const flare = makeTexPlane({ map: flareTexture(gl), shared, width: 60, height: 3.0, color: new Color(0.7, 0.85, 1.3).multiplyScalar(1.6) });
  flare.name = "flare";
  overlay.add(flare);

  // ── Post ──────────────────────────────────────────────────────────────
  const post = defaultPost();
  post.bloomStrength = 0.85;
  post.bloomThreshold = 0.6;
  post.bloomRadius = 0.7;
  post.vignette = 0.38;
  shared.uFocusRange.value = 1.8;
  shared.uAperture.value = 0.06;
  shared.uNearMul.value = 1.3;
  shared.uMaxCoc.value = 0.02;

  const U = (m: { material: unknown }) => (m.material as ShaderMaterial).uniforms;
  const camTarget = new Vector3();
  const bandWorld = new Vector3();
  const update = (frame: number) => {
    const ph = frame / LOOP;
    // camera glides sideways on a closed path
    const glide = Math.sin(ph * TAU);
    camera.position.set(-1.5 + 2.5 * glide, -1.2 + 0.2 * Math.sin(ph * TAU * 2), 13);
    camTarget.set(-0.5 + 2.5 * glide, 0.4, 0);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    board.updateMatrixWorld();
    // candles scroll exactly one data period per loop
    U(candles).uOffset.value = ph * L;
    U(trend).uOffset.value = ph * L;
    labelMeshes.forEach((l) => {
      U(l.mesh).uWrapOffset.value = ph * WRAP * l.speed;
    });
    // flare drifts left→right across the upper frame (one pass per loop)
    const fx = ((ph + 0.35) % 1) * 90 - 45;
    flare.position.set(fx, 2.6, 1);
    flare.rotation.set(0, 0, 0);
    // focus on the candle band (board origin)
    bandWorld.set(0, -0.6, 0).applyMatrix4(board.matrixWorld);
    shared.uFocus.value = camera.position.distanceTo(bandWorld);
  };

  return { opaque, overlay, camera, post, update };
};
