import { useCallback } from "react";
import { CanvasStage, DrawInfo } from "../lib/CanvasStage";
import { LOOP, speechEnvelope } from "./speech";
import { GREEN, WAVEFORM_LINE as CFG } from "../config";

// Three sines across the span. `travel` is whole cycles per 20 s loop, so the
// phases come back to where they started.
const WAVES = [
  { cycles: 2.3, amp: 1.0, travel: 31 },
  { cycles: 4.1, amp: 0.55, travel: -47 },
  { cycles: 6.7, amp: 0.35, travel: 67 },
];
const AMP_SUM = WAVES.reduce((a, w) => a + w.amp, 0);
const STEPS = 480;

export const WaveformLine: React.FC<{ extraFrames?: number }> = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const { width: W, height: H, frame, pxRatio } = info;
    const span = CFG.span * W;
    const x0 = (W - span) / 2;
    const t = (((frame % LOOP) + LOOP) % LOOP) / LOOP;
    const amp = CFG.amplitude * H * (0.03 + 0.97 * speechEnvelope(frame));

    ctx.beginPath();
    for (let s = 0; s <= STEPS; s++) {
      const u = s / STEPS;
      // Taper to zero at both ends.
      const win = Math.pow(Math.sin(Math.PI * u), 1.6);
      let y = 0;
      for (const w of WAVES) {
        y += w.amp * Math.sin(2 * Math.PI * (w.cycles * u + w.travel * t));
      }
      const px = x0 + u * span;
      const py = H / 2 + (amp * win * y) / AMP_SUM;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = CFG.color;
    ctx.lineWidth = CFG.lineWidth;
    // Tight glow (shadowBlur is in device pixels, so scale it to the output).
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = CFG.glow * pxRatio;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.stroke();
  }, []);
  return <CanvasStage background={GREEN} draw={draw} />;
};
