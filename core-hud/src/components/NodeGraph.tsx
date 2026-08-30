import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer, Rect } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import {
  circle,
  closedDrift,
  ctxOf,
  dot,
  line,
  makeCanvas,
  pick,
  rnd,
  rndInt,
  rndRange,
  trimToCircles,
} from "../draw/util";
import { HudCanvas } from "./canvas";

export const GRAPH_W = 1460;
export const GRAPH_H = 980;
/** Largest per-node drift excursion, in unscaled pixels. */
const MAX_DRIFT = 14;

export const measureNodeGraph: Measurer = ({ scale }) => ({
  w: Math.round(GRAPH_W * scale),
  h: Math.round(GRAPH_H * scale),
});

type NodeKind =
  | "plain"
  | "inner"
  | "dot"
  | "tick"
  | "crosshair"
  | "segring"
  | "hatch";

type GNode = {
  i: number;
  /** Rest position in this element's pixel space. */
  x: number;
  y: number;
  r: number;
  kind: NodeKind;
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  px: number;
  py: number;
  chrome: HTMLCanvasElement;
  pad: number;
};

const intersectsRect = (
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
  margin: number,
) =>
  cx + r + margin > rect.x &&
  cx - r - margin < rect.x + rect.w &&
  cy + r + margin > rect.y &&
  cy - r - margin < rect.y + rect.h;

/** Fixed detail for one node, rendered once and blitted at its drifted spot. */
const renderNodeChrome = (node: Omit<GNode, "chrome">, stroke: StrokeSet) => {
  const { r, kind, pad, i } = node;
  const size = Math.ceil((r + pad) * 2);
  const canvas = makeCanvas(size, size);
  const ctx = ctxOf(canvas);
  const c = size / 2;

  if (kind === "hatch") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r - stroke.structure, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = THEME.faint;
    ctx.lineWidth = stroke.structure;
    const step = Math.max(14, r / 5);
    for (let g = -r; g <= r; g += step) {
      line(ctx, c + g, c - r, c + g, c + r);
      line(ctx, c - r, c + g, c + r, c + g);
    }
    ctx.restore();
  }

  // Outer circle. The nodes read first, so they carry the brighter stroke.
  ctx.strokeStyle = kind === "crosshair" || kind === "segring" ? THEME.bright : THEME.mid;
  ctx.lineWidth = kind === "crosshair" || kind === "segring" ? stroke.emphasis : stroke.structure;
  circle(ctx, c, c, r);

  ctx.lineWidth = stroke.structure;

  if (kind === "inner" || kind === "crosshair" || kind === "segring") {
    ctx.strokeStyle = THEME.dim;
    circle(ctx, c, c, r * 0.58);
  }

  if (kind === "dot" || kind === "crosshair" || kind === "segring") {
    ctx.fillStyle = THEME.bright;
    dot(ctx, c, c, Math.max(2.5, r * 0.045));
  }

  if (kind === "tick") {
    const a = rndRange(`tick-${i}`, 0, Math.PI * 2);
    ctx.strokeStyle = THEME.bright;
    line(
      ctx,
      c + Math.cos(a) * (r - r * 0.22),
      c + Math.sin(a) * (r - r * 0.22),
      c + Math.cos(a) * r,
      c + Math.sin(a) * r,
    );
  }

  if (kind === "crosshair") {
    ctx.strokeStyle = THEME.mid;
    const inner = r * 0.58;
    const gap = r * 0.16;
    line(ctx, c - inner, c, c - gap, c);
    line(ctx, c + gap, c, c + inner, c);
    line(ctx, c, c - inner, c, c - gap);
    line(ctx, c, c + gap, c, c + inner);
    ctx.strokeStyle = THEME.dim;
    circle(ctx, c, c, r * 0.30);
  }

  if (kind === "segring") {
    // A segmented ring: arcs with unequal gaps, plus a fine tick band outside.
    ctx.strokeStyle = THEME.mid;
    const segs = 7;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2 + rndRange(`seg-${i}-${s}`, 0.04, 0.16);
      const a1 = ((s + 1) / segs) * Math.PI * 2 - rndRange(`sege-${i}-${s}`, 0.04, 0.2);
      ctx.beginPath();
      ctx.arc(c, c, r * 0.78, a0, a1);
      ctx.stroke();
    }
    ctx.strokeStyle = THEME.dim;
    const ticks = 32;
    for (let t = 0; t < ticks; t++) {
      const a = (t / ticks) * Math.PI * 2;
      const len = t % 4 === 0 ? r * 0.13 : r * 0.07;
      line(
        ctx,
        c + Math.cos(a) * r,
        c + Math.sin(a) * r,
        c + Math.cos(a) * (r + len),
        c + Math.sin(a) * (r + len),
      );
    }
  }

  return canvas;
};

const buildGraph = (
  seed: string,
  count: number,
  edgeCount: number,
  scale: number,
  stroke: StrokeSet,
  avoid: Rect[],
) => {
  const W = GRAPH_W * scale;
  const H = GRAPH_H * scale;

  // Radii: a spread of sizes, with the largest few carrying internal detail.
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = rnd(`${seed}-rt-${i}`);
    const base = t < 0.28 ? rndRange(`${seed}-rl-${i}`, 88, 122) : rndRange(`${seed}-rs-${i}`, 30, 78);
    radii.push(base * scale);
  }
  radii.sort((a, b) => b - a);

  const placed: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = radii[i] as number;
    let best: { x: number; y: number } | null = null;
    // Leaves room for the largest drift excursion plus the segmented ring's
    // outward ticks, so no node is ever clipped by the element's own edge.
    const inset = (12 + MAX_DRIFT + 22) * scale;
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = rndRange(`${seed}-x-${i}-${attempt}`, r + inset, W - r - inset);
      const y = rndRange(`${seed}-y-${i}-${attempt}`, r + inset, H - r - inset);
      const clearOfNodes = placed.every(
        (p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 46 * scale,
      );
      const clearOfPanels = avoid.every(
        (rect) => !intersectsRect(x, y, r, rect, 18 * scale),
      );
      if (clearOfNodes && clearOfPanels) {
        best = { x, y };
        break;
      }
      if (!best && clearOfNodes) {
        best = { x, y };
      }
    }
    placed.push({ x: best?.x ?? W / 2, y: best?.y ?? H / 2, r });
  }

  const nodes: GNode[] = placed.map((p, i) => {
    const large = i < Math.min(3, Math.max(2, Math.round(count * 0.25)));
    let kind: NodeKind;
    if (large) {
      kind = rnd(`${seed}-k-${i}`) < 0.5 ? "crosshair" : "segring";
    } else {
      kind = pick(`${seed}-k-${i}`, [
        "plain",
        "inner",
        "dot",
        "tick",
        "hatch",
        "inner",
        "dot",
      ] as const);
    }
    const pad = Math.ceil((kind === "segring" ? p.r * 0.2 : 0) + stroke.emphasis * 2 + 4);
    const partial = {
      i,
      x: p.x,
      y: p.y,
      r: p.r,
      kind,
      pad,
      ax: rndRange(`${seed}-ax-${i}`, 4, MAX_DRIFT) * scale,
      ay: rndRange(`${seed}-ay-${i}`, 4, MAX_DRIFT) * scale,
      kx: rndInt(`${seed}-kx-${i}`, 1, 3),
      ky: rndInt(`${seed}-ky-${i}`, 1, 3),
      px: rndRange(`${seed}-px-${i}`, 0, Math.PI * 2),
      py: rndRange(`${seed}-py-${i}`, 0, Math.PI * 2),
    };
    return { ...partial, chrome: renderNodeChrome(partial, stroke) };
  });

  // An irregular web: each node reaches its two nearest neighbours, then a few
  // seeded long spans tie distant parts of the graph together.
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  const add = (a: number, b: number) => {
    if (a === b || seen.has(key(a, b))) {
      return;
    }
    seen.add(key(a, b));
    edges.push([a, b]);
  };

  nodes.forEach((n, i) => {
    const others = nodes
      .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d);
    add(i, (others[0] as { j: number }).j);
    if (others[1]) {
      add(i, others[1].j);
    }
  });

  let guard = 0;
  while (edges.length < edgeCount && guard < edgeCount * 20) {
    const a = rndInt(`${seed}-ea-${guard}`, 0, count - 1);
    const b = rndInt(`${seed}-eb-${guard}`, 0, count - 1);
    add(a, b);
    guard++;
  }

  return { nodes, edges };
};

export const NodeGraph: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
  avoid,
}) => {
  const avoidKey = avoid.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join("|");
  const graph = useMemo(
    () =>
      buildGraph(
        config.seed,
        config.nodes ?? 9,
        config.edges ?? 14,
        scale,
        stroke,
        avoid,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.seed, config.nodes, config.edges, scale, stroke.structure, stroke.emphasis, avoidKey],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;

    const pos = graph.nodes.map((n) => {
      const d = closedDrift(frame, n.ax, n.ay, n.kx, n.ky, n.px, n.py);
      return { x: n.x + d.dx, y: n.y + d.dy, r: n.r };
    });

    // The web is the dimmest thing in the assembly; it recomputes every frame
    // from the drifted node positions.
    ctx.lineWidth = stroke.structure;
    graph.edges.forEach(([a, b], i) => {
      const pa = pos[a] as { x: number; y: number; r: number };
      const pb = pos[b] as { x: number; y: number; r: number };
      const t = trimToCircles(pa.x, pa.y, pa.r, pb.x, pb.y, pb.r);
      if (t.len <= 0) {
        return;
      }
      ctx.strokeStyle = rnd(`${config.seed}-ec-${i}`) < 0.28 ? THEME.faint : THEME.dim;
      line(ctx, t.x1, t.y1, t.x2, t.y2);
      // A small anchor dot where a connection meets a node.
      ctx.fillStyle = THEME.mid;
      dot(ctx, t.x1, t.y1, 3 * scale);
      dot(ctx, t.x2, t.y2, 3 * scale);
    });

    // Fixed node detail is pre-rendered; only its position changes, and it is
    // blitted on whole pixels so the line work stays crisp.
    graph.nodes.forEach((n, i) => {
      const p = pos[i] as { x: number; y: number };
      const half = n.chrome.width / 2;
      ctx.drawImage(
        n.chrome,
        Math.round(p.x - half),
        Math.round(p.y - half),
      );
    });

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
