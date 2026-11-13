import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { drawTunnel } from "./drawTunnel";
import { CYAN_MATCH, EMBER_ALT } from "./palettes";

export type ParticleTunnelProps = {
  variant: "match" | "ember";
};

/**
 * Remotion component: draws one frame of the particle tunnel into a
 * full-resolution <canvas> (3840x2160 for the 4K compositions).
 */
export const ParticleTunnel: React.FC<ParticleTunnelProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    drawTunnel(
      ref.current,
      frame / fps,
      durationInFrames / fps,
      variant === "match" ? CYAN_MATCH : EMBER_ALT,
    );
  }, [frame, fps, durationInFrames, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
