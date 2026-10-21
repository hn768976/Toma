import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { packArrows, packSchedule, PEN_LIFT } from "./doodles/arrowPack";
import { variantsOf } from "./doodles/common";
import { variantAt } from "./lib/boil";
import { brushInk } from "./lib/ink";
import { Layer } from "./lib/layer";
import { texOffset, useDpr } from "./lib/scene";

// Hand-like: slow start, fast middle, a slight slow-down at the end.
const handEase = Easing.bezier(0.55, 0.02, 0.4, 0.98);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const ARROWS = packArrows();
const SCHEDULE = packSchedule(ARROWS);

const doneCache = new Map<string, Layer>();
const liveLayers = new Map<string, HTMLCanvasElement>();

export const ArrowPack: React.FC<{ id: string; background: string; ink: string; streakTone: string | null }> = ({
  id,
  background,
  ink,
  streakTone,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = useDpr();
  const ref = useRef<HTMLCanvasElement>(null);
  const v = variantAt(frame);

  const plan = useMemo(
    () =>
      ARROWS.map((a, i) => {
        const s = SCHEDULE[i];
        const f = frame - s.start;
        const n0 = a.strokes[0].pts.length;
        const n1 = a.strokes[1].pts.length;
        const p0 = handEase(clamp01(f / s.split));
        const p1 = handEase(clamp01((f - s.split - PEN_LIFT) / (s.dur - s.split - PEN_LIFT)));
        return { counts: [Math.ceil(p0 * n0), Math.ceil(p1 * n1)], done: p0 >= 1 && p1 >= 1 };
      }),
    [frame],
  );

  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ARROWS.forEach((a, i) => {
      const { counts, done } = plan[i];
      if (counts[0] === 0) return;
      const strokes = variantsOf(id, i, v, a.strokes, a.size * 0.008);
      const off = texOffset(id, i, v);
      let layer: Layer;
      const key = `${id}|${i}|${v}|${dpr}`;
      if (done && doneCache.has(key)) {
        layer = doneCache.get(key)!;
      } else {
        let c = liveLayers.get(`${id}|${i}`);
        if (done) c = undefined;
        layer = new Layer(a.bbox, dpr, c);
        if (!done) liveLayers.set(`${id}|${i}`, layer.canvas);
        const live = counts[1] > 0 ? 2 : 1;
        brushInk(layer, strokes.slice(0, live), a.streaks.slice(0, live), ink, off, done ? undefined : counts.slice(0, live), streakTone);
        if (done) doneCache.set(key, layer);
      }
      ctx.drawImage(layer.canvas, a.bbox.x, a.bbox.y, layer.canvas.width / dpr, layer.canvas.height / dpr);
    });
  }, [plan, v, dpr, width, height, background, ink, id, streakTone]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas ref={ref} width={Math.round(width * dpr)} height={Math.round(height * dpr)} style={{ width, height }} />
    </AbsoluteFill>
  );
};
