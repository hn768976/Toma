import { useCallback } from "react";
import { CanvasStage, DrawInfo } from "../lib/CanvasStage";
import { dim, roundedPolygon } from "../lib/shapes";
import { GREEN, SPINNER_SEGMENTS as CFG } from "../config";

const TRAIL = 8; // bars behind the head that fade down to the base level
// Trail end: 25% white. Drawn opaque (see dim()) as 25% white over mid-grey,
// so it reads as faint white once keyed instead of vanishing.
const BASE = 0.25;
const shade = (k: number) => 0.5 + 0.5 * k;

export const SpinnerSegments: React.FC<{ extraFrames?: number }> = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const { width: W, height: H, frame } = info;
    const n = CFG.bars;
    // The head advances one bar every stepFrames frames, clockwise from 12 o'clock.
    const head = Math.floor(frame / CFG.stepFrames) % n;
    const len = CFG.barLength * H;
    const inner = CFG.radius * H - len / 2;
    const outer = CFG.radius * H + len / 2;
    const wOuter = CFG.barWidth * H;
    const wInner = wOuter * 0.55; // tapered inward
    const r = wInner * 0.35;
    const bar: [number, number][] = [
      [-wInner / 2, -inner],
      [-wOuter / 2, -outer],
      [wOuter / 2, -outer],
      [wInner / 2, -inner],
    ];

    ctx.save();
    ctx.translate(W / 2, H / 2);
    for (let i = 0; i < n; i++) {
      const d = (head - i + n) % n; // 0 = head, 1 = just behind it
      ctx.fillStyle = dim(CFG.color, shade(d < TRAIL ? 1 - (1 - BASE) * (d / TRAIL) : BASE));
      ctx.save();
      ctx.rotate((i / n) * Math.PI * 2);
      roundedPolygon(ctx, bar, r);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }, []);
  return <CanvasStage background={GREEN} draw={draw} />;
};
