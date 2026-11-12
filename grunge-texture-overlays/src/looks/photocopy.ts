import { BLEED } from "../settings";
import { chance, gauss, int, pick, range } from "../lib/rng";
import { brokenStroke, curlyHair, grainyStreak, wanderPath } from "./draw";
import { X, Y, type LookDef } from "./types";

/** 3–4 · Photocopy Grunge: toner haze, specks, fold lines, roller streaks, smudged edges (ink = toner). */
export const photocopyLook: LookDef = {
  id: "PhotocopyGrunge",
  brushLayers: 0,
  clearCentre: false,
  schedule: { window: 4, exposureJumps: false, persistArea: "any" },

  cardUniforms: (r, density) => {
    const d = Math.min(1.8, range(r, 0.55, 1.3) * density);
    const rollerSide = chance(r, 0.5) ? int(r, 2, 3) : chance(r, 0.6) ? int(r, 0, 1) : -1; // 0/1 roller banding, 2/3 ink spatter column
    const smudgeSide = chance(r, 0.45) ? int(r, 0, 3) : -1;
    // up to two dense toner sprays: x, y (frame fraction), radius (height units)
    const spray = () => (chance(r, 0.2) ? [chance(r, 0.5) ? range(r, 0.0, 0.08) : range(r, 0.92, 1.0), range(r, 0.05, 0.95), range(r, 0.04, 0.09)] : [0, 0, 0]);
    const s1 = spray();
    const s2 = spray();
    return {
      p: [
        [d, range(r, 0.25, 0.45), range(r, -0.25, 0.15), range(r, -40, 40)],
        [rollerSide, range(r, 0.06, 0.2), range(r, 0.004, 0.011), range(r, 0.12, 0.3)],
        [smudgeSide, range(r, 0.015, 0.05), range(r, 0.25, 0.55), r() < 0.5 ? range(r, 0, 0.25) : range(r, 0.75, 1)],
        [Math.round(s1[0] * 1000) + s1[1], s1[2], Math.round(s2[0] * 1000) + s2[1], s2[2]],
      ],
    };
  },

  shader: /* glsl */ `
float spray(vec2 P, float packed, float rad, int s) {
  if (rad <= 0.0) return 0.0;
  vec2 c = vec2(floor(packed) / 1000.0 * uAspect, fract(packed)); // packed = round(x*1000) + y
  float dd = length(P - c) / rad;
  float fall = exp(-dd * dd * 1.6);
  if (fall < 0.02) return 0.0;
  return max(specks(P, 0.0045, 0.75 * fall, 0.00025, 0.0018, uPx, s), specks(P, 0.012, 0.6 * fall, 0.0012, 0.0045, uPx, s + 1));
}
float lookInk(vec2 P, vec2 F) {
  float d = uP[0].x;
  vec2 q = P + vec2(uP[0].w, -uP[0].w);
  // distance-to-edge weight: 0 in the middle, 1 at the edges
  vec2 c2 = abs(F - 0.5) * 2.0;
  float ew = clamp(max(pow(c2.x, 2.0), pow(c2.y, 1.7)) * 0.8 + 0.3 * length(c2) - 0.08, 0.0, 1.0);
  // toner haze: uneven clouds, streaked horizontally (paper travel), heavier at the edges
  float hz = fbm(vec2(q.x * 1.1, q.y * 2.0), uSeed + 1, 6);
  float hz2 = fbm(vec2(q.x * 6.0, q.y * 9.0), uSeed + 2, 4);
  // uneven: one side of the sheet is dirtier than the other
  float side = mix(1.0 - F.x, F.x, uP[2].w);
  float ew2 = clamp(ew * 0.55 + side * 0.55 - 0.1, 0.0, 1.0);
  float cov = smoothstep(uP[0].z, uP[0].z + 0.85, hz + 0.3 * hz2 + 1.0 * ew2 - 0.4 + 0.2 * (rough(P * 9.0, uSeed + 18, 3) - 0.5));
  cov *= mix(0.3, 0.8, ew2);
  float g = grain3(P, uSeed + 3);
  float gf = vnoise(P * 520.0, uSeed + 13);
  float haze = cov * uP[0].y * (0.7 + 0.25 * g + 0.2 * (gf - 0.5));
  haze = max(haze, grit(cov * 0.06, g, 0.05) * (0.15 + 0.25 * g));
  // faint mottled toner over the whole sheet (still exactly white in places)
  haze = 1.0 - (1.0 - haze) * (1.0 - smoothstep(0.15, 0.75, fbm(q * 4.0 + 5.0, uSeed + 19, 4)) * 0.07 * (0.4 + g));
  // soft darker smudge clouds, mostly on the dirty side
  float sm = smoothstep(0.35, 0.8, fbm(vec2(q.x * 1.6, q.y * 3.0) + 9.0, uSeed + 14, 5) + 0.4 * side - 0.2);
  haze = 1.0 - (1.0 - haze) * (1.0 - sm * (0.25 + 0.25 * g) * uP[2].z * 1.4);
  // drum scratches: thin lighter vertical lines cutting through the haze
  float colW = 0.0035;
  float col = floor(F.x / colW);
  float hc = hash3(ivec3(int(col), 3, uSeed + 4));
  float wl = 0.0;
  if (hc < 0.08) {
    float xl = (col + 0.2 + 0.6 * hash3(ivec3(int(col), 5, uSeed + 4))) * colW;
    float dpx = abs(F.x - xl) * uAspect / uPx;
    wl = (1.0 - smoothstep(0.4, 1.4, dpx)) * smoothstep(0.35, 0.6, vnoise(vec2(col, P.y * 2.5), uSeed + 6));
  }
  haze *= 1.0 - 0.6 * wl;
  // roller streaks: repeating vertical banding along one side (dotted in places)
  float roller = 0.0;
  float column = 0.0;
  if (uP[1].x >= 1.5) {
    // dense column of black ink spatter along one edge, soft-edged
    float xs = uP[1].x < 2.5 ? F.x : 1.0 - F.x;
    float wcol = uP[1].y * 1.2;
    float fall = smoothstep(wcol, 0.0, xs + 0.04 * fbm(vec2(P.y * 3.0, 1.0), uSeed + 17, 4));
    fall *= clamp(0.55 + 0.6 * fbm(vec2(xs * 4.0, P.y * 2.2), uSeed + 18, 4), 0.0, 1.0);
    float blobs = specks(P, 0.012, 0.85 * fall, 0.0008, 0.0055, uPx, uSeed + 24);
    blobs = max(blobs, specks(P, 0.004, 0.9 * fall, 0.0002, 0.0014, uPx, uSeed + 25));
    column = max(blobs * 1.15, fall * (0.12 + 0.2 * g));
  } else if (uP[1].x >= 0.0) {
    float xs = uP[1].x < 0.5 ? F.x : 1.0 - F.x;
    float band = smoothstep(uP[1].y, uP[1].y * 0.2, xs);
    float wob = 0.15 * fbm(vec2(xs * 30.0, P.y * 1.5), uSeed + 7, 3);
    float stripes = pow(0.5 + 0.5 * sin(6.2831853 * (xs / uP[1].z + wob)), 4.0);
    float dots = smoothstep(0.3, 0.7, vnoise(vec2(xs / uP[1].z * 2.0, P.y * 160.0), uSeed + 8));
    float vary = clamp(0.5 + 0.6 * fbm(vec2(xs * 8.0, P.y * 2.5), uSeed + 9, 4), 0.0, 1.0);
    roller = band * stripes * mix(1.0, dots, 0.6) * vary * uP[1].w * (0.6 + 0.6 * g);
  }
  // dense, thin, dark broken vertical streaks on the dirty side
  float dcol = floor(F.x / 0.006);
  float dh = hash3(ivec3(int(dcol), 9, uSeed + 15));
  float dstreak = 0.0;
  if (dh < 0.3 * side * side) {
    float xl = (dcol + 0.3 + 0.4 * hash3(ivec3(int(dcol), 11, uSeed + 15))) * 0.006;
    float dpx = abs(F.x - xl) * uAspect / uPx;
    float brk = smoothstep(0.2, 0.7, vnoise(vec2(dcol * 3.1, P.y * mix(2.0, 9.0, hash3(ivec3(int(dcol), 13, uSeed + 15)))), uSeed + 16));
    dpx *= mix(0.6, 1.5, vnoise(vec2(dcol, P.y * 25.0), uSeed + 20)); // width varies along the streak
    dstreak = (1.0 - smoothstep(0.5, 1.5, dpx)) * brk * (0.1 + 0.4 * hash3(ivec3(int(dcol), 17, uSeed + 15))) * (0.6 + 0.4 * g);
  }
  // smudged edge on some cards
  float smudge = 0.0;
  if (uP[2].x >= 0.0) {
    int side = int(uP[2].x + 0.5);
    float e = side == 0 ? F.y : side == 1 ? 1.0 - F.x : side == 2 ? 1.0 - F.y : F.x;
    float along = side == 0 || side == 2 ? F.x : F.y;
    float w = uP[2].y * (0.5 + 0.9 * (0.5 + 0.5 * fbm(vec2(along * 3.0, 3.1), uSeed + 10, 5)));
    float m = smoothstep(w, -0.01, e + 0.012 * fbm(P * 30.0, uSeed + 11, 3));
    smudge = m * uP[2].z * (0.25 + 0.45 * g) * (0.6 + 0.4 * fbm(P * 20.0, uSeed + 21, 3));
  }
  // toner specks: scattered, clumped, plus dense sprays
  float clump = clamp(fbm(q * 2.5, uSeed + 30, 3) + 0.5, 0.0, 1.0);
  float sp = specks(P, 0.03 / sqrt(d), 0.35 * (0.2 + clump), 0.0003, 0.0022, uPx, uSeed + 20);
  sp = max(sp, 0.7 * specks(P, 0.008 / sqrt(d), 0.25 * clump * (0.35 + cov), 0.0002, 0.0009, uPx, uSeed + 21));
  sp = max(sp, spray(P, uP[3].x, uP[3].y, uSeed + 22));
  sp = max(sp, spray(P, uP[3].z, uP[3].w, uSeed + 23));
  sp *= 0.95;
  float a = 1.0 - (1.0 - haze) * (1.0 - roller) * (1.0 - smudge) * (1.0 - dstreak) * (1.0 - clamp(column, 0.0, 1.0));
  return 1.0 - (1.0 - a) * (1.0 - sp);
}
`,

  drawLines: (ctx, F, r, cu) => {
    const u = F.u;
    const dens = cu.p[0][0];
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    // fold lines and creases: thin straight lines across the sheet, broken in places, with a soft shadow
    const nFold = chance(r, 0.35) ? 0 : int(r, 1, 2);
    for (let i = 0; i < nFold; i++) {
      const horizontal = chance(r, 0.5);
      const at = pick(r, [0.25, 0.33, 0.5, 0.66, 0.75]) + range(r, -0.06, 0.06);
      const slant = range(r, -0.004, 0.004);
      const len = (horizontal ? F.W : F.H) * (1 + 2 * BLEED) * range(r, 0.55, 1.05);
      const s0 = range(r, -BLEED, 1 + BLEED - len / (horizontal ? F.W : F.H));
      const x0 = horizontal ? X(F, Math.max(-BLEED, s0)) : X(F, at);
      const y0 = horizontal ? Y(F, at) : Y(F, Math.max(-BLEED, s0));
      const heading = horizontal ? slant : Math.PI / 2 + slant;
      const pts = wanderPath(r, x0, y0, heading, len, 14 * u, 0.0004);
      const shadow = pts.map(([x, y]) => [x + (horizontal ? 0 : 2.5 * u), y + (horizontal ? 2.5 * u : 0)] as [number, number]);
      brokenStroke(ctx, r, shadow, range(r, 4, 9) * u, range(r, 0.04, 0.09), 0.1);
      brokenStroke(ctx, r, pts, range(r, 0.6, 1.2) * u, range(r, 0.08, 0.22), 0.25);
    }
    // crease marks: short straight lines, mostly near edges and corners
    const nCrease = int(r, 1, 5);
    for (let i = 0; i < nCrease; i++) {
      const nearEdge = chance(r, 0.7);
      const fx = nearEdge ? pick(r, [range(r, 0, 0.12), range(r, 0.88, 1)]) : range(r, 0, 1);
      const fy = nearEdge ? range(r, 0, 1) : pick(r, [range(r, 0, 0.12), range(r, 0.88, 1)]);
      const pts = wanderPath(r, X(F, fx), Y(F, fy), range(r, 0, Math.PI * 2), range(r, 0.02, 0.09) * F.H, 6 * u, 0.002);
      brokenStroke(ctx, r, pts, range(r, 0.6, 1.3) * u, range(r, 0.2, 0.5), 0.1);
    }
    // a few short hairlines
    const nHair = int(r, 0, 1) + Math.round(dens * 0.6);
    for (let i = 0; i < nHair; i++) {
      curlyHair(ctx, r, F, X(F, range(r, -BLEED, 1 + BLEED)), Y(F, range(r, -BLEED, 1 + BLEED)), range(r, 0.015, 0.07) * F.H, 0.06, range(r, 0.5, 1) * u, range(r, 0.5, 0.85));
    }
    // thin vertical lines across the sheet (some dotted)
    const nV = Math.round(dens * int(r, 4, 14));
    for (let i = 0; i < nV; i++) {
      const len = range(r, 0.15, 1.1) * F.H;
      const pts = wanderPath(r, X(F, range(r, -BLEED, 1 + BLEED)), Y(F, range(r, -0.1, 0.9)), Math.PI / 2 + gauss(r) * 0.006, len, 3 * u, 0.0015);
      const dotted = false;
      brokenStroke(ctx, r, pts, range(r, 0.5, 1.3) * u, range(r, 0.08, 0.35), dotted ? 0.55 : 0.15);
    }
    // jagged crack lines
    const nCrack = chance(r, 0.6) ? int(r, 1, 2) : 0;
    for (let i = 0; i < nCrack; i++) {
      const pts = wanderPath(r, X(F, range(r, 0, 0.6)), Y(F, range(r, 0.1, 0.9)), gauss(r) * 0.2, range(r, 0.08, 0.3) * F.H, 4 * u, 0.12);
      brokenStroke(ctx, r, pts, range(r, 0.6, 1.1) * u, range(r, 0.35, 0.65), 0.05);
    }
    // rows of faint dash marks along one edge (ghost of photocopied type)
    if (chance(r, 0.55)) {
      const rows = int(r, 1, 4);
      const top = chance(r, 0.6);
      for (let k = 0; k < rows; k++) {
        const fy = top ? range(r, 0.015, 0.14) : range(r, 0.86, 0.985);
        let fx = range(r, 0, 0.5);
        const fxEnd = fx + range(r, 0.2, 0.6);
        while (fx < fxEnd) {
          const len = range(r, 0.004, 0.025) * F.W;
          if (chance(r, 0.75)) brokenStroke(ctx, r, [[X(F, fx), Y(F, fy)], [X(F, fx) + len, Y(F, fy) + gauss(r) * 0.5 * u]], range(r, 1, 2.2) * u, range(r, 0.25, 0.6), 0);
          fx += len / F.W + range(r, 0.003, 0.02);
        }
      }
    }
    // short roller scuffs: faint dashes parallel to the paper path
    const nDash = Math.round(dens * int(r, 3, 12));
    for (let i = 0; i < nDash; i++) {
      const pts = wanderPath(r, X(F, range(r, 0, 1)), Y(F, range(r, 0, 1)), Math.PI / 2 + gauss(r) * 0.02, range(r, 0.01, 0.06) * F.H, 4 * u, 0.001);
      brokenStroke(ctx, r, pts, range(r, 0.8, 2) * u, range(r, 0.1, 0.3), 0.2);
    }
  },

  drawPersist: (ctx, F, ev, r) => {
    // a dark streak along the paper path (a dirty roller), lasting a few cards
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "butt";
    const len = range(r, 0.3, 0.9) * F.H;
    grainyStreak(ctx, r, X(F, ev.x), Y(F, range(r, -0.05, 1 - len / F.H)), Math.PI / 2 + gauss(r) * 0.01, len, range(r, 3, 9) * F.u, range(r, 0.25, 0.5), F.u);
  },

  stain: (r) => [range(r, 0.1, 0.22), range(r, 0.25, 0.42), 0.8, 0.55],
};
