import React from "react";
import { hslLighten, rgba, type Rgb } from "../lib/color";

/**
 * Shield with a keyhole cut out of it, drawn as one even-odd path so the
 * keyhole reads through to the panel behind. Original geometry — no icon set.
 */
const SHIELD_PATH = [
  // Outer shield
  "M50 3 L95 21 L95 59 C95 91 76 111 50 119 C24 111 5 91 5 59 L5 21 Z",
  // Keyhole bow
  "M37 50 a13 13 0 1 1 26 0 a13 13 0 1 1 -26 0 Z",
  // Keyhole stem
  "M44.6 59 L55.4 59 L59.2 87 L40.8 87 Z",
].join(" ");

const INNER_RIM = "M50 14 L86 28.5 V59 C86 84.5 70 100.5 50 107.5 C30 100.5 14 84.5 14 59 V28.5 Z";

export const Shield: React.FC<{
  size: number;
  color: Rgb;
  base: Rgb;
  glow: number;
  px: (v: number) => number;
}> = ({ size, color, base, glow, px }) => {
  const width = size * (100 / 122);
  const bloom = 0.45 + glow * 1.6;

  return (
    <div
      style={{
        position: "relative",
        width: px(width),
        height: px(size),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Soft field of light behind the shield — the only bloom in the frame,
          together with the state glow on the panel border. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: px(size * 2.5),
          height: px(size * 2.5),
          marginLeft: px(-size * 1.25),
          marginTop: px(-size * 1.25),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(color, 0.3 * bloom)} 0%, ${rgba(
            color,
            0.1 * bloom,
          )} 34%, ${rgba(color, 0)} 68%)`,
        }}
      />
      <svg
        viewBox="0 0 100 122"
        width={px(width)}
        height={px(size)}
        style={{
          position: "relative",
          overflow: "visible",
          filter: `drop-shadow(0 0 ${px(26 * bloom)}px ${rgba(color, 0.55)}) drop-shadow(0 0 ${px(
            90 * bloom,
          )}px ${rgba(color, 0.35 * bloom)})`,
        }}
      >
        <defs>
          <linearGradient id="shield-face" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={rgba(hslLighten(color, 0.18), 0.98)} />
            <stop offset="52%" stopColor={rgba(color, 0.95)} />
            <stop offset="100%" stopColor={rgba(base, 0.88)} />
          </linearGradient>
        </defs>
        <clipPath id="shield-clip">
          <path d={SHIELD_PATH} clipRule="evenodd" />
        </clipPath>
        <path d={SHIELD_PATH} fill="url(#shield-face)" fillRule="evenodd" />
        {/* Faint horizontal readout lines across the face. */}
        <g clipPath="url(#shield-clip)">
          {Array.from({ length: 22 }).map((_, i) => (
            <rect
              key={i}
              x={0}
              y={6 + i * 5}
              width={100}
              height={1.1}
              fill={rgba(hslLighten(color, 0.85), 0.14)}
            />
          ))}
        </g>
        <path
          d="M50 3 L95 21 L95 59 C95 91 76 111 50 119 C24 111 5 91 5 59 L5 21 Z"
          fill="none"
          stroke={rgba(hslLighten(color, 0.5), 0.9)}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <path
          d={INNER_RIM}
          fill="none"
          stroke={rgba(hslLighten(color, 0.7), 0.22 + glow * 0.3)}
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
