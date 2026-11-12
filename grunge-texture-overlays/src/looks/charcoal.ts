import * as brush from "p5.brush/standalone";
import { BLEED } from "../settings";
import { chance, gauss, int, pick, range, type Rng } from "../lib/rng";
import { curlyHair, flick, grainyStreak } from "./draw";
import { X, Y, type Frame, type LookDef, type Vec4 } from "./types";

/** CSS grey for an ink amount (0 = paper white, 1 = black). */
export const inkGrey = (ink: number) => {
  const v = Math.round(255 * (1 - Math.max(0, Math.min(1, ink))));
  const h = v.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
};

/** p5.brush weight for a stroke width in px (built-in brushes are scaled to F.H/360). */
export const brushWeight = (F: Frame, px: number) => px / (F.u * 10.4);

/**
 * Charcoal and pencil strokes with p5.brush: heavy short strokes at the top/bottom edge, faint long
 * vertical streaks and a few pencil flicks. `area` limits where marks go (for the brush frame's border).
 */
export const paintCharcoalMarks = (F: Frame, r: Rng, dens: number, strength: number, area: (fx: number, fy: number) => boolean) => {
  const tryPos = (gen: () => [number, number]) => {
    for (let k = 0; k < 20; k++) {
      const p = gen();
      if (area(p[0], p[1])) return p;
    }
    return null;
  };
  // heavy, short charcoal-stick strokes from the top or bottom edge (striated: several lines side by side)
  const stick = (x: number, y0: number, y1: number, width: number, ink: number) => {
    const lines = Math.max(3, Math.round(width / (9 * F.u)));
    const dx = gauss(r) * 0.012 * F.H;
    for (let k = 0; k < lines; k++) {
      const o = (k / (lines - 1) - 0.5) * width + gauss(r) * F.u;
      const e = Math.abs(k / (lines - 1) - 0.5) * 2;
      const cut = range(r, 0, 0.3) * (y1 - y0) * (0.4 + e);
      brush.set(chance(r, 0.8) ? "charcoal" : "2B", inkGrey(ink * range(r, 0.7, 1) * (1 - e * 0.35)), brushWeight(F, (width / lines) * range(r, 2.2, 3.0)));
      // wobbly spline, so the stick's edges are ragged
      const ye = y1 - cut;
      const pts: [number, number, number][] = [];
      for (let m = 0; m <= 8; m++) {
        const t = m / 8;
        pts.push([x + o + dx * t + gauss(r) * (width / lines) * 0.35, y0 + (ye - y0) * t, range(r, 0.6, 1)]);
      }
      brush.spline(pts, 0.5);
    }
  };
  const nHeavy = Math.round(range(r, 1, 3) + 4 * dens);
  for (let i = 0; i < nHeavy; i++) {
    const top = chance(r, 0.5);
    const p = tryPos(() => [range(r, -0.02, 1.02), top ? 0 : 1]);
    if (!p) continue;
    const len = range(r, 0.06, 0.32) * F.H;
    const y0 = top ? Y(F, -BLEED) : Y(F, 1 + BLEED);
    const y1 = top ? Y(F, 0) + len : Y(F, 1) - len;
    stick(X(F, p[0]), y0, y1, range(r, 22, 70) * F.u, strength * range(r, 0.85, 1));
  }
  // a few long, faint, grainy vertical columns
  const nLong = Math.round(range(r, 1, 2.5) + 2 * dens);
  for (let i = 0; i < nLong; i++) {
    const fromTop = chance(r, 0.5);
    const p = tryPos(() => [range(r, -0.02, 1.02), fromTop ? 0 : 1]);
    if (!p) continue;
    const len = range(r, 0.35, 1.1) * F.H;
    const x = X(F, p[0]);
    const y0 = fromTop ? Y(F, -BLEED) : Y(F, 1 + BLEED) - len;
    stick(x, y0, y0 + len, range(r, 18, 50) * F.u, strength * range(r, 0.35, 0.65));
  }
  // full-height grungy strip hugging the left or right edge on some cards
  if (chance(r, 0.5 * Math.min(1, dens + 0.3))) {
    const left = chance(r, 0.5);
    const p = tryPos(() => [left ? range(r, -0.005, 0.025) : range(r, 0.975, 1.005), 0.5]);
    if (p) stick(X(F, p[0]), Y(F, -BLEED), Y(F, 1 + BLEED), range(r, 25, 60) * F.u, strength * range(r, 0.6, 0.9));
  }
  // pencil flicks
  const nFlick = int(r, 2, 7);
  for (let i = 0; i < nFlick; i++) {
    const p = tryPos(() => [range(r, 0, 1), range(r, 0, 1)]);
    if (!p) continue;
    const a = range(r, 0, Math.PI * 2);
    const len = range(r, 0.015, 0.07) * F.H;
    const x = X(F, p[0]);
    const y = Y(F, p[1]);
    brush.set(pick(r, ["HB", "2B"]), inkGrey(strength * range(r, 0.45, 0.85)), brushWeight(F, range(r, 2, 5) * F.u));
    brush.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
};

/** GLSL: rubbed diagonal charcoal smudges with paper grain, plus tiny dark specks. Params in p (vec4 x2). */
export const CHARCOAL_GLSL = /* glsl */ `
float charcoalInk(vec2 P, vec4 a, vec4 b) {
  float d = a.x;
  float ang = a.y;
  mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  vec2 q = P + b.xy;
  vec2 rq = R * q;
  // coverage: large rubbed regions, elongated along a diagonal
  float big = fbm(q * 1.3, uSeed + 1, 5);
  float diag = fbm(vec2(rq.x * 2.2, rq.y * 1.1) + 0.6 * vec2(big), uSeed + 2, 5);
  float cov = smoothstep(a.z, a.z + 0.45, 0.75 * big + 0.5 * diag);
  // vertical columns of rubbed texture
  float colN = fbm(vec2(q.x * 7.0, q.y * 0.35), uSeed + 3, 4);
  float col = smoothstep(0.3, 0.62, colN) * b.z;
  // diagonal hatching inside the rubbed areas
  float hatch = 0.5 + 0.6 * fbm(vec2(rq.x * 90.0, rq.y * 7.0), uSeed + 4, 4);
  float g = 0.55 * grain3(P, uSeed + 5) + 0.3 * vnoise(P * 700.0, uSeed + 7) + 0.15 * clamp(hatch, 0.0, 1.0);
  float c = max(cov * a.w, col * 0.7);
  float ink = c * (0.1 + 0.5 * g * g) + grit(c * 0.26, g, 0.06) * 0.3;
  // light grey grime over much of the sheet, heavier towards one side and the edges, with a soft clearing
  vec2 F2 = vec2(P.x / uAspect, P.y);
  float side = mix(1.0 - F2.x, F2.x, b.w);
  float edge = clamp(max(abs(F2.x - 0.5) * 2.0, abs(F2.y - 0.5) * 2.0), 0.0, 1.0);
  float grimeCov = smoothstep(-0.1, 0.5, fbm(q * 1.7 + 3.0, uSeed + 6, 5) + 0.5 * side + 0.35 * edge - 0.55);
  float grime = grimeCov * (0.03 + 0.17 * g * g) + grit(grimeCov * 0.12, g, 0.05) * 0.16;
  ink = 1.0 - (1.0 - ink) * (1.0 - grime);
  // tiny dark specks, mostly inside the textured areas
  float clump = clamp(fbm(q * 2.5, uSeed + 30, 3) + 0.4, 0.0, 1.0);
  float inTex = clamp(max(c, grimeCov) * 1.5, 0.08, 1.0);
  float sp = specks(P, 0.03 / sqrt(d), 0.45 * (0.3 + 0.7 * clump), 0.0006, 0.0034, uPx, uSeed + 20);
  sp = max(sp, 0.8 * specks(P, 0.008 / sqrt(d), 0.3 * clump * inTex, 0.0002, 0.0009, uPx, uSeed + 21));
  return 1.0 - (1.0 - clamp(ink, 0.0, 1.0)) * (1.0 - sp);
}
`;

export const charcoalUniforms = (r: Rng, density: number): [Vec4, Vec4] => {
  const d = Math.min(1.8, range(r, 0.5, 1.3) * density);
  const diag = (chance(r, 0.5) ? 1 : -1) * range(r, 0.55, 0.95);
  return [
    // density, hatch angle, coverage threshold, coverage strength
    [d, diag, range(r, -0.15, 0.2), range(r, 0.45, 0.75)],
    // noise offset, column strength
    [range(r, -50, 50), range(r, -50, 50), range(r, 0.3, 0.8), r() < 0.5 ? range(r, 0, 0.2) : range(r, 0.8, 1)],
  ];
};

/** 5–6 · Charcoal Grunge: charcoal/pencil streaks, rubbed smudges, specks and hairlines on paper (ink = dark). */
export const charcoalLook: LookDef = {
  id: "CharcoalGrunge",
  brushLayers: 1,
  clearCentre: false,
  schedule: { window: 4, exposureJumps: false, persistArea: "any" },

  cardUniforms: (r, density) => {
    const [a, b] = charcoalUniforms(r, density);
    return { p: [a, b, [0, 0, 0, 0], [0, 0, 0, 0]] };
  },

  shader: /* glsl */ `
${CHARCOAL_GLSL}
float lookInk(vec2 P, vec2 F) {
  return charcoalInk(P, uP[0], uP[1]);
}
// p5.brush marks, broken up by the paper tooth
float brushInk(vec4 c, vec2 P) {
  float g = grain3(P * 0.8, uSeed + 40);
  return c.x * mix(0.5, 1.0, g) * mix(1.0, smoothstep(0.15, 0.6, g + c.x * 0.5), 0.5);
}
`,

  paintBrush: (F, r, cu) => {
    paintCharcoalMarks(F, r, cu.p[0][0], 1, () => true);
  },

  drawLines: (ctx, F, r, cu) => {
    const u = F.u;
    const dens = cu.p[0][0];
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    // stray curly hairs
    const nHair = int(r, 7, 10) + Math.round(dens * 8);
    for (let i = 0; i < nHair; i++) {
      const big = chance(r, 0.35);
      curlyHair(ctx, r, F, X(F, range(r, -BLEED, 1 + BLEED)), Y(F, range(r, -BLEED, 1 + BLEED)), range(r, 0.04, big ? 0.28 : 0.11) * F.H, range(r, 0.1, 0.22), range(r, 0.9, big ? 1.9 : 1.4) * u, range(r, 0.75, 1));
    }
    // pencil flicks
    const nFlick = int(r, 2, 8);
    for (let i = 0; i < nFlick; i++) {
      flick(ctx, r, X(F, range(r, 0, 1)), Y(F, range(r, 0, 1)), range(r, 0, Math.PI * 2), range(r, 8, 40) * u, range(r, 1, 2.2) * u, range(r, 0.35, 0.75));
    }
  },

  drawPersist: (ctx, F, ev, r) => {
    // a dark charcoal streak that stays for a few cards
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    const fromEdge = chance(r, 0.6);
    const len = range(r, 0.12, 0.5) * F.H;
    const top = chance(r, 0.5);
    const y = fromEdge ? (top ? Y(F, -BLEED) : Y(F, 1 + BLEED) - len) : Y(F, ev.y) - len / 2;
    grainyStreak(ctx, r, X(F, ev.x), y, Math.PI / 2 + gauss(r) * 0.03, len, range(r, 8, 26) * F.u, range(r, 0.45, 0.8), F.u);
  },

  stain: (r) => [range(r, 0.1, 0.2), range(r, 0.15, 0.3), 0.85, 0.5],
};
