import type { SubjectManifest } from "./types";

// Every size in the template is a fraction of frame height, so the same
// layout holds at 6000x3375, 1920x1080 or any other 16:9 output.
// All three are measured off the reference stills (see README, "Measured
// against the reference"), not guessed.
export const FIT_FRACTION = 0.58; // longest side of the artwork / frame height
export const RING_RADIUS = 0.462; // ring diameter ~0.92 x frame height
export const HEX_CELL = 0.0335; // flat-to-flat hexagon width / frame height

// Tick band radii, as fractions of frame height.
export const TICK_INNER = 0.435;
export const TICK_OUTER = 0.502;
export const TICK_PITCH_DEG = 2.7;
export const TICK_BAR_DEG = 1.9;
export const TICK_HALF_SPAN_DEG = 62;
// Fainter, finer inner band.
export const INNER_TICK_INNER = 0.345;
export const INNER_TICK_OUTER = 0.395;
export const INNER_TICK_PITCH_DEG = 1.9;

export type Fit = {
  scale: number; // artwork units -> frame pixels
  tx: number;
  ty: number;
  transform: string;
};

// Scale the artwork so its longest bounding-box side occupies
// FIT_FRACTION (or scaleOverride) of the frame height, centred on the
// bounding box rather than the viewBox.
export const computeFit = (
  subject: SubjectManifest,
  width: number,
  height: number,
): Fit => {
  const fraction = subject.scaleOverride ?? FIT_FRACTION;
  const longest = Math.max(subject.bbox.w, subject.bbox.h) || 1;
  const scale = (fraction * height) / longest;
  const cx = subject.bbox.x + subject.bbox.w / 2;
  const cy = subject.bbox.y + subject.bbox.h / 2;
  const tx = width / 2 - cx * scale;
  const ty = height / 2 - cy * scale;
  return { scale, tx, ty, transform: `translate(${tx} ${ty}) scale(${scale})` };
};

// Honeycomb grid (pointy-top hexagons) covering the whole frame as a single
// path. Each hexagon contributes its three "upper" edges, so every edge in
// the grid is drawn exactly once and the line weight is uniform.
export const hexMeshPath = (width: number, height: number, cell: number) => {
  const w = cell; // flat-to-flat width
  const r = w / Math.sqrt(3); // circumradius
  const rowStep = 1.5 * r;
  const cols = Math.ceil(width / w) + 2;
  const rows = Math.ceil(height / rowStep) + 2;
  const parts: string[] = [];
  const f = (n: number) => n.toFixed(2);
  for (let j = -1; j < rows; j++) {
    const cy = j * rowStep;
    const offset = j % 2 === 0 ? 0 : w / 2;
    for (let i = -1; i < cols; i++) {
      const cx = i * w + offset;
      parts.push(
        `M${f(cx - w / 2)} ${f(cy - r / 2)}L${f(cx)} ${f(cy - r)}L${f(cx + w / 2)} ${f(cy - r / 2)}L${f(cx + w / 2)} ${f(cy + r / 2)}`,
      );
    }
  }
  return parts.join("");
};

export const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

// Arc path along a circle from angle a0 to a1 (degrees, clockwise in screen space).
export const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${p0.x} ${p0.y}A${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
};

// Four-point sparkle star centred on the origin; quadratic curves through
// the centre give the concave "lens flare" sides.
export const sparklePath = (R: number) =>
  `M0 ${-R}Q0 0 ${R} 0Q0 0 0 ${R}Q0 0 ${-R} 0Q0 0 0 ${-R}Z`;

/**
 * Horizontal falloff of the lens streak, sampled from the reference: the
 * streak's amplitude relative to its centre measured 0.68 at 0.33H out, 0.45
 * at 0.44H, 0.28 at 0.53H and 0.12 at 0.65H, which is exp(-(dx/0.5H)^2.6).
 */
export const streakFalloffStops = (width: number, height: number, steps = 15) =>
  Array.from({ length: steps }, (_, i) => {
    const offset = i / (steps - 1);
    const dx = Math.abs(offset - 0.5) * width;
    return {
      offset,
      colour: "#ffffff",
      opacity: Math.exp(0 - ((dx / (0.5 * height)) ** 2.6)),
    };
  });
