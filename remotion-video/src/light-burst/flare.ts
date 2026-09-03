import {
  CORE_HOTSPOT_RADIUS,
  CORE_PEAK_RADIUS,
  GHOSTS,
  IRIS_ARC_FALLOFF,
  IRIS_BRIGHT_ANGLE,
  IRIS_ELLIPSE_Y,
  IRIS_LINE_WIDTH,
  IRIS_MIN_ARC_ALPHA,
  IRIS_RADIUS,
  SECONDARY_RINGS,
  STREAK_HALF_WIDTH,
  STREAK_HEIGHT,
} from "./constants";
import { clamp, hexToRgb, mixRgb, rgba, type Rgb } from "./color";
import { mulberry32 } from "./random";
import type { Palette } from "./palettes";

export type FlareColors = {
  hot: Rgb;
  falloff: [Rgb, Rgb, Rgb];
  ring: Rgb;
  ghostWarm: Rgb;
  ghostCool: Rgb;
  streak: Rgb;
};

export const flareColors = (palette: Palette): FlareColors => ({
  hot: hexToRgb(palette.hot),
  falloff: [
    hexToRgb(palette.falloff[0]),
    hexToRgb(palette.falloff[1]),
    hexToRgb(palette.falloff[2]),
  ],
  ring: hexToRgb(palette.ring),
  ghostWarm: hexToRgb(palette.ghostWarm),
  ghostCool: hexToRgb(palette.ghostCool),
  streak: hexToRgb(palette.streak),
});

// Per-ghost shape jitter, drawn once from a fixed seed so ghosts keep a
// consistent identity for the whole clip (and across every render worker).
const ghostJitter = GHOSTS.map((_, i) => {
  const rand = mulberry32(1337 + i * 977);
  return {
    aspect: 0.72 + rand() * 0.62,
    rotation: rand() * Math.PI,
    scale: 0.7 + rand() * 0.75,
    // A slight offset perpendicular to the flare axis: real ghosts do not sit
    // perfectly on the line, and a perfectly straight train reads as CG.
    offAxis: (rand() - 0.5) * 0.035,
  };
});

/**
 * The core's warm falloff.
 *
 * Two superimposed inverse-square terms rather than one: a very tight one
 * (K_HOT) that gives the pinpoint white centre, and a very broad one (K_SKIRT)
 * that gives the wide amber field. One term cannot do both — tune it tight and
 * you get a bright dot on a dark frame, tune it broad and the centre never
 * reaches white. A windowing factor takes the whole thing to zero at the
 * gradient's edge so there is no terminating ring.
 *
 * The two weights sum to >1 on purpose: the profile clips to full alpha across
 * the innermost few percent of the radius, which is what makes the peak read
 * as a light source flooding the frame rather than a gradient sitting on top
 * of one. At peak the strong part of the warm field spans roughly 70% of frame
 * width, with a faint ember skirt continuing into the corners as in the
 * reference — its corners never go black under the flare.
 */
const K_HOT = 500;
const K_SKIRT = 3.5;
const W_HOT = 0.85;
const W_SKIRT = 0.82;

const coreGradient = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colors: FlareColors,
  brightness: number,
) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const STOPS = 64;
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    const profile =
      W_HOT / (1 + K_HOT * t * t) + W_SKIRT / (1 + K_SKIRT * t * t);
    const window = Math.pow(1 - t * t * t, 1.2);
    const alpha = clamp(profile * window * brightness);
    // Colour temperature drops with distance: a small white-hot centre, a
    // broad amber body, then a deep ember skirt. The centre also cools with
    // the core itself — as brightness falls the white-hot tip gives way to
    // plain amber, which is what "the core cools as it travels" has to mean
    // if it is to be visible at all.
    const centre = mixRgb(colors.falloff[0], colors.hot, brightness);
    const color =
      t < 0.06
        ? mixRgb(centre, colors.falloff[0], t / 0.06)
        : t < 0.3
          ? mixRgb(colors.falloff[0], colors.falloff[1], (t - 0.06) / 0.24)
          : mixRgb(colors.falloff[1], colors.falloff[2], (t - 0.3) / 0.7);
    g.addColorStop(t, rgba(color, alpha));
  }
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

// The streak is the easiest element in the whole comp to overdo: at gain 1 it
// becomes an opaque white bar straight through the core and reads as a wipe
// rather than a lens artifact.
const STREAK_GAIN = 0.3;

const polygonPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  sides: number,
  rotation: number,
) => {
  ctx.beginPath();
  if (sides < 3) {
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    return;
  }
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * rx;
    const py = y + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

/**
 * Everything soft: warm falloff, ghost train, anamorphic streak, and the
 * diffuse glow that sits under the iris rings. Drawn additively, at the soft
 * layer's fixed backing resolution.
 *
 * `coreX`/`coreY` are in this canvas's pixels; `unit` is the canvas width, so
 * every size below stays a pure fraction of frame width.
 */
export const drawFlareSoft = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  coreX: number,
  coreY: number,
  brightness: number,
  radiusFactor: number,
  ringAlpha: number,
  ghostAlpha: number,
  streakAlpha: number,
  colors: FlareColors,
) => {
  ctx.globalCompositeOperation = "lighter";

  // --- Ghost train -------------------------------------------------------
  // Ghosts live on the line from the core through frame centre and out the
  // far side. Deriving their positions from the core (rather than animating
  // them separately) is what makes the whole thing read as one lens: when the
  // core moves, the train swings through frame like a real reflection stack.
  if (ghostAlpha > 0.002) {
    const cx = width / 2;
    const cy = height / 2;
    const axisX = coreX - cx;
    const axisY = coreY - cy;
    const axisLen = Math.hypot(axisX, axisY) || 1;
    const perpX = -axisY / axisLen;
    const perpY = axisX / axisLen;

    ctx.filter = `blur(${width * 0.02}px)`;
    GHOSTS.forEach((ghost, i) => {
      const j = ghostJitter[i];
      const gx = cx + axisX * ghost.k + perpX * j.offAxis * width;
      const gy = cy + axisY * ghost.k + perpY * j.offAxis * width;
      const r = ghost.size * width * j.scale;
      const tint = ghost.warm ? colors.ghostWarm : colors.ghostCool;
      const a = ghost.alpha * ghostAlpha;

      // Real ghosts are brighter around their rim than dead centre — it is
      // an image of the iris, not a blob of light.
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, rgba(tint, a * 0.55));
      g.addColorStop(0.62, rgba(tint, a * 0.78));
      g.addColorStop(0.86, rgba(tint, a));
      g.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = g;
      polygonPath(ctx, gx, gy, r, r * j.aspect, ghost.sides, j.rotation);
      ctx.fill();
    });
    ctx.filter = "none";
  }

  // --- Anamorphic streak -------------------------------------------------
  if (streakAlpha > 0.002) {
    const halfW = STREAK_HALF_WIDTH * width;
    const halfH = (STREAK_HEIGHT * height) / 2;
    ctx.save();
    ctx.filter = `blur(${halfH * 1.4}px)`;
    ctx.translate(coreX, coreY);
    ctx.scale(1, halfH / halfW);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW);
    const STOPS = 20;
    for (let i = 0; i <= STOPS; i++) {
      const t = i / STOPS;
      g.addColorStop(
        t,
        rgba(colors.streak, streakAlpha * STREAK_GAIN * Math.pow(1 - t, 2.2)),
      );
    }
    ctx.fillStyle = g;
    ctx.fillRect(-halfW, -halfW, halfW * 2, halfW * 2);
    ctx.restore();
    ctx.filter = "none";
  }

  // --- Warm falloff ------------------------------------------------------
  if (brightness > 0.002) {
    coreGradient(
      ctx,
      coreX,
      coreY,
      CORE_PEAK_RADIUS * width * radiusFactor,
      colors,
      brightness,
    );
  }

  // --- Diffuse glow under the iris ring ----------------------------------
  // The reference's arc sits in a faint halo; without it the sharp line reads
  // as vector art rather than light.
  if (ringAlpha > 0.002) {
    const r = IRIS_RADIUS * width;
    ctx.save();
    ctx.filter = `blur(${width * 0.006}px)`;
    ctx.translate(coreX, coreY);
    ctx.scale(1, IRIS_ELLIPSE_Y);
    const SEGMENTS = 90;
    ctx.lineWidth = width * 0.007;
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = (i / SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1.05) / SEGMENTS) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      const arc =
        IRIS_MIN_ARC_ALPHA +
        (1 - IRIS_MIN_ARC_ALPHA) *
          Math.pow(
            Math.max(0, 0.5 + 0.5 * Math.cos(mid - IRIS_BRIGHT_ANGLE)),
            IRIS_ARC_FALLOFF,
          );
      ctx.strokeStyle = rgba(colors.ring, ringAlpha * arc * 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.filter = "none";
  }

  ctx.globalCompositeOperation = "source-over";
};

/**
 * The only elements allowed a hard edge: the thin iris ring, its two fainter
 * concentric companions, and the white-hot centre of the core. Drawn at full
 * composition resolution so the ring stays a crisp ~3px line at 4K.
 */
export const drawFlareSharp = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  coreX: number,
  coreY: number,
  brightness: number,
  radiusFactor: number,
  ringAlpha: number,
  colors: FlareColors,
) => {
  ctx.globalCompositeOperation = "lighter";

  if (ringAlpha > 0.002) {
    const rings = [
      { radiusScale: 1, alpha: 1, widthScale: 1 },
      ...SECONDARY_RINGS,
    ];
    ctx.save();
    ctx.translate(coreX, coreY);
    ctx.scale(1, IRIS_ELLIPSE_Y);
    const SEGMENTS = 160;
    for (const ring of rings) {
      ctx.lineWidth = Math.max(
        1,
        IRIS_LINE_WIDTH * width * ring.widthScale,
      );
      const r = IRIS_RADIUS * width * ring.radiusScale;
      for (let i = 0; i < SEGMENTS; i++) {
        const a0 = (i / SEGMENTS) * Math.PI * 2;
        const a1 = ((i + 1.15) / SEGMENTS) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        // Brightest through the lower-left quadrant, fading out around the
        // top — the partial visibility is the whole character of the detail.
        const arc =
          IRIS_MIN_ARC_ALPHA +
          (1 - IRIS_MIN_ARC_ALPHA) *
            Math.pow(
              Math.max(0, 0.5 + 0.5 * Math.cos(mid - IRIS_BRIGHT_ANGLE)),
              IRIS_ARC_FALLOFF,
            );
        ctx.strokeStyle = rgba(colors.ring, ringAlpha * ring.alpha * arc);
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // White-hot centre.
  if (brightness > 0.002) {
    const r = CORE_HOTSPOT_RADIUS * width * (0.45 + 0.55 * radiusFactor);
    const g = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, r);
    const STOPS = 16;
    for (let i = 0; i <= STOPS; i++) {
      const t = i / STOPS;
      g.addColorStop(
        t,
        rgba(
          mixRgb(
            mixRgb(colors.falloff[0], colors.hot, brightness),
            colors.falloff[0],
            Math.pow(t, 0.7),
          ),
          Math.pow(brightness, 1.6) * Math.pow(1 - t, 2.2),
        ),
      );
    }
    ctx.fillStyle = g;
    ctx.fillRect(coreX - r, coreY - r, r * 2, r * 2);
  }

  ctx.globalCompositeOperation = "source-over";
};
