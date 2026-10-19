import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Options } from "roughjs/bin/core";
import { type Rng, range } from "./random";

export type ShapeKind = "star" | "dot" | "circle" | "squiggle" | "heart" | "zigzag" | "spiral" | "triangle";
export const SHAPE_KINDS: ShapeKind[] = ["star", "dot", "circle", "squiggle", "heart", "zigzag", "spiral", "triangle"];

type P = [number, number];

const starPts = (r: number, n = 5, inner = 0.45): P[] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });

const heartPath = (r: number) => {
  const s = r / 16;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3) * s;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s;
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ") + " Z";
};

/** Draws one hand-drawn element centred on the origin of the current ctx transform. */
export const drawShape = (rc: RoughCanvas, kind: ShapeKind, size: number, ink: string, opts: Options, variant: number, outlineOnly = false) => {
  const base: Options = {
    stroke: ink,
    strokeWidth: opts.strokeWidth ?? 5,
    roughness: opts.roughness ?? 1.4,
    bowing: opts.bowing ?? 1.2,
    seed: opts.seed,
    preserveVertices: false,
  };
  // loose fills: hachure / zigzag scribble / cross-hatch, never flat; gap,
  // angle and weight differ per element like separate hand-filled shapes
  const gapK = opts.hachureGap ?? 1;
  const ang = opts.hachureAngle ?? -41;
  const fills: Options[] = [
    { fill: ink, fillStyle: "hachure", hachureGap: size * 0.13 * gapK, fillWeight: base.strokeWidth! * 0.6, hachureAngle: ang },
    { fill: ink, fillStyle: "zigzag", hachureGap: size * 0.12 * gapK, fillWeight: base.strokeWidth! * 0.55, hachureAngle: ang + 90 },
    { fill: ink, fillStyle: "zigzag-line", hachureGap: size * 0.09 * gapK, fillWeight: base.strokeWidth! * 0.5, hachureAngle: ang + 30 },
    { fill: ink, fillStyle: "cross-hatch", hachureGap: size * 0.16 * gapK, fillWeight: base.strokeWidth! * 0.5, hachureAngle: ang },
  ];
  if (outlineOnly) fills.forEach((f, i) => (fills[i] = { hachureGap: f.hachureGap }));
  const fill = fills[variant % fills.length];
  switch (kind) {
    case "star":
      rc.polygon(starPts(size * 0.5), { ...base, ...fill });
      break;
    case "dot":
      rc.circle(0, 0, size * 0.42, { ...base, ...fills[2], hachureGap: size * 0.07 });
      break;
    case "circle":
      rc.circle(0, 0, size * 0.9, { ...base, ...(variant % 2 ? fill : {}) });
      break;
    case "triangle":
      rc.polygon(
        [
          [0, -size * 0.5],
          [size * 0.45, size * 0.32],
          [-size * 0.45, size * 0.32],
        ],
        { ...base, ...fill },
      );
      break;
    case "heart":
      rc.path(heartPath(size * 0.5), { ...base, ...fill });
      break;
    case "squiggle": {
      const pts: P[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        pts.push([(t - 0.5) * size * 1.3, Math.sin(t * Math.PI * 3 + variant) * size * 0.18]);
      }
      rc.curve(pts, { ...base, strokeWidth: base.strokeWidth! * 1.1 });
      break;
    }
    case "zigzag": {
      const n = 5 + (variant % 3);
      const pts: P[] = Array.from({ length: n + 1 }, (_, i) => [
        (i / n - 0.5) * size * 1.2,
        (i % 2 ? -1 : 1) * size * 0.16,
      ]);
      rc.linearPath(pts, base);
      break;
    }
    case "spiral": {
      const pts: P[] = [];
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const a = t * Math.PI * 2 * 2.6;
        const r = t * size * 0.5;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      rc.curve(pts, base);
      break;
    }
  }
};

export const roughOn = (c: HTMLCanvasElement) => rough.canvas(c);

export type Mover = {
  kind: ShapeKind;
  ink: number;
  size: number;
  x: number;
  y: number;
  /** whole wraps per loop (0 = orbit in place) */
  wx: number;
  wy: number;
  orbit: number;
  orbitPhase: number;
  rot: number;
  spin: number; // whole turns per loop, or 0
  wobble: number;
  seed: number;
  weight: number;
  gap: number;
  angle: number;
  variant: number;
};

export const makeMovers = (rng: Rng, count: number, W: number, H: number): Mover[] =>
  Array.from({ length: count }, (_, i) => {
    const kind = SHAPE_KINDS[i % SHAPE_KINDS.length];
    const dir = rng();
    // most drift up or down (one wrap per 20s loop), some sideways, some
    // circle slowly in place
    const [wx, wy] = dir < 0.42 ? [0, -1] : dir < 0.66 ? [0, 1] : dir < 0.78 ? [rng() < 0.5 ? -1 : 1, 0] : [0, 0];
    return {
      kind,
      ink: Math.floor(rng() * 4),
      size: range(rng, 70, 170) * (kind === "dot" ? 0.6 : 1),
      x: rng() * W,
      y: rng() * H,
      wx,
      wy,
      orbit: range(rng, 40, 140),
      orbitPhase: rng() * Math.PI * 2,
      rot: rng() * Math.PI * 2,
      spin: rng() < 0.25 ? (rng() < 0.5 ? -1 : 1) : 0,
      wobble: range(rng, 0.15, 0.45),
      seed: 1 + Math.floor(rng() * 90000) * 10,
      weight: range(rng, 3.5, 7.5),
      gap: range(rng, 0.75, 1.4),
      angle: range(rng, -70, 70),
      variant: Math.floor(rng() * 4),
    };
  });

/** Periodic position: frame 0 and frame `loop` are identical. */
export const moverAt = (m: Mover, t: number, loop: number, W: number, H: number, margin: number) => {
  const u = t / loop;
  const a = Math.PI * 2 * u;
  const ww = W + 2 * margin;
  const hh = H + 2 * margin;
  let x = m.x + m.wx * ww * u + Math.sin(a + m.orbitPhase) * m.orbit;
  let y = m.y + m.wy * hh * u + Math.cos(a * (m.wx || m.wy ? 1 : 1) + m.orbitPhase * 1.3) * m.orbit * 0.7;
  x = ((((x + margin) % ww) + ww) % ww) - margin;
  y = ((((y + margin) % hh) + hh) % hh) - margin;
  const r = m.rot + m.spin * a + Math.sin(a * 2 + m.orbitPhase) * m.wobble;
  return { x, y, r };
};
