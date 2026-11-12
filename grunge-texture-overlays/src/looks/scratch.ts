import { BLEED } from "../settings";
import { chance, gauss, int, pick, range } from "../lib/rng";
import { brokenStroke, curlyHair, flick, wanderPath } from "./draw";
import { X, Y, type LookDef } from "./types";

/** 1–2 · Scratch Grunge: white scratches, dust, scuffs and grey smudges on black (ink = brightness). */
export const scratchLook: LookDef = {
  id: "ScratchGrunge",
  brushLayers: 0,
  clearCentre: false,
  schedule: { window: 4, exposureJumps: true, persistArea: "any" },

  cardUniforms: (r, density) => {
    // per-card density: sparse ... heavily scratched
    const d = Math.min(1.8, range(r, 0.3, 1.4) * density);
    const worn = chance(r, 0.35) ? int(r, 0, 3) : -1;
    return {
      p: [
        // density, patch grey level, hole threshold, worn edge side
        [d, range(r, 0.2, 0.38), range(r, 0.12, 0.36), worn],
        // dust amount, -, noise offset
        [range(r, 0.6, 1.3), 0, range(r, -50, 50), range(r, -50, 50)],
        // worn strength, patch threshold (coverage), worn depth
        [range(r, 0.35, 0.6), range(r, -0.3, 0.12) + (1 - Math.min(1, d)) * 0.12, range(r, 0.08, 0.22), 0],
        // crusty fringe strength, big blob chance
        [chance(r, 0.3) ? range(r, 0.4, 0.8) : 0, range(r, 0.3, 0.7), 0, 0],
      ],
    };
  },

  shader: /* glsl */ `
float lookInk(vec2 P, vec2 F) {
  float d = uP[0].x;
  vec2 q = P + uP[1].zw;
  // large worn grey patches (domain-warped clouds)
  vec2 w = vec2(fbm(q * 1.2, uSeed + 5, 3), fbm(q * 1.2 + 7.0, uSeed + 6, 3));
  float cloud = fbm(q * 1.15 + w * 0.55, uSeed + 1, 6);
  float cov = smoothstep(uP[2].y, uP[2].y + 0.45, cloud + 0.18 * (rough(P * 12.0, uSeed + 14, 3) - 0.5));
  // inside: micro-scratch grain (anisotropic noise in two directions) + pepper
  float a1 = vnoise(vec2(P.x * 420.0, P.y * 22.0), uSeed + 2);
  float a2 = vnoise(mat2(0.71, 0.71, -0.71, 0.71) * P * vec2(320.0, 26.0), uSeed + 3);
  float pep = vnoise(P * 430.0, uSeed + 4);
  float g = 0.5 * pep + 0.15 * max(a1, a2) + 0.35 * vnoise(P * 70.0, uSeed + 7);
  // soft, cloudy stain with a little fine scuff texture in it
  float soft = (0.7 + 0.3 * fbm(q * 9.0, uSeed + 13, 4)) * (0.55 + 0.6 * rough(P * 38.0, uSeed + 18, 4));
  float a3 = vnoise(mat2(0.26, 0.97, -0.97, 0.26) * P * vec2(360.0, 20.0), uSeed + 15);
  float scuff = smoothstep(0.72, 0.95, max(max(a1, a2), a3)) * smoothstep(0.45, 0.8, vnoise(P * 9.0, uSeed + 17));
  float patchInk = cov * uP[0].y * soft * (0.7 + 0.35 * g) + cov * cov * scuff * 0.05;
  // soft bright smudges
  patchInk += smoothstep(0.55, 0.85, fbm(q * 5.0 + 11.0, uSeed + 16, 4)) * 0.18 * (0.5 + g);
  patchInk = max(patchInk, grit(cov * 0.1, g, 0.05) * 0.35);
  // black holes with rough, pitted edges inside the patches
  float hn = fbm(q * 2.2 + w * 0.9, uSeed + 8, 6) + 0.3 * (rough(P * 32.0, uSeed + 9, 3) - 0.5);
  float hole = smoothstep(uP[0].z, uP[0].z + 0.035, hn);
  patchInk *= 1.0 - hole * 0.95;
  // crusty bright fringe along some patch edges
  float fringe = exp(-pow((cloud - uP[2].y - 0.06) / 0.022, 2.0)) * uP[3].x;
  float crust = fringe * smoothstep(0.62, 0.85, pep * 0.6 + vnoise(P * 150.0, uSeed + 10) * 0.4) * 0.6;
  // worn, lighter area along one edge on some cards
  float worn = 0.0;
  if (uP[0].w >= 0.0) {
    int side = int(uP[0].w + 0.5);
    float e = side == 0 ? F.y : side == 1 ? 1.0 - F.x : side == 2 ? 1.0 - F.y : F.x;
    float along = side == 0 || side == 2 ? F.x : F.y;
    float edge = uP[2].z * (0.6 + 0.8 * (0.5 + 0.5 * fbm(vec2(along * 4.0, 1.7), uSeed + 11, 5)));
    float m = smoothstep(edge, edge - 0.06, e + 0.015 * fbm(P * 40.0, uSeed + 12, 3));
    worn = m * uP[2].x * (0.45 + 0.75 * g);
  }
  // dust: irregular specks, clumped, mostly tiny, a few bigger blobs
  float clump = clamp(fbm(q * 3.0, uSeed + 30, 3) + 0.55, 0.0, 1.0);
  float c2 = clump * clump;
  float dust = specks(P, 0.012 / sqrt(d), 0.3 * uP[1].x * (0.15 + c2), 0.0002, 0.0016, uPx, uSeed + 20);
  dust = max(dust, 0.85 * specks(P, 0.004 / sqrt(d), 0.3 * uP[1].x * (0.1 + c2 * clump), 0.00015, 0.0007, uPx, uSeed + 21));
  dust = max(dust, specks(P, 0.2, uP[3].y * 0.5, 0.0015, 0.0028, uPx, uSeed + 22));
  float a = 1.0 - (1.0 - patchInk) * (1.0 - crust) * (1.0 - worn);
  return 1.0 - (1.0 - a) * (1.0 - dust);
}
`,

  drawLines: (ctx, F, r, cu) => {
    const u = F.u;
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dens = cu.p[0][0]; // per-card density, shared with the shader
    const fx = () => range(r, -BLEED, 1 + BLEED);
    const fy = () => range(r, -BLEED, 1 + BLEED);

    // long scratches: near-exact verticals, mostly bunched in one or two bands (often full height),
    // plus "/" diagonals and a few long shallow ones
    const bands = [range(r, 0.35, 0.85), range(r, 0.15, 0.95)];
    const bandW = [range(r, 0.15, 0.35), range(r, 0.08, 0.2)];
    const nLong = Math.round(10 + 50 * dens);
    for (let i = 0; i < nLong; i++) {
      const kind = r();
      let heading: number;
      let x: number;
      let y: number;
      let len: number;
      if (kind < 0.72) {
        heading = Math.PI / 2 + gauss(r) * (chance(r, 0.6) ? 0.025 : 0.08);
        const inBand = chance(r, 0.7);
        const b = int(r, 0, 1);
        x = X(F, inBand ? bands[b] + gauss(r) * bandW[b] * 0.5 : fx());
        const full = chance(r, 0.15);
        y = Y(F, full ? -BLEED - 0.02 : range(r, -0.3, 0.9));
        len = (full ? 1.1 : range(r, 0.08, 0.9)) * F.H;
      } else if (kind < 0.97) {
        heading = Math.PI / 2 + (chance(r, 0.8) ? 1 : -1) * range(r, 0.35, 0.65); // mostly "/"
        x = X(F, range(r, 0.3, 1.05));
        y = Y(F, range(r, -0.2, 0.9));
        len = range(r, 0.06, 0.5) * F.H;
      } else {
        heading = (chance(r, 0.5) ? 0 : Math.PI) + gauss(r) * 0.15; // long, shallow
        x = X(F, fx());
        y = Y(F, range(r, 0.1, 0.9));
        len = range(r, 0.15, 0.5) * F.H;
      }
      const pts = wanderPath(r, x, y, heading, len, 8 * u, chance(r, 0.3) ? 0.012 : 0.004);
      const w = range(r, 0.5, 1.6) * u * (chance(r, 0.1) ? 1.8 : 1);
      const bright = chance(r, 0.4) ? range(r, 0.75, 1) : range(r, 0.2, 0.6);
      brokenStroke(ctx, r, pts, w, bright, 0.15);
    }

    // short scuffs and a few hooked scratches
    const nShort = Math.round(20 + 110 * dens);
    for (let i = 0; i < nShort; i++) {
      const heading = chance(r, 0.5) ? Math.PI / 2 + gauss(r) * 0.4 : range(r, 0, Math.PI * 2);
      const len = range(r, 3, 40) * u * (chance(r, 0.15) ? 2.5 : 1);
      const hook = chance(r, 0.15) ? (chance(r, 0.5) ? 1 : -1) * range(r, 1, 4) : 0;
      const pts = wanderPath(r, X(F, fx()), Y(F, fy()), heading, len, 1.5 * u, 0.012, hook);
      brokenStroke(ctx, r, pts, range(r, 0.45, 1.4) * u, range(r, 0.35, 1), 0.08);
    }

    // clusters of fine parallel scratches (brushed metal)
    const nClusters = chance(r, 0.15) ? 1 : 0;
    for (let c = 0; c < nClusters; c++) {
      const cx = X(F, range(r, 0, 1));
      const cy = Y(F, range(r, 0, 1));
      const rx = range(r, 0.04, 0.25) * F.H;
      const ry = rx * range(r, 0.25, 0.8);
      const ang = pick(r, [Math.PI / 2, Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, range(r, 0, Math.PI)]) + gauss(r) * 0.1;
      const n = int(r, 25, 160);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (let i = 0; i < n; i++) {
        let px = 0;
        let py = 0;
        do {
          px = range(r, -1, 1);
          py = range(r, -1, 1);
        } while (px * px + py * py > 1);
        const ox = px * ry;
        const oy = py * rx;
        const x = cx + ca * oy - sa * ox;
        const y = cy + sa * oy + ca * ox;
        const len = range(r, 0.01, 0.12) * F.H * (1 - Math.abs(px) * 0.6);
        const a = ang + gauss(r) * 0.15;
        const pts = wanderPath(r, x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2, a, len, 6 * u, 0.0008);
        brokenStroke(ctx, r, pts, range(r, 0.45, 1.0) * u, range(r, 0.25, 0.75), 0.2);
      }
    }

    // fibres
    const nFib = int(r, 0, 2) + Math.round(dens * 1.5);
    for (let i = 0; i < nFib; i++) {
      const long = chance(r, 0.4);
      curlyHair(ctx, r, F, X(F, fx()), Y(F, fy()), range(r, 0.03, long ? 0.3 : 0.08) * F.H, long ? 0.03 : 0.12, range(r, 0.7, 1.4) * u, range(r, 0.55, 0.95));
    }

    // flecks
    const nFleck = Math.round(10 + 60 * dens);
    for (let i = 0; i < nFleck; i++) {
      flick(ctx, r, X(F, fx()), Y(F, fy()), range(r, 0, Math.PI * 2), range(r, 1, 5) * u, range(r, 0.6, 1.8) * u, range(r, 0.35, 1));
    }
  },

  drawPersist: (ctx, F, ev, r) => {
    // a long, prominent scratch
    const u = F.u;
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    const heading = Math.PI / 2 + gauss(r) * 0.12;
    const len = range(r, 0.55, 1.2) * F.H;
    const pts = wanderPath(r, X(F, ev.x), Y(F, range(r, -0.2, 0.3)), heading, len, 8 * u, 0.0012);
    brokenStroke(ctx, r, pts, range(r, 3, 5) * u, 0.1, 0.05);
    brokenStroke(ctx, r, pts, range(r, 1, 2) * u, range(r, 0.75, 1), 0.06);
  },

  stain: (r) => [range(r, 0.12, 0.26), range(r, 0.22, 0.38), 0.6, 0.5],
};
