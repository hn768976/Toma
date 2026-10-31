import { clamp, fbm1, noise1, rng, smoothstep } from "../gl/random";
import type { ForestPalette, Rgb } from "./palettes";

export const ASPECT = 16 / 9;

type Tint = "bright" | "cool" | "green" | "warm";

export type DiscSpec = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  tint: Tint;
  soft: number;
  /** 0 = free leaf, 1 = part of the swaying left branch cluster */
  cluster: number;
  sway: number;
  speed: number;
  twinkleSpeed: number;
  twinkleDepth: number;
  seed: number;
};

/**
 * Builds the bokeh layout. Placement follows the reference: a dense bright
 * cluster hanging down the left edge, a handful of mid-frame highlights, a
 * few warm-white highlights on the bottom edge and a field of faint discs.
 */
export const buildDiscs = (seed = 1337): DiscSpec[] => {
  const R = rng(seed);
  const discs: DiscSpec[] = [];
  const base = (o: Partial<DiscSpec> & Pick<DiscSpec, "x" | "y" | "r" | "alpha" | "tint">): DiscSpec => ({
    soft: 0.32 + R() * 0.16,
    cluster: 0,
    sway: 0.008 + R() * 0.012,
    speed: 0.5 + R() * 0.7,
    twinkleSpeed: 0.9 + R() * 1.8,
    twinkleDepth: 0.25 + R() * 0.45,
    seed: R() * 1000,
    ...o,
  });

  // --- left branch cluster (follows a curve down the left edge) ---
  const path: [number, number][] = [
    [0.04, 0.02],
    [0.16, 0.08],
    [0.28, 0.2],
    [0.34, 0.33],
    [0.27, 0.45],
    [0.17, 0.57],
    [0.08, 0.68],
    [0.04, 0.8],
  ];
  for (let i = 0; i < 56; i++) {
    const u = R() * (path.length - 1);
    const k = Math.floor(u);
    const f = u - k;
    const a = path[k];
    const b = path[Math.min(k + 1, path.length - 1)];
    const x = a[0] + (b[0] - a[0]) * f + (R() - 0.5) * 0.3;
    const y = a[1] + (b[1] - a[1]) * f + (R() - 0.5) * 0.16;
    const bright = R() < 0.5;
    discs.push(
      base({
        x: clamp(x, -0.03, 0.5),
        y,
        r: 0.038 + R() * 0.038,
        alpha: bright ? 0.4 + R() * 0.5 : 0.16 + R() * 0.26,
        tint: bright ? "bright" : "cool",
        cluster: 1,
        twinkleDepth: 0.35 + R() * 0.55,
      }),
    );
  }

  // --- distinct mid-frame highlights seen in the reference ---
  const anchors: [number, number, number, number, Tint][] = [
    [1.17, 0.625, 0.058, 0.42, "bright"],
    [1.67, 0.6, 0.056, 0.32, "cool"],
    [1.62, 0.055, 0.062, 0.3, "cool"],
    [1.5, 0.05, 0.05, 0.22, "cool"],
    [1.09, 0.28, 0.05, 0.22, "cool"],
    [0.67, 0.58, 0.058, 0.2, "cool"],
    [1.36, 0.88, 0.05, 0.3, "warm"],
    [0.69, 0.975, 0.045, 0.55, "warm"],
    [1.33, 0.975, 0.042, 0.42, "warm"],
    [1.28, 0.72, 0.055, 0.18, "cool"],
    [0.84, 0.83, 0.05, 0.16, "green"],
    [1.03, 0.94, 0.05, 0.18, "green"],
    [1.71, 0.36, 0.07, 0.16, "green"],
    [1.5, 0.48, 0.05, 0.2, "cool"],
    [0.55, 0.18, 0.05, 0.14, "cool"],
  ];
  for (const [x, y, r, alpha, tint] of anchors) {
    discs.push(base({ x, y, r, alpha, tint, sway: 0.003 + R() * 0.004 }));
  }

  // --- faint background field ---
  while (discs.length < 146) {
    const x = 0.25 + R() * (ASPECT - 0.2);
    const y = R() * 1.05;
    const t = R();
    const tint: Tint = t < 0.6 ? "cool" : t < 0.85 ? "green" : "warm";
    discs.push(
      base({
        x,
        y,
        r: 0.026 + R() * 0.04,
        alpha: 0.05 + R() * 0.17,
        tint,
        soft: 0.3 + R() * 0.2,
      }),
    );
  }
  return discs;
};

const tintColor = (p: ForestPalette, t: Tint): Rgb =>
  t === "bright" ? p.discBright : t === "cool" ? p.discCool : t === "green" ? p.discGreen : p.discWarm;

/** Per-frame disc uniforms. */
export const discUniforms = (discs: DiscSpec[], palette: ForestPalette, time: number) => {
  const pos = new Float32Array(discs.length * 4);
  const col = new Float32Array(discs.length * 4);
  // shared wind for the branch that carries the left cluster
  const windX = fbm1(time * 0.45, 21) * 0.024 + fbm1(time * 1.4, 22) * 0.008;
  const windY = fbm1(time * 0.4, 23) * 0.014 + fbm1(time * 1.2, 24) * 0.004;
  discs.forEach((d, i) => {
    const ox = fbm1(time * d.speed + d.seed, 1) * d.sway;
    const oy = fbm1(time * d.speed * 0.8 + d.seed, 2) * d.sway * 0.8;
    // leaves flutter in front of the light: smooth twinkle with occasional dropouts
    const tw = 0.5 + 0.5 * noise1(time * d.twinkleSpeed + d.seed, 5);
    const dropout = smoothstep(-0.65, -0.2, noise1(time * d.twinkleSpeed * 0.45 + d.seed * 1.7, 9));
    const a = d.alpha * (1 - d.twinkleDepth + d.twinkleDepth * tw) * (0.35 + 0.65 * dropout);
    pos[i * 4 + 0] = d.x + ox + windX * d.cluster * (0.6 + 0.4 * d.y);
    pos[i * 4 + 1] = d.y + oy + windY * d.cluster;
    pos[i * 4 + 2] = d.r;
    pos[i * 4 + 3] = a;
    const c = tintColor(palette, d.tint);
    col[i * 4 + 0] = c[0];
    col[i * 4 + 1] = c[1];
    col[i * 4 + 2] = c[2];
    col[i * 4 + 3] = d.soft;
  });
  return { pos, col };
};
