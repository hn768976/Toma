// Generic line-art pictograms drawn in code. Each draws in a unit box
// (-1..1) around the origin; callers translate/scale and set strokeStyle.
type Ctx = CanvasRenderingContext2D;

const line = (c: Ctx, pts: number[]) => {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
};
const circ = (c: Ctx, x: number, y: number, r: number, fill = false) => {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) c.fill();
  else c.stroke();
};
const rrect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.stroke();
};

export const ICONS: Record<string, (c: Ctx) => void> = {
  satellite: (c) => {
    c.save();
    c.rotate(-Math.PI / 4);
    rrect(c, -0.2, -0.28, 0.4, 0.56, 0.05);
    for (const s of [-1, 1]) {
      c.strokeRect(s > 0 ? 0.3 : -0.95, -0.2, 0.65, 0.4);
      for (let k = 1; k < 3; k++) line(c, [s > 0 ? 0.3 + k * 0.217 : -0.95 + k * 0.217, -0.2, s > 0 ? 0.3 + k * 0.217 : -0.95 + k * 0.217, 0.2]);
      line(c, [s > 0 ? 0.3 : -0.95, 0, s > 0 ? 0.95 : -0.3, 0]);
      line(c, [s * 0.2, 0, s * 0.3, 0]);
    }
    line(c, [0, 0.28, 0, 0.45]);
    c.beginPath();
    c.arc(0, 0.62, 0.2, Math.PI * 1.1, Math.PI * 1.9);
    c.closePath();
    c.stroke();
    c.restore();
  },
  folder: (c) => {
    c.beginPath();
    c.moveTo(-0.8, -0.5);
    c.lineTo(-0.3, -0.5);
    c.lineTo(-0.18, -0.36);
    c.lineTo(0.8, -0.36);
    c.lineTo(0.8, 0.6);
    c.lineTo(-0.8, 0.6);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(0, 0.12, 0.28, Math.PI * 0.15, Math.PI * 0.95);
    c.stroke();
    c.beginPath();
    c.arc(0, 0.12, 0.28, Math.PI * 1.15, Math.PI * 1.95);
    c.stroke();
    // arrowheads on the refresh arcs
    const head = (x: number, y: number, dx: number, dy: number) => {
      c.beginPath();
      c.moveTo(x + dx * 0.13, y + dy * 0.13);
      c.lineTo(x - dy * 0.1, y + dx * 0.1);
      c.lineTo(x + dy * 0.1, y - dx * 0.1);
      c.closePath();
      c.fill();
    };
    head(-0.27, 0.06, 0, 1);
    head(0.27, 0.18, 0, -1);
  },
  cloud: (c) => {
    c.beginPath();
    c.moveTo(-0.55, 0.05);
    c.arc(-0.5, -0.17, 0.22, Math.PI * 0.6, Math.PI * 1.5);
    c.arc(-0.12, -0.38, 0.32, Math.PI * 1.1, Math.PI * 1.95);
    c.arc(0.42, -0.15, 0.24, Math.PI * 1.4, Math.PI * 0.45);
    c.closePath();
    c.stroke();
    for (const [x, y] of [[-0.45, 0.55], [-0.15, 0.7], [0.15, 0.7], [0.45, 0.55]]) {
      line(c, [x * 0.8, 0.08, x * 0.8, y - 0.2, x, y - 0.1]);
      circ(c, x, y, 0.08);
    }
  },
  atom: (c) => {
    for (let k = 0; k < 3; k++) {
      c.save();
      c.rotate((k * Math.PI) / 3);
      c.beginPath();
      c.ellipse(0, 0, 0.85, 0.3, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    circ(c, 0, 0, 0.12, true);
  },
  brain: (c) => {
    c.beginPath();
    c.moveTo(0, -0.62);
    c.bezierCurveTo(-0.3, -0.85, -0.7, -0.6, -0.62, -0.3);
    c.bezierCurveTo(-0.95, -0.15, -0.9, 0.3, -0.62, 0.38);
    c.bezierCurveTo(-0.6, 0.72, -0.2, 0.8, 0, 0.6);
    c.bezierCurveTo(0.2, 0.8, 0.6, 0.72, 0.62, 0.38);
    c.bezierCurveTo(0.9, 0.3, 0.95, -0.15, 0.62, -0.3);
    c.bezierCurveTo(0.7, -0.6, 0.3, -0.85, 0, -0.62);
    c.stroke();
    c.strokeRect(-0.17, -0.17, 0.34, 0.34);
    for (const s of [-1, 1]) {
      line(c, [s * 0.17, -0.08, s * 0.4, -0.08, s * 0.48, -0.3]);
      line(c, [s * 0.17, 0.08, s * 0.45, 0.08, s * 0.55, 0.2]);
      line(c, [s * 0.08, s * 0.17, s * 0.08, s * 0.42]);
      circ(c, s * 0.48, -0.36, 0.05, true);
      circ(c, s * 0.58, 0.25, 0.05, true);
    }
  },
  server: (c) => {
    for (let k = 0; k < 3; k++) {
      const y = -0.62 + k * 0.44;
      rrect(c, -0.62, y, 1.24, 0.34, 0.06);
      circ(c, -0.42, y + 0.17, 0.05, true);
      circ(c, -0.27, y + 0.17, 0.05, true);
      line(c, [0.0, y + 0.17, 0.45, y + 0.17]);
    }
  },
  robotArm: (c) => {
    c.strokeRect(-0.6, 0.5, 0.6, 0.18);
    line(c, [-0.3, 0.5, -0.3, 0.3]);
    circ(c, -0.3, 0.22, 0.1);
    c.beginPath();
    c.moveTo(-0.38, 0.16);
    c.lineTo(-0.02, -0.42);
    c.lineTo(0.12, -0.32);
    c.lineTo(-0.22, 0.26);
    c.stroke();
    circ(c, 0.05, -0.42, 0.1);
    c.beginPath();
    c.moveTo(0.12, -0.5);
    c.lineTo(0.5, -0.22);
    c.lineTo(0.42, -0.1);
    c.lineTo(0.08, -0.34);
    c.stroke();
    line(c, [0.48, -0.15, 0.62, 0.0, 0.56, 0.12]);
    line(c, [0.44, -0.12, 0.48, 0.08, 0.4, 0.16]);
  },
  chart: (c) => {
    rrect(c, -0.8, -0.55, 1.6, 1.0, 0.06);
    line(c, [-0.2, 0.45, -0.3, 0.68, 0.3, 0.68, 0.2, 0.45]);
    for (let k = 0; k < 4; k++) {
      const h = 0.18 + k * 0.14;
      c.strokeRect(-0.55 + k * 0.28, 0.3 - h, 0.16, h);
    }
    line(c, [-0.55, -0.05, -0.2, -0.22, 0.1, -0.12, 0.5, -0.4]);
    line(c, [0.36, -0.4, 0.5, -0.4, 0.5, -0.26]);
  },
};
