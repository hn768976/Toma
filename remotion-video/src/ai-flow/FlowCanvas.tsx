import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DESIGN_WIDTH, PATH_OVERSHOOT } from "./constants";
import { FlowPalette, hexToRgb, mixRgb, rgba } from "./palettes";
import { LOOP_FRAMES, PATH_LENGTH, buildStreams, lanePoint } from "./streams";

const THREAD_SAMPLES = 48;
const TAIL_SAMPLES = 7;

const fadeNearChip = (d: number) => Math.min(1, Math.max(0, d / 0.05));

export const FlowCanvas: React.FC<{ palette: FlowPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const k = width / DESIGN_WIDTH;

  const { lanes, particles } = useMemo(() => buildStreams(palette), [palette]);
  const sharp = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }, [width, height]);

  useLayoutEffect(() => {
    const out = canvasRef.current?.getContext("2d");
    const ctx = sharp.getContext("2d");
    if (!out || !ctx) return;

    const loopT = (frame % LOOP_FRAMES) / LOOP_FRAMES;
    const threadRgb = hexToRgb(palette.thread);
    const headRgb = hexToRgb(palette.head);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Faint guide threads: the full path of every lane.
    ctx.lineWidth = 0.9;
    for (const lane of lanes) {
      ctx.strokeStyle = rgba(mixRgb(lane.color, threadRgb, 0.4), lane.threadAlpha);
      ctx.beginPath();
      for (let i = 0; i <= THREAD_SAMPLES; i++) {
        const [x, y] = lanePoint(lane, (i / THREAD_SAMPLES) * PATH_OVERSHOOT, loopT);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 2. Comet streaks. Left side flows in towards the chip, right side
    //    flows out of it; both travel a whole number of trips per loop.
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const lane = lanes[p.lane];
      const s = (p.offset + p.cycles * loopT) % 1;
      const d = lane.side < 0 ? PATH_OVERSHOOT * (1 - s) : PATH_OVERSHOOT * s;
      const lenD = p.length / PATH_LENGTH;
      // Tail trails behind the direction of travel.
      const tailD = lane.side < 0 ? d + lenD : Math.max(0, d - lenD);
      const nearChip = 1 - Math.min(1, d / 0.6);
      const alpha = p.brightness * fadeNearChip(d) * (0.75 + 0.35 * nearChip);
      if (alpha <= 0.01) continue;

      const [hx, hy] = lanePoint(lane, d, loopT);
      const [tx, ty] = lanePoint(lane, tailD, loopT);
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, rgba(lane.color, 0));
      grad.addColorStop(0.7, rgba(lane.color, alpha * 0.55));
      grad.addColorStop(1, rgba(lane.color, Math.min(1, alpha * 1.1)));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.3 + p.headSize * 0.25;
      ctx.beginPath();
      for (let i = 0; i <= TAIL_SAMPLES; i++) {
        const [x, y] = lanePoint(lane, tailD + ((d - tailD) * i) / TAIL_SAMPLES, loopT);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = rgba(mixRgb(lane.color, headRgb, 0.75), Math.min(1, alpha * 1.2));
      ctx.beginPath();
      ctx.arc(hx, hy, p.headSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // 3. Composite: wide bloom + tight glow + sharp pass.
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, width, height);
    out.globalCompositeOperation = "lighter";
    out.filter = `blur(${16 * k}px)`;
    out.globalAlpha = 0.55;
    out.drawImage(sharp, 0, 0);
    out.filter = `blur(${4 * k}px)`;
    out.globalAlpha = 0.75;
    out.drawImage(sharp, 0, 0);
    out.filter = "none";
    out.globalAlpha = 1;
    out.drawImage(sharp, 0, 0);
    out.globalCompositeOperation = "source-over";
  }, [frame, width, height, k, lanes, particles, palette, sharp]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width, height }}
    />
  );
};
