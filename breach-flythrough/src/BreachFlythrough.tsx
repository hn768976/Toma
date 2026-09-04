import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraDrift, depthConfig } from "./depth";
import { LAYERS } from "./scene";
import { Layer } from "./components/Layer";
import { Grain } from "./components/Grain";
import { Vignette } from "./components/Vignette";
import { AMBER, CYAN, type Palette } from "./theme";
import "./load-fonts";

export type Variant = "cyan" | "amber";

const PALETTES: Record<Variant, Palette> = { cyan: CYAN, amber: AMBER };

export type BreachFlythroughProps = {
  variant: Variant;
};

/**
 * Slow flight through layered planes of hex data, past open padlocks and the
 * category names of the records they were guarding.
 *
 * Every position, rotation and blur radius is a pure function of the frame
 * number and periodic over `durationInFrames`, so the last frame hands
 * straight back to the first. Sizes and distances are all derived from
 * `width`, which means the geometry and the blur scale together and a 1080p
 * preview is the 4K render, exactly.
 */
export const BreachFlythrough: React.FC<BreachFlythroughProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  const palette = PALETTES[variant];
  const cfg = depthConfig(width);
  const drift = cameraDrift(frame, durationInFrames, width);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 66% 66% at 50% 47%, ${palette.backgroundLift} 0%, ${palette.background} 74%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: `${cfg.perspective}px`,
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            // Translating the whole world inside the perspective (rather than
            // sliding the finished image) means each plane shifts by its own
            // perspective scale, so the drift parallaxes for free.
            transform: `translate3d(${drift.x}px, ${drift.y}px, 0) rotate(${drift.roll}deg)`,
          }}
        >
          {LAYERS.map((layer) => (
            <Layer
              key={layer.index}
              layer={layer}
              cfg={cfg}
              frame={frame}
              durationInFrames={durationInFrames}
              width={width}
              palette={palette}
            />
          ))}
        </div>
      </div>
      <Vignette />
      <Grain frame={frame} opacity={0.045} />
    </AbsoluteFill>
  );
};
