import { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { PALETTES } from "./palette";
import { createMapScene, MapScene } from "./scene";

export const mapPinsDropSchema = z.object({
  variant: z.enum(["v1", "v2"]),
});
export type MapPinsDropProps = z.infer<typeof mapPinsDropSchema>;

/**
 * 3D city map with location pins dropping in while the camera glides over it.
 * Rendered with three.js (WebGL 2): the map is a procedural GLSL shader,
 * the pins are extruded, clear-coated meshes.
 */
export const MapPinsDrop: React.FC<MapPinsDropProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MapScene | null>(null);
  const palette = PALETTES[variant];

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    if (!sceneRef.current) {
      sceneRef.current = createMapScene(canvasRef.current, width, height, palette);
    }
    sceneRef.current.render(frame / fps);
  }, [frame, fps, width, height, palette]);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [width, height, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.fog }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
      {/* gentle lens vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,0,0,${palette.vignette}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
