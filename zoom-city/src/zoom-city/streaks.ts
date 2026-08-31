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
  /** Width at the outer end when the streak is at the frame edge. */
  width: number;
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
      widthMul = 0.55;
      brightMul = 0.75;
    } else if (classRoll > 1 - variant.streaks.heroFraction) {
      kind = "hero";
      reach = 1.3 + random(`reach-h-${i}`) * 0.25;
      lengthFraction = 0.68 + random(`len-h-${i}`) * 0.3;
      widthMul = 1.5;
      brightMul = 1.65;
    } else {
      kind = "normal";
      reach = 1 + random(`reach-n-${i}`) * 0.28;
      lengthFraction = 0.3 + random(`len-n-${i}`) * 0.32;
      widthMul = 0.8 + random(`wid-n-${i}`) * 0.7;
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
      cycles: 1 + Math.floor(random(`cycles-${i}`) * 3),
      phase: random(`phase-${i}`),
      startRadius: 10 + random(`start-${i}`) * 110,
      reach,
      lengthFraction,
      width:
        (6 + random(`width-${i}`) * 26) * widthMul * variant.streaks.widthScale,
      colour,
      hotColour: mix(colour, white, 0.35 + Math.pow(b, 3) * 0.6),
      brightness,
      kind,
    });
  }

  cache.set(key, out);
  return out;
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
  const angle = map.angleAt(angleSeed) + scene.rotation;

  const endRadius = s.reach * scene.maxRadius;
  const outerRadius = s.startRadius * Math.pow(endRadius / s.startRadius, u);
  const innerRadius = outerRadius * (1 - s.lengthFraction);

  // Width grows with radius, i.e. with speed. Sub-linear so the frame edge
  // doesn't turn into slabs.
  const growth = Math.pow(outerRadius / scene.maxRadius, 0.55);
  const outerWidth = Math.max(1.2, s.width * growth);

  const alpha =
    s.brightness *
    smoothstep(0, 0.12, u) *
    (1 - smoothstep(0.78, 1, u));

  return {
    angle,
    angleSeed,
    innerRadius,
    outerRadius,
    innerWidth: outerWidth * 0.16,
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

  const quad = (wIn: number, wOut: number, colour: RGB, a: number) => {
    const grad = ctx.createLinearGradient(ix, iy, ox, oy);
    grad.addColorStop(0, rgba(colour, 0));
    grad.addColorStop(0.22, rgba(colour, a));
    grad.addColorStop(0.55, rgba(colour, a * 0.62));
    grad.addColorStop(0.84, rgba(colour, a * 0.2));
    grad.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ix + nx * wIn, iy + ny * wIn);
    ctx.lineTo(ox + nx * wOut, oy + ny * wOut);
    ctx.lineTo(ox - nx * wOut, oy - ny * wOut);
    ctx.lineTo(ix - nx * wIn, iy - ny * wIn);
    ctx.closePath();
    ctx.fill();
  };

  quad(st.innerWidth, st.outerWidth, s.colour, Math.min(1, alpha * 0.85));
  quad(
    st.innerWidth * 0.4,
    Math.max(0.9, st.outerWidth * 0.34),
    s.hotColour,
    Math.min(1, alpha * 0.95),
  );
};
