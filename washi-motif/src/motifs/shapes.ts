import type { MotifKind, MotifSpec } from "../types";
import type { Rng } from "../rng";

export type Dot = { x: number; y: number; r: number };
/** The frame a full-bleed motif is built against. */
export type Frame = { width: number; height: number };
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
  /** Faint per-tile tonal fills, painted under a field's lattice. */
  washes: { path: Path2D; alpha: number }[];
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
  washes: [],
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


/* ── SURFACE MOTIFS ─────────────────────────────────────────────────────────
   These four cover the whole frame rather than sitting inside it, so they are
   built against the frame rather than against their own radius.             */

/** Deterministic 1-D value noise, cosine-interpolated and two octaves deep. */
const makeNoise = (rng: Rng, samples: number) => {
  const coarse = Array.from({ length: samples }, () => rng.next() * 2 - 1);
  const fine = Array.from({ length: samples * 4 }, () => rng.next() * 2 - 1);
  const at = (table: number[], t: number) => {
    const x = t * (table.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = table[Math.max(0, Math.min(table.length - 1, i))];
    const b = table[Math.max(0, Math.min(table.length - 1, i + 1))];
    const smooth = (1 - Math.cos(f * Math.PI)) / 2;
    return a + (b - a) * smooth;
  };
  return (t: number) => at(coarse, t) * 0.72 + at(fine, t) * 0.28;
};

/**
 * SEIGAIHA FIELD — the wave-scale pattern over the whole sheet. Rows of
 * concentric top-half arcs on a half-offset grid, so each scale overlaps the
 * two below it. Every tile also gets its own faint tonal wash, which is what
 * keeps a field of identical arcs from looking printed.
 */
const seigaihaField = (
  frame: Frame,
  unit: number,
  rings: number,
  weight: number,
  tonal: number,
  rng: Rng,
): MotifGeometry => {
  const halfW = frame.width / 2 + unit * 2;
  const halfH = frame.height / 2 + unit * 2;
  const lattice = new Path2D();
  const washes: { path: Path2D; alpha: number }[] = [];

  const rowStep = unit * 0.5;
  let row = 0;
  for (let cy = -halfH; cy <= halfH; cy += rowStep) {
    const offset = row % 2 === 0 ? 0 : unit;
    for (let cx = -halfW + offset; cx <= halfW; cx += unit * 2) {
      if (tonal > 0) {
        const wash = new Path2D();
        wash.moveTo(cx - unit, cy);
        wash.arc(cx, cy, unit, Math.PI, TAU);
        wash.closePath();
        washes.push({ path: wash, alpha: rng.range(0, tonal) });
      }
      for (let k = 1; k <= rings; k += 1) {
        const r = (unit * k) / rings;
        lattice.moveTo(cx - r, cy);
        lattice.arc(cx, cy, r, Math.PI, TAU);
      }
    }
    row += 1;
  }

  return {
    ...emptyGeometry(Math.hypot(halfW, halfH)),
    lines: [{ path: lattice, width: weight }],
    washes,
  };
};

/**
 * BRUSH RING — a circle drawn the way a loaded brush leaves it: several
 * wobbling strokes at slightly different radii, each starting and stopping
 * short of a full turn.
 */
const brushRing = (
  r: number,
  strokes: number,
  weight: number,
  rng: Rng,
): MotifGeometry => {
  const lines: StrokeSet[] = [];
  for (let i = 0; i < strokes; i += 1) {
    const noise = makeNoise(rng, 7);
    const radius = r * rng.range(0.9, 1.06);
    const start = rng.next() * TAU;
    const sweep = TAU * rng.range(0.55, 0.98);
    const path = new Path2D();
    const steps = 130;
    for (let j = 0; j <= steps; j += 1) {
      const t = j / steps;
      const a = start + sweep * t;
      const rr = radius * (1 + noise(t) * 0.035);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (j === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    lines.push({ path, width: weight * rng.range(0.5, 1.5) });
  }
  return { ...emptyGeometry(r * 1.1), lines };
};

/**
 * FOIL SWEEP — everything to one side of a torn, brushed edge.
 *
 * The body is one polygon reaching well past the frame, so there is never a
 * straight cut inside the picture. The edge itself is noise-displaced and
 * gently curved, then frayed with slivers that straddle it.
 *
 * `dryBrush` replaces the solid body with bands running PARALLEL to the edge,
 * each spanning the full length and some left out — the way a dry brush lays
 * leaf down in streaks. The gaps run with the stroke, never across it, which
 * is what the first attempt got wrong: gaps along the length showed as hard
 * rectangular holes wherever one landed inside the frame.
 */
const foilSweep = (
  frame: Frame,
  rot: number,
  roughness: number,
  dryBrush: number,
  curvature: number,
  rng: Rng,
): MotifGeometry => {
  const reach = Math.hypot(frame.width, frame.height) * 1.2;
  const at = rotator(rot);
  const path = new Path2D();
  /* Fine enough to carry the high-frequency octave of the tear. */
  const steps = 560;

  /**
   * The torn edge. Three octaves: the broad wander, the tear itself, and a
   * fine one for the fibres. A torn edge is fractal — the first attempt added
   * triangular frays instead, and a row of identical triangles reads as saw
   * teeth, not as paper.
   */
  const broad = makeNoise(rng, 7);
  const tear = makeNoise(rng, 40);
  const fine = makeNoise(rng, 220);
  const edge = (t: number) => {
    const centred = t * 2 - 1;
    return (
      broad(t) * roughness * 0.9 +
      tear(t) * roughness * 0.45 +
      fine(t) * roughness * 0.22 +
      curvature * reach * centred * centred
    );
  };

  const layEdge = (offset: number, depth: number) => {
    for (let j = 0; j <= steps; j += 1) {
      const t = j / steps;
      const u = -reach + 2 * reach * t;
      const [x, y] = at(u, edge(t) + offset);
      if (j === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.lineTo(...at(reach, depth));
    path.lineTo(...at(-reach, depth));
    path.closePath();
  };

  if (dryBrush > 0) {
    /* Bands along the stroke, with gaps between them. */
    const bands = 16;
    const span = reach * 1.6;
    for (let k = 0; k < bands; k += 1) {
      // Only the bands near the edge drop out: that breaks up the edge while
      // the body stays covered. Dropping any band striped the whole sweep.
      if (k >= 1 && k <= 4 && rng.chance(dryBrush)) continue;
      const v0 = (span * k) / bands;
      // Bands overlap, so present ones leave no seam between them.
      const v1 = v0 + (span / bands) * rng.range(1.05, 1.7);
      const bandNoise = makeNoise(rng, 8);
      for (let j = 0; j <= steps; j += 1) {
        const t = j / steps;
        const u = -reach + 2 * reach * t;
        const wobble = bandNoise(t) * roughness * (k === 0 ? 1 : 0.8);
        const [x, y] = at(u, edge(t) + (v0 - edge(t) * 0) + wobble);
        if (j === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      for (let j = steps; j >= 0; j -= 1) {
        const t = j / steps;
        const u = -reach + 2 * reach * t;
        path.lineTo(...at(u, edge(t) + v1));
      }
      path.closePath();
    }
  } else {
    layEdge(0, reach * 2);
  }

  /* A few loose fibres lifting off the tear, varied enough not to pattern. */
  const frays = 70;
  for (let i = 0; i < frays; i += 1) {
    const t = rng.next();
    const u = -reach + 2 * reach * t;
    const len = reach * Math.pow(rng.next(), 2) * 0.012 + reach * 0.001;
    const out = roughness * Math.pow(rng.next(), 1.6) * 1.1;
    const base = edge(t);
    path.moveTo(...at(u, base));
    path.lineTo(...at(u + len * rng.range(0.2, 0.8), base - out));
    path.lineTo(...at(u + len, base));
    path.lineTo(...at(u + len, base + roughness));
    path.lineTo(...at(u, base + roughness));
    path.closePath();
  }

  return {
    ...emptyGeometry(reach),
    regions: path,
    regionRule: "nonzero",
  };
};

/**
 * SPLATTER — flicked dots in a band, thrown along one direction. Used where a
 * foil edge has been struck.
 */
const splatter = (
  r: number,
  rot: number,
  aspect: number,
  count: number,
  rng: Rng,
): MotifGeometry => {
  const at = rotator(rot);
  const dots: Dot[] = [];
  for (let i = 0; i < count; i += 1) {
    const u = rng.bell() * r * aspect;
    const v = rng.bell() * r;
    const [x, y] = at(u, v);
    const size = Math.pow(rng.next(), 2.4);
    dots.push({ x, y, r: r * (0.004 + size * 0.022) });
  }
  return { ...emptyGeometry(r * aspect), dots };
};

/* ── DISPATCH ───────────────────────────────────────────────────────────────
   The renderer walks the composition data; adding a composition never means
   touching code, only the table.                                            */

export const buildMotif = (
  spec: MotifSpec,
  radiusPx: number,
  strokePx: number,
  rng: Rng,
  frame: Frame,
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
    case "seigaihaField":
      return seigaihaField(
        frame,
        (spec.unit ?? 0.12) * frame.height,
        spec.rings ?? 4,
        strokePx,
        spec.tonal ?? 0.1,
        rng,
      );
    case "brushRing":
      return brushRing(radiusPx, spec.strokes ?? 5, strokePx, rng);
    case "foilSweep":
      return foilSweep(
        frame,
        rot,
        (spec.roughness ?? 0.02) * frame.height,
        spec.dryBrush ?? 0,
        spec.aspect ?? 0,
        rng,
      );
    case "splatter":
      return splatter(
        radiusPx,
        rot,
        spec.aspect ?? 1,
        Math.round(520 * (spec.fillDensity ?? 1)),
        rng,
      );
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
