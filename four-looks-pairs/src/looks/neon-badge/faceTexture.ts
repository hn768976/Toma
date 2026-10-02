import { INTER, MONTSERRAT } from "../../lib/fonts";
import { DOVE_PATH, DOVE_VIEWBOX } from "./icons";
import { BADGE_H, BADGE_W, roundedHexPoints } from "./shape";
import type { NeonBadgeVersion } from "./versions";

/** Face texture size: 4096 px wide so text is crisp at 4K and in 6000px stills. */
export const TEX_W = 4096;
export const TEX_H = Math.round((TEX_W * BADGE_H) / BADGE_W);

const toPx = (x: number, y: number): [number, number] => [
  (x / BADGE_W + 0.5) * TEX_W,
  (0.5 - y / BADGE_H) * TEX_H,
];

const polyPath = (inset: number) => {
  const p = new Path2D();
  roundedHexPoints(inset).forEach((pt, i) => {
    const [x, y] = toPx(pt.x, pt.y);
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  });
  p.closePath();
  return p;
};

/** Text running clockwise around a closed polyline (pixel space, y down). */
const drawTextOnPath = (ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, unit: string) => {
  const seg: number[] = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    seg.push(seg[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = seg[seg.length - 1];
  const unitW = ctx.measureText(unit).width;
  const reps = Math.max(1, Math.floor(total / unitW));
  const stretch = total / (reps * unitW);
  const text = unit.repeat(reps);
  const at = (s: number) => {
    const d = ((s % total) + total) % total;
    let i = 1;
    while (i < seg.length - 1 && seg[i] < d) i++;
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    const t = (d - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]);
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  };
  let s = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width * stretch;
    const p = at(s + w / 2);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    s += w;
  }
};

const drawDove = (ctx: CanvasRenderingContext2D, cx: number, cy: number, height: number) => {
  const sc = height / DOVE_VIEWBOX.h;
  ctx.save();
  ctx.translate(cx - (DOVE_VIEWBOX.w * sc) / 2, cy - height / 2);
  ctx.scale(sc, sc);
  const g = ctx.createLinearGradient(0, 0, DOVE_VIEWBOX.w, DOVE_VIEWBOX.h);
  ["#FF7A8A", "#FFB37A", "#FFE58A", "#8EE8A6", "#7CC4FF", "#B79BFF"].forEach((c, i) => g.addColorStop(i / 5, c));
  ctx.shadowColor = "rgba(255,255,255,0.55)";
  ctx.shadowBlur = 14 / sc;
  ctx.fillStyle = g;
  ctx.fill(new Path2D(DOVE_PATH));
  ctx.restore();
};

export const drawBadgeFace = (canvas: HTMLCanvasElement, v: NeonBadgeVersion) => {
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  const face = polyPath(0);

  ctx.save();
  ctx.clip(face);
  // Dark translucent glass with a faint blue gradient.
  const glass = ctx.createLinearGradient(0, 0, TEX_W * 0.3, TEX_H);
  glass.addColorStop(0, "rgba(40,96,190,0.55)");
  glass.addColorStop(0.5, "rgba(14,40,110,0.62)");
  glass.addColorStop(1, "rgba(6,16,58,0.72)");
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // Soft inner glow near the tube.
  ctx.shadowColor = "rgba(95,216,255,0.55)";
  ctx.shadowBlur = 120;
  ctx.lineWidth = 60;
  ctx.strokeStyle = "rgba(95,216,255,0.35)";
  ctx.stroke(face);
  ctx.shadowBlur = 0;

  // Ring text around the inside edge.
  ctx.font = `600 ${Math.round(TEX_H * 0.032)}px ${INTER}`;
  ctx.fillStyle = "rgba(200,240,255,0.42)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const ring = roundedHexPoints(0.17, 0.12, 12, 40).map((p) => toPx(p.x, p.y));
  drawTextOnPath(ctx, ring, v.ring);

  // Red strip across the lower part.
  const stripTop = TEX_H * 0.64;
  const stripH = TEX_H * 0.17;
  ctx.fillStyle = v.stripColor;
  ctx.globalAlpha = 0.94;
  ctx.fillRect(0, stripTop, TEX_W, stripH);
  ctx.globalAlpha = 1;
  ctx.font = `800 ${Math.round(stripH * 0.62)}px ${MONTSERRAT}`;
  ctx.fillStyle = v.stripText;
  ctx.letterSpacing = `${Math.round(stripH * 0.06)}px`;
  ctx.fillText(v.strip, TEX_W / 2, stripTop + stripH * 0.54);
  ctx.restore();

  // Top: short dashes either side of an icon or a short label.
  const topY = TEX_H * 0.16;
  ctx.save();
  ctx.shadowColor = "rgba(150,230,255,0.9)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#EAF8FF";
  const dashW = TEX_W * 0.085;
  const dashH = TEX_H * 0.016;
  const gap = TEX_W * 0.075;
  [-1, 1].forEach((s) => {
    const x = TEX_W / 2 + s * (gap + dashW / 2) - dashW / 2;
    ctx.beginPath();
    ctx.roundRect(x, topY - dashH / 2, dashW, dashH, dashH / 2);
    ctx.fill();
  });
  if (v.top.kind === "text") {
    ctx.font = `700 ${Math.round(TEX_H * 0.07)}px ${MONTSERRAT}`;
    ctx.letterSpacing = `${Math.round(TEX_H * 0.004)}px`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(v.top.text, TEX_W / 2, topY + TEX_H * 0.004);
  } else {
    ctx.shadowBlur = 0;
    drawDove(ctx, TEX_W / 2, topY, TEX_H * 0.11);
  }
  ctx.restore();

  // Main text: two lines, white, glowing, second line larger.
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  const drawGlowText = (text: string, size: number, y: number, spacing: number) => {
    ctx.font = `700 ${Math.round(size)}px ${MONTSERRAT}`;
    ctx.letterSpacing = `${Math.round(spacing)}px`;
    ctx.shadowColor = "rgba(140,225,255,0.75)";
    ctx.shadowBlur = size * 0.1;
    ctx.fillText(text, TEX_W / 2, y);
    ctx.shadowBlur = size * 0.05;
    ctx.fillText(text, TEX_W / 2, y);
  };
  drawGlowText(v.line1, TEX_H * 0.15, TEX_H * 0.395, TEX_H * 0.02);
  drawGlowText(v.line2, TEX_H * 0.215, TEX_H * 0.615, TEX_H * 0.012);
  ctx.restore();
};
