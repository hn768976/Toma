/**
 * Health line icons for the "medical" variant.
 *
 * Same construction as the tech set — thin strokes, no fills, authored in the
 * normalised 0..1 box from prims.ts — so both sets are interchangeable behind
 * one <IconNode>. Generic category glyphs only; nothing branded.
 */
import { pen, type IconDraw } from "./prims";

const stethoscope: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.circle(0.24, 0.14, 0.05);
  p.circle(0.5, 0.14, 0.05);
  p.shape((q) => {
    q.moveTo(0.24, 0.19);
    q.curveTo(0.24, 0.42, 0.28, 0.52, 0.37, 0.56);
  });
  p.shape((q) => {
    q.moveTo(0.5, 0.19);
    q.curveTo(0.5, 0.42, 0.46, 0.52, 0.37, 0.56);
  });
  p.shape((q) => {
    q.moveTo(0.37, 0.58);
    q.curveTo(0.37, 0.8, 0.62, 0.84, 0.68, 0.7);
  });
  p.circle(0.71, 0.61, 0.1);
  p.line(0.63, 0.55, 0.79, 0.55);
};

const heart: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.shape((q) => {
    q.moveTo(0.5, 0.82);
    q.curveTo(0.14, 0.58, 0.1, 0.36, 0.24, 0.26);
    q.curveTo(0.38, 0.17, 0.48, 0.3, 0.5, 0.36);
    q.curveTo(0.52, 0.3, 0.62, 0.17, 0.76, 0.26);
    q.curveTo(0.9, 0.36, 0.86, 0.58, 0.5, 0.82);
  }, true);
};

const hexCross: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([0.5 + Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38]);
  }
  p.poly(pts, true);
  p.poly(
    [
      [0.43, 0.29],
      [0.57, 0.29],
      [0.57, 0.43],
      [0.71, 0.43],
      [0.71, 0.57],
      [0.57, 0.57],
      [0.57, 0.71],
      [0.43, 0.71],
      [0.43, 0.57],
      [0.29, 0.57],
      [0.29, 0.43],
      [0.43, 0.43],
    ],
    true,
  );
};

const pillCapsule: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  // A stadium laid on the 45-degree diagonal, split across the middle.
  ctx.save();
  ctx.translate(p.X(0.5), p.Y(0.5));
  ctx.rotate(-Math.PI / 4);
  const w = p.S(0.66);
  const h = p.S(0.3);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(0, h / 2);
  ctx.stroke();
  ctx.restore();
};

const clipboardCheck: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.rrect(0.22, 0.18, 0.56, 0.68, 0.05);
  p.rrect(0.4, 0.11, 0.2, 0.12, 0.04);
  p.poly([
    [0.35, 0.52],
    [0.45, 0.62],
    [0.66, 0.38],
  ]);
  p.line(0.35, 0.73, 0.65, 0.73);
};

const hospitalBuilding: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.poly([
    [0.16, 0.86],
    [0.16, 0.36],
    [0.5, 0.18],
    [0.84, 0.36],
    [0.84, 0.86],
  ]);
  p.line(0.16, 0.86, 0.84, 0.86);
  p.line(0.5, 0.3, 0.5, 0.44);
  p.line(0.43, 0.37, 0.57, 0.37);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      p.rect(0.26 + i * 0.32, 0.52 + j * 0.15, 0.14, 0.1);
    }
  }
};

const ambulance: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.poly(
    [
      [0.08, 0.68],
      [0.08, 0.36],
      [0.58, 0.36],
      [0.58, 0.44],
      [0.76, 0.44],
      [0.92, 0.56],
      [0.92, 0.68],
    ],
    false,
  );
  p.line(0.08, 0.68, 0.92, 0.68);
  p.circle(0.28, 0.72, 0.09);
  p.circle(0.74, 0.72, 0.09);
  p.line(0.3, 0.44, 0.3, 0.58);
  p.line(0.23, 0.51, 0.37, 0.51);
  p.rect(0.62, 0.47, 0.12, 0.09);
};

const shieldCross: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.shape((q) => {
    q.moveTo(0.5, 0.12);
    q.lineTo(0.82, 0.24);
    q.lineTo(0.82, 0.52);
    q.curveTo(0.82, 0.72, 0.66, 0.82, 0.5, 0.88);
    q.curveTo(0.34, 0.82, 0.18, 0.72, 0.18, 0.52);
    q.lineTo(0.18, 0.24);
  }, true);
  p.line(0.5, 0.34, 0.5, 0.62);
  p.line(0.36, 0.48, 0.64, 0.48);
};

const syringe: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  ctx.save();
  ctx.translate(p.X(0.5), p.Y(0.5));
  ctx.rotate(-Math.PI / 4);
  const bw = p.S(0.5);
  const bh = p.S(0.18);
  ctx.beginPath();
  ctx.rect(-bw / 2, -bh / 2, bw, bh);
  ctx.stroke();
  // Needle, plunger rod and thumb rest along the barrel axis.
  ctx.beginPath();
  ctx.moveTo(bw / 2, 0);
  ctx.lineTo(bw / 2 + p.S(0.24), 0);
  ctx.moveTo(-bw / 2, 0);
  ctx.lineTo(-bw / 2 - p.S(0.16), 0);
  ctx.moveTo(-bw / 2 - p.S(0.16), -bh * 0.7);
  ctx.lineTo(-bw / 2 - p.S(0.16), bh * 0.7);
  ctx.moveTo(bw / 2 - p.S(0.06), -bh * 0.85);
  ctx.lineTo(bw / 2 - p.S(0.06), bh * 0.85);
  ctx.stroke();
  for (let i = 1; i <= 3; i++) {
    const x = -bw / 2 + (bw * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, -bh / 2);
    ctx.lineTo(x, -bh / 6);
    ctx.stroke();
  }
  ctx.restore();
};

const dnaHelix: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  const strand = (phase: number) => (t: number): [number, number] =>
    [0.5 + Math.sin(t * Math.PI * 2.4 + phase) * 0.24, 0.12 + t * 0.76];
  p.curve(strand(0), 56);
  p.curve(strand(Math.PI), 56);
  for (let i = 0; i <= 6; i++) {
    const t = 0.06 + (i / 6) * 0.88;
    const [x1, y1] = strand(0)(t);
    const [x2, y2] = strand(Math.PI)(t);
    p.line(x1, y1, x2, y2);
  }
};

const bandagedFigure: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.circle(0.5, 0.24, 0.15);
  // Head bandage: a band across the skull with two wrap lines.
  p.line(0.36, 0.19, 0.64, 0.19);
  p.line(0.37, 0.13, 0.63, 0.13);
  p.arc(0.5, 0.24, 0.15, Math.PI * 1.08, Math.PI * 1.92);
  p.shape((q) => {
    q.moveTo(0.24, 0.86);
    q.curveTo(0.24, 0.5, 0.36, 0.42, 0.5, 0.42);
    q.curveTo(0.64, 0.42, 0.76, 0.5, 0.76, 0.86);
  });
  // Arm in a sling.
  p.poly([
    [0.3, 0.52],
    [0.42, 0.68],
    [0.6, 0.62],
  ]);
  p.line(0.3, 0.52, 0.6, 0.62);
};

const firstAidCase: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.arc(0.5, 0.3, 0.12, Math.PI, 0);
  p.line(0.38, 0.3, 0.62, 0.3);
  p.rrect(0.14, 0.3, 0.72, 0.52, 0.06);
  p.line(0.14, 0.44, 0.86, 0.44);
  p.line(0.5, 0.5, 0.5, 0.74);
  p.line(0.38, 0.62, 0.62, 0.62);
};

const sealedDocument: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.rect(0.22, 0.12, 0.5, 0.7);
  for (let i = 0; i < 4; i++) {
    const y = 0.24 + i * 0.1;
    p.line(0.3, y, i === 3 ? 0.52 : 0.64, y);
  }
  p.circle(0.66, 0.7, 0.14);
  p.circle(0.66, 0.7, 0.07);
  p.poly([
    [0.6, 0.82],
    [0.58, 0.94],
    [0.66, 0.89],
    [0.74, 0.94],
    [0.72, 0.82],
  ]);
};

const pulseMonitor: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.rrect(0.12, 0.2, 0.76, 0.46, 0.05);
  p.line(0.5, 0.66, 0.5, 0.78);
  p.line(0.34, 0.8, 0.66, 0.8);
  p.poly([
    [0.2, 0.45],
    [0.32, 0.45],
    [0.38, 0.32],
    [0.45, 0.56],
    [0.52, 0.38],
    [0.58, 0.45],
    [0.8, 0.45],
  ]);
};

/** The health set. Keys are the icon names referenced from VARIANTS. */
export const HEALTH_ICONS = {
  stethoscope,
  heart,
  hexCross,
  pillCapsule,
  clipboardCheck,
  hospitalBuilding,
  ambulance,
  shieldCross,
  syringe,
  dnaHelix,
  bandagedFigure,
  firstAidCase,
  sealedDocument,
  pulseMonitor,
} satisfies Record<string, IconDraw>;
