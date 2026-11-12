import { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { LOOK } from "./palette";
import { CircuitScene, createCircuitScene } from "./scene";

export const glassCircuitSchema = z.object({
  variant: z.enum(["v1", "v2"]),
  /** internal render resolution factor for quick look-dev previews (1 = native 4K) */
  previewScale: z.number().min(0.1).max(1).optional(),
});
export type GlassCircuitProps = z.infer<typeof glassCircuitSchema>;

/**
 * Macro shot of a glowing data-core landscape: rows of metal plates that rise,
 * fall and light up, with floating glass data panels, shot on a long lens with
 * shallow depth of field. three.js (WebGL 2) + custom GLSL post-processing.
 */
export const GlassCircuitDatacore: React.FC<GlassCircuitProps> = ({ variant, previewScale = 1 }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const fps = config.fps;
  const width = Math.round(config.width * previewScale);
  const height = Math.round(config.height * previewScale);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CircuitScene | null>(null);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    if (!sceneRef.current) {
      sceneRef.current = createCircuitScene(canvasRef.current, width, height, LOOK, variant);
    }
    sceneRef.current.render(frame / fps, frame);
  }, [frame, fps, width, height, variant]);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [width, height, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: LOOK.background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
