import type { MotifKind, MotifSpec } from "../types";
import type { Rng } from "../rng";

export type Dot = { x: number; y: number; r: number };
export type StrokeSet = { path: Path2D; width: number };

/**
 * A motif reduced to drawable geometry, in coordinates relative to the motif
 * centre. Rotation is baked into the points, so the caller only translates —
 * which keeps line-fill and stipple angles measured against the frame rather
 * than against the motif.
 */
export type MotifGeometry = {
  /** Closed areas that receive the fill treatment. */
  regions: Path2D | null;
  regionRule: CanvasFillRule;
  /** Ink outlines drawn whatever the fill treatment (ring lattices). */
  lines: StrokeSet[];
  /** Ink dots (centre clusters). */
  dots: Dot[];
  /** Paper-toned strokes laid over the fill (sakura stamens). */
  knockoutLines: StrokeSet[];
  knockoutDots: Dot[];
  /** Optional clip applied to `lines` only. */
  clip: Path2D | null;
  /** Farthest extent from the centre, used for the open-centre check. */
  extent: number;
};

const TAU = Math.PI * 2;

const emptyGeometry = (extent: number): MotifGeometry => ({
  regions: null,
  regionRule: "nonzero",
  lines: [],
  dots: [],
  knockoutLines: [],
  knockoutDots: [],
  clip: null,
  extent,
});

/** Rotate a point given in the motif's local (u along axis, v across) frame. */
const rotator = (angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (u: number, v: number): [number, number] => [
    u * cos - v * sin,
    u * sin + v * cos,
  ];
};

/** Rotate a finished path about the motif centre. */
const rotatePath = (path: Path2D, angle: number): Path2D => {
  if (angle === 0) return path;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out = new Path2D();
  out.addPath(path, new DOMMatrix([cos, sin, -sin, cos, 0, 0]));
  return out;
};

const circlePath = (r: number, cx = 0, cy = 0): Path2D => {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, TAU);
  return p;
};

/* ── CIRCLE ─────────────────────────────────────────────────────────────── */

const circle = (r: number): MotifGeometry => ({
  ...emptyGeometry(r),
  regions: circlePath(r),
});

/* ── RING ───────────────────────────────────────────────────────────────────
   A thin circular outline. Expressed as a circular region drawn with the
   outline treatment, so ring weight is controlled the same way as any other
   stroked motif.                                                            */

const ring = (r: number): MotifGeometry => ({
  ...emptyGeometry(r),
  regions: circlePath(r),
});

/* ── CHRYSANTHEMUM ──────────────────────────────────────────────────────────
   A formal rosette. Petals are IDENTICAL and evenly spaced: the regularity is
   the motif. Each petal is a rounded lobe, narrow at the centre and wider at
   its outer end, and the middle is an annulus knocked out with the even-odd
   rule so the very centre stays paper-coloured.                             */

const chrysanthemum = (r: number, rot: number, petals: number): MotifGeometry => {
  const path = new Path2D();
  const inner = r * 0.26;
  const outer = r;
  const halfWidthInner = r * 0.075;
  const halfWidthOuter = r * 0.168;

  for (let i = 0; i < petals; i += 1) {
    const angle = rot + (i / petals) * TAU;
    const at = rotator(angle);
    const tip = outer - halfWidthOuter;
    const [tipX, tipY] = at(tip, 0);

    path.moveTo(...at(inner, -halfWidthInner));
    path.bezierCurveTo(
      ...at(inner + (tip - inner) * 0.42, -halfWidthInner * 1.05),
      ...at(tip - (tip - inner) * 0.2, -halfWidthOuter),
      ...at(tip, -halfWidthOuter),
    );
    // Rounded outer end.
    path.arc(tipX, tipY, halfWidthOuter, angle - Math.PI / 2, angle + Math.PI / 2);
    path.bezierCurveTo(
      ...at(tip - (tip - inner) * 0.2, halfWidthOuter),
      ...at(inner + (tip - inner) * 0.42, halfWidthInner * 1.05),
      ...at(inner, halfWidthInner),
    );
    path.closePath();
  }

  // Centre annulus (even-odd knocks the inner disc back out).
  path.arc(0, 0, r * 0.225, 0, TAU);
  path.closePath();
  path.arc(0, 0, r * 0.115, 0, TAU);
  path.closePath();

  return { ...emptyGeometry(r), regions: path, regionRule: "evenodd" };
};

/* ── SAKURA ─────────────────────────────────────────────────────────────────
   Five petals, each a rounded lobe with a notch at its outer tip, and a
   centre cluster of fine radiating stamens each ending in a dot. The notch
   and the stamens are what make it a sakura rather than a generic flower.   */

const sakura = (r: number, rot: number, rng: Rng): MotifGeometry => {
  const petals = 5;
  const path = new Path2D();
  const wide = r * 0.41;
  const root = r * 0.07;

  for (let i = 0; i < petals; i += 1) {
    const angle = rot + (i / petals) * TAU;
    const at = rotator(angle);
    path.moveTo(...at(root, 0));
    path.bezierCurveTo(
      ...at(r * 0.2, -wide * 0.5),
      ...at(r * 0.66, -wide),
      ...at(r * 0.88, -wide * 0.62),
    );
    // Outer tip: out to the shoulder, then a small notch back in. The notch
    // is a nick, not a cleft — deeper and the blossom reads as a heart.
    path.bezierCurveTo(
      ...at(r * 0.985, -wide * 0.36),
      ...at(r * 0.98, -wide * 0.13),
      ...at(r * 0.945, 0),
    );
    path.bezierCurveTo(
      ...at(r * 0.98, wide * 0.13),
      ...at(r * 0.985, wide * 0.36),
      ...at(r * 0.88, wide * 0.62),
    );
    path.bezierCurveTo(
      ...at(r * 0.66, wide),
      ...at(r * 0.2, wide * 0.5),
      ...at(root, 0),
    );
    path.closePath();
  }

  // Stamens: fine radiating lines, each ending in a small dot.
  const stamenPath = new Path2D();
  const stamenDots: Dot[] = [];
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const angle = rot + (i / count) * TAU + rng.range(-0.04, 0.04);
    const len = r * rng.range(0.24, 0.36);
    const at = rotator(angle);
    stamenPath.moveTo(...at(r * 0.04, 0));
    stamenPath.lineTo(...at(len, 0));
    const [dx, dy] = at(len, 0);
    stamenDots.push({ x: dx, y: dy, r: r * 0.028 });
  }
  stamenDots.push({ x: 0, y: 0, r: r * 0.05 });

  return {
    ...emptyGeometry(r),
    regions: path,
    knockoutLines: [{ path: stamenPath, width: r * 0.016 }],
    knockoutDots: stamenDots,
  };
};

/* ── SEIGAIHA CLUSTER ───────────────────────────────────────────────────────
   Overlapping concentric circles on a regular offset grid, outlines only, so
   the overlaps themselves make the scale lattice. Clipped to a disc.        */

const seigaiha = (r: number, rings: number, weight: number): MotifGeometry => {
  const unit = r * 0.30;
  const path = new Path2D();
  const rows = Math.ceil((r * 2) / (unit * 0.62)) + 2;
  const cols = Math.ceil((r * 2) / unit) + 2;

  for (let row = -Math.ceil(rows / 2); row <= Math.ceil(rows / 2); row += 1) {
    for (let col = -Math.ceil(cols / 2); col <= Math.ceil(cols / 2); col += 1) {
      const cx = col * unit + (Math.abs(row % 2) === 1 ? unit * 0.5 : 0);
      const cy = row * unit * 0.62;
      for (let k = 1; k <= rings; k += 1) {
        const rr = (unit * k) / rings;
        path.moveTo(cx + rr, cy);
        path.arc(cx, cy, rr, 0, TAU);
      }
    }
  }

  return {
    ...emptyGeometry(r),
    lines: [{ path, width: weight }],
    clip: circlePath(r),
  };
};

/* ── RING FLOWER ────────────────────────────────────────────────────────────
   A flower made entirely of overlapping ring outlines: equal-radius circles
   around a common centre, so the petals are the negative spaces between the
   outlines rather than drawn shapes. A cluster of dots sits at the centre.  */

const ringFlower = (
  r: number,
  rot: number,
  petals: number,
  weight: number,
  rng: Rng,
): MotifGeometry => {
  const radius = r * 0.60;
  const offset = r * 0.40;
  const path = new Path2D();
  for (let i = 0; i < petals; i += 1) {
    const angle = rot + (i / petals) * TAU;
    const cx = Math.cos(angle) * offset;
    const cy = Math.sin(angle) * offset;
    path.moveTo(cx + radius, cy);
    path.arc(cx, cy, radius, 0, TAU);
  }

  const dots: Dot[] = [];
  const dotCount = 9;
  for (let i = 0; i < dotCount; i += 1) {
    const angle = rng.next() * TAU;
    const dist = Math.sqrt(rng.next()) * r * 0.13;
    dots.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      r: r * rng.range(0.017, 0.026),
    });
  }

  return { ...emptyGeometry(r), lines: [{ path, width: weight }], dots };
};

/* ── KUMO ───────────────────────────────────────────────────────────────────
   A stylised cloud: rounded lobes along the top over a flat, gently curved
   base. Built as a union of overlapping subpaths under the non-zero rule, so
   the lobes merge into one silhouette. Lobe sizes vary slightly.            */

const kumo = (
  r: number,
  rot: number,
  aspect: number,
  lobes: number,
  rng: Rng,
): MotifGeometry => {
  const halfWidth = r * aspect;
  const height = r;
  const path = new Path2D();

  const baseTop = -height * 0.06;
  const baseBottom = height * 0.5;
  const corner = height * 0.16;

  // Body with a gently curved base.
  path.moveTo(-halfWidth + corner, baseTop);
  path.lineTo(halfWidth - corner, baseTop);
  path.quadraticCurveTo(halfWidth, baseTop, halfWidth, baseTop + corner);
  path.lineTo(halfWidth, baseBottom - corner);
  path.quadraticCurveTo(halfWidth, baseBottom, halfWidth - corner, baseBottom);
  path.quadraticCurveTo(0, baseBottom + height * 0.1, -halfWidth + corner, baseBottom);
  path.quadraticCurveTo(-halfWidth, baseBottom, -halfWidth, baseBottom - corner);
  path.lineTo(-halfWidth, baseTop + corner);
  path.quadraticCurveTo(-halfWidth, baseTop, -halfWidth + corner, baseTop);
  path.closePath();

  // Lobes along the top.
  const step = (halfWidth * 2) / lobes;
  for (let i = 0; i < lobes; i += 1) {
    const lobeR = step * 0.5 * rng.range(0.86, 1.16);
    const cx = -halfWidth + step * (i + 0.5) + rng.bell() * step * 0.06;
    const cy = baseTop - lobeR * rng.range(0.12, 0.3);
    path.moveTo(cx + lobeR, cy);
    path.arc(cx, cy, lobeR, 0, TAU);
  }

  return {
    ...emptyGeometry(Math.max(halfWidth, height)),
    regions: rotatePath(path, rot),
    regionRule: "nonzero",
  };
};

/* ── DOT CLUSTER ────────────────────────────────────────────────────────────
   A loose scatter of small dots, denser toward the middle. Used where ring
   outlines cross.                                                           */

const dotCluster = (r: number, density: number, rng: Rng): MotifGeometry => {
  const dots: Dot[] = [];
  const count = Math.round(26 * density);
  for (let i = 0; i < count; i += 1) {
    const angle = rng.next() * TAU;
    const dist = Math.pow(rng.next(), 0.7) * r;
    dots.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      r: r * rng.range(0.045, 0.085),
    });
  }
  return { ...emptyGeometry(r), dots };
};

/* ── DISPATCH ───────────────────────────────────────────────────────────────
   The renderer walks the composition data; adding a composition never means
   touching code, only the table.                                            */

export const buildMotif = (
  spec: MotifSpec,
  radiusPx: number,
  strokePx: number,
  rng: Rng,
): MotifGeometry => {
  const rot = ((spec.rotate ?? 0) * Math.PI) / 180;
  const kind: MotifKind = spec.motif;
  switch (kind) {
    case "circle":
      return circle(radiusPx);
    case "ring":
      return ring(radiusPx);
    case "chrysanthemum":
      return chrysanthemum(radiusPx, rot, spec.petals ?? 12);
    case "sakura":
      return sakura(radiusPx, rot, rng);
    case "seigaiha":
      return seigaiha(radiusPx, spec.rings ?? 4, strokePx);
    case "ringFlower":
      return ringFlower(radiusPx, rot, spec.petals ?? 7, strokePx, rng);
    case "kumo":
      return kumo(radiusPx, rot, spec.aspect ?? 1.7, spec.petals ?? 5, rng);
    case "dotCluster":
      return dotCluster(radiusPx, spec.fillDensity ?? 1, rng);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown motif: ${String(exhaustive)}`);
    }
  }
};

/** Extent used by the open-centre guard, before any cropping. */
export const motifExtent = (spec: MotifSpec, radiusPx: number): number =>
  spec.motif === "kumo"
    ? Math.max(radiusPx * (spec.aspect ?? 1.7), radiusPx)
    : radiusPx;
