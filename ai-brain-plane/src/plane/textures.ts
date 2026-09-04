import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  type Texture,
} from "three";
import { mulberry32, range, rangeInt, type Rng } from "../lib/random";

/**
 * Procedural surface for the circuit plane.
 *
 * Everything here is generated ONCE per JavaScript context (the `let cached`
 * singletons at the bottom) and shared by both versions. The textures carry
 * *masks*, not colours: the plane shader multiplies each channel by a
 * per-version colour, which is what lets V1 and V2 share one generation pass.
 *
 * Channel layout
 * --------------
 * detail (2048^2, tiles):
 *   R  circuit trace intensity
 *   G  data-block intensity (grid aligned, so the shader can hash per block)
 *   B  pad / via mask
 * flow (1024^2, tiles, registered to the traces):
 *   R  position along the trace, wrapping every FLOW_PERIOD px  -> pulse head
 *   G  per-trace id                                             -> pulse timing
 * binary (2048x1024, tiles):
 *   R  glyph coverage
 *   G  per-glyph brightness variation
 *
 * The tiles are drawn wrap-aware (see `wrapDraw`) so the plane can repeat them
 * without a seam; large-scale variation ("dense in bands, sparse elsewhere")
 * is applied in the shader from world position, which also stops the
 * repetition from reading as a pattern.
 */

const DETAIL = 2048;
const FLOW = 1024;
const FLOW_SCALE = FLOW / DETAIL;
const BIN_W = 2048;
const BIN_H = 1024;

/** Trace arc-length, in detail-texture pixels, per full pulse cycle. */
const FLOW_PERIOD = 420;

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx };
};

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Draw `fn` once for every wrap offset whose copy would touch the canvas, so
 * shapes crossing an edge reappear on the opposite side and the tile is
 * seamless. Almost every shape ends up drawn exactly once.
 */
const wrapDraw = (
  ctx: CanvasRenderingContext2D,
  box: Box,
  w: number,
  h: number,
  fn: () => void,
) => {
  for (const dx of [-w, 0, w]) {
    if (box.x1 + dx < 0 || box.x0 + dx > w) continue;
    for (const dy of [-h, 0, h]) {
      if (box.y1 + dy < 0 || box.y0 + dy > h) continue;
      ctx.save();
      ctx.translate(dx, dy);
      fn();
      ctx.restore();
    }
  }
};

type Pt = { x: number; y: number };

/** One routed trace: a polyline in detail-texture pixels. */
type Trace = { pts: Pt[]; width: number; intensity: number; id: number };

/**
 * Route traces on a coarse grid using Manhattan and 45-degree moves, the way a
 * PCB autorouter does. Each trace starts on the grid, takes a handful of runs,
 * and finishes on the grid.
 */
const routeTraces = (rng: Rng): Trace[] => {
  const PITCH = 32;
  const CELLS = DETAIL / PITCH;
  const DIRS: Pt[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];
  const traces: Trace[] = [];
  const COUNT = 620;
  for (let i = 0; i < COUNT; i++) {
    let cx = rangeInt(rng, 0, CELLS - 1);
    let cy = rangeInt(rng, 0, CELLS - 1);
    let dir = DIRS[rangeInt(rng, 0, 7)];
    const pts: Pt[] = [{ x: cx * PITCH, y: cy * PITCH }];
    const runs = rangeInt(rng, 2, 6);
    for (let r = 0; r < runs; r++) {
      const len = rangeInt(rng, 2, 9);
      cx += dir.x * len;
      cy += dir.y * len;
      pts.push({ x: cx * PITCH, y: cy * PITCH });
      // Turn by 45 or 90 degrees, keeping the routing orthogonal-ish.
      const idx = DIRS.indexOf(dir);
      const turn = rng() < 0.55 ? 1 : 2;
      const sign = rng() < 0.5 ? 1 : -1;
      // Walk the 8-direction ring so a turn is always 45 or 90 degrees.
      const ring = [0, 4, 1, 5, 2, 6, 3, 7];
      const pos = ring.indexOf(idx);
      dir = DIRS[ring[(pos + sign * turn + 8) % 8]];
    }
    traces.push({
      pts,
      width: rng() < 0.18 ? 3.4 : rng() < 0.5 ? 2.6 : 1.9,
      intensity: range(rng, 0.34, 0.72),
      // Quantised so the 8-bit id channel round-trips exactly.
      id: Math.round(rng() * 255) / 255,
    });
  }
  return traces;
};

const boxOf = (pts: Pt[], pad: number): Box => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
};

const buildDetailAndFlow = () => {
  const rng = mulberry32(0x51ce_11a1);
  const detail = makeCanvas(DETAIL, DETAIL);
  const flow = makeCanvas(FLOW, FLOW);
  const d = detail.ctx;
  const f = flow.ctx;

  d.fillStyle = "#000";
  d.fillRect(0, 0, DETAIL, DETAIL);
  f.fillStyle = "#000";
  f.fillRect(0, 0, FLOW, FLOW);

  const traces = routeTraces(rng);

  // --- traces: red channel of `detail`, additive so junctions read brighter.
  d.globalCompositeOperation = "lighter";
  d.lineCap = "round";
  d.lineJoin = "round";
  for (const t of traces) {
    const box = boxOf(t.pts, t.width + 2);
    wrapDraw(d, box, DETAIL, DETAIL, () => {
      d.strokeStyle = `rgb(${Math.round(t.intensity * 255)},0,0)`;
      d.lineWidth = t.width;
      d.beginPath();
      d.moveTo(t.pts[0].x, t.pts[0].y);
      for (let i = 1; i < t.pts.length; i++) d.lineTo(t.pts[i].x, t.pts[i].y);
      d.stroke();
    });
  }

  // --- flow: R = arc-length parameter, G = trace id. `source-over` so a
  // crossing takes the topmost trace's value instead of summing two.
  f.globalCompositeOperation = "source-over";
  f.lineCap = "butt";
  f.lineJoin = "round";
  for (const t of traces) {
    const g = Math.round(t.id * 255);
    let arc = 0;
    for (let i = 0; i < t.pts.length - 1; i++) {
      const a = t.pts[i];
      const b = t.pts[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen === 0) continue;
      // Split the run wherever the parameter wraps, so each stroke's gradient
      // stays monotonic.
      let done = 0;
      while (done < segLen) {
        const startArc = arc + done;
        const startParam = (startArc % FLOW_PERIOD) / FLOW_PERIOD;
        const toWrap = FLOW_PERIOD * (1 - startParam);
        const take = Math.min(segLen - done, toWrap);
        const t0 = done / segLen;
        const t1 = (done + take) / segLen;
        const p0 = {
          x: (a.x + (b.x - a.x) * t0) * FLOW_SCALE,
          y: (a.y + (b.y - a.y) * t0) * FLOW_SCALE,
        };
        const p1 = {
          x: (a.x + (b.x - a.x) * t1) * FLOW_SCALE,
          y: (a.y + (b.y - a.y) * t1) * FLOW_SCALE,
        };
        const endParam = startParam + take / FLOW_PERIOD;
        wrapDraw(f, boxOf([p0, p1], 4), FLOW, FLOW, () => {
          const grad = f.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
          grad.addColorStop(0, `rgb(${Math.round(startParam * 255)},${g},0)`);
          grad.addColorStop(1, `rgb(${Math.round(Math.min(1, endParam) * 255)},${g},0)`);
          f.strokeStyle = grad;
          // Wider than the trace so every trace texel finds a flow value even
          // at the lower flow resolution.
          f.lineWidth = t.width * FLOW_SCALE + 2.6;
          f.beginPath();
          f.moveTo(p0.x, p0.y);
          f.lineTo(p1.x, p1.y);
          f.stroke();
        });
        done += take;
        if (take <= 0) break;
      }
      arc += segLen;
    }
  }

  // --- pads and vias: blue channel, sitting on trace ends and some corners.
  d.globalCompositeOperation = "lighter";
  for (const t of traces) {
    for (let i = 0; i < t.pts.length; i++) {
      const isEnd = i === 0 || i === t.pts.length - 1;
      if (!isEnd && rng() > 0.28) continue;
      const p = t.pts[i];
      const r = isEnd ? range(rng, 3.4, 5.6) : range(rng, 2.2, 3.4);
      wrapDraw(d, { x0: p.x - r - 2, y0: p.y - r - 2, x1: p.x + r + 2, y1: p.y + r + 2 }, DETAIL, DETAIL, () => {
        d.fillStyle = `rgb(0,0,${Math.round(range(rng, 0.6, 1) * 255)})`;
        d.beginPath();
        d.arc(p.x, p.y, r, 0, Math.PI * 2);
        d.fill();
        if (isEnd && r > 4.4) {
          // Via: punch a dark centre back out so it reads as a ring.
          d.globalCompositeOperation = "destination-out";
          d.fillStyle = "rgba(0,0,0,1)";
          d.beginPath();
          d.arc(p.x, p.y, r * 0.42, 0, Math.PI * 2);
          d.fill();
          d.globalCompositeOperation = "lighter";
        }
      });
    }
  }

  // --- data blocks: green channel, in grid-aligned clusters so the shader can
  // hash a stable id per block for the flicker.
  const CELL = 16;
  const clusters = 190;
  for (let c = 0; c < clusters; c++) {
    const gx = rangeInt(rng, 0, DETAIL / CELL - 1);
    const gy = rangeInt(rng, 0, DETAIL / CELL - 1);
    const cw = rangeInt(rng, 3, 11);
    const ch = rangeInt(rng, 2, 7);
    for (let ix = 0; ix < cw; ix++) {
      for (let iy = 0; iy < ch; iy++) {
        if (rng() < 0.34) continue;
        const x = (gx + ix) * CELL;
        const y = (gy + iy) * CELL;
        const w = CELL * range(rng, 0.5, 0.86);
        const h = CELL * range(rng, 0.3, 0.62);
        const v = Math.round(range(rng, 0.3, 1) * 255);
        wrapDraw(d, { x0: x, y0: y, x1: x + CELL, y1: y + CELL }, DETAIL, DETAIL, () => {
          d.fillStyle = `rgb(0,${v},0)`;
          d.fillRect(x + (CELL - w) / 2, y + (CELL - h) / 2, w, h);
        });
      }
    }
  }
  d.globalCompositeOperation = "source-over";

  return { detail: detail.canvas, flow: flow.canvas };
};

/**
 * Binary rows. The 0 and 1 glyphs are drawn as geometry rather than as text so
 * the output is identical on any machine, with no font to install and no font
 * licence riding along with the clip.
 */
const buildBinary = () => {
  const COLS = 256;
  const ROWS = 64;
  const CW = BIN_W / COLS; // 8
  const CH = BIN_H / ROWS; // 16
  const { canvas, ctx } = makeCanvas(BIN_W, BIN_H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, BIN_W, BIN_H);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  const rng = mulberry32(0xb1_11_01_10);
  const gw = CW * 0.5; // glyph width
  const gh = CH * 0.58; // glyph height
  const stroke = Math.max(1, Math.round(CW * 0.17));

  for (let row = 0; row < ROWS; row++) {
    // Row density: some rows are dense strings, some are sparse, some empty.
    const rowRoll = rng();
    const density = rowRoll < 0.3 ? 0 : rowRoll < 0.6 ? range(rng, 0.18, 0.4) : range(rng, 0.55, 0.95);
    if (density === 0) continue;
    const rowBright = range(rng, 0.45, 1);
    const y = row * CH + (CH - gh) / 2;
    for (let col = 0; col < COLS; col++) {
      if (rng() > density) continue;
      const one = rng() < 0.5;
      const bright = Math.round(rowBright * range(rng, 0.6, 1) * 255);
      const x = col * CW + (CW - gw) / 2;
      ctx.strokeStyle = `rgb(255,${bright},0)`;
      ctx.fillStyle = `rgb(255,${bright},0)`;
      ctx.lineWidth = stroke;
      if (one) {
        // "1": stem, top flag, foot.
        const mx = x + gw / 2;
        ctx.beginPath();
        ctx.moveTo(mx, y);
        ctx.lineTo(mx, y + gh);
        ctx.moveTo(mx, y);
        ctx.lineTo(x + gw * 0.12, y + gh * 0.26);
        ctx.moveTo(x + gw * 0.1, y + gh);
        ctx.lineTo(x + gw * 0.9, y + gh);
        ctx.stroke();
      } else {
        // "0": squared-off ring.
        const r = Math.min(gw, gh) * 0.28;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + gw - r, y);
        ctx.quadraticCurveTo(x + gw, y, x + gw, y + r);
        ctx.lineTo(x + gw, y + gh - r);
        ctx.quadraticCurveTo(x + gw, y + gh, x + gw - r, y + gh);
        ctx.lineTo(x + r, y + gh);
        ctx.quadraticCurveTo(x, y + gh, x, y + gh - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
};

const finish = (canvas: HTMLCanvasElement, mip: boolean): Texture => {
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = mip ? LinearMipmapLinearFilter : LinearFilter;
  tex.generateMipmaps = mip;
  // These are data masks, not colour: keep them out of the sRGB pipeline.
  tex.colorSpace = "";
  tex.needsUpdate = true;
  return tex;
};

let cached: { detail: Texture; flow: Texture; binary: Texture } | null = null;

/** Built exactly once per JS context and shared by both compositions. */
export const getPlaneTextures = () => {
  if (!cached) {
    const { detail, flow } = buildDetailAndFlow();
    cached = {
      detail: finish(detail, true),
      flow: finish(flow, true),
      binary: finish(buildBinary(), true),
    };
  }
  return cached;
};

export const BINARY_ROWS = 64;
