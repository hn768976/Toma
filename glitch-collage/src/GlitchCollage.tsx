import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { renderCollage } from "./lib/collage";
import type { Palette } from "./lib/palettes";

// The reference is a stop-motion collage: every image holds for 3 frames
// (10 images/s) and the 40-image cycle repeats every 120 frames.
export const HOLD_FRAMES = 3;
export const CYCLE_FRAMES = 120;

export type GlitchCollageProps = {
  palette: Palette;
  seed: number;
};

// Keep the last couple of rendered stills: consecutive frames in a hold share one.
const cache = new Map<string, HTMLCanvasElement>();
const CACHE_SIZE = 2;

const getStill = (key: string, width: number, height: number, draw: (c: HTMLCanvasElement) => void) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c);
  cache.set(key, c);
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return c;
};

export const GlitchCollage: React.FC<GlitchCollageProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  // The reference opens on a one-off still that never comes back in the loop
  const index = frame < HOLD_FRAMES ? 1000 : Math.floor((frame % CYCLE_FRAMES) / HOLD_FRAMES);

  useLayoutEffect(() => {
    const key = `${seed}-${index}-${width}x${height}-${palette.accent.join(",")}`;
    const still = getStill(key, width, height, (c) =>
      renderCollage(c, { width, height, index, seed, palette }),
    );
    const ctx = ref.current!.getContext("2d")!;
    ctx.drawImage(still, 0, 0);
  }, [index, seed, palette, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${palette.bgDeep.join(",")})` }}>
      <canvas ref={ref} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
