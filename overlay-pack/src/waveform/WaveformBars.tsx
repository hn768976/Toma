import { useCallback } from "react";
import { CanvasStage, DrawInfo } from "../lib/CanvasStage";
import { bandLevel, speechEnvelope } from "./speech";
import { GREEN, WAVEFORM_BARS as CFG } from "../config";

export const WaveformBars: React.FC<{ extraFrames?: number }> = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const { width: W, height: H, frame } = info;
    const n = CFG.bars;
    const span = CFG.span * W;
    const pitch = span / n;
    const bw = pitch * CFG.barFill;
    const x0 = (W - span) / 2 + pitch / 2;
    // Compress the envelope a little so normal speech fills the height.
    const env = Math.pow(speechEnvelope(frame), 0.5);
    ctx.fillStyle = CFG.color;
    for (let i = 0; i < n; i++) {
      // Edge bars sit lower than the middle ones.
      const edge = 0.4 + 0.6 * Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.5);
      const level = 0.04 + 0.96 * Math.pow(bandLevel(i, frame), 1.5);
      const h = Math.max(bw, CFG.maxHeight * H * env * edge * level);
      ctx.beginPath();
      ctx.roundRect(x0 + i * pitch - bw / 2, H / 2 - h / 2, bw, h, bw / 2);
      ctx.fill();
    }
  }, []);
  return <CanvasStage background={GREEN} draw={draw} />;
};
