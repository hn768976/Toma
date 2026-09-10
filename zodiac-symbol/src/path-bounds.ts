/**
 * Tight bounding box of an SVG path, computed by sampling.
 *
 * The glyphs are authored by hand on a 100x100 grid and every one of them sits
 * differently in that grid. Rather than hand-copying a bounding box into the
 * data file - where it would quietly go stale the first time a path is nudged -
 * the framing is derived from the paths themselves.
 *
 * Supports the subset of path syntax the glyphs use: M, L, C, A and Z, in
 * absolute form.
 */

export type Bounds = { x: number; y: number; width: number; height: number };

const SAMPLES = 48;

const cubicAt = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/**
 * SVG endpoint arc -> centre parameterisation, per the SVG 1.1 implementation
 * notes (F.6.5), then sampled.
 */
const sampleArc = (
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
  push: (x: number, y: number) => void,
) => {
  if (rxIn === 0 || ryIn === 0) {
    push(x2, y2);
    return;
  }

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);

  // Scale the radii up if they are too small to span the endpoints.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const num =
    rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef =
    (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));

  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    return sign * Math.acos(Math.min(1, Math.max(-1, dot / len)));
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!sweep && dTheta > 0) {
    dTheta -= 2 * Math.PI;
  } else if (sweep && dTheta < 0) {
    dTheta += 2 * Math.PI;
  }

  for (let i = 1; i <= SAMPLES; i++) {
    const th = theta1 + (dTheta * i) / SAMPLES;
    const px = cx + rx * Math.cos(th) * cosPhi - ry * Math.sin(th) * sinPhi;
    const py = cy + rx * Math.cos(th) * sinPhi + ry * Math.sin(th) * cosPhi;
    push(px, py);
  }
};

export const pathBounds = (paths: string[]): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const push = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const d of paths) {
    let cx = 0;
    let cy = 0;
    let startX = 0;
    let startY = 0;

    // Split into commands: a letter plus its run of numbers.
    const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
    for (const command of commands) {
      const op = command[0];
      const args = (command.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(
        Number,
      );

      switch (op) {
        case 'M':
          cx = args[0];
          cy = args[1];
          startX = cx;
          startY = cy;
          push(cx, cy);
          // Extra coordinate pairs after an M are implicit line-tos.
          for (let i = 2; i + 1 < args.length; i += 2) {
            cx = args[i];
            cy = args[i + 1];
            push(cx, cy);
          }
          break;
        case 'L':
          for (let i = 0; i + 1 < args.length; i += 2) {
            cx = args[i];
            cy = args[i + 1];
            push(cx, cy);
          }
          break;
        case 'C':
          for (let i = 0; i + 5 < args.length; i += 6) {
            const [x1, y1, x2, y2, x3, y3] = args.slice(i, i + 6);
            for (let s = 1; s <= SAMPLES; s++) {
              const t = s / SAMPLES;
              push(cubicAt(cx, x1, x2, x3, t), cubicAt(cy, y1, y2, y3, t));
            }
            cx = x3;
            cy = y3;
          }
          break;
        case 'A':
          for (let i = 0; i + 6 < args.length; i += 7) {
            const [rx, ry, rot, large, sweep, x, y] = args.slice(i, i + 7);
            sampleArc(cx, cy, rx, ry, rot, large !== 0, sweep !== 0, x, y, push);
            cx = x;
            cy = y;
          }
          break;
        case 'Z':
        case 'z':
          cx = startX;
          cy = startY;
          break;
        default:
          throw new Error(
            `path-bounds: unsupported path command "${op}". The glyphs use only absolute M, L, C, A and Z.`,
          );
      }
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};
