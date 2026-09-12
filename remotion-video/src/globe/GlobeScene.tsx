import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import "./fonts";
import { drawScene, type SceneGeometry } from "./draw";
import { buildLand, buildMesh, buildRings } from "./sphere";
import { buildStreams, buildTickers } from "./tickers";
import { THEMES, type ThemeId } from "./theme";

export const globeSceneSchema = z.object({
  theme: z.enum(["classic", "cyan-mirror"]),
  tickerCount: z.number().int().min(0).max(2000),
  streamCount: z.number().int().min(0).max(300),
  seed: z.number().int(),
});

export const globeSceneDefaults: z.infer<typeof globeSceneSchema> = {
  theme: "classic",
  tickerCount: 760,
  streamCount: 52,
  seed: 20260912,
};

/** A little 256px noise tile, reused as a repeating pattern for film grain. */
const makeGrainPattern = (ctx: CanvasRenderingContext2D) => {
  const tile = document.createElement("canvas");
  tile.width = 256;
  tile.height = 256;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(256, 256);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) * 0.35;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  return ctx.createPattern(tile, "repeat");
};

export const GlobeScene: React.FC<z.infer<typeof globeSceneSchema>> = ({
  theme,
  tickerCount,
  streamCount,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const geo: SceneGeometry = useMemo(
    () => ({
      mesh: buildMesh(),
      rings: buildRings(),
      land: buildLand(),
      tickers: buildTickers(tickerCount, seed),
      streams: buildStreams(streamCount, seed + 91),
    }),
    [tickerCount, streamCount, seed],
  );

  // Four scratch canvases, one per blurred depth-of-field tier.
  const tierCanvases = useMemo(() => {
    return Array.from({ length: 4 }, () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      return c;
    });
  }, [width, height]);

  const grainRef = useRef<CanvasPattern | null | undefined>(undefined);

  // Layout effect so the canvas is painted during commit, before Remotion
  // ever gets a chance to capture the frame.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    if (grainRef.current === undefined) {
      grainRef.current = makeGrainPattern(ctx);
    }
    drawScene({
      ctx,
      width,
      height,
      frame,
      theme: THEMES[theme as ThemeId],
      geo,
      tierCanvases,
      grainPattern: grainRef.current,
    });
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
