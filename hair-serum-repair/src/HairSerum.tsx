import { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { createHairScene, HairScene } from "./scene/scene";
import { PALETTES, Variant } from "./scene/palette";

export type HairSerumProps = {
  variant: Variant;
};

/**
 * Hosts a Three.js (WebGL 2, custom GLSL shaders) scene inside a Remotion
 * composition. Every frame is a pure function of `frame`, so rendering is
 * deterministic and safe to parallelise across browser tabs.
 */
export const HairSerum: React.FC<HairSerumProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HairScene | null>(null);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    if (!sceneRef.current) {
      sceneRef.current = createHairScene(canvasRef.current, width, height, PALETTES[variant]);
    }
    sceneRef.current.render(frame);
  }, [frame, width, height, variant]);

  // The reference opens under-lit with a heavy vignette that eases off
  const vignette = interpolate(frame, [0, 45], [1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
      <AbsoluteFill
        style={{
          opacity: vignette,
          background:
            "radial-gradient(ellipse 80% 90% at 42% 40%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.78) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
