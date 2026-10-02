import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "./config";
import { mulberry32 } from "./random";
import type { WordData } from "./sampling";

type Streak = {
  angle: number;
  delay: number;
  speed: number; // fraction of height per frame^1.35
  length: number; // fraction of height
  width: number; // fraction of height
  brightness: number;
  life: number;
  warm: boolean;
};

// 84 light-speed streaks, fixed once from a seed.
const STREAKS: Streak[] = (() => {
  const rng = mulberry32(0x57ea4);
  const n = 84;
  return Array.from({ length: n }, (_, i) => ({
    angle: ((i + rng() * 0.9) / n) * Math.PI * 2,
    delay: rng() * 9,
    speed: 0.03 + rng() * 0.05,
    length: 0.12 + rng() * 0.45,
    width: 0.0008 + rng() * rng() * 0.0035,
    brightness: 0.35 + rng() * 0.65,
    life: 18 + rng() * 10,
    warm: rng() < 0.06,
  }));
})();

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Streaks: React.FC<{ data: WordData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const H = height;
  if (frame < T.burstStart - 2 || frame > T.settleStart + 2) return null;
  const cx = width / 2;
  const cy = height / 2;
  // Streaks leave from an ellipse around the word, not the exact centre.
  const a = ((data.bbox.right - data.bbox.left) / 2) * H * 0.9;
  const b = ((data.bbox.bottom - data.bbox.top) / 2) * H * 1.1;
  const flash = interpolate(frame, [T.burstStart - 2, T.burstStart + 2, T.burstStart + 16], [0, 0.35, 0], clamp);

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="streakCool" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5fb4ff" stopOpacity="0" />
            <stop offset="0.75" stopColor="#bfe2ff" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="streakWarm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff8a2a" stopOpacity="0" />
            <stop offset="1" stopColor="#ffd2a0" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="flash" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#dff1ff" stopOpacity="1" />
            <stop offset="0.4" stopColor="#7cc4ff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#7cc4ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {flash > 0 && (
          <ellipse cx={cx} cy={cy} rx={a * 2.2} ry={b * 3.2} fill="url(#flash)" opacity={flash} />
        )}
        {STREAKS.map((s, i) => {
          const dt = frame - T.burstStart - s.delay;
          if (dt <= 0 || dt > s.life) return null;
          const c = Math.cos(s.angle);
          const sn = Math.sin(s.angle);
          const r0 = (a * b) / Math.sqrt((b * c) ** 2 + (a * sn) ** 2);
          const head = r0 + s.speed * H * Math.pow(dt, 1.35);
          const tail = Math.max(r0, head - s.length * H * Math.min(1, dt / 4));
          const o = s.brightness * interpolate(dt, [0, 2, s.life * 0.45, s.life], [0, 1, 0.8, 0], clamp);
          const w = s.width * H;
          return (
            <rect
              key={i}
              x={tail}
              y={-w / 2}
              width={Math.max(head - tail, 0.001)}
              height={w}
              fill={s.warm ? "url(#streakWarm)" : "url(#streakCool)"}
              opacity={o}
              transform={`translate(${cx} ${cy}) rotate(${(s.angle * 180) / Math.PI})`}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
