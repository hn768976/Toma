/**
 * Generic tech line icons for the "ai" variant.
 *
 * Thin strokes, no fills (bar a couple of pupil/rivet dots), authored in the
 * normalised 0..1 box described in prims.ts. Nothing here is branded — every
 * shape is a generic category glyph.
 */
import { pen, type IconDraw } from "./prims";

const chip: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.rrect(0.24, 0.24, 0.52, 0.52, 0.06);
  p.rect(0.38, 0.38, 0.24, 0.24);
  for (let i = 0; i < 3; i++) {
    const at = 0.34 + i * 0.16;
    p.line(at, 0.24, at, 0.12); // top pins
    p.line(at, 0.76, at, 0.88); // bottom pins
    p.line(0.24, at, 0.12, at); // left pins
    p.line(0.76, at, 0.88, at); // right pins
  }
};

const robotHead: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.line(0.5, 0.2, 0.5, 0.1);
  p.circle(0.5, 0.08, 0.045);
  p.rrect(0.2, 0.2, 0.6, 0.5, 0.09);
  p.dot(0.37, 0.4, 0.05);
  p.dot(0.63, 0.4, 0.05);
  p.line(0.4, 0.57, 0.6, 0.57); // mouth grille
  p.rect(0.12, 0.34, 0.08, 0.16); // ears
  p.rect(0.8, 0.34, 0.08, 0.16);
  p.poly([
    [0.34, 0.7],
    [0.34, 0.84],
    [0.66, 0.84],
    [0.66, 0.7],
  ]);
};

const cloud: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.shape((q) => {
    q.moveTo(0.22, 0.66);
    q.quadTo(0.08, 0.66, 0.1, 0.53);
    q.quadTo(0.12, 0.42, 0.26, 0.43);
    q.quadTo(0.3, 0.26, 0.48, 0.27);
    q.quadTo(0.66, 0.28, 0.68, 0.45);
    q.quadTo(0.86, 0.42, 0.89, 0.55);
    q.quadTo(0.92, 0.66, 0.78, 0.66);
  });
  p.line(0.22, 0.66, 0.78, 0.66);
};

const database: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.ellipse(0.5, 0.27, 0.28, 0.1);
  p.line(0.22, 0.27, 0.22, 0.73);
  p.line(0.78, 0.27, 0.78, 0.73);
  p.arc(0.5, 0.73, 0.28, 0, Math.PI);
  p.arc(0.5, 0.42, 0.28, 0.16 * Math.PI, 0.84 * Math.PI);
  p.arc(0.5, 0.57, 0.28, 0.16 * Math.PI, 0.84 * Math.PI);
};

const document: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.poly(
    [
      [0.26, 0.14],
      [0.6, 0.14],
      [0.74, 0.29],
      [0.74, 0.86],
      [0.26, 0.86],
    ],
    true,
  );
  p.poly([
    [0.6, 0.14],
    [0.6, 0.29],
    [0.74, 0.29],
  ]);
  for (let i = 0; i < 4; i++) {
    const y = 0.42 + i * 0.11;
    p.line(0.35, y, i === 3 ? 0.55 : 0.65, y);
  }
};

const lock: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.arc(0.5, 0.42, 0.17, Math.PI, 0);
  p.line(0.33, 0.42, 0.33, 0.48);
  p.line(0.67, 0.42, 0.67, 0.48);
  p.rrect(0.24, 0.46, 0.52, 0.4, 0.06);
  p.circle(0.5, 0.62, 0.055);
  p.line(0.5, 0.67, 0.5, 0.76);
};

const monitor: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.rrect(0.14, 0.22, 0.72, 0.44, 0.04);
  p.line(0.5, 0.66, 0.5, 0.76);
  p.line(0.34, 0.78, 0.66, 0.78);
  p.line(0.24, 0.34, 0.5, 0.34);
  p.line(0.24, 0.44, 0.42, 0.44);
};

const gear: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  const teeth = 8;
  p.circle(0.5, 0.5, 0.26);
  p.circle(0.5, 0.5, 0.1);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const w = 0.055;
    const nx = -sn * w;
    const ny = c * w;
    p.poly([
      [0.5 + c * 0.25 + nx, 0.5 + sn * 0.25 + ny],
      [0.5 + c * 0.38 + nx * 0.7, 0.5 + sn * 0.38 + ny * 0.7],
      [0.5 + c * 0.38 - nx * 0.7, 0.5 + sn * 0.38 - ny * 0.7],
      [0.5 + c * 0.25 - nx, 0.5 + sn * 0.25 - ny],
    ]);
  }
};

const lightBulb: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.circle(0.5, 0.4, 0.25);
  p.line(0.38, 0.6, 0.4, 0.68);
  p.line(0.62, 0.6, 0.6, 0.68);
  p.line(0.4, 0.68, 0.6, 0.68);
  p.line(0.4, 0.75, 0.6, 0.75);
  p.line(0.43, 0.82, 0.57, 0.82);
  p.poly([
    [0.43, 0.48],
    [0.47, 0.36],
    [0.53, 0.48],
    [0.57, 0.36],
  ]);
};

const networkCluster: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  const hub: [number, number] = [0.5, 0.5];
  const outer: [number, number][] = [
    [0.5, 0.16],
    [0.82, 0.36],
    [0.72, 0.8],
    [0.28, 0.8],
    [0.18, 0.36],
  ];
  for (const [x, y] of outer) {
    p.line(hub[0], hub[1], x, y);
  }
  p.line(outer[1][0], outer[1][1], outer[2][0], outer[2][1]);
  p.line(outer[3][0], outer[3][1], outer[4][0], outer[4][1]);
  p.circle(hub[0], hub[1], 0.1);
  for (const [x, y] of outer) {
    p.circle(x, y, 0.07);
  }
};

const mobileDevice: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.rrect(0.3, 0.12, 0.4, 0.76, 0.07);
  p.line(0.44, 0.2, 0.56, 0.2);
  p.circle(0.5, 0.79, 0.045);
  p.rect(0.36, 0.27, 0.28, 0.44);
};

const serverRack: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  for (let i = 0; i < 3; i++) {
    const y = 0.2 + i * 0.22;
    p.rrect(0.18, y, 0.64, 0.16, 0.03);
    p.dot(0.26, y + 0.08, 0.022);
    p.dot(0.33, y + 0.08, 0.022);
    p.line(0.58, y + 0.08, 0.74, y + 0.08);
  }
};

const brain: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  // Two lobes meeting on a centre seam.
  p.shape((q) => {
    q.moveTo(0.5, 0.16);
    q.curveTo(0.28, 0.14, 0.16, 0.3, 0.2, 0.42);
    q.curveTo(0.08, 0.52, 0.16, 0.68, 0.28, 0.72);
    q.curveTo(0.3, 0.86, 0.44, 0.88, 0.5, 0.82);
  });
  p.shape((q) => {
    q.moveTo(0.5, 0.16);
    q.curveTo(0.72, 0.14, 0.84, 0.3, 0.8, 0.42);
    q.curveTo(0.92, 0.52, 0.84, 0.68, 0.72, 0.72);
    q.curveTo(0.7, 0.86, 0.56, 0.88, 0.5, 0.82);
  });
  p.line(0.5, 0.16, 0.5, 0.82);
  p.shape((q) => {
    q.moveTo(0.34, 0.3);
    q.quadTo(0.44, 0.38, 0.36, 0.46);
  });
  p.shape((q) => {
    q.moveTo(0.66, 0.3);
    q.quadTo(0.56, 0.38, 0.64, 0.46);
  });
  p.shape((q) => {
    q.moveTo(0.36, 0.58);
    q.quadTo(0.46, 0.64, 0.38, 0.72);
  });
  p.shape((q) => {
    q.moveTo(0.64, 0.58);
    q.quadTo(0.54, 0.64, 0.62, 0.72);
  });
};

const magnifier: IconDraw = (ctx, s) => {
  const p = pen(ctx, s);
  p.circle(0.44, 0.42, 0.24);
  p.line(0.61, 0.6, 0.84, 0.84);
  p.arc(0.44, 0.42, 0.14, Math.PI * 0.9, Math.PI * 1.45);
};

/** The generic tech set. Keys are the icon names referenced from VARIANTS. */
export const TECH_ICONS = {
  chip,
  robotHead,
  cloud,
  database,
  document,
  lock,
  monitor,
  gear,
  lightBulb,
  networkCluster,
  mobileDevice,
  serverRack,
  brain,
  magnifier,
} satisfies Record<string, IconDraw>;
