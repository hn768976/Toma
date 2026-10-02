import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./config";
import { mulberry32 } from "./random";

// Faint drifting data lines, generated once from a fixed seed.
type DataLine = {
  horizontal: boolean;
  pos: number; // fraction of the perpendicular axis
  drift: number; // perpendicular drift, fraction of height per frame
  flow: number; // dash flow along the line, fraction of height per frame
  opacity: number;
  width: number; // fraction of height
  dash: number[]; // fractions of height
};

const LINES: DataLine[] = (() => {
  const rng = mulberry32(0x1a7e5);
  const out: DataLine[] = [];
  for (let i = 0; i < 46; i++) {
    const depth = rng(); // 0 far .. 1 near
    const horizontal = i < 28;
    const dash: number[] = [];
    const segs = 2 + Math.floor(rng() * 3);
    for (let s = 0; s < segs; s++) {
      dash.push(0.05 + rng() * 0.4, 0.01 + rng() * 0.05);
      if (rng() < 0.6) dash.push(0.004 + rng() * 0.01, 0.006 + rng() * 0.02);
    }
    out.push({
      horizontal,
      pos: rng() * 1.2 - 0.1,
      drift: (rng() < 0.5 ? -1 : 1) * (0.00004 + depth * 0.00014),
      flow: (rng() < 0.5 ? -1 : 1) * (0.0004 + depth * 0.0016),
      opacity: 0.05 + depth * 0.12,
      width: 0.0004 + depth * 0.0009,
      dash,
    });
  }
  return out;
})();

let noiseTileUrl: string | null = null;
// Static +-1/255-scale dither tile for the smooth gradient, from a fixed seed.
const getNoiseTile = () => {
  if (noiseTileUrl) return noiseTileUrl;
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  const rng = mulberry32(0xd17e4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(rng() * 256);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTileUrl = c.toDataURL("image/png");
  return noiseTileUrl;
};

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const tile = useMemo(() => getNoiseTile(), []);
  const wrap = (v: number, lo: number, hi: number) => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="bg" cx="50%" cy="50%" r="75%" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor={COLORS.bgCentre} />
            <stop offset="45%" stopColor={COLORS.bgMid} />
            <stop offset="100%" stopColor={COLORS.bgEdge} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#bg)" />
        <g stroke={COLORS.line} fill="none">
          {LINES.map((l, i) => {
            const p = wrap(l.pos + l.drift * frame, -0.1, 1.1);
            const dash = l.dash.map((d) => d * height).join(" ");
            const offset = l.flow * frame * height;
            const common = {
              strokeWidth: l.width * height,
              strokeOpacity: l.opacity,
              strokeDasharray: dash,
              strokeDashoffset: offset,
            };
            return l.horizontal ? (
              <line key={i} x1={0} x2={width} y1={p * height} y2={p * height} {...common} />
            ) : (
              <line key={i} y1={0} y2={height} x1={p * width} x2={p * width} {...common} />
            );
          })}
        </g>
      </svg>
      <AbsoluteFill
        style={{
          backgroundImage: `url(${tile})`,
          backgroundSize: `${(256 / 1080) * height}px`,
          imageRendering: "pixelated",
          mixBlendMode: "overlay",
          opacity: 0.025,
        }}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,8,16,0) 55%, rgba(0,8,16,0.25) 85%, rgba(0,6,12,0.45) 100%)",
    }}
  />
);
