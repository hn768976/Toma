// Per-layer canvas drawing. Each function receives a RenderContext and
// paints one depth slice of the scene; the component blurs the far and
// mid canvases with CSS for depth-of-field.

import {
  type Camera,
  type Plane,
  type Projected,
  fog,
  makePlane,
  projectPlane,
} from "./camera";
import {
  BAR_BREATHE_PERIOD,
  BASE_HEIGHT,
  BASE_WIDTH,
  CURVE_DRIFT_PERIOD,
  FONT_FAMILY,
  LAYER_DEPTH,
  LOOP_SCROLL,
  NODE_PULSE_PERIOD,
  U_RANGE,
  type Theme,
} from "./constants";
import {
  type Bar,
  type Label,
  type SceneData,
  type Series,
  type Vertex,
  sampleSeries,
} from "./data";

const TAU = Math.PI * 2;

export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  cam: Camera;
  frame: number;
  scroll: number;
  theme: Theme;
  data: SceneData;
};

const PLANES = {
  far: makePlane(LAYER_DEPTH.far),
  mid: makePlane(LAYER_DEPTH.mid),
  grid: makePlane(LAYER_DEPTH.grid),
  main: makePlane(LAYER_DEPTH.main),
  curves: makePlane(LAYER_DEPTH.curves),
};

const MARGIN = 260;
const onScreen = (p: Projected | null): p is Projected =>
  p !== null &&
  p.x > -MARGIN &&
  p.x < BASE_WIDTH + MARGIN &&
  p.y > -MARGIN &&
  p.y < BASE_HEIGHT + MARGIN;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const mod = (a: number, n: number) => ((a % n) + n) % n;

// Iterate every copy of a periodic item whose world-u lands in U_RANGE.
const forEachPeriodic = <T extends { u: number }>(
  items: T[],
  scroll: number,
  cb: (item: T, uWorld: number) => void,
) => {
  const kMin = Math.floor((U_RANGE.min + scroll) / LOOP_SCROLL) - 1;
  const kMax = Math.ceil((U_RANGE.max + scroll) / LOOP_SCROLL) + 1;
  for (let k = kMin; k <= kMax; k++) {
    for (const item of items) {
      const uWorld = item.u + k * LOOP_SCROLL - scroll;
      if (uWorld < U_RANGE.min || uWorld > U_RANGE.max) continue;
      cb(item, uWorld);
    }
  }
};

// Iterate the copies of a regularly spaced series (bars, zigzag verts).
const forEachIndexed = (
  pitch: number,
  count: number,
  scroll: number,
  cb: (index: number, uWorld: number, dataIndex: number) => void,
) => {
  const iMin = Math.floor((U_RANGE.min + scroll) / pitch);
  const iMax = Math.ceil((U_RANGE.max + scroll) / pitch);
  for (let i = iMin; i <= iMax; i++) {
    cb(i, i * pitch - scroll, mod(i, count));
  }
};

const fillQuad = (
  ctx: CanvasRenderingContext2D,
  a: Projected,
  b: Projected,
  c: Projected,
  d: Projected,
) => {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
};

// Strokes a projected polyline in short chunks so line width and fog
// follow the depth of each chunk (near = thicker and brighter).
const strokeProjected = (
  ctx: CanvasRenderingContext2D,
  pts: (Projected | null)[],
  baseWidth: number,
  alpha: number,
  chunk = 6,
) => {
  let i = 0;
  while (i < pts.length - 1) {
    const end = Math.min(pts.length - 1, i + chunk);
    const mid = pts[Math.floor((i + end) / 2)];
    if (mid) {
      ctx.lineWidth = Math.max(0.6, baseWidth * mid.s);
      ctx.globalAlpha = alpha * fog(mid.depth);
      ctx.beginPath();
      let open = false;
      for (let j = i; j <= end; j++) {
        const p = pts[j];
        if (!p) {
          open = false;
          continue;
        }
        if (!open) {
          ctx.moveTo(p.x, p.y);
          open = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
    i = end;
  }
  ctx.globalAlpha = 1;
};

const drawBars = (
  rc: RenderContext,
  plane: Plane,
  pitch: number,
  width: number,
  bars: Bar[],
  fill: string,
  edge: string | null,
  breatheAmount: number,
) => {
  const { ctx, cam, frame, scroll } = rc;
  const breathe = (frame / BAR_BREATHE_PERIOD) * TAU;
  forEachIndexed(pitch, bars.length, scroll, (_, uWorld, di) => {
    const bar = bars[di];
    const centre = projectPlane(cam, plane, uWorld, bar.center);
    if (!onScreen(centre)) return;

    // Bars "grow in" as they enter from the right edge of the frame and
    // gently breathe so the whole chart weaves.
    const grow = smoothstep((BASE_WIDTH + 40 - centre.x) / (BASE_WIDTH * 0.16));
    const pulse = 1 - breatheAmount + breatheAmount * Math.sin(breathe + bar.phase);
    const half = bar.half * grow * pulse;
    if (half < 1) return;

    const u0 = uWorld - width / 2;
    const u1 = uWorld + width / 2;
    const a = projectPlane(cam, plane, u0, bar.center + half);
    const b = projectPlane(cam, plane, u1, bar.center + half);
    const c = projectPlane(cam, plane, u1, bar.center - half);
    const d = projectPlane(cam, plane, u0, bar.center - half);
    if (!a || !b || !c || !d) return;

    ctx.globalAlpha = fog(centre.depth);
    ctx.fillStyle = fill;
    fillQuad(ctx, a, b, c, d);
    if (edge) {
      // Thin darker right face hints at the bar's thickness.
      const w = Math.max(1, 2.2 * centre.s);
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + w, b.y + w * 0.35);
      ctx.lineTo(c.x + w, c.y + w * 0.35);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
};

const drawZigzag = (
  rc: RenderContext,
  plane: Plane,
  pitch: number,
  verts: Vertex[],
  color: string,
  width: number,
  alpha: number,
) => {
  const { ctx, cam, scroll } = rc;
  const pts: (Projected | null)[] = [];
  forEachIndexed(pitch, verts.length, scroll, (_, uWorld, di) => {
    pts.push(projectPlane(cam, plane, uWorld, verts[di].v));
  });
  ctx.strokeStyle = color;
  ctx.lineJoin = "miter";
  ctx.lineCap = "round";
  strokeProjected(ctx, pts, width, alpha, 4);
};

const drawCurve = (
  rc: RenderContext,
  plane: Plane,
  series: Series,
  color: string,
  width: number,
  alpha: number,
  drift: number,
) => {
  const { ctx, cam, scroll, frame } = rc;
  const pts: (Projected | null)[] = [];
  const step = 14;
  const wobble = Math.sin((frame / CURVE_DRIFT_PERIOD) * TAU) * drift;
  for (let u = U_RANGE.min; u <= U_RANGE.max; u += step) {
    const v = sampleSeries(series, u + scroll) + wobble;
    pts.push(projectPlane(cam, plane, u, v));
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Soft under-glow, then the crisp line.
  ctx.strokeStyle = color;
  strokeProjected(ctx, pts, width * 3.2, alpha * 0.16, 8);
  strokeProjected(ctx, pts, width, alpha, 8);
};

const drawLabel = (
  rc: RenderContext,
  plane: Plane,
  label: Label,
  uWorld: number,
  color: string,
) => {
  const { ctx, cam } = rc;
  const p = projectPlane(cam, plane, uWorld, label.v);
  if (!onScreen(p)) return;
  const size = label.size * p.s;
  if (size < 4) return;
  ctx.globalAlpha = label.alpha * fog(p.depth);
  ctx.fillStyle = color;

  const t = size * 0.5;
  ctx.beginPath();
  if (label.up) {
    ctx.moveTo(p.x - t, p.y + t * 0.55);
    ctx.lineTo(p.x + t, p.y + t * 0.55);
    ctx.lineTo(p.x, p.y - t * 0.6);
  } else {
    ctx.moveTo(p.x - t, p.y - t * 0.55);
    ctx.lineTo(p.x + t, p.y - t * 0.55);
    ctx.lineTo(p.x, p.y + t * 0.6);
  }
  ctx.closePath();
  ctx.fill();

  ctx.font = `600 ${size.toFixed(2)}px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label.text, p.x + t * 1.7, p.y + size * 0.04);
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------------
// Layer: far background (heavily blurred ticker digits)
// ---------------------------------------------------------------------
export const drawFar = (rc: RenderContext) => {
  const { ctx, cam, scroll, theme, data } = rc;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const row of data.tickerRows) {
    forEachPeriodic(row.tokens, scroll, (tok, uWorld) => {
      const p = projectPlane(cam, PLANES.far, uWorld, row.v);
      if (!onScreen(p)) return;
      const size = tok.size * p.s;
      if (size < 5) return;
      ctx.globalAlpha = tok.alpha * fog(p.depth);
      ctx.fillStyle =
        tok.tone === "up"
          ? theme.tickerUp
          : tok.tone === "down"
            ? theme.tickerDown
            : theme.tickerNeutral;
      ctx.font = `700 ${size.toFixed(2)}px ${FONT_FAMILY}`;
      ctx.fillText(tok.text, p.x, p.y);
    });
  }
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------------
// Layer: mid (slightly soft): thin cyan bars, horizontal bar groups,
// secondary labels
// ---------------------------------------------------------------------
export const drawMid = (rc: RenderContext) => {
  const { ctx, cam, scroll, theme, data } = rc;

  forEachPeriodic(data.hbarGroups, scroll, (group, uWorld) => {
    const rowH = 20;
    const gap = 12;
    group.widths.forEach((w, i) => {
      const v0 = group.v - i * (rowH + gap);
      const a = projectPlane(cam, PLANES.mid, uWorld, v0 + rowH);
      const b = projectPlane(cam, PLANES.mid, uWorld + w, v0 + rowH);
      const c = projectPlane(cam, PLANES.mid, uWorld + w, v0);
      const d = projectPlane(cam, PLANES.mid, uWorld, v0);
      if (!a || !b || !c || !d || !onScreen(a)) return;
      ctx.globalAlpha = 0.65 * fog(a.depth);
      ctx.fillStyle = theme.hbar;
      fillQuad(ctx, a, b, c, d);
    });
    ctx.globalAlpha = 1;
  });

  drawBars(
    rc,
    PLANES.mid,
    data.cyanPitch,
    data.cyanWidth,
    data.cyanBars,
    theme.cyan,
    null,
    0.12,
  );

  forEachPeriodic(data.labelsMid, scroll, (label, uWorld) => {
    drawLabel(rc, PLANES.mid, label, uWorld, theme.labelSoft);
  });
};

// ---------------------------------------------------------------------
// Layer: main (crisp): node grid, zigzags, green bars, curves, labels
// ---------------------------------------------------------------------
export const drawMain = (rc: RenderContext) => {
  const { ctx, cam, scroll, frame, theme, data } = rc;

  // Dashed horizontal grid rows.
  ctx.strokeStyle = theme.grid;
  ctx.setLineDash([5, 7]);
  ctx.lineCap = "butt";
  for (const v of data.gridRows) {
    const pts: (Projected | null)[] = [];
    for (let u = U_RANGE.min; u <= U_RANGE.max; u += 120) {
      pts.push(projectPlane(cam, PLANES.grid, u, v));
    }
    strokeProjected(ctx, pts, 1.3, 1, 6);
  }
  // Dashed vertical grid columns (slightly irregular spacing).
  const colCount = data.gridColOffsets.length;
  forEachIndexed(data.gridColPitch, colCount, scroll, (_, uWorld, di) => {
    const u = uWorld + data.gridColOffsets[di];
    const top = projectPlane(cam, PLANES.grid, u, 700);
    const bottom = projectPlane(cam, PLANES.grid, u, -700);
    if (!top || !bottom) return;
    if (top.x < -MARGIN || top.x > BASE_WIDTH + MARGIN) return;
    const pts: (Projected | null)[] = [];
    for (let v = 700; v >= -700; v -= 140) {
      pts.push(projectPlane(cam, PLANES.grid, u, v));
    }
    strokeProjected(ctx, pts, 1.1, 0.85, 4);
  });
  ctx.setLineDash([]);

  // Network links between nodes.
  ctx.strokeStyle = theme.nodeLink;
  for (const link of data.nodeLinks) {
    forEachPeriodic([link.a], scroll, (_, uWorld) => {
      const du = link.b.u - link.a.u;
      const a = projectPlane(cam, PLANES.grid, uWorld, link.a.v);
      const b = projectPlane(cam, PLANES.grid, uWorld + du, link.b.v);
      if (!onScreen(a) || !b) return;
      strokeProjected(ctx, [a, b], 1.2, 1, 2);
    });
  }

  // Node dots, gently pulsing.
  const pulse = (frame / NODE_PULSE_PERIOD) * TAU;
  ctx.fillStyle = theme.node;
  forEachPeriodic(data.nodes, scroll, (node, uWorld) => {
    const p = projectPlane(cam, PLANES.grid, uWorld, node.v);
    if (!onScreen(p)) return;
    const twinkle = 0.75 + 0.25 * Math.sin(pulse + node.u * 0.013 + node.v * 0.02);
    ctx.globalAlpha = twinkle * fog(p.depth);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.8, 3.4 * p.s), 0, TAU);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Saw-tooth line charts behind the bars.
  drawZigzag(rc, PLANES.main, data.purplePitch, data.purple, theme.purple, 2.3, 0.92);
  drawZigzag(rc, PLANES.main, data.limePitch, data.lime, theme.lime, 2.1, 0.9);

  // Hero green bars.
  drawBars(
    rc,
    PLANES.main,
    data.greenPitch,
    data.greenWidth,
    data.greenBars,
    theme.green,
    theme.greenEdge,
    0.16,
  );

  // Smooth curves floating just in front of the bars.
  drawCurve(rc, PLANES.curves, data.curveAccent, theme.curveAccent, 3.4, 0.95, 26);
  drawCurve(rc, PLANES.curves, data.curvePrimary, theme.curvePrimary, 3.6, 1, -18);

  // Small numeric read-outs near the green trend.
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  forEachPeriodic(data.valueTags, scroll, (tag, uWorld) => {
    const p = projectPlane(cam, PLANES.main, uWorld, tag.v);
    if (!onScreen(p)) return;
    const size = 12 * p.s;
    if (size < 4) return;
    ctx.globalAlpha = 0.9 * fog(p.depth);
    ctx.fillStyle = theme.valueTag;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.8, 2.6 * p.s), 0, TAU);
    ctx.fill();
    ctx.font = `500 ${size.toFixed(2)}px ${FONT_FAMILY}`;
    ctx.fillText(tag.text, p.x + 6 * p.s, p.y);
  });
  ctx.globalAlpha = 1;

  forEachPeriodic(data.labelsMain, scroll, (label, uWorld) => {
    drawLabel(rc, PLANES.main, label, uWorld, theme.label);
  });
};

