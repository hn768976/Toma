import { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

import { COLORWAYS, type ColorwayName } from "./colorways";
import { createScene, type CodeGridScene } from "./scene";
import { loadCodeFont } from "./font";

export const codeGridSchema = z.object({
  colorway: z.enum(Object.keys(COLORWAYS) as [ColorwayName, ...ColorwayName[]]),
  /** 1 renders at 1080p sizing, 2 at 4K. Must match the composition size. */
  resolutionScale: z.number().min(1).max(4),
  /** MSAA samples on the scene pass. 0 turns it off. */
  samples: z.number().min(0).max(8),
});

export type CodeGridProps = z.infer<typeof codeGridSchema>;

export const codeGridDefaults: CodeGridProps = {
  colorway: "blue",
  resolutionScale: 1,
  samples: 4,
};

export const CodeGrid: React.FC<CodeGridProps> = ({
  colorway,
  resolutionScale,
  samples,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The scene is expensive to build (field generation, code sheet, shader
  // compilation), so it is created once per tab and kept on a ref as a
  // promise. Remotion renders many frames in the same tab, and every one
  // of them awaits this same promise instead of rebuilding.
  const sceneRef = useRef<Promise<CodeGridScene> | null>(null);

  useEffect(() => {
    const handle = delayRender(`CodeGrid frame ${frame}`, {
      // Software rasterising a 4K frame, plus one-off shader compilation
      // on the first frame of each tab, comfortably outruns the default.
      timeoutInMilliseconds: 300000,
    });

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("CodeGrid: canvas was not mounted");

      if (!sceneRef.current) {
        sceneRef.current = loadCodeFont().then(() =>
          createScene({ width, height, resolutionScale, colorway, samples }),
        );
      }

      const scene = await sceneRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("CodeGrid: could not get a 2D context");

      scene.update(frame);
      await scene.renderTo(ctx);
    })()
      .catch((err) => {
        // Surfaced rather than swallowed: a frame that failed to draw must
        // not be quietly written out as a black frame.
          console.error("CodeGrid: frame render failed", err);
        throw err;
      })
      .finally(() => continueRender(handle));
  }, [frame, width, height, resolutionScale, colorway, samples]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
