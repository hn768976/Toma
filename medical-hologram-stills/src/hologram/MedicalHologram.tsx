import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import manifestJson from "../subjects/manifest.generated.json";
import { COLOURWAYS, COLOURWAY_IDS } from "./colourways";
import {
  HEX_CELL,
  RING_RADIUS,
  arcPath,
  computeFit,
  hexMeshPath,
  polar,
  sparklePath,
} from "./layout";
import { range, seededRng } from "./random";
import type { ColourwayId, FlatPath, Manifest, SubjectManifest } from "./types";

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

  // Long faint curved lines sweeping through the lower left and right.
  const trails: Trail[] = [];
  const cx = W / 2;
  const cy = H / 2;
  const mk = (ccx: number, ccy: number, r: number, a0: number, a1: number, o: number) =>
    trails.push({ d: arcPath(ccx, ccy, r, a0, a1), o });
  mk(cx - W * range(rng, 0.02, 0.08), cy + H * range(rng, 0.02, 0.1), H * range(rng, 0.62, 0.7), 118 + range(rng, -6, 6), 196 + range(rng, -6, 6), 0.22);
  mk(cx - W * range(rng, 0.0, 0.05), cy + H * range(rng, 0.08, 0.16), H * range(rng, 0.74, 0.82), 128 + range(rng, -6, 6), 178 + range(rng, -6, 6), 0.14);
  mk(cx + W * range(rng, 0.02, 0.08), cy - H * range(rng, 0.0, 0.08), H * range(rng, 0.66, 0.74), -34 + range(rng, -6, 6), 44 + range(rng, -6, 6), 0.18);

  return { fit, sparkles, particles, trails };
};

// ---------------------------------------------------------------------------
// Ring tick band: dense at the top and bottom, sparse at the sides.
// ---------------------------------------------------------------------------
const buildTicks = (cx: number, cy: number, R: number, H: number) => {
  const ticks: { d: string; o: number; w: number }[] = [];
  const inner = R + H * 0.018;
  const push = (deg: number, len: number, o: number, w: number) => {
    const p0 = polar(cx, cy, inner, deg);
    const p1 = polar(cx, cy, inner + len, deg);
    ticks.push({ d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}`, o, w });
  };
  const bands = [270, 90]; // screen-space: 270 = top, 90 = bottom
  for (const centre of bands) {
    for (let k = -44; k <= 44; k++) {
      const deg = centre + k * 1.5;
      const long = k % 5 === 0;
      const edge = 1 - Math.pow(Math.abs(k) / 46, 3); // fade toward band ends
      push(deg, H * (long ? 0.013 : 0.007), (long ? 0.5 : 0.32) * edge, H * (long ? 0.0011 : 0.0008));
    }
  }
  for (let deg = 0; deg < 360; deg += 7.5) {
    const fromTop = Math.min(Math.abs(((deg - 270 + 540) % 360) - 180), Math.abs(((deg - 90 + 540) % 360) - 180));
    if (fromTop > 114) continue; // inside the dense bands
    push(deg, H * 0.006, 0.16, H * 0.0008);
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
  const ticks = useMemo(() => buildTicks(cx, cy, R, H), [cx, cy, R, H]);
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
    <AbsoluteFill style={{ backgroundColor: cw.fieldEdge }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", shapeRendering: "geometricPrecision" }}
      >
        <defs>
          {/* 1. Background field */}
          <radialGradient id={`${uid}-field`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={W * 0.6}>
            <stop offset="0" stopColor={cw.fieldCentre} />
            <stop offset="0.3" stopColor={cw.fieldCentre} stopOpacity="0.45" />
            <stop offset="1" stopColor={cw.fieldEdge} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-halo`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={H * 0.5}>
            <stop offset="0" stopColor={cw.fieldCentre} stopOpacity="0.9" />
            <stop offset="0.7" stopColor={cw.fieldCentre} stopOpacity="0.25" />
            <stop offset="1" stopColor={cw.fieldCentre} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-castL`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W * 0.55} y2={0}>
            <stop offset="0" stopColor={cw.castLeft} stopOpacity="0.55" />
            <stop offset="0.45" stopColor={cw.castLeft} stopOpacity="0.18" />
            <stop offset="1" stopColor={cw.castLeft} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-castR`} gradientUnits="userSpaceOnUse" x1={W * 0.5} y1={0} x2={W} y2={0}>
            <stop offset="0" stopColor={cw.castRight} stopOpacity="0" />
            <stop offset="1" stopColor={cw.castRight} stopOpacity="0.32" />
          </linearGradient>
          <radialGradient id={`${uid}-vignette`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={W * 0.6}>
            <stop offset="0.42" stopColor="#000010" stopOpacity="0" />
            <stop offset="1" stopColor="#000010" stopOpacity="0.62" />
          </radialGradient>

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
            <stop offset="0.2" stopColor="#fff" />
            <stop offset="0.8" stopColor="#fff" />
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
            <stop offset="0" stopColor={cw.arcLeft} stopOpacity="0.75" />
            <stop offset="0.35" stopColor={cw.arcLeft} stopOpacity="0.25" />
            <stop offset="1" stopColor={cw.arcLeft} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-flareR`}>
            <stop offset="0" stopColor={cw.arcRight} stopOpacity="0.75" />
            <stop offset="0.35" stopColor={cw.arcRight} stopOpacity="0.25" />
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
          <linearGradient id={`${uid}-streakV`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cw.streak} stopOpacity="0" />
            <stop offset="0.38" stopColor={cw.streak} stopOpacity="0.14" />
            <stop offset="0.5" stopColor={cw.streak} stopOpacity="0.85" />
            <stop offset="0.62" stopColor={cw.streak} stopOpacity="0.14" />
            <stop offset="1" stopColor={cw.streak} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-streakWideV`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cw.streak} stopOpacity="0" />
            <stop offset="0.5" stopColor={cw.streak} stopOpacity="0.16" />
            <stop offset="1" stopColor={cw.streak} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-streakH`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="0.2" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
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
          <linearGradient id={`${uid}-trailGrad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={cw.ring} stopOpacity="0" />
            <stop offset="0.5" stopColor={cw.ring} stopOpacity="1" />
            <stop offset="1" stopColor={cw.ring} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ---- 1. Background ---- */}
        <rect width={W} height={H} fill={cw.fieldEdge} />
        <rect width={W} height={H} fill={`url(#${uid}-field)`} />
        <rect width={W} height={H} fill={`url(#${uid}-halo)`} />
        <rect width={W} height={H} fill={`url(#${uid}-castL)`} />
        <rect width={W} height={H} fill={`url(#${uid}-castR)`} />
        <rect width={W} height={H} fill={`url(#${uid}-vignette)`} />

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
          <circle cx={cx} cy={cy} r={R + H * 0.075} fill="none" stroke={cw.ring} strokeWidth={H * 0.0006} strokeOpacity={0.16} strokeDasharray={`${H * 0.018} ${H * 0.012}`} />
          <circle cx={cx} cy={cy} r={R + H * 0.125} fill="none" stroke={cw.ring} strokeWidth={H * 0.0006} strokeOpacity={0.1} strokeDasharray={`${H * 0.03} ${H * 0.02}`} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={cw.ring} strokeWidth={H * 0.007} strokeOpacity={0.35} filter={`url(#${uid}-arcGlow)`} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={cw.ring} strokeWidth={H * 0.0018} strokeOpacity={0.85} />
        </g>
        <g fill="none" strokeLinecap="round" stroke={cw.ring}>
          {ticks.map((t, i) => (
            <path key={i} d={t.d} strokeWidth={t.w} strokeOpacity={t.o} />
          ))}
        </g>
        <g style={{ mixBlendMode: "screen" }}>
          <g mask={`url(#${uid}-arcMaskL)`}>
            <path d={arcPath(cx, cy, R, 145, 215)} fill="none" stroke={cw.arcLeft} strokeWidth={H * 0.012} strokeOpacity={0.55} filter={`url(#${uid}-arcGlow)`} />
            <path d={arcPath(cx, cy, R, 145, 215)} fill="none" stroke={cw.arcLeft} strokeWidth={H * 0.0034} />
          </g>
          <g mask={`url(#${uid}-arcMaskL)`}>
            <path d={arcPath(cx, cy, R, -35, 35)} fill="none" stroke={cw.arcRight} strokeWidth={H * 0.012} strokeOpacity={0.55} filter={`url(#${uid}-arcGlow)`} />
            <path d={arcPath(cx, cy, R, -35, 35)} fill="none" stroke={cw.arcRight} strokeWidth={H * 0.0034} />
          </g>
          <circle cx={cx - R} cy={cy} r={H * 0.16} fill={`url(#${uid}-flareL)`} />
          <circle cx={cx + R} cy={cy} r={H * 0.16} fill={`url(#${uid}-flareR)`} />
        </g>

        {/* ---- 4. Central light burst + lens streak ---- */}
        <g style={{ mixBlendMode: "screen" }}>
          <circle cx={cx} cy={cy} r={H * 0.34} fill={`url(#${uid}-burst)`} />
          <g mask={`url(#${uid}-streakMask)`}>
            <rect x={0} y={cy - H * 0.11} width={W} height={H * 0.22} fill={`url(#${uid}-streakWideV)`} />
            <rect x={0} y={cy - H * 0.028} width={W} height={H * 0.056} fill={`url(#${uid}-streakV)`} />
            <rect x={0} y={cy - H * 0.0012} width={W} height={H * 0.0024} fill={cw.streak} opacity={0.9} />
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
        <g fill="none" strokeLinecap="round">
          {trails.map((t, i) => (
            <path key={i} d={t.d} stroke={`url(#${uid}-trailGrad)`} strokeWidth={H * 0.0016} opacity={t.o * 1.6} />
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
