import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { makeCamera } from "./camera";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CAMERA_BASE,
  CAMERA_DRIFT,
  DURATION_IN_FRAMES,
  LAYER_BLUR,
  LOOP_SCROLL,
  THEMES,
} from "./constants";
import { generateSceneData } from "./data";
import { type RenderContext, drawFar, drawFore, drawMain, drawMid } from "./draw";
import { useInterFont } from "./fonts";

export const marketTrendsSchema = z.object({
  theme: z.enum(["dark", "light"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the
  // width/height the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
  seed: z.number().int(),
});

export type MarketTrendsProps = z.infer<typeof marketTrendsSchema>;

export const marketTrendsDefaults: MarketTrendsProps = {
  theme: "dark",
  resolutionScale: 1,
  seed: 7,
};

type LayerProps = {
  width: number;
  height: number;
  scale: number;
  blur: number;
  opacity: number;
  frame: number;
  ready: boolean;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

// One full-frame canvas. Drawing happens in 1x logical units and the
// context is scaled up for higher resolutions, so 1080p and 4K share the
// exact same geometry. Blur is applied by CSS on the whole layer to get
// a cheap depth-of-field.
const CanvasLayer: React.FC<LayerProps> = ({
  width,
  height,
  scale,
  blur,
  opacity,
  frame,
  ready,
  draw,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !ready) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx);
  }, [draw, frame, ready, width, height, scale]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        filter: blur > 0 ? `blur(${blur * scale}px)` : undefined,
      }}
    />
  );
};

// 3D market-trends data visualisation: a perspective-tilted plane of
// green bars, saw-tooth and smooth line charts, a dotted node grid and
// time-stamp labels, scrolling past a slowly drifting camera. Blurred
// ticker digits and donut charts sit far behind, and soft bokeh floats in
// front. Everything is projected through a real pinhole camera (see
// camera.ts) rather than faked with CSS transforms, so parallax between
// depth layers and foreshortening along the plane are physically
// consistent.
export const MarketTrends: React.FC<MarketTrendsProps> = ({
  theme: themeId,
  resolutionScale,
  seed,
}) => {
  const frame = useCurrentFrame();
  const ready = useInterFont();
  const theme = THEMES[themeId];
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;

  const data = useMemo(() => generateSceneData(seed), [seed]);

  const rcBase = useMemo(() => {
    const t = frame / DURATION_IN_FRAMES; // 0..1 over one loop
    const w = t * Math.PI * 2;
    const cam = makeCamera(
      {
        x: CAMERA_BASE.x + Math.sin(w) * CAMERA_DRIFT.x,
        y: CAMERA_BASE.y + Math.sin(w * 2 + 1.1) * CAMERA_DRIFT.y,
        z: CAMERA_BASE.z + Math.cos(w) * CAMERA_DRIFT.z,
      },
      CAMERA_BASE.yaw + Math.sin(w + 0.6) * CAMERA_DRIFT.yaw,
      CAMERA_BASE.pitch + Math.sin(w * 2 + 2.4) * CAMERA_DRIFT.pitch,
      BASE_WIDTH,
      BASE_HEIGHT,
    );
    const scroll = t * LOOP_SCROLL;
    return { cam, frame, scroll, theme, data };
  }, [frame, theme, data]);

  const layer = (fn: (rc: RenderContext) => void) => (ctx: CanvasRenderingContext2D) =>
    fn({ ...rcBase, ctx });

  const common = { width, height, scale: resolutionScale, frame, ready };

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <CanvasLayer
        {...common}
        blur={LAYER_BLUR.far}
        opacity={theme.farOpacity}
        draw={layer(drawFar)}
      />
      <CanvasLayer
        {...common}
        blur={LAYER_BLUR.mid}
        opacity={theme.midOpacity}
        draw={layer(drawMid)}
      />
      <CanvasLayer {...common} blur={LAYER_BLUR.main} opacity={1} draw={layer(drawMain)} />
      <CanvasLayer
        {...common}
        blur={LAYER_BLUR.fore}
        opacity={theme.foreOpacity}
        draw={layer(drawFore)}
      />
      <AbsoluteFill style={{ background: theme.vignette, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
