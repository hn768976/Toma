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
import { mulberry32, Rng, SEEDS } from "../lib/rand";
import { Shared } from "../lib/shared";

export interface MapTickerParams {
  map: string; // dot colour
  bg: string;
  up: string; // green candles / ▲
  down: string; // red candles / ▼
}

const LOOP = 600;
const MAP_K = 0.12; // board units per degree
const WRAP = 56; // label rows wrap length (board units)

// Invented index names only.
const NAMES = ["IDX-30", "GLB-500", "MKT-A", "MKT-B", "NRG-40", "TEC-90", "FIN-25", "IND-60"];

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
  const { c, ctx } = makeCanvas(64, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  return canvasTexture(c, gl);
};

/**
 * One candle series (wicks + bodies) snaking along the board. It scrolls
 * exactly one data period (n · dx) per loop, so frame 600 == frame 0.
 */
const candleSeries = (
  rng: Rng,
  shared: Shared,
  o: { n: number; dx: number; amp: number; y: number; z: number; body: number; bend: number; phase: number; up: Color; down: Color; gain: number },
) => {
  const L = o.n * o.dx;
  const s = periodicSeries(rng, o.n, { harmonics: 5, noise: 2.0 });
  const lo = Math.min(...s);
  const hi = Math.max(...s);
  const ca: number[] = [];
  const cb: number[] = [];
  const ck: number[] = [];
  for (let i = 0; i < o.n; i++) {
    const c = (s[i] - lo) / (hi - lo);
    const op = (s[(i - 1 + o.n) % o.n] - lo) / (hi - lo);
    const yc = (c - 0.5) * o.amp;
    const yo = (op - 0.5) * o.amp;
    const top = Math.max(yc, yo);
    const bot = Math.min(yc, yo);
    const wick = 0.05 + rng() * 0.2;
    // mostly green, as in the reference: only some falling candles are red
    const green = c < op && rng() < 0.45 ? 0 : 1;
    const x = i * o.dx;
    ca.push(x, bot - wick, o.z);
    cb.push(x, top + wick, o.z);
    ck.push(x, 0, green, o.body * 0.17);
    ca.push(x, bot - 0.015, o.z + 0.005);
    cb.push(x, Math.max(top, bot + 0.05), o.z + 0.005);
    ck.push(x, 1, green, o.body);
  }
  const m = makeSegments({
    count: ca.length / 3,
    attrs: { iA: attr(3, ca), iB: attr(3, cb), iK: attr(4, ck) },
    shared,
    uniforms: { uUp: { value: o.up }, uDown: { value: o.down }, uOffset: { value: 0 } },
    hook: /* glsl */ `
      float x = mod(iK.x - uOffset, ${L.toFixed(3)}) - ${(L / 2).toFixed(3)};
      float bend = sin(x * ${o.bend.toFixed(3)} + ${o.phase.toFixed(3)}) * 1.2;
      a.x = x; b.x = x;
      a.y += ${o.y.toFixed(3)} + bend; b.y += ${o.y.toFixed(3)} + bend;
      widthW = iK.w;
      minPx = 0.9;
      col = (iK.z > 0.5 ? uUp : uDown) * (iK.y > 0.5 ? ${(o.gain * 1.4).toFixed(3)} : ${o.gain.toFixed(3)});
      alpha = smoothstep(${(L / 2).toFixed(3)}, ${(L / 2 - 4).toFixed(3)}, abs(x));
    `,
  });
  return { mesh: m, L };
};

export const mapTicker: LookFactory<MapTickerParams> = ({ gl, assets, shared, params, width, height }) => {
  const opaque = new Scene();
  const overlay = new Scene();
  const camera = new PerspectiveCamera(32, width / height, 0.3, 300);
  const rng = mulberry32(SEEDS.mapTicker);
  const upC = new Color(params.up);
  const downC = new Color(params.down);

  opaque.add(
    makeBackground(
      /* glsl */ `
      // deep electric blue, brighter through the middle band, dark corners
      float band = exp(-pow((vUv.y - 0.55) * 2.4, 2.0));
      col = uBg * (0.35 + 1.5 * band) * (0.6 + 0.5 * smoothstep(1.0, 0.2, vUv.x));
      `,
      { uBg: { value: new Color(params.bg) } },
      shared,
    ),
  );

  // The board: tilted ~50° and turned so it recedes to the upper right, slight roll.
  const board = new Group();
  board.rotation.order = "YXZ";
  board.rotation.set(-0.86, -0.5, -0.16);
  overlay.add(board);

  // ── Map: fine round halftone dots (Asia–Pacific under the camera) ────────
  const grid = landGrid(assets, 0.55, { minLat: -50, maxLat: 75 });
  const mp: number[] = [];
  for (let i = 0; i < grid.length; i += 2) {
    let lon = grid[i] - 112;
    if (lon < -180) lon += 360;
    mp.push(lon * MAP_K, (grid[i + 1] - 8) * MAP_K, 0);
  }
  const mapDots = makeDots({
    count: mp.length / 3,
    attrs: { iPos: attr(3, mp) },
    shared,
    uniforms: { uC: { value: new Color(params.map) } },
    hook: /* glsl */ `
      sizeW = 0.026;
      minPx = 1.0;
      col = uC * 0.85;
      alpha = smoothstep(26.0, 18.0, abs(pos.x));
    `,
  });
  mapDots.name = "map";
  board.add(mapDots);

  // ── Perspective grid: horizontal row rules + vertical lines ─────────────
  const ga: number[] = [];
  const gb: number[] = [];
  const gk: number[] = [];
  const ruleYs = [-9.6, -7.9, -6.4, -5.1, -3.9, 4.6, 5.7, 6.8, 7.9, 9.0, 10.1];
  for (const y of ruleYs) {
    ga.push(-26, y, 0.02);
    gb.push(26, y, 0.02);
    gk.push(1);
  }
  for (let x = -24; x <= 24; x += 4) {
    ga.push(x, -11, 0.01);
    gb.push(x, 11, 0.01);
    gk.push(0);
  }
  const gridLines = makeSegments({
    count: ga.length / 3,
    attrs: { iA: attr(3, ga), iB: attr(3, gb), iK: attr(1, gk) },
    shared,
    hook: /* glsl */ `
      widthW = iK > 0.5 ? 0.014 : 0.012;
      col = iK > 0.5 ? vec3(0.45, 0.65, 1.0) * 0.6 : vec3(0.3, 0.5, 1.0) * 0.3;
    `,
    fragHook: /* glsl */ `
      // fade both ends
      inten *= smoothstep(0.0, 0.25, vAlong) * smoothstep(1.0, 0.75, vAlong);
    `,
  });
  gridLines.name = "grid";
  board.add(gridLines);

  // ── Candle series at three depths ───────────────────────────────────────
  const series = [
    candleSeries(rng, shared, { n: 300, dx: 0.15, amp: 4.6, y: 0.0, z: 0.05, body: 0.1, bend: 0.14, phase: 0.6, up: upC, down: downC, gain: 1.7 }),
    candleSeries(rng, shared, { n: 260, dx: 0.17, amp: 2.6, y: 2.9, z: 0.5, body: 0.09, bend: 0.11, phase: 2.0, up: upC, down: downC, gain: 1.2 }),
    candleSeries(rng, shared, { n: 240, dx: 0.19, amp: 2.4, y: -2.6, z: 0.8, body: 0.11, bend: 0.12, phase: 4.1, up: upC, down: downC, gain: 1.3 }),
  ];
  series.forEach((s) => {
    s.mesh.name = "candles";
    board.add(s.mesh);
  });

  // faint wavy line charts
  const lines: { mesh: ReturnType<typeof makeSegments>; L: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const n = 120;
    const dx = 0.42;
    const L = n * dx;
    const s = periodicSeries(rng, n, { harmonics: 3, noise: 0.6 });
    const lo = Math.min(...s);
    const hi = Math.max(...s);
    const la: number[] = [];
    const lb: number[] = [];
    const lx: number[] = [];
    for (let i = 0; i < n; i++) {
      la.push(0, ((s[i] - lo) / (hi - lo) - 0.5) * 2.2, 0.03);
      lb.push(0, ((s[(i + 1) % n] - lo) / (hi - lo) - 0.5) * 2.2, 0.03);
      lx.push(i * dx);
    }
    const y0 = [1.6, -1.2, 3.6][k];
    const m = makeSegments({
      count: n,
      attrs: { iA: attr(3, la), iB: attr(3, lb), iX: attr(1, lx) },
      shared,
      uniforms: { uOffset: { value: 0 } },
      hook: /* glsl */ `
        float x0 = mod(iX - uOffset, ${L.toFixed(3)}) - ${(L / 2).toFixed(3)};
        float x1 = x0 + ${dx.toFixed(3)};
        a.x = x0; b.x = x1;
        a.y += ${y0.toFixed(2)}; b.y += ${y0.toFixed(2)};
        widthW = 0.016;
        col = vec3(0.75, 0.88, 1.0) * 0.55;
        alpha = abs(x0) < ${(L / 2 - dx).toFixed(3)} ? smoothstep(${(L / 2).toFixed(3)}, ${(L / 2 - 6).toFixed(3)}, abs(x0)) : 0.0;
      `,
    });
    m.name = "lines";
    board.add(m);
    lines.push({ mesh: m, L });
  }

  // ── Label rows ──────────────────────────────────────────────────────────
  // Atlas cells (×4 tick variants each): big bare numbers, "▲ 923.47" values,
  // and a few "NAME ▲ value" items.
  const cells: CellDraw[] = [];
  const pools = { big: [] as number[], val: [] as number[], item: [] as number[] };
  const tri = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, upv: boolean) => {
    ctx.fillStyle = "#E8F2FF";
    ctx.beginPath();
    if (upv) {
      ctx.moveTo(x, y + s * 0.5);
      ctx.lineTo(x + s * 0.5, y - s * 0.4);
      ctx.lineTo(x + s, y + s * 0.5);
    } else {
      ctx.moveTo(x, y - s * 0.5);
      ctx.lineTo(x + s * 0.5, y + s * 0.4);
      ctx.lineTo(x + s, y - s * 0.5);
    }
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 0; i < 40; i++) {
    pools.big.push(cells.length);
    const base = 5 + rng() * 95;
    for (let v = 0; v < 4; v++) {
      const val = (base + (rng() - 0.5) * 0.3).toFixed(3);
      cells.push((ctx, x, y, w, h) => {
        ctx.font = `600 66px "${FONT.inter}"`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(val, x + w / 2, y + h / 2);
      });
    }
  }
  for (let i = 0; i < 40; i++) {
    pools.val.push(cells.length);
    const base = 100 + rng() * 900;
    for (let v = 0; v < 4; v++) {
      const val = (base + (rng() - 0.5) * 4).toFixed(2);
      const upv = rng() < 0.6;
      cells.push((ctx, x, y, w, h) => {
        ctx.font = `600 52px "${FONT.inter}"`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        tri(ctx, x + 70, y + h / 2, 30, upv);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(val, x + 116, y + h / 2);
      });
    }
  }
  for (let i = 0; i < 16; i++) {
    pools.item.push(cells.length);
    const name = NAMES[i % NAMES.length];
    const base = 100 + rng() * 900;
    for (let v = 0; v < 4; v++) {
      const val = (base + (rng() - 0.5) * 4).toFixed(2);
      const upv = rng() < 0.6;
      cells.push((ctx, x, y, w, h) => {
        ctx.font = `600 40px "${FONT.inter}"`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        const nm = ctx.measureText(name + " ").width;
        ctx.fillText(name, x + 20, y + h / 2);
        ctx.fillStyle = upv ? params.up : params.down;
        ctx.fillText(upv ? "▲" : "▼", x + 20 + nm, y + h / 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(val, x + 20 + nm + 46, y + h / 2);
      });
    }
  }
  const atlas = makeAtlas(gl, cells, { cellW: 512, cellH: 128, font: `600 40px "${FONT.inter}"` });

  type Row = { y: number; z: number; h: number; spacing: number; kind: keyof typeof pools; speed: number; bright: number };
  const rows: Row[] = [
    // far rows (top of frame)
    { y: 10.6, z: 0.15, h: 0.9, spacing: 5.0, kind: "big", speed: 1, bright: 0.9 },
    { y: 9.55, z: 0.15, h: 0.7, spacing: 4.0, kind: "val", speed: 2, bright: 0.9 },
    { y: 8.45, z: 0.15, h: 0.9, spacing: 5.0, kind: "big", speed: 1, bright: 1.0 },
    { y: 7.35, z: 0.15, h: 0.7, spacing: 4.0, kind: "val", speed: 1, bright: 0.95 },
    { y: 6.25, z: 0.15, h: 0.62, spacing: 4.4, kind: "item", speed: 2, bright: 0.9 },
    { y: 5.15, z: 0.15, h: 0.7, spacing: 4.0, kind: "val", speed: 1, bright: 0.85 },
    // middle (sparse, over the candles)
    { y: 1.0, z: 0.25, h: 0.55, spacing: 6.5, kind: "val", speed: 1, bright: 0.75 },
    { y: -1.9, z: 0.3, h: 0.5, spacing: 7.0, kind: "item", speed: 2, bright: 0.75 },
    // near rows (bottom of frame, larger, nearer)
    { y: -4.5, z: 0.35, h: 0.85, spacing: 4.4, kind: "val", speed: 1, bright: 1.0 },
    { y: -5.75, z: 0.45, h: 1.15, spacing: 5.4, kind: "big", speed: 2, bright: 1.05 },
    { y: -7.15, z: 0.6, h: 0.95, spacing: 4.6, kind: "val", speed: 1, bright: 1.05 },
    { y: -8.75, z: 0.8, h: 1.5, spacing: 6.4, kind: "big", speed: 1, bright: 1.1 },
    { y: -10.5, z: 1.0, h: 1.2, spacing: 5.4, kind: "val", speed: 2, bright: 1.1 },
  ];
  const labelMeshes: { mesh: ReturnType<typeof makeLabels>; speed: number }[] = [];
  rows.forEach((r) => {
    const specs: LabelSpec[] = [];
    const n = Math.floor(WRAP / r.spacing);
    const sp = WRAP / n;
    const pool = pools[r.kind];
    for (let i = 0; i < n; i++) {
      specs.push({
        pos: [-WRAP / 2 + i * sp + (rng() - 0.5) * 0.8, r.y + (rng() - 0.5) * 0.15, r.z],
        cell: pool[Math.floor(rng() * pool.length)],
        variants: 4,
        period: 30, // 600 / 30 = 20 ticks; 20 % 4 = 0 → loops
        phase: Math.floor(rng() * 4) * 30,
        height: r.h,
        color: [r.bright * 1.35, r.bright * 1.45, r.bright * 1.6],
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
    [8.45, 1.4, 0.07],
    [10.6, 1.2, 0.05],
    [-5.75, 1.6, 0.06],
    [-8.75, 2.0, 0.06],
  ] as const) {
    const b = makeTexPlane({ map: bTex, shared, width: 60, height: h, color: new Color(0.45, 0.6, 1.0).multiplyScalar(k * 3) });
    b.position.set(0, y, 0.1);
    b.name = "bands";
    board.add(b);
  }

  // ── Flare: horizontal streak drifting across the upper frame ────────────
  const flare = makeTexPlane({ map: flareTexture(gl), shared, width: 60, height: 3.0, color: new Color(0.7, 0.85, 1.3).multiplyScalar(1.8) });
  flare.name = "flare";
  overlay.add(flare);

  // ── Post ──────────────────────────────────────────────────────────────
  const post = defaultPost();
  post.bloomStrength = 1.15;
  post.bloomThreshold = 0.42;
  post.bloomRadius = 0.75;
  post.vignette = 0.55;
  shared.uFocusRange.value = 1.2;
  shared.uAperture.value = 0.07;
  shared.uNearMul.value = 1.2;
  shared.uMaxCoc.value = 0.02;

  const U = (m: { material: unknown }) => (m.material as ShaderMaterial).uniforms;
  const camTarget = new Vector3();
  const bandWorld = new Vector3();
  const update = (frame: number) => {
    const ph = frame / LOOP;
    // camera glides sideways along the map on a closed path (whole cycle per loop)
    const glide = Math.sin(ph * TAU);
    camera.position.set(-1.0 + 2.6 * glide, -2.0 + 0.25 * Math.sin(ph * TAU * 2), 19.5);
    camTarget.set(0.0 + 2.6 * glide, -0.4, 0);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    board.updateMatrixWorld();
    // candles + line charts scroll exactly one data period per loop
    series.forEach((s) => {
      U(s.mesh).uOffset.value = ph * s.L;
    });
    lines.forEach((l) => {
      U(l.mesh).uOffset.value = ph * l.L;
    });
    labelMeshes.forEach((l) => {
      U(l.mesh).uWrapOffset.value = ph * WRAP * l.speed;
    });
    // flare drifts left→right across the upper frame (one pass per loop)
    const fx = ((ph + 0.35) % 1) * 90 - 45;
    flare.position.set(fx, 3.4, 1);
    // focus on the main candle band
    bandWorld.set(0, 0, 0).applyMatrix4(board.matrixWorld);
    shared.uFocus.value = camera.position.distanceTo(bandWorld);
  };

  return { opaque, overlay, camera, post, update };
};
