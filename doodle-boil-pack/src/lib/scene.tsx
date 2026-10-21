import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { driftAt, variantAt } from "./boil";
import type { BBox, Pt } from "./geom";
import { Layer } from "./layer";
import { TILE } from "./textures";
import { rngFor } from "./random";

export type Doodle = {
  /** Area the doodle can occupy in any variant (composition units). */
  bbox: BBox;
  /** Pivot for the drift tilt. */
  center: Pt;
  driftPhase: number;
  driftCycles: [number, number];
  /** Draw variant `v` into the layer (composition coordinates). */
  render: (layer: Layer, variant: number) => void;
};

/** Grain offset for one doodle variant: a different texture seed per redraw. */
export const texOffset = (...parts: (string | number)[]): Pt => {
  const r = rngFor(...parts, "tex");
  return [Math.floor(r() * TILE), Math.floor(r() * TILE)];
};

/** Device pixels per composition unit (1/3 for a 720p preview of a 4K composition). */
export const useDpr = () => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

// Each variant is drawn once per tab and reused: the boil only ever shows these 4 drawings.
const variantCache = new Map<string, Layer>();

const variantLayer = (key: string, d: Doodle, v: number, dpr: number) => {
  const k = `${key}|${v}|${dpr}`;
  let l = variantCache.get(k);
  if (!l) {
    l = new Layer(d.bbox, dpr);
    d.render(l, v);
    variantCache.set(k, l);
  }
  return l;
};

export const BoilScene: React.FC<{
  id: string;
  background: string;
  doodles: Doodle[];
  loop: number;
  drift: boolean;
}> = ({ id, background, doodles, loop, drift }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = useDpr();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const v = variantAt(frame);
    doodles.forEach((d, i) => {
      const layer = variantLayer(`${id}|${i}`, d, v, dpr);
      ctx.save();
      if (drift) {
        const { dy, rot } = driftAt(frame, loop, height, d.driftPhase, d.driftCycles);
        ctx.translate(d.center[0], d.center[1] + dy);
        ctx.rotate(rot);
        ctx.translate(-d.center[0], -d.center[1]);
      }
      ctx.drawImage(layer.canvas, d.bbox.x, d.bbox.y, layer.canvas.width / dpr, layer.canvas.height / dpr);
      ctx.restore();
    });
  }, [frame, dpr, width, height, background, doodles, id, loop, drift]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={ref}
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        style={{ width, height }}
      />
    </AbsoluteFill>
  );
};
