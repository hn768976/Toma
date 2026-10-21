import { useCallback } from "react";
import { CanvasStage, DrawInfo } from "../lib/CanvasStage";
import { dim } from "../lib/shapes";
import { GREEN, SPINNER_DOTS as CFG } from "../config";

const LOOP = 300;

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// How lit a dot is, given how far (0..1 of a turn) the wave crest has moved past it.
// Quick rise just before the crest, slower decay after: continuous around the ring.
const pulse = (behind: number) => {
  if (behind < 0.55) return Math.pow(1 - behind / 0.55, 2);
  return smooth(0.86, 1, behind);
};

export const SpinnerDots: React.FC<{ extraFrames?: number }> = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const { width: W, height: H, frame } = info;
    const n = CFG.dots;
    const crest = (((frame % LOOP) / LOOP) * CFG.revolutions) % 1;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    for (let i = 0; i < n; i++) {
      const pos = i / n;
      const v = pulse((crest - pos + 1) % 1);
      const a = -Math.PI / 2 + pos * Math.PI * 2;
      // 30% white over mid-grey at rest (opaque, see dim()).
      ctx.fillStyle = dim(CFG.color, 0.5 + 0.5 * (0.3 + 0.7 * v));
      ctx.beginPath();
      ctx.arc(
        Math.cos(a) * CFG.radius * H,
        Math.sin(a) * CFG.radius * H,
        CFG.dotRadius * H * (1 + 0.4 * v),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }, []);
  return <CanvasStage background={GREEN} draw={draw} />;
};
