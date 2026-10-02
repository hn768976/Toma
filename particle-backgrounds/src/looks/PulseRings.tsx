import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Look 1 - Pulse Rings (2D, SVG). Pure function of useCurrentFrame():
 * no CSS animation, no transitions, no grain. Background is exactly #000000.
 */
export type PulseRingsColors = { ring: string };

export const PULSE_FRAMES = 75; // 8 pulses per 600-frame loop (600 / 75 = 8)
const VISIBLE_RINGS = 3;

// Band profile: [position across band 0..1, ring brightness 0..1].
const BAND_STOPS: [number, number][] = [
  [0, 0],
  [0.3, 0.05],
  [0.55, 0.16],
  [0.75, 0.36],
  [0.88, 0.6],
  [0.945, 0.86],
  [0.968, 0.9],
  [0.99, 0.35],
  [1, 0],
];

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export const PulseRings: React.FC<{ colors: PulseRingsColors }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  // Outer ring diameter = 45% of frame height.
  const outerR = 0.45 * height * 0.5;
  const step = outerR / VISIBLE_RINGS;

  const local = ((frame % PULSE_FRAMES) + PULSE_FRAMES) % PULSE_FRAMES;
  const s = easeInOutSine(local / PULSE_FRAMES);

  // Slot u: 0 = centre dot being born, 1..3 = rings, 3..4 = outermost growing out and fading.
  const rings: { r: number; opacity: number; key: number }[] = [];
  for (let k = VISIBLE_RINGS; k >= 0; k--) {
    const u = k + s;
    const r = Math.max(0.0001, u * step);
    let opacity = 1;
    if (u > VISIBLE_RINGS) opacity = 1 - easeInOutSine(Math.min(1, u - VISIBLE_RINGS));
    if (u < 0.35) opacity = Math.min(opacity, easeInOutSine(u / 0.35));
    rings.push({ r, opacity, key: k });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
        <defs>
          {rings.map(({ r, key }) => (
            // Each band: black at the next-inner ring's edge, glowing up to a bright
            // soft edge at its own radius, then back to black (seamless with the next band).
            <radialGradient key={key} id={`pulse-ring-${key}`} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
              {BAND_STOPS.map(([t, v], i) => (
                <stop
                  key={i}
                  offset={Math.max(0, (r - step + t * step) / r)}
                  stopColor={colors.ring}
                  stopOpacity={v}
                />
              ))}
            </radialGradient>
          ))}
        </defs>
        {rings.map(({ r, opacity, key }) => (
          <g key={key} opacity={opacity}>
            <circle cx={cx} cy={cy} r={r} fill="#000000" />
            <circle cx={cx} cy={cy} r={r} fill={`url(#pulse-ring-${key})`} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
