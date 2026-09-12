import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { LOOP } from "../constants";
import type { HudTheme } from "../theme";

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

// SVG arc between two angles. Drawn around (0,0); each ring is placed and
// rotated by its own <g transform>, so the path itself never changes
// between frames and only the transform is re-evaluated.
const arcPath = (r: number, from: number, to: number) => {
  const [x0, y0] = polar(0, 0, r, from);
  const [x1, y1] = polar(0, 0, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export type Ring =
  /** N evenly spaced arc segments, each `sweep` degrees wide */
  | { kind: "arcs"; r: number; count: number; sweep: number; width: number; turns: number; opacity?: number; offset?: number; accent?: boolean }
  /** dense radial ticks, like a bearing scale */
  | { kind: "ticks"; r: number; count: number; length: number; width: number; turns: number; span?: number; opacity?: number; accent?: boolean }
  /** a full circle with a dash pattern */
  | { kind: "dashed"; r: number; dash: number; gap: number; width: number; turns: number; opacity?: number; accent?: boolean }
  /** a plain circle */
  | { kind: "solid"; r: number; width: number; opacity?: number; accent?: boolean };

// The reference reticle, read off the source frame from the outside in.
// Radii are fractions of the reticle radius so one `size` prop rescales
// the whole assembly. `turns` is whole revolutions per loop -- keeping it
// an integer is what makes the rotation seamless across the loop point.
export const REFERENCE_RINGS: Ring[] = [
  { kind: "arcs", r: 1.0, count: 2, sweep: 104, width: 3, turns: 1, offset: 0, opacity: 0.85 },
  { kind: "ticks", r: 0.935, count: 96, length: 0.062, width: 2.4, turns: -1, span: 320, opacity: 0.7 },
  { kind: "arcs", r: 0.86, count: 4, sweep: 62, width: 6, turns: 1, offset: 22 },
  { kind: "dashed", r: 0.78, dash: 16, gap: 12, width: 3, turns: -2, opacity: 0.8 },
  { kind: "ticks", r: 0.705, count: 140, length: 0.038, width: 1.8, turns: 2, span: 360, opacity: 0.5 },
  { kind: "dashed", r: 0.632, dash: 34, gap: 20, width: 3.4, turns: -1, opacity: 0.9 },
  { kind: "solid", r: 0.552, width: 1.6, opacity: 0.28 },
  { kind: "arcs", r: 0.5, count: 3, sweep: 34, width: 2.4, turns: 3, offset: 10, opacity: 0.55, accent: true },
];

// Violet layout: fewer, heavier rings plus a counter-rotating accent
// scale, so the off-centre reticle still reads at its larger size.
export const VIOLET_RINGS: Ring[] = [
  { kind: "ticks", r: 1.0, count: 72, length: 0.05, width: 3, turns: 1, span: 268, opacity: 0.65 },
  { kind: "arcs", r: 0.925, count: 3, sweep: 84, width: 7, turns: -1, offset: 30 },
  { kind: "dashed", r: 0.845, dash: 26, gap: 16, width: 3, turns: 2, opacity: 0.75 },
  { kind: "arcs", r: 0.78, count: 2, sweep: 128, width: 3.5, turns: -2, offset: 45, opacity: 0.8, accent: true },
  { kind: "ticks", r: 0.69, count: 160, length: 0.034, width: 1.7, turns: 1, span: 360, opacity: 0.45 },
  { kind: "dashed", r: 0.6, dash: 40, gap: 26, width: 4, turns: -1, opacity: 0.9 },
  { kind: "solid", r: 0.5, width: 1.6, opacity: 0.3 },
  { kind: "arcs", r: 0.44, count: 4, sweep: 40, width: 2.6, turns: 3, offset: 14, opacity: 0.6, accent: true },
];

const RingShape: React.FC<{
  ring: Ring;
  size: number;
  theme: HudTheme;
  rotation: number;
}> = ({ ring, size, theme, rotation }) => {
  const stroke = ring.accent ? theme.accent : theme.line;
  const opacity = ring.opacity ?? 1;
  const r = ring.r * size;

  const content = useMemo(() => {
    if (ring.kind === "solid") {
      return <circle r={r} fill="none" stroke={stroke} strokeWidth={ring.width} />;
    }
    if (ring.kind === "dashed") {
      return (
        <circle
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={ring.width}
          strokeDasharray={`${ring.dash} ${ring.gap}`}
          strokeLinecap="butt"
        />
      );
    }
    if (ring.kind === "arcs") {
      const step = 360 / ring.count;
      const d = Array.from({ length: ring.count }, (_, i) => {
        const from = i * step + (ring.offset ?? 0);
        return arcPath(r, from, from + ring.sweep);
      }).join("");
      return (
        <path d={d} fill="none" stroke={stroke} strokeWidth={ring.width} strokeLinecap="butt" />
      );
    }
    // ticks
    const span = ring.span ?? 360;
    const inner = r - ring.length * size;
    const d = Array.from({ length: ring.count }, (_, i) => {
      const deg = (i / ring.count) * span;
      const [x0, y0] = polar(0, 0, inner, deg);
      const [x1, y1] = polar(0, 0, r, deg);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }).join("");
    return <path d={d} stroke={stroke} strokeWidth={ring.width} fill="none" />;
  }, [ring, r, size, stroke]);

  return (
    <g transform={`rotate(${rotation.toFixed(3)})`} opacity={opacity}>
      {content}
    </g>
  );
};

export const Reticle: React.FC<{
  theme: HudTheme;
  cx: number;
  cy: number;
  /** outer radius in design units */
  size: number;
  rings?: Ring[];
  /** extra whole turns applied to every ring, for a global drift */
  speed?: number;
  /** unique per instance -- scopes the filter/gradient ids */
  id?: string;
}> = ({ theme, cx, cy, size, rings = REFERENCE_RINGS, speed = 1, id = "ret" }) => {
  const frame = useCurrentFrame();
  const t = frame / LOOP;

  const shapes = rings.map((ring, i) => (
    <RingShape
      key={i}
      ring={ring}
      size={size}
      theme={theme}
      rotation={t * 360 * ("turns" in ring ? ring.turns * speed : 0)}
    />
  ));

  return (
    <g transform={`translate(${cx} ${cy})`}>
      <defs>
        <filter id={`${id}-bloom`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={size * 0.035} />
        </filter>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={theme.accent} stopOpacity={0.22} />
          <stop offset="55%" stopColor={theme.accent} stopOpacity={0.09} />
          <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r={size * 1.25} fill={`url(#${id}-glow)`} />
      {/* Blurred copy under a crisp copy: the cheap way to get the
          reference's bloomed linework without a full post pass. */}
      <g filter={`url(#${id}-bloom)`} opacity={0.8}>
        {shapes}
      </g>
      {shapes}
    </g>
  );
};
