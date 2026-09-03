import React, { useMemo } from "react";
import { rnd, rndBiased, rndInt, rndRange, rndSigned } from "./rand";
import { useCanvas } from "./useCanvas";

/**
 * <HorizonSilhouette> — a ground line across the lower frame, with low
 * irregular overlapping hills beyond it and a dense band of fine vertical
 * strokes along it.
 *
 * Everything is drawn in one flat colour: this is a silhouette
 * treatment, not a landscape. Hills and the solid ground are static and
 * rasterised once; only the blades are redrawn per frame, each swaying on
 * its own seeded phase at an integer number of cycles per loop, so frame
 * 0 and frame `loopLength` match exactly.
 *
 * Every part is optional. Pass `hills: null` for a clean line,
 * `blades: null` for bare ground, or `ground: false` to drop the solid
 * fill below the line — which is what turns the blade band into reeds
 * standing at a waterline rather than grass on a bank.
 */

export type HillOptions = {
  count?: number;
  /** Peak height above the horizon, in pixels. */
  peak?: [number, number];
  /** Half-width as a fraction of frame width. */
  halfWidth?: [number, number];
  /**
   * Pushes hill centres away from the middle of the frame, as a fraction
   * of frame width. Useful when a subject sits on the horizon and a peak
   * rising through it would read as a slice.
   */
  avoidCentre?: number;
};

export type BladeOptions = {
  /** Blade height in pixels; the distribution is biased toward `min`. */
  height?: [number, number];
  /** Gap between successive blades in pixels. Irregular on purpose:
   *  even spacing reads as a comb. */
  gap?: [number, number];
  /** Half-width of a blade at its base. */
  width?: [number, number];
  /** Maximum static lean, in pixels, at the tip. */
  lean?: number;
  /** Sway amplitude at the tip, in pixels. */
  sway?: [number, number];
  /** Sway rate, in whole cycles per loop. Must be integers. */
  swayCycles?: [number, number];
};

export type HorizonSilhouetteProps = {
  width: number;
  height: number;
  /** y of the ground line. */
  horizonY: number;
  color: string;
  frame: number;
  loopLength: number;
  seed: string;
  hills?: HillOptions | null;
  blades?: BladeOptions | null;
  /** Fill everything below the line with `color`. Default true. */
  ground?: boolean;
  offset?: { x: number; y: number };
  style?: React.CSSProperties;
  className?: string;
};

/**
 * Stable defaults. A `{}` written inline as a destructuring default is a
 * NEW object on every render, which would invalidate the memos below and
 * rebuild every blade — and the full-frame ground raster — once per
 * frame. Module-level constants keep the identity fixed.
 */
const DEFAULT_HILLS: HillOptions = {};
const DEFAULT_BLADES: BladeOptions = {};

type Blade = {
  x: number;
  height: number;
  width: number;
  lean: number;
  swayAmp: number;
  swayK: number;
  swayPhase: number;
};

type Hill = {
  cx: number;
  halfWidth: number;
  peak: number;
  wobbleAmp: number;
  wobbleK: number;
  wobblePhase: number;
};

const buildBlades = (
  width: number,
  o: BladeOptions,
  seedPrefix: string,
): Blade[] => {
  const height = o.height ?? [22, 235];
  const gap = o.gap ?? [0.8, 3.9];
  const bladeWidth = o.width ?? [1.6, 4.2];
  const lean = o.lean ?? 26;
  const sway = o.sway ?? [2.5, 9];
  const swayCycles = o.swayCycles ?? [1, 3];

  const blades: Blade[] = [];
  let x = -40;
  let i = 0;
  while (x < width + 40 && i < 20000) {
    const seed = `${seedPrefix}:blade:${i}`;
    blades.push({
      x,
      height: rndBiased(`${seed}:h`, height[0], height[1], 1.6),
      width: rndRange(`${seed}:w`, bladeWidth[0], bladeWidth[1]),
      lean: rndSigned(`${seed}:l`, lean),
      swayAmp: rndRange(`${seed}:sa`, sway[0], sway[1]),
      swayK: rndInt(`${seed}:sk`, swayCycles[0], swayCycles[1]),
      swayPhase: rnd(`${seed}:sp`) * Math.PI * 2,
    });
    x += rndRange(`${seed}:gap`, gap[0], gap[1]);
    i++;
  }
  return blades;
};

const buildHills = (
  width: number,
  o: HillOptions,
  seedPrefix: string,
): Hill[] => {
  const count = o.count ?? 7;
  const peak = o.peak ?? [34, 186];
  const halfWidth = o.halfWidth ?? [0.11, 0.27];
  const avoidCentre = o.avoidCentre ?? 0.14;

  const hills: Hill[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `${seedPrefix}:hill:${i}`;
    const raw = rndRange(`${seed}:cx`, -0.15, 1.15);
    const pushed = raw < 0.5 ? raw - avoidCentre : raw + avoidCentre;
    hills.push({
      cx: pushed * width,
      halfWidth: rndRange(`${seed}:hw`, halfWidth[0], halfWidth[1]) * width,
      peak: rndRange(`${seed}:p`, peak[0], peak[1]),
      wobbleAmp: rndRange(`${seed}:wa`, 6, 22),
      wobbleK: rndRange(`${seed}:wk`, 2.2, 5.4),
      wobblePhase: rnd(`${seed}:wp`) * Math.PI * 2,
    });
  }
  return hills;
};

/** Hills plus solid ground: static, so it is rasterised once and blitted. */
const buildGroundRaster = (
  width: number,
  height: number,
  horizonY: number,
  color: string,
  hills: Hill[],
  ground: boolean,
): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("buildGroundRaster: no 2d context");
  ctx.fillStyle = color;

  for (const hill of hills) {
    ctx.beginPath();
    ctx.moveTo(hill.cx - hill.halfWidth, height);
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = hill.cx + (t * 2 - 1) * hill.halfWidth;
      const dome = Math.pow(Math.cos((t * 2 - 1) * (Math.PI / 2)), 1.6);
      const wobble =
        hill.wobbleAmp *
        Math.sin(hill.wobbleK * (t * 2 - 1) * Math.PI + hill.wobblePhase) *
        dome;
      ctx.lineTo(x, horizonY - hill.peak * dome - wobble);
    }
    ctx.lineTo(hill.cx + hill.halfWidth, height);
    ctx.closePath();
    ctx.fill();
  }

  if (ground) {
    ctx.fillRect(0, horizonY, width, height - horizonY);
  }
  return c;
};

export const HorizonSilhouette: React.FC<HorizonSilhouetteProps> = ({
  width,
  height,
  horizonY,
  color,
  frame,
  loopLength,
  seed,
  hills = DEFAULT_HILLS,
  blades = DEFAULT_BLADES,
  ground = true,
  offset = { x: 0, y: 0 },
  style,
  className,
}) => {
  const bladeList = useMemo(
    () => (blades ? buildBlades(width, blades, seed) : []),
    [width, blades, seed],
  );
  const groundRaster = useMemo(
    () =>
      buildGroundRaster(
        width,
        height,
        horizonY,
        color,
        hills ? buildHills(width, hills, seed) : [],
        ground,
      ),
    [width, height, horizonY, color, hills, seed, ground],
  );

  const ref = useCanvas(width, height, (ctx) => {
    const tau = Math.PI * 2;
    ctx.save();
    ctx.translate(offset.x, offset.y);

    ctx.fillStyle = color;
    if (ground) {
      // The whole layer may be translated by an ambient drift, so the
      // solid ground is over-filled past the frame edges to keep a sliver
      // of background from appearing at the bottom.
      ctx.fillRect(-20, horizonY, width + 40, height - horizonY + 20);
    }
    ctx.drawImage(groundRaster, 0, 0);

    for (const blade of bladeList) {
      const sway =
        blade.swayAmp *
        Math.sin((tau * blade.swayK * frame) / loopLength + blade.swayPhase);
      const tipX = blade.x + blade.lean + sway;
      const tipY = horizonY - blade.height;
      const midX = blade.x + (blade.lean + sway) * 0.35;
      const midY = horizonY - blade.height * 0.55;
      ctx.beginPath();
      ctx.moveTo(blade.x - blade.width, horizonY + 6);
      ctx.quadraticCurveTo(midX - blade.width * 0.45, midY, tipX, tipY);
      ctx.quadraticCurveTo(
        midX + blade.width * 0.45,
        midY,
        blade.x + blade.width,
        horizonY + 6,
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  });

  return <canvas ref={ref} style={style} className={className} />;
};
