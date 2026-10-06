import * as THREE from "three";
import { MONO, SANS } from "../lib/assets";
import { Batch2D, texPlaneMaterial } from "../lib/batch2d";
import { canvasTexture, makeCanvas } from "../lib/canvas";
import { Lines3D } from "../lib/prims3d";
import {
  beatValue,
  clamp01,
  easeOutCubic,
  hash2,
  irange,
  mulberry32,
  pick,
  range,
  remap,
  rollingDigits,
  stepIndex,
} from "../lib/random";
import { BuildFn, LookProps, Stage } from "../lib/Stage";

// Look 1 — Big Data Screen. A monochrome blue data screen seen at a steep
// angle: one 8192^2 Canvas 2D tile (static frames, labels, tiny text, grid)
// + GPU widget batch for everything that moves (rolling digits, bars, blinks).

export const BIGDATA_FRAMES = 600;
const LOOP = 600;

const C_HI = "#BFE8FF";
const C_MID = "#5AA8E8";
const C_BG = "#061A5A";

const TILE = 8192; // canvas px
const TILE_W = 8.5; // world units per tile
const K = TILE_W / TILE;

const WORDS = [
  "DATA", "NODE", "LINK", "CORE", "SYNC", "PORT", "FLOW", "GRID", "UNIT", "RATE",
  "LOAD", "PEAK", "MEAN", "SCAN", "READ", "WRITE", "VALUE", "TOTAL", "INPUT",
  "OUTPUT", "MODEL", "LAYER", "TRACE", "INDEX", "STATUS", "SIGNAL", "BUFFER",
  "QUEUE", "CACHE", "STREAM", "SECTOR", "VECTOR", "MATRIX", "SAMPLE",
];
const LABELS = [
  "BIG DATA", "BIG DATA", "BIG DATA", "ANALYSIS NODE", "DATA STREAM", "THROUGHPUT",
  "LATENCY", "CLUSTER", "SIGNAL INDEX", "NODE 07", "SECTOR 12", "DATA CORE",
];
const BIG_PATTERNS = ["#### #### ##", "•#### ##", "#### ####", "##### ##", "#### ## ####", "#### ##"];
const SMALL_PATTERNS = ["+##", ".##", "##", "## ##", "+#.#", "###"];

// ---------------------------------------------------------------------------
// Layout, generated at module level from a fixed seed.

type Block = {
  kind: "digits" | "bars" | "stair" | "list" | "hatch" | "gauge" | "small" | "meter" | "frame" | "wave";
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  label: string;
  pattern: string;
  n: number;
};

const layoutRng = mulberry32(0x5eed01);
const BLOCKS: Block[] = (() => {
  // scattered placement (rejection sampling, no overlaps), not a grid
  const out: Block[] = [];
  const kinds: Block["kind"][] = ["digits", "digits", "digits", "digits", "digits", "small", "small", "small", "small", "bars", "stair", "stair", "list", "hatch", "hatch", "gauge", "meter"];
  let guard = 0;
  while (out.length < 58 && guard++ < 20000) {
    const kind = pick(layoutRng, kinds);
    const w = range(layoutRng, 520, 1000) * (kind === "small" ? 0.6 : 1);
    const h = range(layoutRng, 380, 640) * (kind === "small" ? 0.6 : 1);
    const x = range(layoutRng, 80, TILE - w - 80);
    const y = range(layoutRng, 80, TILE - h - 80);
    const pad = 60;
    if (out.some((o) => x < o.x + o.w + pad && x + w + pad > o.x && y < o.y + o.h + pad && y + h + pad > o.y)) continue;
    out.push({
      kind,
      x,
      y,
      w,
      h,
      seed: irange(layoutRng, 1, 1e9),
      label: pick(layoutRng, LABELS),
      pattern: kind === "small" ? pick(layoutRng, SMALL_PATTERNS) : pick(layoutRng, BIG_PATTERNS),
      n: irange(layoutRng, 8, 16),
    });
  }
  return out;
})();

// Stray scattered digits and rules between blocks
const STRAYS = Array.from({ length: 420 }, () => ({
  x: range(layoutRng, 100, TILE - 300),
  y: range(layoutRng, 100, TILE - 100),
  s: range(layoutRng, 22, 48),
  t: String(irange(layoutRng, 0, 9999)).padStart(irange(layoutRng, 2, 4), "0"),
  rule: layoutRng() < 0.35,
  len: range(layoutRng, 200, 900),
}));

const VLINES = Array.from({ length: 10 }, () => ({
  x: range(layoutRng, -9, 9),
  z: range(layoutRng, -10, -1),
  h: range(layoutRng, 1.2, 4),
  a: range(layoutRng, 0.15, 0.4),
}));

// ---------------------------------------------------------------------------
// Static tile (Canvas 2D)

const tinyWords = (seed: number, n: number) => {
  const r = mulberry32(seed);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(r() < 0.5 ? pick(r, WORDS) : String(irange(r, 10, 9999)));
  return parts.join(" ");
};

const drawTile = () => {
  const { c, ctx } = makeCanvas(TILE, TILE);
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, TILE, TILE);
  // slightly uneven background: soft brighter patches
  const r = mulberry32(77);
  for (let i = 0; i < 40; i++) {
    const x = r() * TILE;
    const y = r() * TILE;
    const rad = range(r, 300, 1200);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(40,90,190,0.10)");
    g.addColorStop(1, "rgba(40,90,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // faint grid (divides the tile: seamless)
  ctx.strokeStyle = "rgba(90,168,232,0.10)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= TILE; i += 256) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, TILE);
    ctx.moveTo(0, i);
    ctx.lineTo(TILE, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(90,168,232,0.2)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= TILE; i += 1024) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, TILE);
    ctx.moveTo(0, i);
    ctx.lineTo(TILE, i);
    ctx.stroke();
  }

  // large translucent light-blue panels that overlap (layered-sheet look)
  const pr = mulberry32(4711);
  for (let i = 0; i < 46; i++) {
    const w = range(pr, 900, 2600);
    const h = range(pr, 500, 1500);
    const x = range(pr, 0, TILE - w);
    const y = range(pr, 0, TILE - h);
    ctx.fillStyle = `rgba(50,120,230,${range(pr, 0.07, 0.16).toFixed(3)})`;
    ctx.fillRect(x, y, w, h);
    if (pr() < 0.6) {
      ctx.strokeStyle = `rgba(150,210,255,${range(pr, 0.25, 0.5).toFixed(3)})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
    }
  }
  // long thin bright border lines across the plane (both axes)
  for (let i = 0; i < 26; i++) {
    const horiz = pr() < 0.6;
    const p = range(pr, 100, TILE - 100);
    const a = range(pr, 0, TILE * 0.4);
    const b = a + range(pr, TILE * 0.3, TILE * 0.6);
    ctx.fillStyle = `rgba(170,225,255,${range(pr, 0.35, 0.7).toFixed(3)})`;
    if (horiz) ctx.fillRect(a, p, b - a, 4);
    else ctx.fillRect(p, a, 4, b - a);
    ctx.beginPath();
    ctx.arc(horiz ? b : p + 2, horiz ? p + 2 : b, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // big faint rings (ellipses once seen in perspective)
  for (let i = 0; i < 7; i++) {
    const x = range(pr, 800, TILE - 800);
    const y = range(pr, 800, TILE - 800);
    const r = range(pr, 260, 520);
    ctx.strokeStyle = "rgba(150,210,255,0.4)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(150,210,255,0.2)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0.3, Math.PI * 1.6);
    ctx.stroke();
  }
  // vertical columns of digits (one digit per line)
  ctx.font = `500 54px ${MONO}`;
  ctx.textBaseline = "middle";
  for (let i = 0; i < 14; i++) {
    const x = range(pr, 100, TILE - 100);
    const y = range(pr, 100, TILE - 900);
    ctx.fillStyle = "rgba(191,232,255,0.6)";
    for (let k = 0; k < irange(pr, 4, 9); k++) ctx.fillText(String(irange(pr, 0, 9)), x, y + k * 70);
  }
  for (const s of STRAYS) {
    if (s.rule) {
      ctx.fillStyle = "rgba(90,168,232,0.35)";
      ctx.fillRect(s.x, s.y, s.len, 3);
    } else {
      ctx.fillStyle = "rgba(191,232,255,0.45)";
      ctx.font = `500 ${s.s}px ${MONO}`;
      ctx.fillText(s.t, s.x, s.y);
    }
  }

  for (const b of BLOCKS) {
    const br = mulberry32(b.seed);
    ctx.save();
    ctx.translate(b.x, b.y);
    // translucent lighter-blue panel behind most blocks (mid-tone density)
    if (br() < 0.4) {
      ctx.fillStyle = "rgba(40,100,210,0.16)";
      ctx.fillRect(-40 - br() * 80, -30, b.w * range(br, 0.6, 1.1) + 80, b.h * range(br, 0.5, 1) + 60);
      ctx.fillStyle = "rgba(90,168,232,0.10)";
      ctx.fillRect(b.w * range(br, 0.1, 0.5), b.h * range(br, 0.2, 0.6), b.w * 0.45, 22);
    }
    // dense tiny text + hatch rows around the block (the reference is busy)
    {
      const rows = irange(br, 3, 7);
      const ox = range(br, -30, b.w * 0.4);
      const oy = b.h + range(br, 10, 60);
      for (let i = 0; i < rows; i++) {
        let x = ox;
        const y = oy + i * 34;
        while (x < ox + b.w * range(br, 0.5, 0.9)) {
          const w = range(br, 20, 110);
          ctx.fillStyle = br() < 0.3 ? "rgba(191,232,255,0.55)" : "rgba(90,168,232,0.45)";
          ctx.fillRect(x, y, w, 12);
          x += w + range(br, 10, 30);
        }
      }
    }
    // common: small label + thin rule
    ctx.fillStyle = C_MID;
    ctx.globalAlpha = 0.9;
    ctx.font = `600 40px ${SANS}`;
    ctx.textAlign = "left";
    switch (b.kind) {
      case "digits": {
        ctx.fillText(b.label, 0, 30);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, 62, b.w * 0.6, 3);
        ctx.font = `500 26px ${MONO}`;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.45;
          ctx.fillText(tinyWords(b.seed + i, 5), 0, 290 + i * 40);
        }
        // bracket
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-30, 90, 4, 150);
        ctx.fillRect(-30, 90, 24, 4);
        ctx.fillRect(-30, 236, 24, 4);
        break;
      }
      case "bars": {
        ctx.fillText(b.label, 0, 24);
        ctx.globalAlpha = 0.6;
        const base = b.h - 60;
        ctx.fillRect(0, base, b.w, 3);
        for (let i = 0; i <= b.n; i++) ctx.fillRect((i * b.w) / b.n, base, 2, 14);
        ctx.font = `500 22px ${MONO}`;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < b.n; i += 2) ctx.fillText(String(10 + i * 3), (i * b.w) / b.n, base + 40);
        break;
      }
      case "list": {
        ctx.fillText(b.label, 0, 24);
        ctx.font = `500 26px ${MONO}`;
        const rows = Math.min(8, Math.floor((b.h - 80) / 46));
        for (let i = 0; i < rows; i++) {
          ctx.globalAlpha = 0.55;
          ctx.fillText(pick(br, WORDS), 0, 90 + i * 46);
          ctx.textAlign = "right";
          ctx.fillText(String(irange(br, 100, 99999)), b.w, 90 + i * 46);
          ctx.textAlign = "left";
          ctx.globalAlpha = 0.2;
          ctx.fillRect(b.w * 0.32, 84 + i * 46, b.w * 0.42, 10);
        }
        break;
      }
      case "hatch": {
        // barcode / dot-matrix / dashed-text field
        ctx.fillText(b.label, 0, 24);
        const mode = br() < 0.5;
        for (let gy = 70; gy < b.h; gy += mode ? 28 : 22) {
          for (let gx = 0; gx < b.w; ) {
            const w = mode ? range(br, 6, 18) : range(br, 30, 140);
            ctx.globalAlpha = range(br, 0.35, 0.85);
            ctx.fillRect(gx, gy, w, mode ? 18 : 10);
            gx += w + (mode ? range(br, 6, 14) : range(br, 14, 40));
          }
        }
        break;
      }
      case "stair": {
        ctx.fillText(b.label, 0, 24);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, 60, 3, b.h - 80);
        break;
      }
      case "gauge": {
        const R = Math.min(b.w, b.h) * 0.36;
        ctx.strokeStyle = C_MID;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(R + 20, R + 40, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(R + 20, R + 40, R * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(R + 20 + Math.cos(a) * (R + 14), R + 40 + Math.sin(a) * (R + 14), 5, 5);
        }
        ctx.globalAlpha = 0.9;
        ctx.fillText(b.label, R * 2 + 70, 60);
        ctx.font = `500 26px ${MONO}`;
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < 4; i++) ctx.fillText(tinyWords(b.seed + 9 + i, 3), R * 2 + 70, 120 + i * 40);
        break;
      }
      case "small": {
        ctx.font = `600 32px ${SANS}`;
        ctx.fillText(b.label, 0, 130);
        ctx.font = `500 24px ${MONO}`;
        ctx.globalAlpha = 0.4;
        ctx.fillText(tinyWords(b.seed, 4), 0, 175);
        break;
      }
      case "meter": {
        ctx.fillText(b.label, 0, 24);
        ctx.globalAlpha = 0.6;
        const y0 = 110;
        ctx.fillRect(0, y0, b.w, 3);
        for (let i = 0; i <= 40; i++) {
          const hh = i % 5 === 0 ? 28 : 12;
          ctx.fillRect((i * b.w) / 40, y0 - hh, 2, hh);
        }
        ctx.globalAlpha = 0.25;
        ctx.fillRect(0, y0 + 60, b.w, 14);
        ctx.fillRect(0, y0 + 100, b.w, 14);
        break;
      }
      case "frame": {
        ctx.strokeStyle = C_MID;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, b.w, b.h);
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 6;
        const L = 40;
        for (const [cx, cy, sx, sy] of [
          [0, 0, 1, 1],
          [b.w, 0, -1, 1],
          [0, b.h, 1, -1],
          [b.w, b.h, -1, -1],
        ]) {
          ctx.beginPath();
          ctx.moveTo(cx + sx * L, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + sy * L);
          ctx.stroke();
        }
        ctx.fillText(b.label, 30, 50);
        ctx.globalAlpha = 0.3;
        for (let gy = 100; gy < b.h - 30; gy += 30) {
          for (let gx = 30; gx < b.w - 30; gx += 30) ctx.fillRect(gx, gy, 6, 6);
        }
        break;
      }
      case "wave": {
        ctx.fillText(b.label, 0, 24);
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 5; i++) ctx.fillRect(0, 70 + (i * (b.h - 110)) / 4, b.w, 2);
        break;
      }
    }
    ctx.restore();
  }
  return c;
};

// ---------------------------------------------------------------------------
// Dynamic layer: pure function of frame.

const drawDynamic = (B: Batch2D, f: number) => {
  B.begin();
  for (const b of BLOCKS) {
    const s = b.seed;
    const blink = (k: number, rate: number) => hash2(s + k, stepIndex(f, rate, LOOP)) > 0.25;
    switch (b.kind) {
      case "digits": {
        const str = rollingDigits(b.pattern, s, f, LOOP, 5);
        B.text(str, b.x, b.y + 165, 175, C_HI, 1, { i: 2.0, spacing: 1.35 });
        if (blink(1, 10)) B.dot(b.x - 60, b.y + 165, 12, C_HI, 1, { i: 2.2 });
        const p = beatValue(f, s + 3, 50, LOOP);
        B.rect(b.x, b.y + 230, b.w * 0.6 * (0.2 + 0.8 * p), 8, C_MID, 0.9, { i: 1.2 });
        break;
      }
      case "bars": {
        const base = b.y + b.h - 60;
        const bw = (b.w / b.n) * 0.6;
        const hmax = b.h - 120;
        for (let i = 0; i < b.n; i++) {
          const v = 0.15 + 0.85 * beatValue(f, s + i * 13, 30, LOOP, 0.6);
          const hgt = hmax * v;
          const x = b.x + (i * b.w) / b.n + ((b.w / b.n) - bw) / 2;
          B.rect(x, base - hgt, bw, hgt, C_MID, 0.85, { i: 1.1 });
          B.rect(x, base - hgt, bw, Math.min(12, hgt), C_HI, 1, { i: 1.8 });
        }
        break;
      }
      case "stair": {
        // staircase of horizontal bars, lengths step down
        const n = Math.min(9, Math.floor((b.h - 90) / 34));
        for (let i = 0; i < n; i++) {
          const base = 1 - i / (n + 1);
          const v = base * (0.75 + 0.25 * beatValue(f, s + i * 11, 40, LOOP));
          B.rect(b.x + 10, b.y + 70 + i * 34, (b.w - 20) * v, 24, i % 3 === 0 ? C_HI : C_MID, 0.7, { i: 1.25 });
        }
        break;
      }
      case "hatch":
        break;
      case "list": {
        const rows = Math.min(8, Math.floor((b.h - 80) / 46));
        for (let i = 0; i < rows; i++) {
          const v = beatValue(f, s + i * 7, 40, LOOP);
          B.rect(b.x + b.w * 0.32, b.y + 84 + i * 46, b.w * 0.42 * v, 10, i % 3 === 0 ? C_HI : C_MID, 0.9, { i: 1.3 });
        }
        break;
      }
      case "gauge": {
        const R = Math.min(b.w, b.h) * 0.36;
        const cx = b.x + R + 20;
        const cy = b.y + R + 40;
        const v = beatValue(f, s, 60, LOOP);
        B.arc(cx, cy, R - 8, R + 4, 0, Math.PI * 2 * (0.15 + 0.8 * v), C_HI, 0.9, { i: 1.6 });
        B.text(rollingDigits("##", s, f, LOOP, 10), cx, cy, 110, C_HI, 1, { align: "center", i: 1.8 });
        break;
      }
      case "small": {
        const str = rollingDigits(b.pattern, s, f, LOOP, 15);
        B.text(str, b.x, b.y + 60, 110, C_HI, 1, { i: 2.0, spacing: 1.3 });
        if (blink(2, 20)) B.dot(b.x - 34, b.y + 60, 9, C_HI, 1, { i: 2 });
        break;
      }
      case "meter": {
        const v = beatValue(f, s, 40, LOOP);
        const mx = b.x + b.w * v;
        B.rect(mx - 4, b.y + 60, 8, 60, C_HI, 1, { i: 2 });
        B.rect(b.x, b.y + 170, b.w * beatValue(f, s + 1, 50, LOOP), 14, C_MID, 0.9, { i: 1.2 });
        B.rect(b.x, b.y + 210, b.w * beatValue(f, s + 2, 30, LOOP), 14, C_HI, 0.8, { i: 1.4 });
        B.text(rollingDigits("###.#", s, f, LOOP, 10), b.x + b.w, b.y + 24, 44, C_HI, 1, { align: "right", i: 1.5 });
        break;
      }
      case "frame": {
        const cols = Math.floor((b.w - 60) / 30);
        const rowsN = Math.floor((b.h - 130) / 30);
        const st = stepIndex(f, 6, LOOP);
        for (let k = 0; k < 10; k++) {
          const cell = Math.floor(hash2(s + k, st) * cols * rowsN);
          const gx = 30 + (cell % cols) * 30;
          const gy = 100 + Math.floor(cell / cols) * 30;
          B.rect(b.x + gx, b.y + gy, 6, 6, C_HI, 1, { i: 2.4 });
        }
        break;
      }
      case "wave": {
        const n = 24;
        const pts: number[] = [];
        for (let i = 0; i < n; i++) {
          const v = beatValue(f, s + i * 31, 20, LOOP, 0.8);
          pts.push(b.x + (i / (n - 1)) * b.w, b.y + 70 + (1 - v) * (b.h - 110));
        }
        B.poly(pts, 5, C_HI, 0.95, { i: 1.6 });
        break;
      }
    }
  }
  B.end();
};

// ---------------------------------------------------------------------------

const build: BuildFn = () => {
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 140);
  const tex = canvasTexture(drawTile(), { repeat: true });
  const FOG: [number, number, number] = [11, 30, 0.85];
  const fogColor = "#0a2470";

  const makeFloor = (opts: { tint: number; uvOff: [number, number]; y: number; withDyn: boolean }) => {
    const floor = new THREE.Group();
    floor.position.y = opts.y;
    floor.rotation.x = -Math.PI / 2;
    const inner = new THREE.Group();
    inner.rotation.z = THREE.MathUtils.degToRad(-44);
    floor.add(inner);
    const REP = 5;
    const mat = texPlaneMaterial(tex, {
      tint: [opts.tint, opts.tint, opts.tint],
      repeat: [REP, REP],
      fog: FOG,
      fogColor,
      opacity: opts.withDyn ? 0.78 : 1,
    });
    mat.uniforms.uUV.value.x = opts.uvOff[0];
    mat.uniforms.uUV.value.y = opts.uvOff[1];
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(TILE_W * REP, TILE_W * REP), mat);
    plane.renderOrder = 0;
    inner.add(plane);
    let batch: Batch2D | null = null;
    if (opts.withDyn) {
      batch = new Batch2D({ capacity: 9000, width: TILE, height: TILE, unitsPerPx: K, z: 0.002, padPx: 6, fog: FOG });
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          const m = new THREE.Mesh(batch.mesh.geometry, batch.material);
          m.frustumCulled = false;
          m.renderOrder = 1;
          m.position.set(tx * TILE_W, ty * TILE_W, 0);
          inner.add(m);
        }
      }
    }
    return { floor, batch, mat };
  };

  // main plane + its dimmer copy below
  const main = makeFloor({ tint: 1.3, uvOff: [0, 0], y: 0, withDyn: true });
  const under = makeFloor({ tint: 0.75, uvOff: [0.37, 0.61], y: -1.3, withDyn: false });

  const sMain = new THREE.Scene();
  sMain.add(main.floor);
  const lines = new Lines3D(64);
  lines.mesh.renderOrder = 2;
  sMain.add(lines.mesh);
  const sUnder = new THREE.Scene();
  sUnder.add(under.floor);

  const target = new THREE.Vector3();
  const layers = [
    { scene: sUnder, blur: 0.006 },
    { scene: sMain, depth: { focus: 7.2, band: 0.9, range: 3.4, maxBlur: 0.0105, nearMul: 1.8 } },
  ];

  return {
    camera,
    layers,
    pipeline: {
      background: fogColor,
      bloomThreshold: 0.6,
      bloomKnee: 0.5,
      bloomIntensity: 1.5,
      bloomRadius: 0.85,
      vignette: 0.6,
      saturation: 1.05,
    },
    update: (f) => {
      // camera glides diagonally across the plane
      const t = f / BIGDATA_FRAMES;
      target.set(-1.6 + 3.6 * t, 0, 1.0 - 2.4 * t);
      const dist = 7.2;
      const elev = THREE.MathUtils.degToRad(33);
      const az = THREE.MathUtils.degToRad(-6);
      camera.position.set(
        target.x + Math.sin(az) * Math.cos(elev) * dist,
        Math.sin(elev) * dist,
        target.z + Math.cos(az) * Math.cos(elev) * dist,
      );
      camera.up.set(Math.sin(THREE.MathUtils.degToRad(-4)), Math.cos(THREE.MathUtils.degToRad(-4)), 0);
      camera.lookAt(target);
      camera.updateMatrixWorld();

      drawDynamic(main.batch!, f);

      lines.begin();
      for (const v of VLINES) {
        lines.seg(v.x, 0, v.z, v.x, v.h, v.z, 0.8, C_HI, v.a, 1);
      }
      lines.end();

      // 0-1.5s black; 1.5-3.5s fade up with a quick glitch; then live.
      const fade = easeOutCubic(remap(f, 45, 105));
      const g = f < 45 ? 0 : clamp01(1 - (f - 45) / 50) * (hash2(f >> 1, 99) > 0.3 ? 1 : 0.2);
      return { fade, glitch: f > 105 ? 0 : g };
    },
  };
};

export const BigDataScreen: React.FC<LookProps> = ({ grade }) => <Stage build={build} grade={grade} />;
