/**
 * An animated turbulent shimmer clipped to an arbitrary mask.
 *
 * This is the thing that stops the symbol being a static icon. Two bands of
 * looping spectral noise — a slow large-scale drift and a faster fine-scale
 * flicker — are multiplied together, brightened toward the mask's edge, struck
 * by occasional flares, and mapped through a three-stop colour ramp running
 * from below the base accent up to near white. The field is computed at 1/6
 * linear resolution and upscaled with high-quality smoothing, which is what
 * makes it affordable at 4K; it is soft by nature, so nothing is lost.
 *
 * The component knows nothing about what shape it is filling: it is handed
 * alpha masks and coverage maps. Give it a different mask and it fills that
 * instead.
 *
 * Everything is a pure function of the loop position, and every temporal
 * frequency is a whole number of cycles per loop, so the shimmer closes
 * seamlessly.
 */

import React, { useMemo } from "react";
import { LOOP_FRAMES, TAU } from "./constants";
import { createLayer, hexToRgb } from "./lib/canvas";
import { lowResUpscale } from "./lib/lowResUpscale";
import {
  buildSpectralBand,
  combineBands,
  sampleSpectralBand,
} from "./lib/noiseField";
import { randInt, randRange } from "./lib/seededRandom";

export interface EnergyFillMask {
  size: number;
  noiseSize: number;
  /** Where the fill is allowed to paint solidly. */
  clip: HTMLCanvasElement;
  /** Low-resolution inside/outside coverage. */
  coverage: Float32Array;
  /** Low-resolution proximity to the shape's edge. */
  edge: Float32Array;
  /** Low-resolution weight of the band just outside the shape. */
  wisp: Float32Array;
}

export interface EnergyFillLook {
  /** Shimmer trough, mid and peak colours. */
  dark: string;
  mid: string;
  bright: string;
  lowWeight: number;
  highWeight: number;
  lowCycles: [number, number];
  highCycles: [number, number];
  lowFreq: [number, number];
  highFreq: [number, number];
  contrast: number;
  edgeBoost: number;
  wispGain: number;
  wispBlur: number;
  flareGap: [number, number];
  flareDuration: [number, number];
  flareOnset: number;
}

interface Flare {
  start: number;
  duration: number;
  x: number;
  y: number;
  radius: number;
  strength: number;
}

const LOW_BAND_WAVES = 7;
const HIGH_BAND_WAVES = 11;
const RAMP_STEPS = 256;

/**
 * Flares are laid out *around* the loop rather than along a timeline.
 *
 * The gaps are drawn freely across the whole requested range, so the rhythm
 * stays properly irregular, and then the difference between their sum and one
 * loop is absorbed by nudging each gap in proportion to the slack it has left
 * before hitting the end of the range. The gaps therefore sum to exactly 600
 * while every one of them — including the wrap from the last flare back to the
 * first — still obeys the spacing rule, and the schedule closes seamlessly.
 * Positions, sizes and timings all come from a stable seed.
 */
const buildFlareSchedule = (seed: string, look: EnergyFillLook): Flare[] => {
  const [minGap, maxGap] = look.flareGap;
  // A count whose mean gap lands inside the range, so the repair below always
  // has enough slack to work with.
  const count = Math.max(1, Math.round(LOOP_FRAMES / ((minGap + maxGap) / 2)));

  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const gap = randRange(`${seed}-gap-${i}`, minGap, maxGap);
    gaps.push(gap);
    total += gap;
  }

  const deficit = LOOP_FRAMES - total;
  let slack = 0;
  for (const gap of gaps) slack += deficit > 0 ? maxGap - gap : gap - minGap;
  if (slack > 0) {
    for (let i = 0; i < count; i++) {
      const share = (deficit > 0 ? maxGap - gaps[i] : gaps[i] - minGap) / slack;
      gaps[i] += deficit * share;
    }
  }

  const flares: Flare[] = [];
  let cursor = randRange(`${seed}-first`, 0, LOOP_FRAMES);
  for (let i = 0; i < count; i++) {
    const angle = randRange(`${seed}-a-${i}`, 0, TAU);
    const distance = randRange(`${seed}-d-${i}`, 0.18, 0.82);
    flares.push({
      start: cursor % LOOP_FRAMES,
      duration: randInt(`${seed}-dur-${i}`, look.flareDuration[0], look.flareDuration[1]),
      x: 0.5 + Math.cos(angle) * distance * 0.5,
      y: 0.5 + Math.sin(angle) * distance * 0.5,
      radius: randRange(`${seed}-r-${i}`, 0.1, 0.24),
      strength: randRange(`${seed}-s-${i}`, 0.55, 1),
    });
    cursor += gaps[i];
  }
  return flares;
};

/** Shortest signed distance between two frames on a circular timeline. */
const loopDelta = (frame: number, start: number): number => {
  let d = frame - start;
  if (d < -LOOP_FRAMES / 2) d += LOOP_FRAMES;
  if (d > LOOP_FRAMES / 2) d -= LOOP_FRAMES;
  return d;
};

/** Sharp strike, then decay. `onset` is the fraction of life spent rising. */
const flareEnvelope = (age: number, duration: number, onset: number): number => {
  if (age < 0 || age > duration) return 0;
  const t = age / duration;
  if (t < onset) return t / onset;
  const decay = (t - onset) / (1 - onset);
  return (1 - decay) * (1 - decay);
};

const buildRamp = (look: EnergyFillLook): Uint8ClampedArray => {
  const dark = hexToRgb(look.dark);
  const mid = hexToRgb(look.mid);
  const bright = hexToRgb(look.bright);
  const ramp = new Uint8ClampedArray(RAMP_STEPS * 3);
  for (let i = 0; i < RAMP_STEPS; i++) {
    const t = i / (RAMP_STEPS - 1);
    const from = t < 0.5 ? dark : mid;
    const to = t < 0.5 ? mid : bright;
    const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    ramp[i * 3] = from[0] + (to[0] - from[0]) * k;
    ramp[i * 3 + 1] = from[1] + (to[1] - from[1]) * k;
    ramp[i * 3 + 2] = from[2] + (to[2] - from[2]) * k;
  }
  return ramp;
};

export interface EnergyFillProps {
  ctx: CanvasRenderingContext2D;
  mask: EnergyFillMask;
  look: EnergyFillLook;
  seed: string;
  frame: number;
  centerX: number;
  centerY: number;
}

export const EnergyFill: React.FC<EnergyFillProps> = ({
  ctx,
  mask,
  look,
  seed,
  frame,
  centerX,
  centerY,
}) => {
  const n = mask.noiseSize;

  const resources = useMemo(() => {
    return {
      low: buildSpectralBand(
        `${seed}-low`,
        LOW_BAND_WAVES,
        look.lowFreq[0],
        look.lowFreq[1],
        look.lowCycles[0],
        look.lowCycles[1],
        n,
      ),
      high: buildSpectralBand(
        `${seed}-high`,
        HIGH_BAND_WAVES,
        look.highFreq[0],
        look.highFreq[1],
        look.highCycles[0],
        look.highCycles[1],
        n,
      ),
      lowValues: new Float32Array(n * n),
      highValues: new Float32Array(n * n),
      field: new Float32Array(n * n),
      ramp: buildRamp(look),
      flares: buildFlareSchedule(`${seed}-flare`, look),
      noise: createLayer(n, n),
      wisps: createLayer(n, n),
      layer: createLayer(mask.size, mask.size),
      image: new ImageData(n, n),
      wispImage: new ImageData(n, n),
    };
    // The look and mask are fixed per variant; rebuilding per frame is exactly
    // what this memo exists to prevent.
  }, [seed, n, mask.size, look]);

  const frameInLoop = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const t = frameInLoop / LOOP_FRAMES;

  const { low, high, lowValues, highValues, field, ramp, flares } = resources;
  sampleSpectralBand(low, t, lowValues);
  sampleSpectralBand(high, t, highValues);
  combineBands(
    lowValues,
    highValues,
    look.lowWeight,
    look.highWeight,
    look.contrast,
    field,
  );

  // Active flares, resolved once per frame rather than per pixel.
  const active: { cx: number; cy: number; inverseRadius: number; amount: number }[] = [];
  for (const flare of flares) {
    const amount =
      flareEnvelope(loopDelta(frameInLoop, flare.start), flare.duration, look.flareOnset) *
      flare.strength;
    if (amount > 0.001) {
      active.push({
        cx: flare.x * n,
        cy: flare.y * n,
        inverseRadius: 1 / (flare.radius * n),
        amount,
      });
    }
  }

  const { lowValues: lowGate } = resources;
  const { data: fillData } = resources.image;
  const { data: wispData } = resources.wispImage;
  const { coverage, edge, wisp } = mask;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      let v = field[i];

      // The shimmer runs hotter within a rim of the shape's edge, which is
      // what sells the energy as bleeding off the outline.
      v += edge[i] * look.edgeBoost * (0.35 + 0.65 * v);

      for (let f = 0; f < active.length; f++) {
        const flare = active[f];
        const dx = (x - flare.cx) * flare.inverseRadius;
        const dy = (y - flare.cy) * flare.inverseRadius;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const falloff = 1 - d2;
          v += flare.amount * falloff * falloff;
        }
      }

      const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
      const step = (clamped * (RAMP_STEPS - 1)) | 0;
      const r = ramp[step * 3];
      const g = ramp[step * 3 + 1];
      const b = ramp[step * 3 + 2];

      const o = i * 4;
      fillData[o] = r;
      fillData[o + 1] = g;
      fillData[o + 2] = b;
      fillData[o + 3] = 255;

      // Escaping wisps: the same field, sampled in the band just outside the
      // outline, weighted so only the hotter parts break free.
      // Cubed and thresholded so only the hottest parts of the field break
      // free, then gated on the slow band so the escaping energy clusters in
      // a few stretches of the outline instead of ringing all of it evenly.
      const hot = clamped > 0.5 ? (clamped - 0.5) * 2 : 0;
      const gate = lowGate[i] * 1.6 + 0.5;
      const gated = gate < 0 ? 0 : gate > 1 ? 1 : gate;
      const escape = wisp[i] * hot * hot * hot * gated * look.wispGain;
      wispData[o] = r;
      wispData[o + 1] = g;
      wispData[o + 2] = b;
      wispData[o + 3] = escape * 255 * (1 - coverage[i]);
    }
  }

  const { noise, wisps, layer } = resources;
  noise.ctx.putImageData(resources.image, 0, 0);
  wisps.ctx.putImageData(resources.wispImage, 0, 0);

  const size = mask.size;
  const half = size / 2;

  // Core: the shimmer, clipped to the mask.
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  layer.ctx.globalCompositeOperation = "source-over";
  layer.ctx.globalAlpha = 1;
  layer.ctx.filter = "none";
  layer.ctx.clearRect(0, 0, size, size);
  lowResUpscale(layer.ctx, noise.canvas, 0, 0, size, size);
  layer.ctx.globalCompositeOperation = "destination-in";
  layer.ctx.drawImage(mask.clip, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer.canvas, centerX - half, centerY - half);

  // Wisps: blurred and added, so they read as energy bleeding off the shape
  // rather than as more shape.
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${look.wispBlur}px)`;
  lowResUpscale(ctx, wisps.canvas, centerX - half, centerY - half, size, size);
  ctx.filter = "none";
  ctx.restore();

  return null;
};
