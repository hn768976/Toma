import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, T } from "./config";
import { FONT_FAMILY, FONT_WEIGHT } from "./font";
import { GlowFilter } from "./Glow";
import { hash1 } from "./random";
import type { WordData } from "./sampling";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

// Outline flickers in over ~14 frames; the pattern is a pure function of frame.
const outlineOpacity = (f: number) => {
  if (f < T.outlineStart) return 0;
  const p = (f - T.outlineStart) / 14;
  if (p < 1) {
    const on = hash1(f * 7 + 3) < 0.3 + p * 0.7;
    return (on ? 1 : 0.12) * Math.min(1, 0.35 + p);
  }
  return interpolate(f, [T.settleStart + 12, T.holdStart - 2], [1, 0], { ...clamp, easing: ease });
};

const outlineGlow = (f: number) =>
  interpolate(
    f,
    [T.outlineStart, T.outlineStart + 14, T.burstStart - 2, T.burstStart + 4, T.burstStart + 22, T.settleStart, T.holdStart],
    [0.8, 1.3, 1.3, 2.6, 1.4, 1.1, 0],
    clamp,
  );

export const WordLayer: React.FC<{ data: WordData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const H = height;
  const cx = width / 2;
  const cy = height / 2;
  const textX = cx + data.xShiftN * H;
  const baseline = cy + data.baselineN * H;
  const fontSize = data.fontSizeN * H;

  const oOutline = outlineOpacity(frame);
  const gOutline = outlineGlow(frame);
  const oFill = interpolate(frame, [T.settleStart - 4, T.settleStart + 26], [0, 1], { ...clamp, easing: ease });
  // Halo: strong as the fill lands, then a soft, gently breathing glow.
  const breathe = 0.06 * Math.sin(((frame - T.holdStart) / 120) * Math.PI * 2);
  const gFill =
    interpolate(frame, [T.settleStart, T.settleStart + 20, T.holdStart], [1.2, 0.9, 0.5], clamp) +
    (frame >= T.holdStart ? breathe : breathe * interpolate(frame, [T.settleStart + 20, T.holdStart], [0, 1], clamp));

  const pad = 0.12 * H;
  const region = {
    x: cx + data.bbox.left * H - pad,
    y: cy + data.bbox.top * H - pad,
    w: (data.bbox.right - data.bbox.left) * H + pad * 2,
    h: (data.bbox.bottom - data.bbox.top) * H + pad * 2,
  };
  const circuitRegion = { x: 0, y: 0, w: width, h: height };

  const text = (props: React.SVGProps<SVGTextElement>) => (
    <text
      x={textX}
      y={baseline}
      textAnchor="middle"
      fontFamily={FONT_FAMILY}
      fontWeight={FONT_WEIGHT}
      fontSize={fontSize}
      {...props}
    >
      {data.word}
    </text>
  );

  const circuitOpacity = interpolate(frame, [T.burstStart - 14, T.burstStart + 4], [1, 0], clamp);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute" }}>
        <defs>
          <GlowFilter id="glowOutline" unit={H} base={0.0016} color={COLORS.glow} strength={gOutline} region={region} />
          <GlowFilter id="glowFill" unit={H} base={0.0018} color={COLORS.halo} strength={gFill} region={region} />
          <GlowFilter id="glowCircuit" unit={H} base={0.0012} color={COLORS.glow} strength={1} region={circuitRegion} />
        </defs>

        {frame >= T.outlineStart && circuitOpacity > 0 && (
          <g filter="url(#glowCircuit)" opacity={circuitOpacity}>
            {data.circuits.map((c, i) => {
              const start = T.outlineStart + 4 + i * 1.6;
              const p = interpolate(frame, [start, start + 18], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
              if (p <= 0) return null;
              const len = c.length * H;
              const pts = c.points.map(([x, y]) => `${cx + x * H},${cy + y * H}`).join(" ");
              const end = c.points[c.points.length - 1];
              return (
                <g key={i}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={COLORS.outline}
                    strokeWidth={0.0016 * H}
                    strokeLinecap="square"
                    strokeDasharray={`${len} ${len}`}
                    strokeDashoffset={len * (1 - p)}
                  />
                  {p >= 1 && <circle cx={cx + end[0] * H} cy={cy + end[1] * H} r={0.0032 * H} fill={COLORS.outline} />}
                </g>
              );
            })}
          </g>
        )}

        {oFill > 0 &&
          text({
            fill: "#ffffff",
            opacity: oFill,
            filter: "url(#glowFill)",
          })}

        {oOutline > 0 &&
          text({
            fill: "none",
            stroke: COLORS.outline,
            strokeWidth: 0.0042 * H,
            strokeLinejoin: "round",
            opacity: oOutline,
            filter: "url(#glowOutline)",
          })}
      </svg>
    </AbsoluteFill>
  );
};
