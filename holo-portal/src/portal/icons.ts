// Tiny line-art "tech" glyphs (brain, gear, chat, bulb, robot, ...) like
// the ones floating up out of the portal in the reference. Each draws in a
// unit box roughly [-1, 1] centred on the origin; the caller sets the
// transform and stroke style.
type IconFn = (ctx: CanvasRenderingContext2D) => void;

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

const brain: IconFn = (ctx) => {
  ctx.beginPath();
  circle(ctx, -0.32, -0.25, 0.38);
  circle(ctx, 0.32, -0.25, 0.38);
  circle(ctx, -0.36, 0.28, 0.34);
  circle(ctx, 0.36, 0.28, 0.34);
  ctx.moveTo(0, -0.62);
  ctx.lineTo(0, 0.62);
  ctx.stroke();
};

const gear: IconFn = (ctx) => {
  ctx.beginPath();
  const teeth = 8;
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.85 : 0.62;
    const a0 = a - Math.PI / (teeth * 2);
    const a1 = a + Math.PI / (teeth * 2);
    if (i === 0) ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    else ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.closePath();
  circle(ctx, 0, 0, 0.28);
  ctx.stroke();
};

const chat: IconFn = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(-0.85, -0.55);
  ctx.lineTo(0.85, -0.55);
  ctx.lineTo(0.85, 0.3);
  ctx.lineTo(-0.2, 0.3);
  ctx.lineTo(-0.55, 0.7);
  ctx.lineTo(-0.5, 0.3);
  ctx.lineTo(-0.85, 0.3);
  ctx.closePath();
  ctx.moveTo(-0.5, -0.22);
  ctx.lineTo(0.5, -0.22);
  ctx.moveTo(-0.5, 0.02);
  ctx.lineTo(0.25, 0.02);
  ctx.stroke();
};

const bulb: IconFn = (ctx) => {
  ctx.beginPath();
  ctx.arc(0, -0.2, 0.55, Math.PI * 0.8, Math.PI * 2.2);
  ctx.lineTo(0.22, 0.5);
  ctx.lineTo(-0.22, 0.5);
  ctx.closePath();
  ctx.moveTo(-0.2, 0.68);
  ctx.lineTo(0.2, 0.68);
  ctx.moveTo(-0.12, 0.84);
  ctx.lineTo(0.12, 0.84);
  ctx.stroke();
};

const robot: IconFn = (ctx) => {
  ctx.beginPath();
  ctx.rect(-0.7, -0.4, 1.4, 1.0);
  circle(ctx, -0.3, 0.05, 0.14);
  circle(ctx, 0.3, 0.05, 0.14);
  ctx.moveTo(0, -0.4);
  ctx.lineTo(0, -0.7);
  circle(ctx, 0, -0.8, 0.1);
  ctx.moveTo(-0.7, 0.05);
  ctx.lineTo(-0.9, 0.05);
  ctx.moveTo(0.7, 0.05);
  ctx.lineTo(0.9, 0.05);
  ctx.stroke();
};

const cloud: IconFn = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(-0.6, 0.4);
  ctx.arc(-0.45, 0.1, 0.3, Math.PI * 0.6, Math.PI * 1.5);
  ctx.arc(0.0, -0.15, 0.42, Math.PI * 1.1, Math.PI * 1.9);
  ctx.arc(0.5, 0.12, 0.3, Math.PI * 1.5, Math.PI * 0.45);
  ctx.closePath();
  ctx.stroke();
};

const search: IconFn = (ctx) => {
  ctx.beginPath();
  circle(ctx, -0.15, -0.15, 0.5);
  ctx.moveTo(0.22, 0.22);
  ctx.lineTo(0.75, 0.75);
  ctx.stroke();
};

const chip: IconFn = (ctx) => {
  ctx.beginPath();
  ctx.rect(-0.5, -0.5, 1, 1);
  ctx.rect(-0.22, -0.22, 0.44, 0.44);
  for (let i = -1; i <= 1; i++) {
    const o = i * 0.3;
    ctx.moveTo(o, -0.5);
    ctx.lineTo(o, -0.78);
    ctx.moveTo(o, 0.5);
    ctx.lineTo(o, 0.78);
    ctx.moveTo(-0.5, o);
    ctx.lineTo(-0.78, o);
    ctx.moveTo(0.5, o);
    ctx.lineTo(0.78, o);
  }
  ctx.stroke();
};

const people: IconFn = (ctx) => {
  ctx.beginPath();
  circle(ctx, 0, -0.35, 0.25);
  ctx.moveTo(-0.5, 0.65);
  ctx.quadraticCurveTo(0, -0.15, 0.5, 0.65);
  circle(ctx, -0.55, -0.15, 0.16);
  circle(ctx, 0.55, -0.15, 0.16);
  ctx.stroke();
};

const chart: IconFn = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(-0.75, 0.7);
  ctx.lineTo(0.75, 0.7);
  ctx.rect(-0.6, 0.1, 0.28, 0.6);
  ctx.rect(-0.14, -0.25, 0.28, 0.95);
  ctx.rect(0.32, -0.6, 0.28, 1.3);
  ctx.stroke();
};

export const ICONS: IconFn[] = [
  brain,
  gear,
  chat,
  bulb,
  robot,
  cloud,
  search,
  chip,
  people,
  chart,
];
