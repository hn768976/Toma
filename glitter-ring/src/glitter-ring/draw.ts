// The whole frame, painted onto a 2D canvas. Polar coordinates, no camera,
// no 3D: depth is faked with size, blur and brightness.
//
// Every value below is a pure function of (frame, seeded field), so frames can
// be rendered in any order on any thread and still produce the same movie.

import {
  ARCS,
  ARC_LAPS,
  BREATHE_AMPLITUDE,
  DURATION_IN_FRAMES,
  GRAIN_STRENGTH,
  GRAIN_TILE_SIZE,
  ORBIT_LAPS,
  PARTICLE_MAX_SIZE,
  RING_RADIUS_FRACTION,
  SHEAR_AMPLITUDE,
  VIGNETTE_STRENGTH,
} from "./constants";
import { BokehDisc, ParticleField } from "./field";
import { hexToRgb, Palette, rgbaString } from "./palettes";
import { BOKEH_TINTS, getGrainTiles, getSprites } from "./sprites";
import { mulberry32 } from "./random";

const TAU = Math.PI * 2;

const wrapAngle = (angle: number): number => {
  const wrapped = ((angle + Math.PI) % TAU + TAU) % TAU;
  return wrapped - Math.PI;
};

// How strongly the arc highlights are lighting the ring at this angle.
const arcBoostAt = (angle: number, progress: number): number => {
  let boost = 0;
  for (const arc of ARCS) {
    const centre = arc.phase + TAU * ARC_LAPS * progress;
    const delta = wrapAngle(angle - centre) / arc.sigma;
    const pulse =
      0.78 + 0.22 * Math.sin(TAU * arc.pulseCycles * progress + arc.pulsePhase);
    boost += arc.intensity * pulse * Math.exp(-0.5 * delta * delta);
  }
  return boost;
};

const drawDisc = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
) => {
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
};

// Bokeh and foreground blobs travel a closed loop: every offset is a whole
// number of sine cycles, so frame 600 lands exactly where frame 0 started.
const driftedPosition = (
  disc: BokehDisc,
  progress: number,
  width: number,
  height: number,
) => ({
  x: (disc.x + disc.driftX * Math.sin(TAU * disc.cyclesX * progress + disc.phaseX)) * width,
  y: (disc.y + disc.driftY * Math.sin(TAU * disc.cyclesY * progress + disc.phaseY)) * height,
});

const grainOffsets = (() => {
  // Fixed per-frame jitter so the grain never sits still, and never differs
  // between two renders of the same frame.
  const rand = mulberry32(0x5bd1e995);
  return Array.from({ length: DURATION_IN_FRAMES }, () => ({
    x: Math.floor(rand() * GRAIN_TILE_SIZE),
    y: Math.floor(rand() * GRAIN_TILE_SIZE),
  }));
})();

export type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: number;
  palette: Palette;
  field: ParticleField;
};

export const drawGlitterRing = ({
  ctx,
  width,
  height,
  frame,
  palette,
  field,
}: DrawArgs): void => {
  const sprites = getSprites(palette);
  const progress = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  const centreX = width / 2;
  const centreY = height / 2;
  // Radial breathing: the ring inhales and exhales once per loop.
  const ringRadius =
    height *
    RING_RADIUS_FRACTION *
    (1 + BREATHE_AMPLITUDE * Math.sin(TAU * progress));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // --- Background ----------------------------------------------------------
  // Deep tone behind the ring, falling to near-black in the corners. It never
  // brightens enough to compete with the ring itself.
  const background = ctx.createRadialGradient(
    centreX,
    centreY,
    0,
    centreX,
    centreY,
    Math.hypot(width, height) * 0.62,
  );
  background.addColorStop(0, palette.backgroundInner);
  background.addColorStop(0.55, palette.backgroundInner);
  background.addColorStop(1, palette.backgroundOuter);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // --- Background bokeh ----------------------------------------------------
  // Large, heavily blurred discs drifting slowly. Without them the ring floats
  // in a void; they must stay soft and dim so the ring keeps the eye.
  ctx.globalCompositeOperation = "lighter";
  for (const disc of field.bokeh) {
    const { x, y } = driftedPosition(disc, progress, width, height);
    ctx.globalAlpha = disc.alpha;
    drawDisc(
      ctx,
      sprites.bokeh[Math.min(BOKEH_TINTS - 1, Math.floor(disc.tint * BOKEH_TINTS))],
      x,
      y,
      disc.radius * height,
    );
  }

  // --- Glow along the ring path -------------------------------------------
  const glow = ctx.createRadialGradient(
    centreX,
    centreY,
    ringRadius * 0.55,
    centreX,
    centreY,
    ringRadius * 1.45,
  );
  const glowColor = hexToRgb(palette.ringGlow);
  glow.addColorStop(0, rgbaString(glowColor, 0));
  glow.addColorStop(0.32, rgbaString(glowColor, 0.06));
  glow.addColorStop(0.5, rgbaString(glowColor, 0.16));
  glow.addColorStop(0.68, rgbaString(glowColor, 0.055));
  glow.addColorStop(1, rgbaString(glowColor, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.fillRect(
    centreX - ringRadius * 1.5,
    centreY - ringRadius * 1.5,
    ringRadius * 3,
    ringRadius * 3,
  );

  // --- Ring particles ------------------------------------------------------
  // The field is pre-sorted by depth bucket then colour bucket, so this loop
  // walks contiguous runs of a single cached sprite.
  const maxSizePx = PARTICLE_MAX_SIZE * height;
  for (const particle of field.ring) {
    const angle =
      particle.angle +
      TAU * ORBIT_LAPS * progress +
      // Inner particles run a touch ahead of outer ones and then fall back:
      // the ring shears gently rather than turning as a rigid disc.
      particle.shear * SHEAR_AMPLITUDE * Math.sin(TAU * progress) +
      particle.wobbleAmplitude *
        Math.sin(TAU * particle.wobbleCycles * progress + particle.wobblePhase);

    const radius = ringRadius + particle.radialOffset * height;
    const x = centreX + Math.cos(angle) * radius;
    const y = centreY + Math.sin(angle) * radius;

    const boost = arcBoostAt(angle, progress);
    const twinkle =
      1 +
      particle.twinkleAmount *
        Math.sin(TAU * particle.twinkleCycles * progress + particle.twinklePhase);

    const core = particle.size * height * (1 + boost * 0.55);
    const drawRadius = (core * (2.1 + 6 * particle.softness)) / 2;
    const alpha = Math.min(
      1,
      particle.brightness * twinkle * (1 - 0.45 * particle.softness) * (1 + boost),
    );

    ctx.globalAlpha = alpha;
    drawDisc(ctx, sprites.discs[particle.softnessLevel][particle.colorBucket], x, y, drawRadius);

    // Bloom, on the arc highlights only: a near-white halo that builds where
    // the light is catching the ring.
    if (boost > 0.12) {
      ctx.globalAlpha = Math.min(0.2, boost * 0.14);
      drawDisc(ctx, sprites.highlight, x, y, drawRadius * (1.4 + boost * 0.9));
    }

    // Sparkle: a hard flash with a tiny four-point cross, on a schedule keyed
    // to frame % 600 so it repeats exactly across the loop.
    if (particle.sparklePeriod > 0) {
      const phase = (frame + particle.sparkleOffset) % particle.sparklePeriod;
      if (phase < particle.sparkleFrames) {
        const fade = 1 - phase / particle.sparkleFrames;
        const scale = 0.45 + 0.55 * (particle.size / PARTICLE_MAX_SIZE);
        const crossRadius = maxSizePx * 4.2 * scale * (0.55 + 0.45 * fade);
        ctx.globalAlpha = Math.min(1, 0.75 * fade + 0.25);
        drawDisc(ctx, sprites.cross, x, y, crossRadius);
        ctx.globalAlpha = Math.min(0.8, 0.55 * fade);
        drawDisc(ctx, sprites.highlight, x, y, crossRadius * 0.55);
      }
    }
  }

  // --- Arc highlights ------------------------------------------------------
  // Short tangential streaks where the ring catches the light, bloomed. These
  // travel one whole lap per loop.
  for (const arc of ARCS) {
    const centre = arc.phase + TAU * ARC_LAPS * progress;
    const pulse =
      0.78 + 0.22 * Math.sin(TAU * arc.pulseCycles * progress + arc.pulsePhase);
    const x = centreX + Math.cos(centre) * ringRadius;
    const y = centreY + Math.sin(centre) * ringRadius;
    const length = arc.sigma * ringRadius * 4.6;
    const thickness = height * 0.015;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(centre + Math.PI / 2); // long axis tangential to the ring
    const layers: [number, number, number][] = [
      [2.6, 3, 0.12], // outer bloom
      [1.3, 0.7, 0.3], // streak
      [0.8, 0.2, 0.65], // near-white core line
    ];
    for (const [lengthScale, thicknessScale, alpha] of layers) {
      ctx.globalAlpha = alpha * arc.intensity * pulse;
      const w = length * lengthScale;
      const h = thickness * thicknessScale;
      ctx.drawImage(sprites.highlight, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  // --- Foreground ----------------------------------------------------------
  // A handful of large, very blurred, dim discs crossing in front, held to the
  // frame edges so nothing ever drifts across the empty centre.
  for (const disc of field.foreground) {
    const { x, y } = driftedPosition(disc, progress, width, height);
    ctx.globalAlpha = disc.alpha;
    drawDisc(
      ctx,
      sprites.bokeh[Math.min(BOKEH_TINTS - 1, Math.floor(disc.tint * BOKEH_TINTS))],
      x,
      y,
      disc.radius * height,
    );
  }

  // --- Grain ---------------------------------------------------------------
  // Additive dither. The smooth background gradient bands in H.264 without it,
  // and banding only shows up in the encoded file, not the preview.
  const tiles = getGrainTiles();
  const tile = tiles[frame % tiles.length];
  const offset = grainOffsets[frame % DURATION_IN_FRAMES];
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.globalAlpha = GRAIN_STRENGTH;
    ctx.save();
    ctx.translate(-offset.x, -offset.y);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + GRAIN_TILE_SIZE, height + GRAIN_TILE_SIZE);
    ctx.restore();
  }

  // --- Vignette ------------------------------------------------------------
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(
    centreX,
    centreY,
    Math.min(width, height) * 0.28,
    centreX,
    centreY,
    Math.hypot(width, height) * 0.55,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.6, `rgba(0, 0, 0, ${VIGNETTE_STRENGTH * 0.35})`);
  vignette.addColorStop(1, `rgba(0, 0, 0, ${VIGNETTE_STRENGTH})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
};
