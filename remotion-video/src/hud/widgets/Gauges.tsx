import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { rampTo, wobble } from "../anim";
import { rngFor } from "../random";
import { FONT_MONO, FONT_UI, type HudTheme } from "../theme";
import { NODE_WORDS } from "../text";

const TAU = Math.PI * 2;

// Arc path for a donut/ring fill, drawn clockwise from 12 o'clock.
const arc = (r: number, fraction: number) => {
  const f = Math.min(0.9999, Math.max(0.0001, fraction));
  const a = f * TAU - Math.PI / 2;
  const x = r * Math.cos(a);
  const yy = r * Math.sin(a);
  const large = f > 0.5 ? 1 : 0;
  return `M0 ${-r}A${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${yy.toFixed(2)}`;
};

// Circle filled from the bottom like a level indicator, with the reading
// inside and a chip label alongside -- the three-row cluster on the
// reference's left rail.
export const LevelGauges: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  count?: number;
  radius?: number;
  spacing?: number;
  seed: string;
}> = ({ theme, x, y, count = 3, radius = 22, spacing = 62, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:level`);
    return Array.from({ length: count }, (_, i) => ({
      target: 45 + rand() * 55,
      delay: rand() * 0.15,
      label: `${NODE_WORDS[Math.floor(rand() * NODE_WORDS.length)]}-${(i * 3 + 4) % 9}`,
    }));
  }, [seed, count]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.map((g, i) => {
        const value = rampTo(frame, g.target, g.delay, 0.8, g.target * 0.35);
        const level = value / 100;
        const cy = i * spacing;
        const fillTop = radius - level * radius * 2;
        return (
          <g key={i} transform={`translate(0 ${cy})`}>
            <clipPath id={`lvl-${seed}-${i}`}>
              <rect x={-radius} y={fillTop} width={radius * 2} height={radius * 2} />
            </clipPath>
            <circle r={radius} fill="none" stroke={theme.lineSoft} strokeWidth={1.8} />
            <circle
              r={radius - 1}
              fill={theme.barFill}
              opacity={0.9}
              clipPath={`url(#lvl-${seed}-${i})`}
            />
            {/* The reading is drawn twice and clipped to each side of
                the fill line, so it stays legible at any level instead
                of half-vanishing as the fill sweeps past it. */}
            <text
              y={4}
              textAnchor="middle"
              fontFamily={FONT_MONO}
              fontSize={12}
              fill={theme.text}
            >
              {Math.round(value)}%
            </text>
            <text
              y={4}
              textAnchor="middle"
              fontFamily={FONT_MONO}
              fontSize={12}
              fill={theme.chipText}
              clipPath={`url(#lvl-${seed}-${i})`}
            >
              {Math.round(value)}%
            </text>
            <rect x={radius + 14} y={-9} width={82} height={18} rx={2} fill={theme.chipFill} />
            <text
              x={radius + 55}
              y={4}
              textAnchor="middle"
              fontFamily={FONT_UI}
              fontWeight={600}
              fontSize={12}
              fill={theme.chipText}
              letterSpacing={0.6}
            >
              {g.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Grid of small ring gauges (top-right of the reference).
export const RingGaugeGrid: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  cols?: number;
  rows?: number;
  radius?: number;
  gap?: number;
  seed: string;
}> = ({ theme, x, y, cols = 3, rows = 2, radius = 21, gap = 56, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:rings`);
    return Array.from({ length: cols * rows }, () => ({
      target: 35 + rand() * 65,
      delay: rand() * 0.2,
    }));
  }, [seed, cols, rows]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.map((g, i) => {
        const value = rampTo(frame, g.target, g.delay, 0.85, g.target * 0.45);
        const cx = (i % cols) * (radius * 2 + gap - radius);
        const cy = Math.floor(i / cols) * (radius * 2 + gap - radius * 1.4);
        return (
          <g key={i} transform={`translate(${cx} ${cy})`}>
            <circle r={radius} fill="none" stroke={theme.barTrack} strokeWidth={3.4} />
            <path
              d={arc(radius, value / 100)}
              fill="none"
              stroke={theme.line}
              strokeWidth={3.4}
              strokeLinecap="butt"
            />
            <text
              y={4}
              textAnchor="middle"
              fontFamily={FONT_MONO}
              fontSize={11}
              fill={theme.textDim}
            >
              {Math.round(value)}%
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Donut with a leader line out to its reading, plus a secondary figure
// below -- the bottom-left cluster of the reference.
export const DonutReadout: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  radius?: number;
  thickness?: number;
  target?: number;
  secondary?: number;
  seed: string;
}> = ({
  theme,
  x,
  y,
  radius = 44,
  thickness = 15,
  target = 100,
  secondary = 87,
  seed,
}) => {
  const frame = useCurrentFrame();
  const value = rampTo(frame, target, 0.04);
  const second = rampTo(frame, secondary, 0.12, 0.92, 12);
  // Gives each instance a different centre reading rather than sharing one.
  const centreBase = useMemo(() => 40 + rngFor(`${seed}:donut`)() * 50, [seed]);

  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={radius} fill="none" stroke={theme.barTrack} strokeWidth={thickness} />
      <path
        d={arc(radius, value / 100)}
        fill="none"
        stroke={theme.barFill}
        strokeWidth={thickness}
      />
      <path
        d={`M${-radius - 6} ${-radius * 0.45}h-34l-18-14h-52`}
        fill="none"
        stroke={theme.lineSoft}
        strokeWidth={1.6}
      />
      <circle cx={-radius - 6} cy={-radius * 0.45} r={3.4} fill={theme.line} />
      <text
        x={-radius - 118}
        y={-radius * 0.45 - 18}
        fontFamily={FONT_MONO}
        fontSize={15}
        fill={theme.text}
      >
        {Math.round(value)}%
      </text>
      <path
        d={`M${-radius * 0.4} ${radius + 6}v26h-46`}
        fill="none"
        stroke={theme.lineSoft}
        strokeWidth={1.6}
      />
      <text
        x={-radius * 0.4 - 44}
        y={radius + 46}
        fontFamily={FONT_MONO}
        fontSize={14}
        fill={theme.textDim}
      >
        {Math.round(second)}%
      </text>
      <text
        y={4}
        textAnchor="middle"
        fontFamily={FONT_UI}
        fontWeight={600}
        fontSize={13}
        fill={theme.textDim}
        letterSpacing={1}
      >
        {Math.round(wobble(frame, centreBase, 26, 2))}
      </text>
    </g>
  );
};

// Pair of tiny dial gauges with a bare integer reading.
export const MiniDials: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  count?: number;
  radius?: number;
  gap?: number;
  seed: string;
}> = ({ theme, x, y, count = 2, radius = 20, gap = 52, seed }) => {
  const frame = useCurrentFrame();
  const model = useMemo(() => {
    const rand = rngFor(`${seed}:dials`);
    return Array.from({ length: count }, () => ({
      target: 55 + rand() * 45,
      delay: rand() * 0.12,
    }));
  }, [seed, count]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.map((d, i) => {
        const value = rampTo(frame, d.target, d.delay, 0.8, d.target * 0.55);
        return (
          <g key={i} transform={`translate(${i * gap} 0)`}>
            <circle r={radius} fill="none" stroke={theme.lineSoft} strokeWidth={1.6} />
            <path
              d={`${arc(radius - 5, value / 100)}`}
              fill="none"
              stroke={theme.barFill}
              strokeWidth={7}
              opacity={0.85}
            />
            <text
              y={4}
              textAnchor="middle"
              fontFamily={FONT_MONO}
              fontSize={12}
              fill={theme.text}
            >
              {Math.round(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
};
