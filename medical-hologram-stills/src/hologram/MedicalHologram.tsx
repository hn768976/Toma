import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import manifestJson from "../subjects/manifest.generated.json";
import { COLOURWAYS, COLOURWAY_IDS } from "./colourways";
import {
  HEX_CELL,
  INNER_TICK_INNER,
  INNER_TICK_OUTER,
  INNER_TICK_PITCH_DEG,
  RING_RADIUS,
  TICK_BAR_DEG,
  TICK_HALF_SPAN_DEG,
  TICK_INNER,
  TICK_OUTER,
  TICK_PITCH_DEG,
  arcPath,
  computeFit,
  hexMeshPath,
  polar,
  sparklePath,
  streakFalloffStops,
} from "./layout";
import {
  castTransform,
  gaussianStops,
  rampStops,
  rgb,
  superGaussianStops,
  type Stop,
} from "./field";
import { range, seededRng } from "./random";
import type { ColourwayId, FlatPath, Manifest, SubjectManifest } from "./types";

// The field halo gradient is drawn out to this many multiples of its scale;
// beyond it the fitted falloff is below 1/255.
const HALO_REACH = 1.7;

const SCREEN: React.CSSProperties = { mixBlendMode: "screen" };

const renderStops = (stops: Stop[]) =>
  stops.map((st, i) => (
    <stop key={i} offset={st.offset} stopColor={st.colour} stopOpacity={st.opacity} />
  ));

const MANIFEST = manifestJson as Manifest;
export const SUBJECTS: SubjectManifest[] = MANIFEST.subjects;
export const getSubject = (id: string) => SUBJECTS.find((s) => s.id === id);

const subjectIds = SUBJECTS.map((s) => s.id);
export const medicalHologramSchema = z.object({
  subjectId:
    subjectIds.length > 0
      ? z.enum(subjectIds as [string, ...string[]])
      : z.string(),
  colourway: z.enum(COLOURWAY_IDS as [ColourwayId, ...ColourwayId[]]),
});
export type MedicalHologramProps = z.infer<typeof medicalHologramSchema>;

// ---------------------------------------------------------------------------
// Seeded decoration (sparkles, particles, trails) — pure function of the
// subject id + frame size, so both colourways of a subject match exactly.
// ---------------------------------------------------------------------------
type PathKind = "fill" | "line" | "band";
type Sparkle = { x: number; y: number; r: number; rot: number; bright: number };
type Particle = { x: number; y: number; r: number; o: number; blur: boolean; tint: boolean };
type Trail = { d: string; o: number };

const buildDecor = (subject: SubjectManifest, W: number, H: number) => {
  const fit = computeFit(subject, W, H);
  const rng = seededRng(`decor:${subject.id}`);

  // Sparkles sit on high-curvature points of the artwork outline.
  const count = 5 + Math.floor(rng() * 4); // 5..8
  const sparkles: Sparkle[] = [];
  const anchors = subject.anchors;
  let guard = 0;
  for (let i = 0; sparkles.length < count && anchors.length > 0 && guard < 400; i++, guard++) {
    const a = anchors[i % anchors.length];
    if (i >= anchors.length || rng() < 0.7) {
      const x = fit.tx + a.x * fit.scale;
      const y = fit.ty + a.y * fit.scale;
      if (sparkles.some((s) => Math.hypot(s.x - x, s.y - y) < H * 0.09)) continue;
      const big = sparkles.length === 0;
      sparkles.push({
        x,
        y,
        r: H * (big ? range(rng, 0.024, 0.032) : range(rng, 0.011, 0.022)),
        rot: rng() < 0.25 ? 45 : 0,
        bright: range(rng, 0.75, 1),
      });
    }
  }

  // Fine drifting dots, biased toward the middle band of the frame.
  const particles: Particle[] = [];
  const n = 170;
  for (let i = 0; i < n; i++) {
    const x = range(rng, 0.02, 0.98) * W;
    const y = H / 2 + (rng() + rng() - 1) * H * 0.62;
    if (y < 0 || y > H) continue;
    particles.push({
      x,
      y,
      r: H * range(rng, 0.0005, 0.0021),
      o: range(rng, 0.2, 0.9),
      blur: rng() < 0.4,
      tint: rng() < 0.3,
    });
  }

  // Long, very faint curved lines sweeping out of the ring toward the frame
  // edges — a tight fan on the right and a looser one through the lower left,
  // as in the reference. Each is a single bowed curve that starts on the ring
  // and leaves the frame, so nothing ever crosses the subject.
  const trails: Trail[] = [];
  const cx = W / 2;
  const cy = H / 2;
  const R = RING_RADIUS * H;
  const sweep = (x0: number, y0: number, x1: number, y1: number, bow: number) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    return `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${(
      (x0 + x1) / 2 - (dy / len) * bow
    ).toFixed(1)} ${((y0 + y1) / 2 + (dx / len) * bow).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const fan = (
    degs: number[],
    endX: number,
    endY: (i: number) => number,
    bow: (i: number) => number,
    o: number,
  ) => {
    degs.forEach((deg, i) => {
      const start = polar(cx, cy, R * range(rng, 0.99, 1.06), deg + range(rng, -3, 3));
      trails.push({
        d: sweep(start.x, start.y, endX, endY(i), bow(i) * range(rng, 0.85, 1.15)),
        o: o * range(rng, 0.65, 1.1),
      });
    });
  };
  // right flank: a tight fan flattening out toward the right edge
  fan([-70, -55, -40], W * 1.02, (i) => cy - H * (0.3 - i * 0.09), (i) => H * (0.1 + i * 0.035), 0.3);
  // lower right
  fan([34], W * 1.02, () => cy + H * 0.24, () => -H * 0.08, 0.2);
  // lower left
  fan([146, 128], -W * 0.02, (i) => cy + H * (0.13 + i * 0.16), () => H * 0.11, 0.24);

  // A few fine dots riding the trails, as in the reference.
  const pointOn = (d: string, t: number) => {
    const m = d.match(/M([-\d.]+) ([-\d.]+)Q([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/);
    if (!m) return null;
    const [x0, y0, qx, qy, x1, y1] = m.slice(1).map(Number);
    const u = 1 - t;
    return { x: u * u * x0 + 2 * u * t * qx + t * t * x1, y: u * u * y0 + 2 * u * t * qy + t * t * y1 };
  };
  for (const tr of trails) {
    const n = Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const pt = pointOn(tr.d, range(rng, 0.12, 0.88));
      if (!pt || pt.x < 0 || pt.x > W || pt.y < 0 || pt.y > H) continue;
      particles.push({
        x: pt.x,
        y: pt.y,
        r: H * range(rng, 0.0009, 0.0022),
        o: range(rng, 0.5, 1),
        blur: false,
        tint: rng() < 0.5,
      });
    }
  }

  return { fit, sparkles, particles, trails };
};

// ---------------------------------------------------------------------------
// Ring tick band. In the reference this is the strongest piece of HUD
// furniture: wide, closely spaced radial bars straddling the ring across the
// top and bottom of the frame, plus a fainter, finer band further in. Radii
// and pitch are measured (see layout.ts).
// ---------------------------------------------------------------------------
type Tick = { d: string; o: number; w: number };

const buildTickBand = (
  cx: number,
  cy: number,
  H: number,
  innerFrac: number,
  outerFrac: number,
  pitchDeg: number,
  barDeg: number,
  halfSpanDeg: number,
  opacity: number,
): Tick[] => {
  const ticks: Tick[] = [];
  const inner = innerFrac * H;
  const outer = outerFrac * H;
  const mid = (inner + outer) / 2;
  // A bar of angular width barDeg at the mid radius, drawn as a thick stroke.
  const w = 2 * mid * Math.sin((barDeg * Math.PI) / 360);
  const steps = Math.floor(halfSpanDeg / pitchDeg);
  for (const centre of [270, 90]) {
    for (let k = -steps; k <= steps; k++) {
      const deg = centre + k * pitchDeg;
      const p0 = polar(cx, cy, inner, deg);
      const p1 = polar(cx, cy, outer, deg);
      const fade = 1 - Math.pow(Math.abs(k) / (steps + 1), 2.5);
      ticks.push({ d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}`, o: opacity * fade, w });
    }
  }
  return ticks;
};

// ---------------------------------------------------------------------------
// The still
// ---------------------------------------------------------------------------
export const MedicalHologram: React.FC<MedicalHologramProps> = ({ subjectId, colourway }) => {
  const { width: W, height: H } = useVideoConfig();
  const subject = getSubject(subjectId);
  const cw = COLOURWAYS[colourway];
  if (!subject) {
    throw new Error(
      `Unknown subject "${subjectId}". Add a row to src/subjects/subjects.json and run "npm run prepare-subjects".`,
    );
  }

  const cx = W / 2;
  const cy = H / 2;
  const R = RING_RADIUS * H;
  const mesh = useMemo(() => hexMeshPath(W, H, HEX_CELL * H), [W, H]);
  const ticks = useMemo(
    () => [
      ...buildTickBand(cx, cy, H, TICK_INNER, TICK_OUTER, TICK_PITCH_DEG, TICK_BAR_DEG, TICK_HALF_SPAN_DEG, 0.072),
      ...buildTickBand(cx, cy, H, INNER_TICK_INNER, INNER_TICK_OUTER, INNER_TICK_PITCH_DEG, 1.1, 50, 0.04),
    ],
    [cx, cy, H],
  );
  const { fit, sparkles, particles, trails } = useMemo(() => buildDecor(subject, W, H), [subject, W, H]);

  // Template sizes are fractions of frame height; inside the fitted subject
  // group everything is in artwork units, so convert with px().
  const s = fit.scale;
  const px = (fraction: number) => (fraction * H) / s;
  const templateStroke = px(0.0032);
  // Line art wider than a few template strokes is drawn as a hollow "band"
  // (two crisp edges, translucent interior with the mesh showing through),
  // so thick strokes read as holograms rather than solid tubes.
  const BAND_FACTOR = 3;
  const kindOf = (p: FlatPath): PathKind =>
    p.mode === "fill" ? "fill" : p.strokeWidth > templateStroke * BAND_FACTOR ? "band" : "line";
  const hasBands = subject.paths.some((p) => kindOf(p) === "band");
  const hasInterior = subject.paths.some((p) => kindOf(p) !== "line");
  const lineWidth = (p: FlatPath) => (p.mode === "stroke" ? Math.max(p.strokeWidth, templateStroke) : templateStroke);
  const cap = (p: FlatPath) => (p.mode === "stroke" ? p.linecap : "round");
  const join = (p: FlatPath) => (p.mode === "stroke" ? p.linejoin : "round");
  const uid = `${subject.id}-${colourway}`;
  // Filter region for subject layers, in artwork units (bbox-relative
  // regions collapse on zero-height lines, so use explicit bounds).
  const fb = subject.bbox;
  const subjectFilterRegion = { x: fb.x - fb.w, y: fb.y - fb.h, width: fb.w * 3, height: fb.h * 3 };

  const renderPaths = (
    attrs: (p: FlatPath) => React.SVGProps<SVGPathElement>,
    only?: PathKind,
  ) =>
    subject.paths.map((p, i) =>
      only && kindOf(p) !== only ? null : (
        <path
          key={i}
          d={p.d}
          fillRule={p.fillRule}
          strokeLinecap={cap(p) as React.SVGProps<SVGPathElement>["strokeLinecap"]}
          strokeLinejoin={join(p) as React.SVGProps<SVGPathElement>["strokeLinejoin"]}
          {...attrs(p)}
        />
      ),
    );

  return (
    <AbsoluteFill style={{ backgroundColor: rgb(cw.field.tint.map((t) => t * cw.field.ramp[0]) as [number, number, number]) }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", shapeRendering: "geometricPrecision" }}
      >
        <defs>
          {/* 1. Background field — the fitted layer stack (see field.ts) */}
          <linearGradient id={`${uid}-base`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={0}>
            {renderStops(rampStops(cw.field))}
          </linearGradient>
          <radialGradient
            id={`${uid}-castL`}
            gradientUnits="userSpaceOnUse"
            cx={cw.field.left.x * W}
            cy={H / 2}
            r={3 * cw.field.left.sx * W}
            gradientTransform={castTransform(cw.field.left, W, H)}
          >
            {renderStops(gaussianStops(rgb(cw.field.left.colour)))}
          </radialGradient>
          <radialGradient
            id={`${uid}-castR`}
            gradientUnits="userSpaceOnUse"
            cx={cw.field.right.x * W}
            cy={H / 2}
            r={3 * cw.field.right.sx * W}
            gradientTransform={castTransform(cw.field.right, W, H)}
          >
            {renderStops(gaussianStops(rgb(cw.field.right.colour)))}
          </radialGradient>
          <radialGradient
            id={`${uid}-fieldHalo`}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            r={cw.field.halo.scale * HALO_REACH * H}
          >
            {renderStops(superGaussianStops(rgb(cw.field.halo.colour), cw.field.halo.power, HALO_REACH))}
          </radialGradient>
          <linearGradient id={`${uid}-bottomShade`} gradientUnits="userSpaceOnUse" x1={0} y1={cy} x2={0} y2={H}>
            <stop offset="0" stopColor="#000008" stopOpacity="0" />
            <stop offset="0.5" stopColor="#000008" stopOpacity={cw.field.bottomShade * 0.5} />
            <stop offset="1" stopColor="#000008" stopOpacity={cw.field.bottomShade} />
          </linearGradient>

          {/* 2. Hex mesh: brighter where it crosses the central glow */}
          <radialGradient id={`${uid}-meshGrad`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={H * 0.78}>
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.16" />
          </radialGradient>
          <mask id={`${uid}-meshMask`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect width={W} height={H} fill={`url(#${uid}-meshGrad)`} />
          </mask>

          {/* 3. HUD ring: fades out at the top and bottom */}
          <linearGradient id={`${uid}-ringFadeGrad`} gradientUnits="userSpaceOnUse" x1={0} y1={cy - R} x2={0} y2={cy + R}>
            <stop offset="0" stopColor="#000" />
            <stop offset="0.14" stopColor="#fff" />
            <stop offset="0.86" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id={`${uid}-ringFade`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect width={W} height={H} fill={`url(#${uid}-ringFadeGrad)`} />
          </mask>
          <linearGradient id={`${uid}-arcFade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`${uid}-arcMaskL`} maskContentUnits="objectBoundingBox" maskUnits="objectBoundingBox" x="-0.1" y="-0.1" width="1.2" height="1.2">
            <rect x="-0.1" y="-0.1" width="1.2" height="1.2" fill={`url(#${uid}-arcFade)`} />
          </mask>
          <radialGradient id={`${uid}-flareL`}>
            <stop offset="0" stopColor={cw.arcLeft} stopOpacity="0.8" />
            <stop offset="0.25" stopColor={cw.arcLeft} stopOpacity="0.22" />
            <stop offset="0.6" stopColor={cw.arcLeft} stopOpacity="0.05" />
            <stop offset="1" stopColor={cw.arcLeft} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-flareR`}>
            <stop offset="0" stopColor={cw.arcRight} stopOpacity="0.8" />
            <stop offset="0.25" stopColor={cw.arcRight} stopOpacity="0.22" />
            <stop offset="0.6" stopColor={cw.arcRight} stopOpacity="0.05" />
            <stop offset="1" stopColor={cw.arcRight} stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-arcGlow`} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <feGaussianBlur stdDeviation={H * 0.006} />
          </filter>

          {/* 4. Central burst + horizontal lens streak */}
          <radialGradient id={`${uid}-burst`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={H * 0.34}>
            <stop offset="0" stopColor={cw.burst} stopOpacity="0.95" />
            <stop offset="0.1" stopColor={cw.burst} stopOpacity="0.6" />
            <stop offset="0.3" stopColor={cw.burst} stopOpacity="0.22" />
            <stop offset="0.6" stopColor={cw.burst} stopOpacity="0.06" />
            <stop offset="1" stopColor={cw.burst} stopOpacity="0" />
          </radialGradient>
          {/* The streak has no hard core in the reference: a soft ~0.018H band
              with a brighter centre, fading to nothing well before the frame
              edge (measured falloff exp(-(dx/0.5H)^2.6)). */}
          <linearGradient id={`${uid}-streakV`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cw.streak} stopOpacity="0" />
            <stop offset="0.3" stopColor={cw.streak} stopOpacity="0.045" />
            <stop offset="0.44" stopColor={cw.streak} stopOpacity="0.19" />
            <stop offset="0.5" stopColor={cw.streak} stopOpacity="0.28" />
            <stop offset="0.56" stopColor={cw.streak} stopOpacity="0.19" />
            <stop offset="0.7" stopColor={cw.streak} stopOpacity="0.045" />
            <stop offset="1" stopColor={cw.streak} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-streakWideV`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cw.streak} stopOpacity="0" />
            <stop offset="0.5" stopColor={cw.streak} stopOpacity="0.045" />
            <stop offset="1" stopColor={cw.streak} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-streakH`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={0}>
            {renderStops(streakFalloffStops(W, H))}
          </linearGradient>
          <mask id={`${uid}-streakMask`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect width={W} height={H} fill={`url(#${uid}-streakH)`} />
          </mask>

          {/* 5. Subject */}
          {/* Interior of the artwork: filled shapes plus wide line-art bands */}
          <mask id={`${uid}-interiorLocal`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" {...subjectFilterRegion}>
            {renderPaths(() => ({ fill: "#fff", stroke: "none" }), "fill")}
            {renderPaths((p) => ({ fill: "none", stroke: "#fff", strokeWidth: p.strokeWidth }), "band")}
          </mask>
          <mask id={`${uid}-interiorFrame`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <g transform={fit.transform}>
              {renderPaths(() => ({ fill: "#fff", stroke: "none" }), "fill")}
              {renderPaths((p) => ({ fill: "none", stroke: "#fff", strokeWidth: p.strokeWidth }), "band")}
            </g>
          </mask>
          {/* Wide line art: keep only the two edges of each band... */}
          <mask id={`${uid}-bandRing`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" {...subjectFilterRegion}>
            {renderPaths((p) => ({ fill: "none", stroke: "#fff", strokeWidth: p.strokeWidth }), "band")}
            {renderPaths((p) => ({ fill: "none", stroke: "#000", strokeWidth: p.strokeWidth - 2 * templateStroke }), "band")}
          </mask>
          {/* ...and everything except the band interiors */}
          <mask id={`${uid}-bandOutside`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" {...subjectFilterRegion}>
            <rect {...subjectFilterRegion} fill="#fff" />
            {renderPaths((p) => ({ fill: "none", stroke: "#000", strokeWidth: p.strokeWidth - 2 * templateStroke }), "band")}
          </mask>
          <filter id={`${uid}-glowBig`} filterUnits="userSpaceOnUse" {...subjectFilterRegion}>
            <feGaussianBlur stdDeviation={px(0.014)} />
          </filter>
          <filter id={`${uid}-glowSoft`} filterUnits="userSpaceOnUse" {...subjectFilterRegion}>
            <feGaussianBlur stdDeviation={px(0.006)} />
          </filter>
          <filter id={`${uid}-glowTight`} filterUnits="userSpaceOnUse" {...subjectFilterRegion}>
            <feGaussianBlur stdDeviation={px(0.0022)} />
          </filter>
          <filter id={`${uid}-rimBlur`} filterUnits="userSpaceOnUse" {...subjectFilterRegion}>
            <feGaussianBlur stdDeviation={px(0.007)} />
          </filter>

          {/* 6. Sparkles + particles */}
          <radialGradient id={`${uid}-sparkleGlow`}>
            <stop offset="0" stopColor={cw.sparkle} stopOpacity="0.6" />
            <stop offset="0.3" stopColor={cw.glow} stopOpacity="0.22" />
            <stop offset="1" stopColor={cw.glow} stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-dotBlur`} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <feGaussianBlur stdDeviation={H * 0.0014} />
          </filter>
          {/* Trails fade out before they reach the frame edge, as in the
              reference, so they read as passing through rather than stopping. */}
          <radialGradient id={`${uid}-trailFade`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={W * 0.56}>
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.62" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.85" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${uid}-trailMask`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect width={W} height={H} fill={`url(#${uid}-trailFade)`} />
          </mask>
        </defs>

        {/* ---- 1. Background ---- */}
        <rect width={W} height={H} fill={`url(#${uid}-base)`} />
        {/* Each cast screens onto everything painted below it. The blend mode
            has to sit on the element, not on a wrapping group: siblings inside
            a group composite with each other normally, and only the finished
            group would blend with the backdrop. */}
        <rect width={W} height={H} fill={`url(#${uid}-castL)`} style={SCREEN} />
        <rect width={W} height={H} fill={`url(#${uid}-castR)`} style={SCREEN} />
        <rect width={W} height={H} fill={`url(#${uid}-fieldHalo)`} style={SCREEN} />
        <rect x={0} y={cy} width={W} height={H - cy} fill={`url(#${uid}-bottomShade)`} />

        {/* ---- 2. Hex mesh ---- */}
        <path
          d={mesh}
          fill="none"
          stroke={cw.mesh}
          strokeWidth={H * 0.00045}
          strokeOpacity={0.62}
          mask={`url(#${uid}-meshMask)`}
        />

        {/* ---- 3. HUD ring assembly ---- */}
        <g mask={`url(#${uid}-ringFade)`}>
          <circle cx={cx} cy={cy} r={H * 0.408} fill="none" stroke={cw.ring} strokeWidth={H * 0.0007} strokeOpacity={0.14} strokeDasharray={`${H * 0.02} ${H * 0.013}`} />
          <circle cx={cx} cy={cy} r={H * 0.502} fill="none" stroke={cw.ring} strokeWidth={H * 0.0007} strokeOpacity={0.1} strokeDasharray={`${H * 0.032} ${H * 0.021}`} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={cw.ring} strokeWidth={H * 0.006} strokeOpacity={0.3} filter={`url(#${uid}-arcGlow)`} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={cw.ring} strokeWidth={H * 0.0016} strokeOpacity={0.8} />
        </g>
        <g fill="none" stroke={cw.ring}>
          {ticks.map((t, i) => (
            <path key={i} d={t.d} strokeWidth={t.w} strokeOpacity={t.o} />
          ))}
        </g>
        {/* The two accent arcs run most of the left and right flanks and each
            carries a bright point flare where it crosses the centre line. */}
        <g style={{ mixBlendMode: "screen" }}>
          <g mask={`url(#${uid}-arcMaskL)`}>
            <path d={arcPath(cx, cy, R, 138, 222)} fill="none" stroke={cw.arcLeft} strokeWidth={H * 0.014} strokeOpacity={0.5} filter={`url(#${uid}-arcGlow)`} />
            <path d={arcPath(cx, cy, R, 138, 222)} fill="none" stroke={cw.arcLeft} strokeWidth={H * 0.0028} />
          </g>
          <g mask={`url(#${uid}-arcMaskL)`}>
            <path d={arcPath(cx, cy, R, -42, 42)} fill="none" stroke={cw.arcRight} strokeWidth={H * 0.014} strokeOpacity={0.5} filter={`url(#${uid}-arcGlow)`} />
            <path d={arcPath(cx, cy, R, -42, 42)} fill="none" stroke={cw.arcRight} strokeWidth={H * 0.0028} />
          </g>
          <circle cx={cx - R} cy={cy} r={H * 0.085} fill={`url(#${uid}-flareL)`} />
          <circle cx={cx + R} cy={cy} r={H * 0.085} fill={`url(#${uid}-flareR)`} />
          {([[cx - R, cw.arcLeft], [cx + R, cw.arcRight]] as [number, string][]).map(([fx, fc], i) => (
            <g key={i} transform={`translate(${fx} ${cy})`}>
              <circle r={H * 0.02} fill={`url(#${uid}-sparkleGlow)`} />
              <path d={sparklePath(H * 0.016)} fill={cw.sparkle} opacity={0.95} />
              <path d={`M${-H * 0.055} 0H${H * 0.055}`} stroke={fc} strokeWidth={H * 0.0014} opacity={0.8} />
            </g>
          ))}
        </g>

        {/* ---- 4. Central light burst + lens streak ---- */}
        <g style={{ mixBlendMode: "screen" }}>
          <circle cx={cx} cy={cy} r={H * 0.34} fill={`url(#${uid}-burst)`} />
          <g mask={`url(#${uid}-streakMask)`}>
            <rect x={0} y={cy - H * 0.1} width={W} height={H * 0.2} fill={`url(#${uid}-streakWideV)`} />
            <rect x={0} y={cy - H * 0.022} width={W} height={H * 0.044} fill={`url(#${uid}-streakV)`} />
          </g>
        </g>

        {/* ---- 5. Subject ---- */}
        <g transform={fit.transform}>
          {/* outer glow */}
          <g style={{ mixBlendMode: "screen" }}>
            <g filter={`url(#${uid}-glowBig)`} opacity={0.8}>
              {renderPaths((p) => ({ fill: "none", stroke: cw.glow, strokeWidth: lineWidth(p) + px(0.012) }), "fill")}
              {renderPaths((p) => ({ fill: "none", stroke: cw.glow, strokeWidth: lineWidth(p) + px(0.012) }), "line")}
            </g>
            {hasBands ? (
              <g mask={`url(#${uid}-bandOutside)`}>
                <g filter={`url(#${uid}-glowBig)`} opacity={0.8}>
                  {renderPaths((p) => ({ fill: "none", stroke: cw.glow, strokeWidth: p.strokeWidth + px(0.012) }), "band")}
                </g>
              </g>
            ) : null}
          </g>
          {/* translucent interior: filled shapes and wide bands; thin lines get a soft halo band instead */}
          {/* group opacity, so overlapping shapes / band junctions don't stack up brighter */}
          <g opacity={0.25}>
            {renderPaths(() => ({ fill: cw.fill, stroke: "none" }), "fill")}
            {renderPaths((p) => ({ fill: "none", stroke: cw.fill, strokeWidth: p.strokeWidth }), "band")}
          </g>
          <g filter={`url(#${uid}-glowSoft)`} opacity={0.22}>
            {renderPaths((p) => ({ fill: "none", stroke: cw.fill, strokeWidth: lineWidth(p) + px(0.016) }), "line")}
          </g>
        </g>
        {/* hex mesh, brighter inside the subject */}
        {hasInterior ? (
          <path
            d={mesh}
            fill="none"
            stroke={cw.mesh}
            strokeWidth={H * 0.0006}
            strokeOpacity={0.62}
            mask={`url(#${uid}-interiorFrame)`}
          />
        ) : null}
        <g transform={fit.transform}>
          {/* inner rim brightening, lit from the upper left */}
          {hasInterior ? (
            <g mask={`url(#${uid}-interiorLocal)`} style={{ mixBlendMode: "screen" }}>
              <g filter={`url(#${uid}-rimBlur)`} opacity={0.42}>
                {renderPaths(() => ({ fill: "none", stroke: cw.rim, strokeWidth: px(0.022) }), "fill")}
              </g>
              <g filter={`url(#${uid}-rimBlur)`} opacity={0.5} transform={`translate(${px(0.006)} ${px(0.006)})`}>
                {renderPaths(() => ({ fill: "none", stroke: cw.rim, strokeWidth: px(0.02) }), "fill")}
              </g>
              {hasBands ? (
                <g filter={`url(#${uid}-rimBlur)`} opacity={0.55}>
                  <g mask={`url(#${uid}-bandRing)`}>
                    {renderPaths((p) => ({ fill: "none", stroke: cw.rim, strokeWidth: p.strokeWidth }), "band")}
                  </g>
                </g>
              ) : null}
            </g>
          ) : null}
          {/* outline halo */}
          <g filter={`url(#${uid}-glowTight)`} opacity={0.75}>
            {renderPaths((p) => ({ fill: "none", stroke: cw.outline, strokeWidth: lineWidth(p) + px(0.0035) }), "fill")}
            {renderPaths((p) => ({ fill: "none", stroke: cw.outline, strokeWidth: lineWidth(p) + px(0.0035) }), "line")}
          </g>
          {/* crisp outline — the brightest element in frame */}
          <g>
            {renderPaths((p) => ({ fill: "none", stroke: cw.outline, strokeWidth: lineWidth(p) }), "fill")}
            {renderPaths((p) => ({ fill: "none", stroke: cw.outline, strokeWidth: lineWidth(p) }), "line")}
          </g>
          {hasBands ? (
            <g mask={`url(#${uid}-bandOutside)`}>
              <g filter={`url(#${uid}-glowTight)`} opacity={0.75}>
                {renderPaths((p) => ({ fill: "none", stroke: cw.outline, strokeWidth: p.strokeWidth + px(0.0035) }), "band")}
              </g>
              {renderPaths((p) => ({ fill: "none", stroke: cw.outline, strokeWidth: p.strokeWidth }), "band")}
            </g>
          ) : null}
        </g>

        {/* ---- 6. Sparkles, particles, motion trails ---- */}
        <g fill="none" strokeLinecap="round" mask={`url(#${uid}-trailMask)`}>
          {trails.map((t, i) => (
            <path key={i} d={t.d} stroke={cw.ring} strokeWidth={H * 0.0011} opacity={t.o} />
          ))}
        </g>
        <g fill={cw.sparkle}>
          {particles.filter((p) => !p.blur).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.tint ? cw.glow : cw.sparkle} opacity={p.o} />
          ))}
        </g>
        <g filter={`url(#${uid}-dotBlur)`}>
          {particles.filter((p) => p.blur).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r * 1.6} fill={p.tint ? cw.glow : cw.sparkle} opacity={p.o * 0.8} />
          ))}
        </g>
        <g style={{ mixBlendMode: "screen" }}>
          {sparkles.map((sp, i) => (
            <g key={i} transform={`translate(${sp.x} ${sp.y}) rotate(${sp.rot})`} opacity={sp.bright}>
              <circle r={sp.r * 3.2} fill={`url(#${uid}-sparkleGlow)`} />
              <path d={sparklePath(sp.r)} fill={cw.sparkle} />
              <path d={`M0 ${-sp.r * 2.1}V${sp.r * 2.1}M${-sp.r * 2.1} 0H${sp.r * 2.1}`} stroke={cw.sparkle} strokeWidth={H * 0.0008} strokeOpacity={0.7} fill="none" />
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
