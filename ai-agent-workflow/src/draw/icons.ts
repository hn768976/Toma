import type { IconName } from "../layout";

// Line icons drawn with Canvas 2D, centred on (0,0) inside an s×s box.
// Colours come from the caller via strokeStyle/fillStyle.

type Ctx = CanvasRenderingContext2D;

const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const database = (ctx: Ctx, s: number) => {
  const w = s * 0.62;
  const eh = s * 0.13;
  const top = -s * 0.36;
  const step = s * 0.24;
  for (let i = 0; i < 3; i++) {
    const y = top + eh + i * step;
    rr(ctx, -w / 2, y - eh * 0.2, w, step * 0.86, s * 0.07);
    ctx.fill();
  }
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 3; i++) {
    const y = top + eh + i * step + step * 0.38;
    ctx.beginPath();
    ctx.arc(w / 2 - s * 0.12, y, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const doc = (ctx: Ctx, s: number) => {
  const w = s * 0.56;
  const h = s * 0.7;
  const f = s * 0.18;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2 - f, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + f);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = s * 0.06;
  for (let i = 0; i < 3; i++) {
    const y = -h * 0.08 + i * s * 0.14;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, y);
    ctx.lineTo(w * (i === 2 ? 0.05 : 0.3), y);
    ctx.stroke();
  }
  ctx.restore();
};

const chat = (ctx: Ctx, s: number) => {
  const w = s * 0.74;
  const h = s * 0.5;
  rr(ctx, -w / 2, -h / 2 - s * 0.06, w, h, s * 0.08);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, h / 2 - s * 0.08);
  ctx.lineTo(-w * 0.34, h / 2 + s * 0.14);
  ctx.lineTo(-w * 0.06, h / 2 - s * 0.08);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = s * 0.06;
  for (let i = 0; i < 2; i++) {
    const y = -s * 0.13 + i * s * 0.15;
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, y);
    ctx.lineTo(w * (i ? 0.1 : 0.32), y);
    ctx.stroke();
  }
  ctx.restore();
};

const cloud = (ctx: Ctx, s: number) => {
  ctx.beginPath();
  ctx.arc(-s * 0.18, s * 0.04, s * 0.17, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(s * 0.0, -s * 0.1, s * 0.22, Math.PI * 1.05, Math.PI * 1.95);
  ctx.arc(s * 0.2, s * 0.04, s * 0.17, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.16);
  ctx.lineTo(0, -s * 0.1);
  ctx.moveTo(-s * 0.09, -s * 0.01);
  ctx.lineTo(0, -s * 0.1);
  ctx.lineTo(s * 0.09, -s * 0.01);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(0, s * 0.2);
  ctx.lineTo(0, s * 0.36);
  ctx.stroke();
};

const broadcast = (ctx: Ctx, s: number) => {
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 1; i <= 2; i++) {
    const r = s * (0.12 + i * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.7, Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, s * 0.08);
  ctx.lineTo(0, s * 0.36);
  ctx.stroke();
};

const flowchart = (ctx: Ctx, s: number) => {
  const b = s * 0.18;
  rr(ctx, -s * 0.13, -s * 0.36, s * 0.26, b, s * 0.03);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.18);
  ctx.lineTo(0, -s * 0.06);
  ctx.moveTo(-s * 0.28, s * 0.06);
  ctx.lineTo(-s * 0.28, -s * 0.06);
  ctx.lineTo(s * 0.28, -s * 0.06);
  ctx.lineTo(s * 0.28, s * 0.06);
  ctx.moveTo(0, -s * 0.06);
  ctx.lineTo(0, s * 0.06);
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    rr(ctx, i * s * 0.28 - b / 2, s * 0.08, b, b, s * 0.03);
    ctx.fill();
  }
};

const shield = (ctx: Ctx, s: number) => {
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.36);
  ctx.quadraticCurveTo(s * 0.18, -s * 0.24, s * 0.32, -s * 0.24);
  ctx.quadraticCurveTo(s * 0.32, s * 0.2, 0, s * 0.38);
  ctx.quadraticCurveTo(-s * 0.32, s * 0.2, -s * 0.32, -s * 0.24);
  ctx.quadraticCurveTo(-s * 0.18, -s * 0.24, 0, -s * 0.36);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, s * 0.0);
  ctx.lineTo(-s * 0.03, s * 0.1);
  ctx.lineTo(s * 0.15, -s * 0.1);
  ctx.stroke();
};

const gear = (ctx: Ctx, s: number) => {
  const teeth = 8;
  const ro = s * 0.36;
  const ri = s * 0.27;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? ro : ri;
    if (i === 0) ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.11, 0, Math.PI * 2);
  ctx.stroke();
};

const bulb = (ctx: Ctx, s: number) => {
  ctx.beginPath();
  ctx.arc(0, -s * 0.08, s * 0.22, Math.PI * 0.8, Math.PI * 2.2);
  ctx.lineTo(s * 0.09, s * 0.2);
  ctx.lineTo(-s * 0.09, s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, s * 0.28);
  ctx.lineTo(s * 0.08, s * 0.28);
  ctx.stroke();
  for (const a of [-0.75, -0.5, -0.25]) {
    const ang = a * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * s * 0.3, -s * 0.08 + Math.sin(ang) * s * 0.3);
    ctx.lineTo(Math.cos(ang) * s * 0.38, -s * 0.08 + Math.sin(ang) * s * 0.38);
    ctx.stroke();
  }
};

const robot = (ctx: Ctx, s: number) => {
  rr(ctx, -s * 0.26, s * 0.22, s * 0.36, s * 0.12, s * 0.03);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, s * 0.22);
  ctx.lineTo(-s * 0.16, -s * 0.06);
  ctx.lineTo(s * 0.12, -s * 0.26);
  ctx.lineTo(s * 0.26, -s * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-s * 0.16, -s * 0.06, s * 0.06, 0, Math.PI * 2);
  ctx.arc(s * 0.12, -s * 0.26, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
};

const bell = (ctx: Ctx, s: number) => {
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, s * 0.18);
  ctx.quadraticCurveTo(-s * 0.18, s * 0.08, -s * 0.18, -s * 0.06);
  ctx.quadraticCurveTo(-s * 0.18, -s * 0.3, 0, -s * 0.3);
  ctx.quadraticCurveTo(s * 0.18, -s * 0.3, s * 0.18, -s * 0.06);
  ctx.quadraticCurveTo(s * 0.18, s * 0.08, s * 0.28, s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, s * 0.26, s * 0.07, 0, Math.PI);
  ctx.fill();
};

const puzzle = (ctx: Ctx, s: number) => {
  const h = s * 0.26;
  ctx.beginPath();
  ctx.moveTo(-h, -h);
  ctx.lineTo(-s * 0.07, -h);
  ctx.arc(0, -h, s * 0.08, Math.PI, 0, false);
  ctx.lineTo(h, -h);
  ctx.lineTo(h, -s * 0.07);
  ctx.arc(h, 0, s * 0.08, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(h, h);
  ctx.lineTo(-h, h);
  ctx.closePath();
  ctx.fill();
};

const ICONS: Record<IconName, (ctx: Ctx, s: number) => void> = {
  database,
  document: doc,
  chat,
  cloud,
  broadcast,
  flowchart,
  shield,
  gear,
  bulb,
  robot,
  bell,
  puzzle,
};

let scratch: HTMLCanvasElement | null = null;

/**
 * Icons cut details out with destination-out, so each is drawn on a
 * scratch canvas first and then composited (with glow) onto the target.
 */
export const drawIcon = (
  ctx: Ctx,
  name: IconName,
  cx: number,
  cy: number,
  s: number,
  color: string,
  glow: number,
) => {
  const size = Math.ceil(s * 1.1);
  if (!scratch) scratch = window.document.createElement("canvas");
  if (scratch.width < size || scratch.height < size) {
    scratch.width = Math.max(scratch.width, size);
    scratch.height = Math.max(scratch.height, size);
  }
  const sc = scratch.getContext("2d")!;
  sc.clearRect(0, 0, scratch.width, scratch.height);
  sc.save();
  sc.translate(size / 2, size / 2);
  sc.strokeStyle = color;
  sc.fillStyle = color;
  sc.lineWidth = s * 0.07;
  sc.lineCap = "round";
  sc.lineJoin = "round";
  ICONS[name](sc, s);
  sc.restore();

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.drawImage(scratch, 0, 0, size, size, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
};
