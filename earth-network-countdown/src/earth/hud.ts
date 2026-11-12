// Countdown HUD drawn with Canvas 2D, then composited (and glitched) in the
// WebGL post pass. All measurements are authored for 3840×2160 and scaled.

import { EarthPalette } from "./palette";

export const HUD_FONT = "Exo2HUD";

/** HUD canvas rectangle in 4K pixels (top-left origin). */
export const HUD_RECT_4K = { x: 1020, y: 690, w: 1800, h: 620 };

const DIGIT_CENTER_Y = 290; // local, 4K px
const TEXT_WIDTH = 1305;
const FONT_PX = 212;

export const createHudCanvas = (scale: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(HUD_RECT_4K.w * scale);
  c.height = Math.round(HUD_RECT_4K.h * scale);
  return c;
};

export const drawHud = (canvas: HTMLCanvasElement, scale: number, groups: string[], pal: EarthPalette) => {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const cx = HUD_RECT_4K.w / 2;

  // Fixed-cell layout so changing digits never shift (tabular figures).
  ctx.font = `600 ${FONT_PX}px ${HUD_FONT}`;
  let digitW = 0;
  for (const ch of "0123456789") digitW = Math.max(digitW, ctx.measureText(ch).width);
  const colonW = ctx.measureText(":").width;
  const natural = digitW * 8 + colonW * 3;
  const gap = (TEXT_WIDTH - natural) / 10;
  const cells: { ch: string; x: number; w: number }[] = [];
  let x = cx - TEXT_WIDTH / 2;
  const chars = groups.join(":").split("");
  chars.forEach((ch, i) => {
    const w = ch === ":" ? colonW : digitW;
    cells.push({ ch, x, w });
    x += w + (i < chars.length - 1 ? gap : 0);
  });

  // thin rules above the digits and below the labels
  ctx.strokeStyle = "rgba(200, 210, 255, 0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - TEXT_WIDTH / 2, 140);
  ctx.lineTo(cx + TEXT_WIDTH / 2, 140);
  ctx.moveTo(cx - TEXT_WIDTH / 2, 478);
  ctx.lineTo(cx + TEXT_WIDTH / 2, 478);
  ctx.stroke();

  // digits with a soft glow
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.shadowColor = pal.hudGlow;
  ctx.shadowBlur = 26;
  ctx.fillStyle = pal.hud;
  for (const c of cells) ctx.fillText(c.ch, c.x + c.w / 2, DIGIT_CENTER_Y + 6);
  ctx.shadowBlur = 0;

  // labels centred under each group
  const labels = ["HRS", "MINS", "SECS", "FRAMES"];
  ctx.font = `600 30px ${HUD_FONT}`;
  ctx.fillStyle = "rgba(225, 230, 255, 0.82)";
  for (let g = 0; g < 4; g++) {
    const a = cells[g * 3];
    const b = cells[g * 3 + 1];
    const mid = (a.x + b.x + b.w) / 2;
    ctx.fillText(labels[g], mid, 445);
  }

  // registration "+" marks
  ctx.strokeStyle = "rgba(225, 230, 255, 0.7)";
  ctx.lineWidth = 4;
  const plus = (px: number, py: number) => {
    ctx.beginPath();
    ctx.moveTo(px - 18, py);
    ctx.lineTo(px + 18, py);
    ctx.moveTo(px, py - 18);
    ctx.lineTo(px, py + 18);
    ctx.stroke();
  };
  plus(130, 50);
  plus(cx - 5, 50);
  plus(HUD_RECT_4K.w - 135, 50);
  plus(130, 525);
  plus(HUD_RECT_4K.w - 135, 525);
};
