import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { SANS } from "../fonts";
import { BEATS, COLORS, type Accent } from "../theme";
import { alpha, mix } from "../color";
import { DIALOG } from "./metrics";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Point = [number, number];

/**
 * Rounded-corner polygon path. Used for the warning triangle rather than
 * a stock icon — the corner radius is what keeps it from looking like a
 * clip-art hazard sign.
 */
const roundedPolygon = (points: Point[], radius: number): string => {
  const n = points.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];

    const toward = (p: Point): Point => {
      const dx = p[0] - cur[0];
      const dy = p[1] - cur[1];
      const len = Math.hypot(dx, dy);
      const r = Math.min(radius, len / 2);
      return [cur[0] + (dx / len) * r, cur[1] + (dy / len) * r];
    };

    const a = toward(prev);
    const b = toward(next);
    d += `${i === 0 ? "M" : "L"} ${a[0].toFixed(2)} ${a[1].toFixed(2)} `;
    d += `Q ${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)} `;
  }
  return `${d}Z`;
};

const TRIANGLE = roundedPolygon(
  [
    [50, 7],
    [95, 84],
    [5, 84],
  ],
  11,
);

/**
 * The alert glyph and its heavy caps. Slams in at BEATS.alert with a
 * short scale overshoot and — for the breach — a two-frame shake. No
 * fade: a dissolve here would undercut the whole clip.
 */
export const AlertGraphic: React.FC<{ accent: Accent }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const since = frame - BEATS.alert;
  const isBreach = accent.intensity === 1;

  const scale = interpolate(since, [0, 8], [1.09, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const shakeAmp = interpolate(since, [0, 9], [isBreach ? 14 : 4, 0], CLAMP);
  const shake = Math.sin(since * 2.4) * shakeAmp;

  // The glyph keeps a slow bloom pulse going through the hold.
  const pulse = 0.5 + 0.5 * Math.sin(frame / (isBreach ? 8 : 15));
  const bloom = (isBreach ? 34 : 22) + pulse * (isBreach ? 30 : 12);

  const size = DIALOG.alert.glyph;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateX(${shake.toFixed(2)}px) scale(${scale.toFixed(4)})`,
      }}
    >
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 100 90"
        style={{
          filter: `drop-shadow(0 0 ${bloom}px ${alpha(accent.color, 0.75)}) drop-shadow(0 0 ${bloom * 2.4}px ${alpha(accent.color, 0.3)})`,
        }}
      >
        {isBreach ? (
          <>
            <path d={TRIANGLE} fill={accent.color} />
            <path
              d={TRIANGLE}
              fill="none"
              stroke={mix(accent.colorDeep, "#000000", 0.15)}
              strokeWidth={4}
              transform="translate(50 48) scale(0.8) translate(-50 -48)"
            />
            {/* Exclamation: a tapered bar over a square dot. */}
            <path
              d="M 45.6 33 L 54.4 33 L 52.9 62 L 47.1 62 Z"
              fill={COLORS.white}
            />
            <rect x={46.4} y={67} width={7.2} height={7.2} rx={1.4} fill={COLORS.white} />
          </>
        ) : (
          <>
            <circle cx={50} cy={45} r={39} fill={accent.color} />
            <circle
              cx={50}
              cy={45}
              r={31}
              fill="none"
              stroke={accent.colorDeep}
              strokeWidth={4}
            />
            <path
              d="M 34 45.5 L 45.5 57 L 67 33"
              fill="none"
              stroke={COLORS.white}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>

      <div
        style={{
          marginTop: DIALOG.alert.gap,
          fontFamily: SANS,
          fontWeight: 800,
          fontStretch: "88%",
          fontSize: DIALOG.alert.label,
          letterSpacing: "0.005em",
          color: COLORS.white,
          textShadow: `0 0 ${bloom * 0.7}px ${alpha(accent.color, 0.55)}`,
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {accent.label}
      </div>
    </div>
  );
};
