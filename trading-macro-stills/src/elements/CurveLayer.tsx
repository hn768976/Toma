import { rgba } from "../lib/color";
import { extent, makeCandles, midline, resample, smooth } from "../lib/series";
import type { CurveDef, CurvesSpec } from "../types";
import { asElement, yMapper, type ElementProps } from "./common";

const SAMPLES = 520;

const strokeSmooth = (
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
): void => {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
};

const strokeAngular = (
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  every: number,
): { x: number; y: number }[] => {
  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i += every) nodes.push(pts[i]);
  nodes.push(pts[pts.length - 1]);
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for (const n of nodes.slice(1)) ctx.lineTo(n.x, n.y);
  ctx.stroke();
  return nodes;
};

const draw = ({
  ctx,
  width,
  height,
  palette,
  seriesRng,
  spec,
}: ElementProps<CurvesSpec>): void => {
  // The curves are smoothings of one price series, so they genuinely track
  // the same market the candles show rather than wandering on their own.
  const candles = makeCandles(seriesRng, spec.source.count, {
    volatility: spec.source.volatility,
  });
  const mid = midline(candles);
  // The same extent CandleSeries uses, so a shared series lines up.
  const [lo, hi] = extent(candles.flatMap((c) => [c.low, c.high]));

  const one = (curve: CurveDef): void => {
    const amp = curve.amplitude ?? 1;
    const y = yMapper(height, lo, hi, spec.fill * amp, curve.offset ?? 0);
    const values = resample(smooth(mid, curve.window), SAMPLES);
    const rise = curve.rise ?? 0;
    const pts = values.map((v, i) => {
      const t = i / (SAMPLES - 1);
      return { x: t * width, y: y(v) - (t - 0.5) * rise * height };
    });

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = curve.width;
    ctx.strokeStyle = rgba(palette, curve.color, 1);
    ctx.shadowColor = rgba(palette, curve.color, 0.85);
    ctx.shadowBlur = curve.glow;
    if (curve.dash) ctx.setLineDash(curve.dash);

    if (curve.angular) {
      const nodes = strokeAngular(ctx, pts, curve.angular);
      if (curve.nodes) {
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(palette, curve.color, 1);
        for (const n of nodes) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, curve.nodes, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      strokeSmooth(ctx, pts);
    }
    ctx.restore();
  };

  for (const curve of spec.curves) one(curve);
};

export const CurveLayer = asElement<CurvesSpec>("CurveLayer", draw);
