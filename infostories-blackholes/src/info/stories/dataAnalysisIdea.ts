import { Group, Mesh, Shape, Vector2, type Object3D } from "three";
import { easeInOutCubic, easeOutBack, easeOutCubic, lerp, pop, ramp } from "../../lib/anim";
import { mulberry32 } from "../../lib/random";
import { PAL, lineMesh, makeLabel, rectMesh, rectPts, shapeMesh } from "../kit";
import type { StoryBuilder } from "../pipeline";

/** 1A — Data -> Analysis -> Idea (450 frames). Layout in layer units (frame height ~5.4). */

// module-level seeded randomness: digit values, colours, loose start positions
const rng = mulberry32(512128386);
const DIGITS = Array.from({ length: 25 }, (_, i) => ({
  value: rng() < 0.5 ? "0" : "1",
  cyan: rng() < 0.55,
  start: [(rng() - 0.5) * 1.9, (rng() - 0.5) * 1.9, (rng() - 0.5) * 2.2] as const,
  phase: rng() * Math.PI * 2,
  delay: i * 0.7 + rng() * 6,
}));

// 13 uneven wedge rays over the upper ~150 degrees (above the arrow), slightly asymmetric
const RAYS = Array.from({ length: 13 }, (_, i) => ({
  deg: 15 + i * (150 / 12) + (rng() - 0.5) * 6,
  len: 0.12 + rng() * 0.3,
  rad: 0.9 + rng() * 0.32,
}));

const LABEL_Y = -1.45;
// Equal gaps between the three icons, each arrow centred in its gap.
// Icon bodies (x extents about their centre): data page stack [-0.65, +0.91],
// chart axes [-0.8, +0.9], bulb glass [-0.62, +0.62].
// The layer is turned with its right side nearer the camera, so the second gap is
// narrower in world units to read the same width on screen.
const GAP1 = 1.6, GAP2 = 1.2;
const X_DATA = -2.95;
const X_A1 = X_DATA + 0.91 + GAP1 / 2;
const X_CHART = X_DATA + 0.91 + GAP1 + 0.8;
const X_A2 = X_CHART + 0.9 + GAP2 / 2;
const X_BULB = X_CHART + 0.9 + GAP2 + 0.62;

const order = <T extends Object3D>(o: T, r: number): T => {
  o.renderOrder = r;
  return o;
};

export const dataAnalysisIdea: StoryBuilder = ({ anisotropy }) => {
  const root = new Group();
  root.scale.setScalar(0.88);
  root.position.y = 0.1;
  const content = new Group();
  root.add(content);

  // ---------------- Data: digits -> grid, page frame, stacked copies -------
  const data = new Group();
  data.position.x = X_DATA;
  content.add(data);
  const PW = 1.3, PH = 1.66;
  const backs = [PAL.violet, PAL.cyan].map((c, i) => {
    const g = new Group();
    const fill = rectMesh(PW, PH, "#16166A", 0.85);
    const edge = lineMesh(rectPts(PW, PH), 0.032, c, true, 1.1);
    g.add(order(fill, 1 + (1 - i) * 2), order(edge, 2 + (1 - i) * 2));
    data.add(g);
    return { g, fill, edge };
  });
  const pageFill = order(rectMesh(PW, PH, "#121258", 0.9), 6);
  const pageEdge = order(lineMesh(rectPts(PW, PH), 0.036, PAL.white, true, 1.15), 7);
  data.add(pageFill, pageEdge);

  const digitLabels = {
    "0": makeLabel("0", { family: "Inter", weight: 400, px: 200, em: 0.3, align: "center", anisotropy, glow: 0.35 }),
    "1": makeLabel("1", { family: "Inter", weight: 400, px: 200, em: 0.3, align: "center", anisotropy, glow: 0.35 }),
  };
  const digits = DIGITS.map((d, i) => {
    const src = digitLabels[d.value as "0" | "1"];
    const m = new Mesh(src.mesh.geometry, src.mesh.material.clone());
    m.material.uniforms.uColor.value.set(d.cyan ? PAL.cyan : PAL.violet);
    m.material.uniforms.uGain.value = 1.15;
    order(m, 8);
    data.add(m);
    const c = i % 5, r = Math.floor(i / 5);
    return { m, d, grid: [(c - 2) * 0.215, (2 - r) * 0.28 + 0.0] as const };
  });
  const lData = makeLabel("Data", { em: 0.66, align: "center", anisotropy, glow: 0.18, color: "#E4E2FA" });
  lData.mesh.position.set(0, LABEL_Y, 0);
  data.add(order(lData.mesh, 10));

  // ---------------- arrows -------------------------------------------------
  const arrowShape = () => {
    const s = new Shape();
    s.moveTo(-0.26, 0.31);
    s.lineTo(0.3, 0);
    s.lineTo(-0.26, -0.31);
    s.lineTo(-0.12, 0);
    s.lineTo(-0.26, 0.31);
    return s;
  };
  const arrows = [X_A1, X_A2].map((x) => {
    const g = new Group();
    g.position.set(x, 0.0, 0);
    const outer = shapeMesh(arrowShape(), PAL.violet, 0.95);
    outer.scale.setScalar(1.14);
    outer.position.x = -0.015;
    const m = shapeMesh(arrowShape(), PAL.white, 1);
    const inner = shapeMesh(arrowShape(), PAL.cyan, 1);
    inner.scale.setScalar(0.55);
    inner.position.x = -0.03;
    g.add(order(outer, 8), order(m, 9), order(inner, 10));
    content.add(g);
    return g;
  });

  // ---------------- Analysis: bar chart ----------------------------------
  const chart = new Group();
  chart.position.x = X_CHART;
  content.add(chart);
  const axes = lineMesh(
    [new Vector2(-0.8, 0.9), new Vector2(-0.8, -0.78), new Vector2(0.9, -0.78)],
    0.04,
    PAL.white,
    false,
    1.15,
  );
  chart.add(order(axes, 9));
  const HEIGHTS = [0.42, 0.66, 0.6, 0.98, 0.9, 1.5];
  const bars = HEIGHTS.map((h, i) => {
    const m = rectMesh(0.2, 1, i % 2 === 0 ? PAL.violet : PAL.cyan, 0.95);
    m.material.uniforms.uGain.value = 1.1;
    m.geometry.translate(0, 0.5, 0);
    m.position.set(-0.56 + i * 0.255, -0.74, 0);
    chart.add(order(m, 8));
    return { m, h };
  });
  const lAnalysis = makeLabel("Analysis", { em: 0.66, align: "center", anisotropy, glow: 0.18, color: "#E4E2FA" });
  lAnalysis.mesh.position.set(0.05, LABEL_Y, 0);
  chart.add(order(lAnalysis.mesh, 10));

  // ---------------- Idea: light bulb with rays -----------------------------
  const bulb = new Group();
  bulb.position.x = X_BULB;
  content.add(bulb);
  const BY = 0.38; // glass centre
  const glass = new Shape();
  {
    const R = 0.62;
    const a0 = Math.asin(0.3 / R);
    // neck left -> around the top -> neck right -> down
    glass.moveTo(-0.27, -0.48);
    glass.bezierCurveTo(-0.3, -0.3, -0.44, -0.18, -R * Math.cos(-a0) * 0.98, BY - 0.38);
    glass.absarc(0, BY, R, Math.PI + 0.66, -0.66, true);
    glass.bezierCurveTo(0.44, -0.18, 0.3, -0.3, 0.27, -0.48);
    glass.lineTo(-0.27, -0.48);
  }
  const glassPts = glass.getSpacedPoints(220).map((p) => new Vector2(p.x, p.y));
  const bulbFill = order(shapeMesh(glass, PAL.white, 1, 96), 8);
  bulbFill.material.uniforms.uGain.value = 1.05;
  const bulbEdge = order(lineMesh(glassPts, 0.04, PAL.white, true, 1.2), 9);
  bulb.add(bulbFill, bulbEdge);
  const baseBars = [0, 1, 2].map((k) => {
    const w = 0.56 - k * 0.04;
    const s = new Shape();
    const y = -0.6 - k * 0.135, hh = 0.05, r = 0.05;
    s.moveTo(-w / 2 + r, y + hh);
    s.lineTo(w / 2 - r, y + hh);
    s.absarc(w / 2 - r, y, hh, Math.PI / 2, -Math.PI / 2, true);
    s.lineTo(-w / 2 + r, y - hh);
    s.absarc(-w / 2 + r, y, hh, -Math.PI / 2, Math.PI / 2, true);
    const m = order(shapeMesh(s, PAL.cyan, 1, 24), 9);
    m.material.uniforms.uGain.value = 1.1;
    bulb.add(m);
    return m;
  });
  const tip = new Shape();
  tip.moveTo(-0.17, -1.0);
  tip.lineTo(0.17, -1.0);
  tip.lineTo(0.08, -1.1);
  tip.lineTo(-0.08, -1.1);
  const tipMesh = order(shapeMesh(tip, PAL.violet, 1), 9);
  bulb.add(tipMesh);
  const rays = RAYS.map(({ deg, len, rad }, i) => {
    const a = (deg * Math.PI) / 180;
    const s = new Shape();
    const L = len;
    s.moveTo(-0.035, 0);
    s.lineTo(0.035, 0);
    s.lineTo(0, L);
    s.lineTo(-0.035, 0);
    const pivot = new Group();
    pivot.position.set(0, BY, 0);
    pivot.rotation.z = a - Math.PI / 2;
    const m = shapeMesh(s, PAL.white, 1);
    m.material.uniforms.uGain.value = 1.25;
    const holder = new Group();
    holder.add(order(m, 9));
    pivot.add(holder);
    bulb.add(pivot);
    return { holder, m, i };
  });
  const lIdea = makeLabel("Idea", { em: 0.66, align: "center", anisotropy, glow: 0.18, color: "#E4E2FA" });
  lIdea.mesh.position.set(0, LABEL_Y, 0);
  bulb.add(order(lIdea.mesh, 10));

  const update = (f: number) => {
    // group slides: Data centred -> Data+chart -> all three
    const s1 = easeInOutCubic(ramp(f, 72, 98));
    const s2 = easeInOutCubic(ramp(f, 162, 190));
    content.position.x = lerp(lerp(-X_DATA, -(X_DATA + X_CHART) / 2 - 0.15, s1), -(X_DATA + X_BULB) / 2 + 0.1, s2);

    // digits float loosely then snap to the 5x5 grid
    for (const { m, d, grid } of digits) {
      const appear = easeOutCubic(ramp(f, d.delay * 0.5, d.delay * 0.5 + 10));
      const snap = easeInOutCubic(ramp(f, 26 + d.delay * 0.6, 50 + d.delay * 0.6));
      const fl = 1 - snap;
      const fx = d.start[0] + 0.08 * Math.sin(f * 0.06 + d.phase);
      const fy = d.start[1] + 0.08 * Math.cos(f * 0.05 + d.phase);
      m.position.set(lerp(fx, grid[0], snap), lerp(fy, grid[1], snap), d.start[2] * fl);
      m.rotation.z = 0.5 * Math.sin(d.phase) * fl;
      m.material.uniforms.uOpacity.value = appear;
    }
    const frameDraw = easeInOutCubic(ramp(f, 44, 64));
    pageEdge.material.uniforms.uDraw.value = frameDraw;
    pageEdge.material.uniforms.uOpacity.value = ramp(f, 44, 46);
    pageFill.material.uniforms.uOpacity.value = 0.88 * ramp(f, 52, 66);
    backs.forEach((b, i) => {
      const t = easeOutCubic(ramp(f, 58 + i * 5, 76 + i * 5));
      const off = 0.13 * (i + 1) * t;
      b.g.position.set(off, off, 0);
      b.fill.material.uniforms.uOpacity.value = 0.85 * ramp(f, 58 + i * 5, 64 + i * 5);
      b.edge.material.uniforms.uOpacity.value = ramp(f, 58 + i * 5, 64 + i * 5);
    });
    lData.typeOn(f, 60);

    // arrows pop
    arrows.forEach((a, i) => {
      const p = pop(f, i === 0 ? 82 : 176, 12);
      a.scale.setScalar(Math.max(p, 1e-4));
    });

    // chart: axes draw, then bars grow (alternating violet / cyan)
    axes.material.uniforms.uDraw.value = easeInOutCubic(ramp(f, 90, 110));
    axes.material.uniforms.uOpacity.value = ramp(f, 90, 92);
    bars.forEach(({ m, h }, i) => {
      const g = easeOutCubic(ramp(f, 104 + i * 5, 124 + i * 5));
      m.scale.y = Math.max(h * g, 1e-4);
      m.material.uniforms.uOpacity.value = 0.95 * ramp(f, 104 + i * 5, 107 + i * 5);
    });
    lAnalysis.typeOn(f, 122);

    // bulb: outline draws, fills white with cyan base, rays burst
    bulbEdge.material.uniforms.uDraw.value = easeInOutCubic(ramp(f, 188, 216));
    bulbEdge.material.uniforms.uOpacity.value = ramp(f, 188, 190);
    const fillT = easeOutCubic(ramp(f, 214, 228));
    bulbFill.material.uniforms.uOpacity.value = fillT;
    baseBars.forEach((b, k) => (b.material.uniforms.uOpacity.value = easeOutCubic(ramp(f, 206 + k * 4, 214 + k * 4))));
    tipMesh.material.uniforms.uOpacity.value = easeOutCubic(ramp(f, 218, 226));
    for (const r of rays) {
      const t = ramp(f, 228 + (r.i % 3), 244 + (r.i % 3));
      const burst = easeOutBack(t);
      const pulse = f > 270 ? 0.06 * Math.sin(((f - 270) / 45) * Math.PI * 2 + r.i * 0.6) : 0;
      r.holder.position.y = RAYS[r.i].rad * (0.75 + 0.25 * burst) + pulse * 1.5;
      r.holder.scale.setScalar(Math.max(1e-4, Math.min(1.2, burst) * (1 + pulse)));
      r.m.material.uniforms.uOpacity.value = ramp(f, 228, 232) * (0.9 + pulse);
    }
    lIdea.typeOn(f, 240);
  };

  return { group: root, update };
};
