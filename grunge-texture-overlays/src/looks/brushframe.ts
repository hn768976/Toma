import * as brush from "p5.brush/standalone";
import { chance, gauss, int, range, type Rng } from "../lib/rng";
import { customWeight } from "./brushes";
import { CHARCOAL_GLSL, charcoalUniforms, paintCharcoalMarks } from "./charcoal";
import { curlyHair, grainyStreak } from "./draw";
import { X, Y, type Frame, type LookDef } from "./types";

/** Is a frame position in the border band (outside the clean centre)? */
const inBorder = (fx: number, fy: number) => Math.abs(fx - 0.5) > 0.4 || Math.abs(fy - 0.5) > 0.35;

/** Coverage as a CSS grey (1 = black). */
const covGrey = (c: number) => {
  const h = Math.round(255 * (1 - Math.max(0, Math.min(1, c)))).toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
};

/**
 * One wide ink-wash stroke along a slightly wavy centre line, painted as coverage: many overlapping
 * bristles merge into one band with fine streaks along it (dry brush), more broken at the edges,
 * with soft, uneven ends. Tone is applied in the card shader.
 */
const inkStroke = (F: Frame, r: Rng, horizontal: boolean, centre: number, thickness: number) => {
  const n = 9;
  const amp = range(r, 0.05, 0.15) * thickness;
  const ph = range(r, 0, Math.PI * 2);
  const freq = range(r, 0.4, 1.2);
  const start = range(r, -0.08, -0.03);
  const end = range(r, 1.03, 1.08);
  const line: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + ((end - start) * i) / n;
    const off = amp * Math.sin(ph + t * Math.PI * 2 * freq) + gauss(r) * thickness * 0.03;
    line.push(horizontal ? [X(F, t), Y(F, centre) + off] : [X(F, centre) + off, Y(F, t)]);
  }
  const normal = (i: number): [number, number] => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  const widthAt = line.map(() => thickness * range(r, 0.88, 1.1));
  const bristles = 40;
  for (let b = 0; b < bristles; b++) {
    const across = (b + 0.5) / bristles - 0.5 + gauss(r) * 0.008;
    const edge = Math.abs(across) * 2;
    const s0 = Math.max(0, range(r, -0.02, 0.05) + edge * range(r, 0, 0.07));
    const s1 = Math.min(1, 1 - range(r, -0.02, 0.05) - edge * range(r, 0, 0.08));
    const pieces: [number, number][] = [];
    if (chance(r, 0.08 + edge * edge * 0.5)) {
      const cut = range(r, s0 + 0.15, s1 - 0.15);
      const gap = range(r, 0.01, 0.06);
      pieces.push([s0, cut - gap / 2], [cut + gap / 2, s1]);
    } else pieces.push([s0, s1]);
    // streaks: most bristles near full coverage, some lighter
    const c = chance(r, 0.2) ? range(r, 0.7, 0.88) : range(r, 0.88, 1);
    brush.set("inkBristle", covGrey(c), customWeight(F.H, (thickness / bristles) * range(r, 2.8, 3.8)));
    for (const [a, z] of pieces) {
      if (z - a < 0.05) continue;
      const pts: [number, number, number][] = [];
      const m = 10;
      for (let k = 0; k <= m; k++) {
        const t = (a + ((z - a) * k) / m) * n;
        const i0 = Math.min(n - 1, Math.floor(t));
        const ft = t - i0;
        const cx = line[i0][0] + (line[i0 + 1][0] - line[i0][0]) * ft;
        const cy = line[i0][1] + (line[i0 + 1][1] - line[i0][1]) * ft;
        const [nx, ny] = normal(Math.round(t));
        const w = widthAt[Math.round(t)];
        const press = Math.min(1, Math.sin((Math.PI * k) / m) * 2.5 + 0.3);
        pts.push([cx + nx * across * w, cy + ny * across * w, press]);
      }
      brush.spline(pts, 0.5);
    }
  }
};

/** 7–8 · Brush Frame: a loose rectangle of wide ink-wash strokes over faint charcoal; the centre stays clean. */
export const brushFrameLook: LookDef = {
  id: "BrushFrame",
  brushLayers: 4,
  clearCentre: true,
  schedule: { window: 4, exposureJumps: false, persistArea: "border" },

  cardUniforms: (r, density) => {
    const [a, b] = charcoalUniforms(r, density * 0.7);
    a[3] *= 0.75; // fainter coverage
    // per-card stroke layout (shared by the brush layers): jitter of each stroke's centre, thickness,
    // whether the extra side strokes exist
    return {
      p: [
        a,
        b,
        [range(r, -0.015, 0.015), range(r, -0.015, 0.015), range(r, -0.015, 0.015), range(r, -0.015, 0.015)],
        [chance(r, 0.9) ? range(r, 0.0, 0.03) : -1, chance(r, 0.9) ? range(r, 0.0, 0.03) : -1, range(r, 0.92, 1.08), range(r, 0.92, 1.06)],
      ],
    };
  },

  shader: /* glsl */ `
${CHARCOAL_GLSL}
float lookInk(vec2 P, vec2 F) {
  // the charcoal texture, faint and mostly in the border band
  vec2 cd = abs(F - 0.5) - vec2(0.33, 0.27);
  float border = smoothstep(0.0, 0.08, max(cd.x, cd.y * 1.25));
  float dust = specks(P, 0.03, 0.5, 0.0006, 0.003, uPx, uSeed + 60);
  return 1.0 - (1.0 - charcoalInk(P, uP[0], uP[1]) * mix(0.1, 1.0, border) * 0.9) * (1.0 - dust * border * 0.9);
}
// layers: x = top/bottom strokes, y = side strokes, z = extra side strokes, w = charcoal marks.
// Each stroke is up to 70% opaque; where strokes cross they multiply (darker).
float brushInk(vec4 c, vec2 P) {
  // ink-wash variation: slow density changes along the stroke + fine dry-brush streaks along it
  float washH = 0.85 + 0.3 * fbm(vec2(P.x * 2.2, P.y * 7.0), uSeed + 50, 5);
  float washV = 0.85 + 0.3 * fbm(vec2(P.x * 7.0, P.y * 2.2), uSeed + 51, 5);
  float strH = 0.84 + 0.16 * vnoise(vec2(P.x * 3.0, P.y * 90.0), uSeed + 52);
  float strV = 0.84 + 0.16 * vnoise(vec2(P.x * 90.0, P.y * 3.0), uSeed + 53);
  float g = grain3(P, uSeed + 54);
  float h = min(0.7, 0.86 * c.x * washH * strH * mix(0.82, 1.0, g));
  float v = min(0.7, 0.86 * c.y * washV * strV * mix(0.82, 1.0, g));
  float v2 = min(0.7, 0.86 * c.z * washV * strV);
  float ch = 0.55 * c.w * mix(0.45, 1.0, g);
  return 1.0 - (1.0 - h) * (1.0 - v) * (1.0 - v2) * (1.0 - ch);
}
`,

  paintBrush: (F, r, cu, density, layer) => {
    const [jt, jb, jl, jr] = cu.p[2];
    const [extraL, extraR, tH, tV] = cu.p[3];
    if (layer === 0) {
      inkStroke(F, r, true, 0.055 + jt * 0.6, 0.135 * F.H * tH);
      inkStroke(F, r, true, 0.945 + jb * 0.6, 0.135 * F.H * tH * range(r, 0.93, 1.04));
    } else if (layer === 1) {
      inkStroke(F, r, false, 0.05 + jl * 0.5, 0.085 * F.W * tV);
      inkStroke(F, r, false, 0.95 + jr * 0.5, 0.085 * F.W * tV * range(r, 0.93, 1.04));
    } else if (layer === 2) {
      if (extraL >= 0) inkStroke(F, r, false, 0.018 + extraL * 0.5, 0.045 * F.W * range(r, 0.85, 1.1));
      if (extraR >= 0) inkStroke(F, r, false, 0.982 - extraR * 0.5, 0.045 * F.W * range(r, 0.85, 1.1));
    } else {
      // faint charcoal marks under the frame, border only
      paintCharcoalMarks(F, r, cu.p[0][0] * 0.6 * density, 0.8, inBorder);
    }
  },

  drawLines: (ctx, F, r) => {
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    // hairs on the bars and in the ring just outside the clean centre
    const n = int(r, 3, 7);
    for (let i = 0; i < n; i++) {
      const side = int(r, 0, 3);
      const fx = side === 0 ? range(r, 0, 0.11) : side === 1 ? range(r, 0.89, 1) : range(r, 0.05, 0.95);
      const fy = side === 2 ? range(r, 0, 0.15) : side === 3 ? range(r, 0.85, 1) : range(r, 0.05, 0.95);
      curlyHair(ctx, r, F, X(F, fx), Y(F, fy), range(r, 0.025, 0.08) * F.H, 0.12, range(r, 0.7, 1.3) * F.u, range(r, 0.6, 0.95));
    }
  },

  drawPersist: (ctx, F, ev, r) => {
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    const len = range(r, 0.1, 0.3) * F.H;
    grainyStreak(ctx, r, X(F, ev.x), Y(F, ev.y) - len / 2, Math.PI / 2 + gauss(r) * 0.05, len, range(r, 6, 18) * F.u, range(r, 0.25, 0.45), F.u);
  },

  stain: (r) => [range(r, 0.06, 0.12), range(r, 0.1, 0.2), 0.85, 0.5],
};
