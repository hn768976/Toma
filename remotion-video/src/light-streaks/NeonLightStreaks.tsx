import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { AXIS_DIR, AXIS_NORMAL, buildStrands, strandPath, waveOffset } from "./geometry";
import { AXIS_LENGTH, AXIS_ORIGIN, BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { PALETTES } from "./palettes";

const TAU = Math.PI * 2;

export const neonLightStreaksSchema = z.object({
  variant: z.enum(["blue", "violet"]),
  strandCount: z.number().int().min(8).max(200),
  seed: z.number().int().min(0).max(9999),
  /** Overall brightness of the bloom stack. */
  intensity: z.number().min(0.2).max(2),
});

export type NeonLightStreaksProps = z.infer<typeof neonLightStreaksSchema>;

export const neonLightStreaksDefaults: NeonLightStreaksProps = {
  variant: "blue",
  strandCount: 78,
  seed: 7,
  intensity: 1,
};

// The bloom stack: the same strands drawn four times, widest and blurriest
// first. Together they fake the way a real long-exposure light trail blows out
// — a broad haze, a tight halo, and a hard core sitting inside it.
const LAYERS = [
  { widthMul: 9, opacity: 0.2, blur: 34 },
  { widthMul: 3.6, opacity: 0.38, blur: 11 },
  { widthMul: 1.8, opacity: 0.6, blur: 3.2 },
  { widthMul: 1, opacity: 1, blur: 0.4 },
];

export const NeonLightStreaks: React.FC<NeonLightStreaksProps> = ({
  variant,
  strandCount,
  seed,
  intensity,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();

  // Normalised loop time. Dividing by durationInFrames (not durationInFrames-1)
  // is what makes the clip loop: the frame after the last one would be t = 1,
  // which every term in the animation maps back onto t = 0.
  const t = frame / durationInFrames;

  // Blur radii are device pixels, so they are the one thing that has to be
  // scaled up for the 4K compositions. Everything else is vector.
  const resolutionScale = width / BASE_WIDTH;

  const palette = PALETTES[variant];
  const strands = useMemo(
    () => buildStrands(strandCount, seed, variant),
    [strandCount, seed, variant],
  );

  // Sample every strand once per frame and share the path strings across all
  // four bloom layers — resampling them per layer would quadruple the work.
  const paths = useMemo(() => strands.map((s) => strandPath(s, t)), [strands, t]);

  // A slow camera sway. Both harmonics are integer multiples of the loop rate.
  const swayX = 26 * Math.sin(TAU * t);
  const swayY = 16 * Math.cos(TAU * t);
  const swayRot = 0.7 * Math.sin(TAU * (t + 0.25));
  const swayScale = 1 + 0.014 * Math.sin(TAU * 2 * t);

  // Park the ambient bloom on the ribbon itself so the background light moves
  // with the ribbon instead of sitting in a fixed spot.
  const bloomS = 0.52;
  const bloomD = waveOffset(bloomS, t);
  const bloomX =
    AXIS_ORIGIN.x + AXIS_DIR.x * bloomS * AXIS_LENGTH + AXIS_NORMAL.x * bloomD;
  const bloomY =
    AXIS_ORIGIN.y + AXIS_DIR.y * bloomS * AXIS_LENGTH + AXIS_NORMAL.y * bloomD;

  const renderStrands = (widthMul: number, layerOpacity: number) =>
    strands.map((strand, i) => (
      <path
        key={i}
        d={paths[i]}
        stroke={strand.color}
        strokeWidth={strand.width * widthMul}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={strand.opacity * layerOpacity}
        strokeDasharray={strand.dash ? strand.dash.pattern.join(" ") : undefined}
        strokeDashoffset={
          strand.dash ? -t * strand.dash.cycles * strand.dash.period : undefined
        }
      />
    ));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(130% 110% at 62% 34%, ${palette.backdrop[0]} 0%, ${palette.backdrop[1]} 68%, #000000 100%)`,
      }}
    >
      {/* Ambient light spilling off the ribbon onto the background. */}
      <AbsoluteFill style={{ mixBlendMode: "screen" }}>
        <div
          style={{
            position: "absolute",
            left: `${(bloomX / BASE_WIDTH) * 100}%`,
            top: `${(bloomY / BASE_HEIGHT) * 100}%`,
            width: "150%",
            height: "150%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${palette.bloom} 0%, transparent 55%)`,
            opacity: 0.22 * intensity,
            filter: `blur(${90 * resolutionScale}px)`,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          transform: `translate(${swayX}px, ${swayY}px) rotate(${swayRot}deg) scale(${swayScale})`,
          transformOrigin: "center center",
          isolation: "isolate",
        }}
      >
        {LAYERS.map((layer) => (
          <AbsoluteFill
            key={layer.blur}
            style={{
              mixBlendMode: "screen",
              filter: `blur(${layer.blur * resolutionScale}px)`,
              opacity: Math.min(1, intensity),
            }}
          >
            <svg
              viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
              width="100%"
              height="100%"
              style={{ overflow: "visible" }}
            >
              {renderStrands(layer.widthMul, layer.opacity * intensity)}
            </svg>
          </AbsoluteFill>
        ))}

        {/* A final hard white pass down the middle of the bundle. This is the
            blown-out highlight that makes the centre read as pure light. */}
        <AbsoluteFill style={{ mixBlendMode: "screen" }}>
          <svg
            viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
            width="100%"
            height="100%"
            style={{ overflow: "visible" }}
          >
            {strands.map((strand, i) =>
              strand.hot <= 0 ? null : (
                <path
                  key={i}
                  d={paths[i]}
                  stroke="#FFFFFF"
                  strokeWidth={strand.width * 0.45}
                  strokeLinecap="round"
                  fill="none"
                  opacity={strand.hot * 0.85 * strand.opacity * intensity}
                  strokeDasharray={
                    strand.dash ? strand.dash.pattern.join(" ") : undefined
                  }
                  strokeDashoffset={
                    strand.dash
                      ? -t * strand.dash.cycles * strand.dash.period
                      : undefined
                  }
                />
              ),
            )}
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Vignette, to keep the corners from lifting off black. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 100% at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
