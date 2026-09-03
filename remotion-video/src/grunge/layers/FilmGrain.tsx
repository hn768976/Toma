import React, { useLayoutEffect, useMemo } from "react";
import { createCanvas } from "../lib/canvas";
import { hexToRgb } from "../lib/color";
import { createOctaveNoiseField } from "../lib/noiseField";
import { flickerEnvelope, scheduleFlickerEvents } from "../lib/flickerSchedule";
import type { ActiveLeak } from "../lib/leak";
import { leakMaskAt } from "../lib/leak";
import { lcgSeedFrom, rndRange } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings, MotionSettings } from "../variants";

/**
 * Film grain, regenerated from scratch every frame.
 *
 * Static grain reads as texture printed on a still image; it has to change
 * every frame to read as film. The seed comes from the frame number, so it is
 * different on every frame and yet perfectly reproducible across a distributed
 * render.
 *
 * Performance notes, because this is the one layer that unavoidably touches
 * every pixel:
 *
 *  - Values come from an integer LCG, not random(). Eight million string-seeded
 *    hashes per frame is not affordable; one seeded call per frame is.
 *  - Pixels are written through a Uint32Array view, one store per pixel rather
 *    than four.
 *  - Density modulation is quantised into 32 levels and each level gets its
 *    own precomputed 256-entry table of packed pixels, so the inner loop is a
 *    shift, a table lookup and a store, with no float maths at all.
 *  - `pitch` > 1 generates the noise coarser than the frame and lets the
 *    upscale clump it, which is what gives grain a visible size instead of
 *    being single pixels.
 */

/** Peak grain value as a fraction of white, at intensity 1. */
const GRAIN_AMPLITUDE = 0.55;
/**
 * Shapes the distribution: value = amplitude * u^gamma, so the mean lift is
 * amplitude / (gamma + 1) while the peaks stay at amplitude.
 *
 * This exponent is the single most important number in the project. Additive
 * grain always raises the mean, and in screen blend a raised mean is a grey
 * haze over the editor's footage. A high gamma buys bright, clearly visible
 * specks (peaks around 140/255) for a mean lift of only ~9/255 — sparse
 * sparkle rather than a uniform lift, which is also what real film grain
 * looks like once the dark half of it is thrown away by the blend mode.
 */
const GRAIN_GAMMA = 14;
/** Density block size, in grain pixels. Power of two so we can shift. */
const BLOCK_SHIFT = 4;
const DENSITY_LEVELS = 32;
const DENSITY_MAX = 2.4;
const NOISE_GRID_W = 20;
const NOISE_GRID_H = 12;

type FilmGrainProps = LayerBaseProps & {
  settings: LayerSettings["grain"];
  motion: MotionSettings;
  loopFrames: number;
  leaks: ActiveLeak[];
};

export const FilmGrain: React.FC<FilmGrainProps> = (props) => {
  const { frame, width, height, palette, intensity, settings, motion, loopFrames, leaks, mode } =
    props;

  const grainW = Math.ceil(width / settings.pitch);
  const grainH = Math.ceil(height / settings.pitch);
  const densityW = Math.ceil(grainW / (1 << BLOCK_SHIFT));
  const densityH = Math.ceil(grainH / (1 << BLOCK_SHIFT));

  const surface = useMemo(() => {
    const canvas = createCanvas(grainW, grainH);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const bytes = new Uint8ClampedArray(grainW * grainH * 4);
    return {
      canvas,
      ctx,
      image: new ImageData(bytes, grainW, grainH),
      words: new Uint32Array(bytes.buffer),
      density: new Int32Array(densityW * densityH),
    };
  }, [grainW, grainH, densityW, densityH]);

  const noise = useMemo(
    () => createOctaveNoiseField("grain|density", NOISE_GRID_W, NOISE_GRID_H),
    [],
  );

  /** Larger transient clumps that appear and vanish over 20-40 frames. */
  const clusterEvents = useMemo(
    () =>
      settings.clusterConcurrent > 0
        ? scheduleFlickerEvents({
            seed: "grain|cluster",
            duration: loopFrames,
            minConcurrent: 0,
            maxConcurrent: settings.clusterConcurrent,
            minLife: 20,
            maxLife: 40,
            minGap: 25,
            maxGap: 160,
          })
        : [],
    [loopFrames, settings.clusterConcurrent],
  );

  const clusters = useMemo(
    () =>
      clusterEvents.map((event) => ({
        event,
        x: rndRange(event.id + "|cx", 0.05, 0.95),
        y: rndRange(event.id + "|cy", 0.05, 0.95),
        radius: rndRange(event.id + "|cr", 0.08, 0.19),
        gain: rndRange(event.id + "|cg", 0.35, 0.75),
      })),
    [clusterEvents],
  );

  /** Packed-pixel tables, one per density level. Rebuilt only when the tint,
   *  intensity or mode changes — not per frame. */
  const tables = useMemo(() => {
    const tint = hexToRgb(palette.grainTint);
    const table = new Uint32Array(DENSITY_LEVELS * 256);
    const amplitude = GRAIN_AMPLITUDE * intensity;
    for (let level = 0; level < DENSITY_LEVELS; level++) {
      const density = ((level + 0.5) / DENSITY_LEVELS) * DENSITY_MAX;
      const scale = amplitude * density;
      for (let b = 0; b < 256; b++) {
        const v = Math.min(1, Math.pow(b / 255, GRAIN_GAMMA) * scale);
        if (mode === "alpha") {
          // Colour is the tint; the grain value becomes opacity.
          const a = Math.round(v * 255);
          table[level * 256 + b] = ((a << 24) | (tint.b << 16) | (tint.g << 8) | tint.r) >>> 0;
        } else {
          const r = Math.round(v * tint.r);
          const g = Math.round(v * tint.g);
          const bl = Math.round(v * tint.b);
          table[level * 256 + b] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
        }
      }
    }
    return table;
  }, [palette.grainTint, intensity, mode]);

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx || !surface) return;

    // --- density map -------------------------------------------------------
    // Cheap: a few tens of thousands of samples, versus millions of pixels.
    const { density } = surface;
    const drift = (frame / loopFrames) * NOISE_GRID_W * motion.grainDensityCycles;
    const variation = settings.densityVariation;
    for (let by = 0; by < densityH; by++) {
      for (let bx = 0; bx < densityW; bx++) {
        let d = 1;
        if (variation > 0) {
          const n = noise.sample(
            (bx / densityW) * NOISE_GRID_W + drift,
            (by / densityH) * NOISE_GRID_H,
          );
          d = 1 + (n * 2 - 1) * variation;
        }
        const nx = (bx + 0.5) / densityW;
        const ny = (by + 0.5) / densityH;
        for (let i = 0; i < clusters.length; i++) {
          const cluster = clusters[i];
          const envelope = flickerEnvelope(frame, cluster.event, 10);
          if (envelope <= 0) continue;
          const dx = nx - cluster.x;
          const dy = (ny - cluster.y) * (height / width);
          const dist = Math.sqrt(dx * dx + dy * dy) / cluster.radius;
          if (dist < 1) d += cluster.gain * envelope * (1 - dist) * (1 - dist);
        }
        // Grain gets stronger where a leak has exposed the film.
        for (let i = 0; i < leaks.length; i++) {
          d += 0.4 * leakMaskAt(leaks[i], nx * width, ny * height, width, height);
        }
        const level = Math.max(
          0,
          Math.min(DENSITY_LEVELS - 1, Math.round((d / DENSITY_MAX) * DENSITY_LEVELS - 0.5)),
        );
        density[by * densityW + bx] = level << 8;
      }
    }

    // --- pixels ------------------------------------------------------------
    const words = surface.words;
    let state = lcgSeedFrom("grain|" + frame) >>> 0;
    const blockSize = 1 << BLOCK_SHIFT;
    for (let y = 0; y < grainH; y++) {
      const rowBase = y * grainW;
      const densityRow = (y >> BLOCK_SHIFT) * densityW;
      for (let bx = 0; bx < densityW; bx++) {
        const tableBase = density[densityRow + bx];
        const x0 = bx << BLOCK_SHIFT;
        const x1 = Math.min(grainW, x0 + blockSize);
        for (let x = x0; x < x1; x++) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          words[rowBase + x] = tables[tableBase + ((state >>> 24) & 255)];
        }
      }
    }

    surface.ctx.putImageData(surface.image, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(surface.canvas, 0, 0, width, height);
    ctx.restore();
  });

  return null;
};
