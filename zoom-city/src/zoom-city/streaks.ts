/**
 * The streak field.
 *
 * A streak is not an object that happens to move — it is one sample of radial
 * motion blur: a long tapered wedge running outward from the vanishing point,
 * nearly zero width at its inner end and widest at its outer end, with its
 * opacity falling away at the tip so it dissolves instead of stopping.
 *
 * Motion: speed is proportional to radius, which is what perspective does, so
 * the radius over a cycle is exponential — r(u) = r0 * (rEnd / r0)^u. Each
 * streak completes a whole number of cycles across the 300-frame loop and is
 * re-seeded to a new angle near the vanishing point at every recycle, which is
 * invisible because the alpha envelope is zero at both ends of the cycle.
 */

import { random } from "remotion";
import { angularMap } from "./angular";
import { hexToRgb, mix, rgba, type RGB } from "./colour";
import { LOOP_FRAMES, smoothstep, type Scene } from "./geometry";
import type { Variant } from "./variants";

/** How far a streak travels, as a share of the distance to the far corner. */
type Kind = "short" | "normal" | "hero";

export type Streak = {
  index: number;
  /** Whole traversals across the loop — this is what closes the loop. */
  cycles: number;
  /** Where in its cycle the streak sits at frame 0. */
  phase: number;
  /** Radius the streak starts each cycle at. */
  startRadius: number;
  /** Radius the streak recycles at, in units of the far-corner distance. */
  reach: number;
  /** The streak's own extent, as a share of its current radius. */
  lengthFraction: number;
  /** Half-width of the soft halo at the outer end, at the frame edge. */
  width: number;
  /** Streaks outside a bundle keep the field's gaps from going empty. */
  free: boolean;
  colour: RGB;
  /** The hot inner colour — the brightest streaks burn out towards white. */
  hotColour: RGB;
  brightness: number;
  kind: Kind;
};

const cacheKey = (variant: Variant) => variant.name;
const cache = new Map<string, Streak[]>();

/** Uniform value in [0,1) used to pick this streak's angle on a given cycle. */
export const angleSeedOf = (s: Streak, cycleIndex: number) =>
  random(`angle-${s.index}-${((cycleIndex % s.cycles) + s.cycles) % s.cycles}`);

export const buildStreaks = (variant: Variant): Streak[] => {
  const key = cacheKey(variant);
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  const p = variant.palette;
  const w = variant.colourWeights;
  const weightTotal = w.dominant + w.secondary + w.accent + w.white;
  const slots: { colour: RGB; weight: number }[] = [
    { colour: hexToRgb(p.streakDominant), weight: w.dominant / weightTotal },
    { colour: hexToRgb(p.streakSecondary), weight: w.secondary / weightTotal },
    { colour: hexToRgb(p.streakAccent), weight: w.accent / weightTotal },
    { colour: hexToRgb(p.streakWhite), weight: w.white / weightTotal },
  ];
  const white = hexToRgb(p.streakWhite);

  const out: Streak[] = [];
  for (let i = 0; i < variant.streaks.count; i++) {
    // --- length class -------------------------------------------------
    // Most streaks are long and run past the frame edge. A minority stay
    // close to the vanishing point, reading as distant lights not yet
    // smeared by speed. A few are enormous and bright and carry the eye.
    const classRoll = random(`class-${i}`);
    let kind: Kind;
    let reach: number;
    let lengthFraction: number;
    let widthMul: number;
    let brightMul: number;
    if (classRoll < variant.streaks.shortFraction) {
      kind = "short";
      reach = 0.1 + random(`reach-s-${i}`) * 0.2;
      lengthFraction = 0.16 + random(`len-s-${i}`) * 0.2;
      widthMul = 0.6;
      brightMul = 0.8;
    } else if (classRoll > 1 - variant.streaks.heroFraction) {
      kind = "hero";
      reach = 2 + random(`reach-h-${i}`) * 0.45;
      lengthFraction = 0.86 + random(`len-h-${i}`) * 0.14;
      widthMul = 1.45;
      brightMul = 1.7;
    } else {
      kind = "normal";
      reach = 1.5 + random(`reach-n-${i}`) * 0.42;
      lengthFraction = 0.55 + random(`len-n-${i}`) * 0.4;
      widthMul = 0.75 + random(`wid-n-${i}`) * 0.8;
      brightMul = 1;
    }

    // --- colour -------------------------------------------------------
    let roll = random(`colour-${i}`);
    let colour = slots[0].colour;
    for (const slot of slots) {
      if (roll < slot.weight) {
        colour = slot.colour;
        break;
      }
      roll -= slot.weight;
    }

    // --- brightness ---------------------------------------------------
    // Skewed hard towards the dim end: a field of uniformly bright streaks
    // reads as a gradient, the spread is what makes it read as a city.
    const b = random(`bright-${i}`);
    const brightness =
      (0.16 + Math.pow(b, 2.2) * 0.95) * brightMul * variant.streaks.brightnessScale;

    out.push({
      index: i,
      cycles:
        variant.motion.cyclesMin +
        Math.floor(
          random(`cycles-${i}`) *
            (variant.motion.cyclesMax - variant.motion.cyclesMin + 1),
        ),
      phase: random(`phase-${i}`),
      startRadius: 10 + random(`start-${i}`) * 110,
      reach,
      lengthFraction,
      // Filaments, not wedges: at 4K the halo runs about 8-26px across and
      // the hot core inside it about a third of that, which is what the
      // reference footage looks like when it is scaled up to this frame.
      width:
        (4 + random(`width-${i}`) * 9) * widthMul * variant.streaks.widthScale,
      free: random(`free-${i}`) < variant.streaks.freeShare,
      colour,
      hotColour: mix(colour, white, 0.35 + Math.pow(b, 3) * 0.6),
      brightness,
      kind,
    });
  }

  cache.set(key, out);
  return out;
};

/**
 * Bundles brighten and fade on their own seeded, loop-periodic schedules —
 * lit facades arriving and passing. Without this the field's large-scale
 * structure never changes, however fast the individual filaments travel.
 */
const pulseCache = new Map<string, Float64Array>();

const pulseTable = (variant: Variant) => {
  const hit = pulseCache.get(variant.name);
  if (hit) {
    return hit;
  }
  const n = variant.streaks.pulseGroups;
  const table = new Float64Array(n * 2);
  for (let b = 0; b < n; b++) {
    // Whole numbers of pulses per loop, so the schedule closes with it.
    table[b * 2] = 1 + Math.floor(random(`pulse-rate-${variant.name}-${b}`) * 4);
    table[b * 2 + 1] = random(`pulse-phase-${variant.name}-${b}`);
  }
  pulseCache.set(variant.name, table);
  return table;
};

export const bundlePulseAt = (
  variant: Variant,
  angleSeed: number,
  f: number,
) => {
  const depth = variant.streaks.bundlePulse;
  if (depth <= 0) {
    return 1;
  }
  const n = variant.streaks.pulseGroups;
  const b = Math.min(n - 1, Math.floor((angleSeed - Math.floor(angleSeed)) * n));
  const table = pulseTable(variant);
  const wave =
    0.5 +
    0.5 *
      Math.sin(
        (table[b * 2] * (f / LOOP_FRAMES) + table[b * 2 + 1]) * Math.PI * 2,
      );
  // Dim most of the time, flaring as the bundle comes past.
  return 1 + depth * (Math.pow(wave, 2.4) * 1.65 - 0.62);
};

export type StreakState = {
  angle: number;
  /** Uniform that produced the angle — burst membership is tested on this. */
  angleSeed: number;
  innerRadius: number;
  outerRadius: number;
  innerWidth: number;
  outerWidth: number;
  alpha: number;
};

/**
 * Where a streak is, and how it looks, on one frame. Pure in (streak, scene).
 */
export const streakStateAt = (
  s: Streak,
  scene: Scene,
  variant: Variant,
): StreakState => {
  const map = angularMap(variant);

  const t = s.phase + (scene.f * s.cycles) / LOOP_FRAMES;
  const cycleIndex = Math.floor(t);
  const u = t - cycleIndex;

  const angleSeed = angleSeedOf(s, cycleIndex);
  const angle = map.bundledAngleAt(angleSeed, s.free) + scene.rotation;

  const endRadius = s.reach * scene.maxRadius;
  const outerRadius = s.startRadius * Math.pow(endRadius / s.startRadius, u);
  const innerRadius = outerRadius * (1 - s.lengthFraction);

  // Width grows with radius, i.e. with speed, but only weakly: the lines in
  // real radial blur stay filaments rather than fanning into slabs.
  const growth = Math.pow(outerRadius / scene.maxRadius, 0.38);
  const outerWidth = Math.max(1.1, s.width * growth);

  // The streak holds its brightness until its leading end is out past the
  // frame corner, then dissolves over the last stretch of the cycle. Fading
  // it on the cycle alone would empty the frame edges, because the radius
  // grows exponentially and most of the travel happens at the very end.
  const alpha =
    s.brightness *
    smoothstep(0, 0.08, u) *
    (1 - smoothstep(0.86, 1, u));

  return {
    angle,
    angleSeed,
    innerRadius,
    outerRadius,
    innerWidth: outerWidth * 0.34,
    outerWidth,
    alpha,
  };
};

/**
 * Draw one streak as two overlapping tapered quads — a wide soft halo and a
 * narrow hot core. A single uniform-width line does not read as motion blur;
 * the width taper plus the alpha falloff at the tip is what sells it.
 */
export const drawStreak = (
  ctx: CanvasRenderingContext2D,
  s: Streak,
  st: StreakState,
  scene: Scene,
  gain: number,
) => {
  const alpha = st.alpha * gain;
  if (alpha < 0.004 || st.innerRadius > scene.maxRadius * 1.02) {
    return;
  }

  const ca = Math.cos(st.angle);
  const sa = Math.sin(st.angle);
  const ix = scene.vx + ca * st.innerRadius;
  const iy = scene.vy + sa * st.innerRadius;
  const ox = scene.vx + ca * st.outerRadius;
  const oy = scene.vy + sa * st.outerRadius;
  const nx = -sa;
  const ny = ca;

  // The colour shifts along the line — hotter and cooler near the vanishing
  // point, settling into the streak's own hue further out — which is what
  // gives a real zoom blur its chromatic banding.
  const quad = (
    wIn: number,
    wOut: number,
    inner: RGB,
    outer: RGB,
    a: number,
  ) => {
    const grad = ctx.createLinearGradient(ix, iy, ox, oy);
    grad.addColorStop(0, rgba(inner, 0));
    grad.addColorStop(0.16, rgba(inner, a));
    grad.addColorStop(0.42, rgba(outer, a * 0.74));
    grad.addColorStop(0.78, rgba(outer, a * 0.3));
    grad.addColorStop(1, rgba(outer, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ix + nx * wIn, iy + ny * wIn);
    ctx.lineTo(ox + nx * wOut, oy + ny * wOut);
    ctx.lineTo(ox - nx * wOut, oy - ny * wOut);
    ctx.lineTo(ix - nx * wIn, iy - ny * wIn);
    ctx.closePath();
    ctx.fill();
  };

  // A soft halo, then the hot filament inside it.
  quad(
    st.innerWidth,
    st.outerWidth,
    s.hotColour,
    s.colour,
    Math.min(1, alpha * 0.6),
  );
  quad(
    Math.max(0.6, st.innerWidth * 0.36),
    Math.max(0.8, st.outerWidth * 0.32),
    s.hotColour,
    s.colour,
    Math.min(1, alpha * 1.1),
  );
};
