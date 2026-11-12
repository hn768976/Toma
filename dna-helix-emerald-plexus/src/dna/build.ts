import { createRng, type Rng } from "./random";
import type { FieldStyle, HelixStyle, RGB, Range } from "./types";

/** Growable typed buffers for one draw layer. */
export class PointBuffer {
  pos: number[] = [];
  col: number[] = [];
  size: number[] = [];
  alpha: number[] = [];
  kind: number[] = [];
  phase: number[] = [];
  /** unit axis for edge-on fading (0,0,0 = none) */
  axis: number[] = [];
  add(
    p: readonly number[],
    c: RGB,
    size: number,
    alpha: number,
    kind: number,
    phase: number,
    axis: readonly number[] = [0, 0, 0],
  ) {
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(c[0], c[1], c[2]);
    this.size.push(size);
    this.alpha.push(alpha);
    this.kind.push(kind);
    this.phase.push(phase);
    this.axis.push(axis[0], axis[1], axis[2]);
  }
  get count() {
    return this.size.length;
  }
}

export class LineBuffer {
  start: number[] = [];
  end: number[] = [];
  col: number[] = [];
  add(a: readonly number[], b: readonly number[], c: RGB, alpha: number) {
    this.start.push(a[0], a[1], a[2]);
    this.end.push(b[0], b[1], b[2]);
    this.col.push(c[0], c[1], c[2], alpha);
  }
  get count() {
    return this.start.length / 3;
  }
}

export class FacetBuffer {
  pos: number[] = [];
  rgba: number[] = [];
  add(a: readonly number[], b: readonly number[], c: readonly number[], col: RGB, alpha: number) {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.rgba.push(col[0], col[1], col[2], alpha);
  }
}

export type LayerSet = {
  points: PointBuffer;
  lines: LineBuffer;
  /** wider lines drawn in their own pass (rung bars, glows) */
  bars: { width: number; lines: LineBuffer }[];
  facets: FacetBuffer;
};

const newLayer = (): LayerSet => ({
  points: new PointBuffer(),
  lines: new LineBuffer(),
  bars: [],
  facets: new FacetBuffer(),
});

const r = (rng: Rng, range: Range) => rng.range(range[0], range[1]);

const jitterColor = (rng: Rng, c: RGB, amt: number): RGB => {
  const k = 1 + (rng.next() - 0.5) * amt;
  return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
};

/** k-nearest-neighbour plexus over a node set (brute force, build-time only). */
const plexus = (
  nodes: number[][],
  k: number,
  maxDist: number,
  rng: Rng,
  facetChance: number,
) => {
  const n = nodes.length;
  const max2 = maxDist * maxDist;
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    const cand: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const b = nodes[j];
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < max2) cand.push([d2, j]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    for (let c = 0; c < Math.min(k, cand.length); c++) {
      const j = cand[c][1];
      if (!adj[i].has(j)) {
        adj[i].add(j);
        adj[j].add(i);
        edges.push([Math.min(i, j), Math.max(i, j)]);
      }
    }
  }
  const tris: [number, number, number][] = [];
  if (facetChance > 0) {
    for (const [i, j] of edges) {
      for (const m of adj[i]) {
        if (m > j && adj[j].has(m) && rng.next() < facetChance) tris.push([i, j, m]);
      }
    }
  }
  return { edges, tris };
};

export const helixPoint = (h: HelixStyle, y: number, strand: number) => {
  const th = (2 * Math.PI * y) / h.pitch + strand * h.strandOffset;
  return [h.radius * Math.cos(th), y, h.radius * Math.sin(th)];
};

/** Builds the DNA in helix-local space (axis = +Y). */
export const buildHelix = (h: HelixStyle, seed: number): LayerSet => {
  const rng = createRng(seed);
  const L = newLayer();
  const span = h.yMax - h.yMin;

  // --- backbone particle clouds
  for (let s = 0; s < 2; s++) {
    const n = Math.round(h.strand.density * span);
    for (let i = 0; i < n; i++) {
      const y = h.yMin + rng.next() * span;
      const p = helixPoint(h, y, s);
      const j = h.strand.jitter;
      const q = [p[0] + rng.gauss() * j, p[1] + rng.gauss() * j, p[2] + rng.gauss() * j];
      if (rng.next() < h.strand.sparkleChance) {
        L.points.add(q, h.strand.sparkleColor, r(rng, h.strand.sparkleSize), 1, 0, rng.next());
      } else {
        L.points.add(
          q,
          jitterColor(rng, rng.pick(h.strand.colors), 0.25),
          r(rng, h.strand.size),
          r(rng, h.strand.alpha),
          h.strand.ringDots ? 4 : 0,
          rng.next(),
        );
      }
    }
  }

  // --- rungs (base pairs)
  const rungStep = h.pitch / h.rungsPerTurn;
  const first = Math.ceil(h.yMin / rungStep);
  const last = Math.floor(h.yMax / rungStep);
  const rungEnds: [number[], number[]][] = [];
  const bar = h.rung.bar;
  const barCore = new LineBuffer();
  const barGlow = new LineBuffer();
  for (let k = first; k <= last; k++) {
    const y = k * rungStep + rungStep * 0.5;
    if (y > h.yMax) continue;
    const a = helixPoint(h, y, 0);
    const b = helixPoint(h, y, 1);
    rungEnds.push([a, b]);
    const lerp = (t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    const rungAxis = h.rung.edgeFade ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len] : [0, 0, 0];
    const inset = h.rung.inset;
    for (let i = 0; i < h.rung.count; i++) {
      const t = inset + rng.next() * (1 - 2 * inset);
      const p = lerp(t);
      const j = h.rung.jitter;
      const c = t < 0.5 ? h.rung.colorA : h.rung.colorB;
      L.points.add(
        [p[0] + rng.gauss() * j, p[1] + rng.gauss() * j, p[2] + rng.gauss() * j],
        jitterColor(rng, c, 0.3),
        r(rng, h.rung.size),
        r(rng, h.rung.alpha),
        h.rung.ringDots ? 4 : 0,
        rng.next(),
        rungAxis,
      );
    }
    if (bar) {
      const pa = lerp(inset * 0.6);
      const pb = lerp(1 - inset * 0.6);
      // Slightly broken core: 3-5 segments with small gaps, like the reference
      const segs = bar.continuous ? 1 : 3 + Math.floor(rng.next() * 3);
      for (let s = 0; s < segs; s++) {
        const t0 = bar.continuous ? 0 : s / segs + rng.range(0, 0.03);
        const t1 = bar.continuous ? 1 : (s + 1) / segs - rng.range(0, 0.04);
        const A = [pa[0] + (pb[0] - pa[0]) * t0, pa[1] + (pb[1] - pa[1]) * t0, pa[2] + (pb[2] - pa[2]) * t0];
        const B = [pa[0] + (pb[0] - pa[0]) * t1, pa[1] + (pb[1] - pa[1]) * t1, pa[2] + (pb[2] - pa[2]) * t1];
        barCore.add(A, B, bar.color, bar.alpha * rng.range(0.7, 1.1));
        barGlow.add(A, B, bar.color, bar.glowAlpha);
      }
    }
    const hot = h.rung.hot;
    if (hot) {
      const clusters = Math.round(r(rng, hot.clusters));
      for (let c = 0; c < clusters; c++) {
        const tc = rng.pick([inset + 0.04, 0.5, 1 - inset - 0.04, rng.range(0.2, 0.8)]);
        const len = rng.range(0.03, hot.spread);
        for (let i = 0; i < hot.count; i++) {
          const t = tc + (rng.next() - 0.5) * len;
          const p = lerp(t);
          const j = h.rung.jitter * 0.6;
          L.points.add(
            [p[0] + rng.gauss() * j, p[1] + rng.gauss() * j, p[2] + rng.gauss() * j],
            jitterColor(rng, hot.color, 0.2),
            r(rng, hot.size),
            r(rng, hot.alpha),
            0,
            rng.next(),
          );
        }
      }
    }
  }
  if (bar) {
    L.bars.push({ width: bar.glowWidth, lines: barGlow });
    L.bars.push({ width: bar.width, lines: barCore });
  }

  // --- plexus shell
  const px = h.plexus;
  const nodes: number[][] = [];
  for (let s = 0; s < 2; s++) {
    const n = Math.round(px.nodesPerUnit * span);
    for (let i = 0; i < n; i++) {
      const y = h.yMin + rng.next() * span;
      const p = helixPoint(h, y, s);
      const j = px.jitter * (0.4 + rng.next() * 0.9);
      nodes.push([p[0] + rng.gauss() * j, p[1] + rng.gauss() * j, p[2] + rng.gauss() * j]);
    }
  }
  for (const [a, b] of rungEnds) {
    for (let i = 0; i < px.rungNodes; i++) {
      const t = rng.next();
      const j = px.rungJitter;
      nodes.push([
        a[0] + (b[0] - a[0]) * t + rng.gauss() * j,
        a[1] + (b[1] - a[1]) * t + rng.gauss() * j,
        a[2] + (b[2] - a[2]) * t + rng.gauss() * j,
      ]);
    }
  }
  const { edges, tris } = plexus(nodes, px.k, px.maxDist, rng, px.facetChance);
  for (const [i, j] of edges) {
    L.lines.add(nodes[i], nodes[j], jitterColor(rng, px.color, 0.3), px.alpha * rng.range(0.5, 1.2));
  }
  for (const [i, j, m] of tris) {
    L.facets.add(nodes[i], nodes[j], nodes[m], px.facetColor, px.facetAlpha * rng.range(0.4, 1.3));
  }
  for (const nd of nodes) {
    L.points.add(nd, px.nodeColor, r(rng, px.nodeSize), px.nodeAlpha * rng.range(0.5, 1.2), 0, rng.next());
  }
  if (px.haze) {
    const hz = px.haze;
    for (let s = 0; s < 2; s++) {
      const n = Math.round(hz.perUnit * span);
      for (let i = 0; i < n; i++) {
        const p = helixPoint(h, h.yMin + rng.next() * span, s);
        const j = hz.jitter;
        L.points.add([p[0] + rng.gauss() * j, p[1] + rng.gauss() * j, p[2] + rng.gauss() * j], hz.color, r(rng, hz.size), hz.alpha * rng.range(0.5, 1.2), 3, rng.next());
      }
    }
    for (const [a, b] of rungEnds) {
      for (let i = 0; i < hz.perRung; i++) {
        const t = rng.next();
        const j = hz.jitter * 0.6;
        L.points.add(
          [a[0] + (b[0] - a[0]) * t + rng.gauss() * j, a[1] + (b[1] - a[1]) * t + rng.gauss() * j, a[2] + (b[2] - a[2]) * t + rng.gauss() * j],
          hz.color,
          r(rng, hz.size),
          hz.alpha * rng.range(0.5, 1.2),
          3,
          rng.next(),
        );
      }
    }
  }
  if (px.stray) {
    const st = px.stray;
    const stray = new LineBuffer();
    for (let i = 0; i < st.count; i++) {
      const a = nodes[Math.floor(rng.next() * nodes.length)];
      // find a far-ish partner
      for (let tries = 0; tries < 20; tries++) {
        const b = nodes[Math.floor(rng.next() * nodes.length)];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d > st.maxDist * 0.4 && d < st.maxDist) {
          stray.add(a, b, st.color, st.alpha * rng.range(0.4, 1));
          break;
        }
      }
    }
    L.bars.unshift({ width: st.width, lines: stray });
  }
  return L;
};

/** Background plexus + dust, in world space. */
export const buildField = (f: FieldStyle, seed: number): LayerSet => {
  const rng = createRng(seed);
  const L = newLayer();
  const nodes: number[][] = [];
  const clear = f.clearRadius ?? 0;
  const inBox = (box: FieldStyle["box"]) => {
    for (let tries = 0; tries < 50; tries++) {
      const p = [r(rng, box.x), r(rng, box.y), r(rng, box.z)];
      if (Math.hypot(p[0], p[2]) >= clear) return p;
    }
    return [r(rng, box.x), r(rng, box.y), r(rng, box.z)];
  };
  for (let i = 0; i < f.nodes; i++) nodes.push(inBox(f.box));
  const { edges, tris } = plexus(nodes, f.k, f.maxDist, rng, f.facetChance);
  for (const [i, j] of edges) {
    L.lines.add(nodes[i], nodes[j], f.lineColor, f.lineAlpha * rng.range(0.4, 1.2));
  }
  for (const [i, j, m] of tris) {
    L.facets.add(nodes[i], nodes[j], nodes[m], f.lineColor, f.facetAlpha * rng.range(0.4, 1.2));
  }
  for (const nd of nodes) {
    L.points.add(nd, f.nodeColor, r(rng, f.nodeSize), f.nodeAlpha * rng.range(0.6, 1.1), f.nodeKind, rng.next());
  }
  for (let i = 0; i < f.dust; i++) {
    L.points.add(
      inBox(f.dustBox),
      jitterColor(rng, rng.pick(f.dustColors), 0.3),
      r(rng, f.dustSize),
      r(rng, f.dustAlpha),
      1,
      rng.next(),
    );
  }
  return L;
};
