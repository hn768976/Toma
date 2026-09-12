import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { z } from "zod";
import { CAMERA_FOV } from "./constants";
import { PALETTES } from "./palettes";
import { Scene } from "./Scene";

export const neuralSphereSchema = z.object({
  /** Which colour treatment to render. */
  variant: z.enum(["blue", "darkCyan"]),
  /** 1 = 1080p, 2 = 4K. Scales every pixel-space quantity. */
  resolutionScale: z.number().min(0.25).max(4),
  /** Changes which filament tangle is grown, without changing the look. */
  seed: z.number().int().min(0).max(9999),
  /** Master brightness for every additive element. */
  glow: z.number().min(0).max(3),
  /** How much the filament tips drift over time, in world units. */
  wobble: z.number().min(0).max(1),
  /** Extra multiplier on the travelling-dot size. */
  nodeSizeScale: z.number().min(0.1).max(4),
});

export type NeuralSphereProps = z.infer<typeof neuralSphereSchema>;

export const neuralSphereDefaults: NeuralSphereProps = {
  variant: "blue",
  resolutionScale: 1,
  seed: 7,
  glow: 1,
  wobble: 0.22,
  nodeSizeScale: 1,
};

export const NeuralSphere: React.FC<NeuralSphereProps> = ({
  variant,
  resolutionScale,
  seed,
  glow,
  wobble,
  nodeSizeScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const palette = PALETTES[variant];

  const time = frame / fps;
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.backgroundOuter }}>
      {/* The deep field the structure sits in. Kept in CSS rather than as
          a WebGL quad so the gradient is dithered by the browser and
          doesn't band across a 4K frame. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 78% at 50% 50%, ${palette.backgroundInner} 0%, ${palette.backgroundOuter} 72%)`,
        }}
      />

      <AbsoluteFill>
        <ThreeCanvas
          width={width}
          height={height}
          dpr={1}
          orthographic={false}
          camera={{ fov: CAMERA_FOV, near: 0.1, far: 200, position: [0, 0, 10] }}
          gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
          style={{ background: "transparent" }}
        >
          <Scene
            palette={palette}
            time={time}
            progress={progress}
            width={width}
            height={height}
            pixelScale={resolutionScale}
            seed={seed}
            glow={glow}
            wobble={wobble}
            nodeSizeScale={nodeSizeScale}
          />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Vignette: pulls the corners down so the eye stays on the core. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0) 38%, ${palette.vignette} 100%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
