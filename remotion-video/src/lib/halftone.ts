// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { rgba } from "./colorUtils";
import { noiseField } from "./noiseField";

/**
 * A halftone photograph placeholder: a rectangle of coarse dots whose radius
 * follows a smooth density field, so light and dark regions appear without the
 * block depicting anything.
 *
 * The screen is deliberately coarse — a wide dot pitch and a 45 degree rule
 * angle, the way cheap newsprint is screened — so that it reads as a printed
 * image rather than as a photograph.
 */
export const drawHalftone = (
  ctx: CanvasRenderingContext2D,
  opts: {
    seed: string;
    x: number;
    y: number;
    w: number;
    h: number;
    inkHex: string;
    /** Distance between dot centres, in px. */
    pitch?: number;
  },
): void => {
  const { seed, x, y, w, h, inkHex } = opts;
  if (w < 30 || h < 30) return;
  const pitch = opts.pitch ?? Math.max(7, w / 46);

  const field = noiseField({ seed: `${seed}:halftone`, octaves: 3, latticeW: 16, latticeH: 16 });
  const angle = Math.PI / 4;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = rgba(inkHex, 0.88);

  // Walk a rotated lattice wide enough to cover the rect at any angle.
  const diag = Math.hypot(w, h);
  const steps = Math.ceil(diag / pitch) + 2;
  const cx = x + w / 2;
  const cy = y + h / 2;

  for (let iy = -steps; iy <= steps; iy++) {
    for (let ix = -steps; ix <= steps; ix++) {
      const lx = ix * pitch;
      const ly = iy * pitch;
      const px = cx + lx * ca - ly * sa;
      const py = cy + lx * sa + ly * ca;
      if (px < x - pitch || px > x + w + pitch || py < y - pitch || py > y + h + pitch) continue;
      // Density comes from a low-frequency field plus a broad tonal ramp, then
      // gets its contrast stretched. Without the stretch every dot lands in the
      // middle of the range and the block reads as an even texture swatch
      // rather than as a picture: a printed halftone needs regions where the
      // dots have merged into solid ink and regions where they have all but
      // vanished.
      const u = (px - x) / w;
      const v = (py - y) / h;
      const raw = field.sample(u * 2.4, v * 2.4);
      const ramp = 0.66 - v * 0.36 + u * 0.1;
      const blended = raw * 0.62 + ramp * 0.38;
      const d = Math.max(0, Math.min(1, (blended - 0.5) * 1.85 + 0.5));
      const radius = Math.max(0, (d - 0.08) * pitch * 0.62);
      if (radius <= 0.25) continue;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A hairline frame, as a printed cut would have.
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rgba(inkHex, 0.35);
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
};
