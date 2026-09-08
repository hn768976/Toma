import React from "react";
import {buildRamp, mix, scale} from "../lib/color";
import {KIND_ACCENT, KIND_COAST, KIND_LAND, KIND_OCEAN} from "../lib/dots";
import {BRACKETS, type Stage} from "../lib/stage";
import {usePass, type PassProps} from "./pass";

/** Brightness steps each dot class is quantised to, so the hot loop never builds a colour string. */
const STEPS = 24;

/**
 * Ocean dots per blur bucket. They need to be readable where the frame is
 * sharp — their regular rows are what carry the undulation — but a defocused
 * field of them averages out into a flat wash, so they fade back as the blur
 * grows.
 */
const OCEAN_BY_BRACKET = [0.62, 0.4, 0.2, 0.11];

/** Land dots are damped a little in the soft buckets for the same reason. */
const LAND_BY_BRACKET = [1, 0.95, 0.72, 0.52];

const buildRamps = (stage: Stage): string[][] => {
  const {pal} = stage;
  const ramps: string[][] = [];
  // Ocean: present everywhere, but barely above the background. Their
  // regularity is what carries the undulation.
  ramps[KIND_OCEAN] = buildRamp(
    scale(pal.ocean, 0.34),
    mix(pal.ocean, pal.land, 0.62),
    STEPS,
  );
  ramps[KIND_LAND] = buildRamp(
    scale(pal.land, 0.44),
    mix(pal.land, pal.landBright, 0.9),
    STEPS,
  );
  // Coastal dots are what make the continents legible.
  ramps[KIND_COAST] = buildRamp(
    mix(pal.land, pal.landBright, 0.4),
    mix(pal.landBright, pal.lightCore, 0.65),
    STEPS,
  );
  ramps[KIND_ACCENT] = buildRamp(
    scale(pal.accent, 0.5),
    mix(pal.accent, pal.lightCore, 0.55),
    STEPS,
  );
  return ramps;
};

/**
 * Draws every dot as a small square into one of the four blur buffers. Dots are
 * bucketed by (buffer, class, brightness step) and drawn bucket by bucket, so
 * the canvas fill style is set a few hundred times rather than a few hundred
 * thousand.
 */
export const DotMapSurface: React.FC<PassProps> = (props) => {
  usePass(props, (_ctx, stage) => {
    const {dots, buffers, field} = stage;
    const ramps = buildRamps(stage);

    for (const b of buffers) {
      b.ctx.setTransform(1, 0, 0, 1, 0, 0);
      b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
      b.ctx.setTransform(b.scale, 0, 0, b.scale, -field.x0 * b.scale, -field.y0 * b.scale);
      b.ctx.globalCompositeOperation = "source-over";
      b.ctx.globalAlpha = 1;
    }

    const nBuckets = BRACKETS.length * 4 * STEPS;
    const key = new Int32Array(dots.n);
    const counts = new Int32Array(nBuckets + 1);

    for (let i = 0; i < dots.n; i++) {
      const kind = dots.kind[i];
      const br = dots.bracket[i];
      // Ocean dots sit far dimmer than land. Blurred dots are boosted so they
      // bloom into soft points — but only the already-bright ones, otherwise a
      // defocused dot field just averages out into a flat wash.
      const base =
        dots.lit[i] *
        (kind === KIND_OCEAN ? OCEAN_BY_BRACKET[br] : LAND_BY_BRACKET[br]);
      const hi = Math.min(1, Math.max(0, (base - 1.05) / 1.5));
      const lit = base * (1 + (BRACKETS[br].boost - 1) * hi * hi);
      let t = (lit - 0.22) / 2.5;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const step = Math.min(STEPS - 1, Math.round(Math.pow(t, 0.72) * (STEPS - 1)));
      const bucket = (br * 4 + kind) * STEPS + step;
      key[i] = bucket;
      counts[bucket + 1]++;
    }
    for (let i = 0; i < nBuckets; i++) {
      counts[i + 1] += counts[i];
    }
    const order = new Int32Array(dots.n);
    const cursor = counts.slice(0, nBuckets);
    for (let i = 0; i < dots.n; i++) {
      order[cursor[key[i]]++] = i;
    }

    for (let bucket = 0; bucket < nBuckets; bucket++) {
      const from = counts[bucket];
      const to = counts[bucket + 1];
      if (from === to) {
        continue;
      }
      const step = bucket % STEPS;
      const rest = (bucket - step) / STEPS;
      const kind = rest % 4;
      const br = (rest - kind) / 4;
      const ctx = buffers[br].ctx;
      ctx.fillStyle = ramps[kind][step];
      // Softer brackets get slightly fatter dots so the bloom has something to
      // spread from.
      const grow = 1 + br * 0.09;
      for (let j = from; j < to; j++) {
        const i = order[j];
        const s = dots.size[i] * grow;
        ctx.fillRect(dots.sx[i] - s * 0.5, dots.sy[i] - s * 0.5, s, s);
      }
    }
  });
  return null;
};
