import React, { useMemo } from "react";
import { mulberry32, range } from "./rng";
import type { BackdropSpec } from "./presets";

type Props = {
  spec: BackdropSpec;
  seed: number;
  /** CSS-pixel multiplier: 1 at 1080p, 2 at 4K. */
  scale: number;
  seconds: number;
  width: number;
  height: number;
};

/**
 * Everything behind the swarm: the ground wash, the two-tone radial
 * gradient each reference is built on, and the out-of-focus granular
 * field. All DOM, because a soft gradient costs nothing there and a
 * great deal in a software-rasterised 4K fragment shader.
 */
export const Backdrop: React.FC<Props> = ({
  spec,
  seed,
  scale,
  seconds,
  width,
  height,
}) => {
  const bokeh = useMemo(() => {
    const rng = mulberry32(seed * 65537 + 13);
    return new Array(spec.bokehCount).fill(0).map(() => ({
      x: rng(),
      y: rng(),
      size: range(rng, spec.bokehSizePx[0], spec.bokehSizePx[1]),
      opacity: range(rng, 0.3, 1),
      // Slow parallax so the ground drifts under the cells rather than
      // sitting dead still behind them.
      driftX: range(rng, -0.014, 0.014),
      driftY: range(rng, -0.012, 0.012),
      phase: range(rng, 0, Math.PI * 2),
      period: range(rng, 14, 30),
    }));
  }, [spec, seed]);

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: spec.base }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${spec.glowRadius}% ${
            spec.glowRadius * 1.1
          }% at ${spec.glowX}% ${spec.glowY}%, ${spec.glowColor} 0%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${spec.glow2Radius}% ${
            spec.glow2Radius * 1.1
          }% at ${spec.glow2X}% ${spec.glow2Y}%, ${spec.glow2Color} 0%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `blur(${spec.bokehBlurPx * scale}px)`,
          opacity: spec.bokehOpacity,
        }}
      >
        {bokeh.map((dot, i) => {
          const wobble = Math.sin((Math.PI * 2 * seconds) / dot.period + dot.phase);
          const left = (dot.x + dot.driftX * seconds) * width;
          const top = (dot.y + dot.driftY * seconds + wobble * 0.004) * height;
          const size = dot.size * scale;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left,
                top,
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: spec.bokehColor,
                opacity: dot.opacity,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
