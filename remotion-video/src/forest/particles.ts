import { DURATION_IN_FRAMES as LOOP_FRAMES, loopSin, loopT } from "./constants";
import { withAlpha, mixHex } from "./color";
import { clamp, lerp, rndInt, rndPick, rndPow, rndRange, wrap } from "./rand";
import type { Palette, ParticleSettings } from "./variants";

// ─────────────────────────────────────────────────────────────────────────────
// ONE particle system. Embers and snow are the same code with a different sign
// on the vertical component and a different behaviour profile; there is no
// second implementation anywhere in this project.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flicker is two sines at incommensurate periods multiplied together, which
 * gives an irregular spark rather than a clean pulse. Both period sets divide
 * 240 exactly, so however they beat against each other the product is back to
 * its frame-0 value at frame 240.
 */
const SLOW_FLICKER_PERIODS = [48, 40, 30, 24] as const;
const FAST_FLICKER_PERIODS = [16, 15, 12, 10] as const;

export type ParticleSpec = {
  size: number;
  /** 0 = hottest/brightest, 1 = the bulk, 2 = the dimmest and most distant. */
  tone: 0 | 1 | 2;
  /** Whole traversals of the travel span completed in one 240-frame loop. */
  cycles: number;
  /** Starting position along the span, 0..1. */
  offset: number;
  /**
   * One horizontal position per traversal. A particle that wraps re-enters at
   * a NEW seeded x — but the list is indexed by lap modulo `cycles`, so after
   * exactly `cycles` laps (i.e. at frame 240) it is back on the first one and
   * the loop still closes.
   */
  lanes: number[];
  wander: number;
  wanderCycles: number;
  wanderPhase: number;
  wanderCycles2: number;
  wanderPhase2: number;
  alpha: number;
  flickerCyclesA: number;
  flickerCyclesB: number;
  flickerPhaseA: number;
  flickerPhaseB: number;
  driftCycles: number;
  driftPhase: number;
  rotateCycles: number;
  rotatePhase: number;
};

export type ParticleFieldSpec = {
  particles: ParticleSpec[];
  /** Top of the travel span and its height, in frame pixels. */
  spanTop: number;
  spanHeight: number;
};

export type BuildParticlesOptions = {
  seed: string;
  count: number;
  width: number;
  /** Travel span in frame pixels; particles wrap across it. */
  spanTop: number;
  spanHeight: number;
  settings: ParticleSettings;
  /** Multiplier on the configured size range (the ground bed runs smaller). */
  sizeScale?: number;
};

export const buildParticles = ({
  seed,
  count,
  width,
  spanTop,
  spanHeight,
  settings,
  sizeScale = 1,
}: BuildParticlesOptions): ParticleFieldSpec => {
  const particles = new Array(count).fill(0).map((_, i) => {
    const s = `${seed}-${i}`;
    // Size drives depth: bigger particles read as nearer, so they are brighter
    // and (for embers) faster.
    const sizeT = Math.pow(rndRange(`${s}-size`, 0, 1), 1.6);
    const size = lerp(settings.sizeMin, settings.sizeMax, sizeT) * sizeScale;

    const toneRoll = rndRange(`${s}-tone`, 0, 1) * (0.55 + 0.45 * (1 - sizeT));
    const tone: 0 | 1 | 2 = toneRoll < 0.1 ? 0 : toneRoll < 0.55 ? 1 : 2;

    const fast = rndRange(`${s}-fast`, 0, 1) < settings.fastFraction;
    const paced = settings.speedFollowsSize
      ? Math.round(lerp(settings.cyclesMin, settings.cyclesMax, sizeT))
      : rndInt(`${s}-cyc`, settings.cyclesMin, settings.cyclesMax);
    const cycles = Math.max(1, paced + (fast ? settings.fastBoost : 0));

    const lanes = new Array(cycles)
      .fill(0)
      .map((__, lap) => rndRange(`${s}-lane-${lap}`, -0.08, 1.08) * width);

    return {
      size,
      tone,
      cycles,
      offset: rndRange(`${s}-offset`, 0, 1),
      lanes,
      wander:
        lerp(settings.wanderMin, settings.wanderMax, rndRange(`${s}-wan`, 0, 1)) *
        width,
      wanderCycles: rndInt(`${s}-wc`, 1, 3),
      wanderPhase: rndRange(`${s}-wp`, 0, Math.PI * 2),
      wanderCycles2: rndInt(`${s}-wc2`, 4, 6),
      wanderPhase2: rndRange(`${s}-wp2`, 0, Math.PI * 2),
      alpha: rndPow(`${s}-alpha`, 0.45, 1, 0.7) * (0.6 + 0.4 * sizeT),
      flickerCyclesA: LOOP_FRAMES / rndPick(`${s}-fa`, SLOW_FLICKER_PERIODS),
      flickerCyclesB: LOOP_FRAMES / rndPick(`${s}-fb`, FAST_FLICKER_PERIODS),
      flickerPhaseA: rndRange(`${s}-fpa`, 0, Math.PI * 2),
      flickerPhaseB: rndRange(`${s}-fpb`, 0, Math.PI * 2),
      driftCycles: rndInt(`${s}-dc`, 1, 2),
      driftPhase: rndRange(`${s}-dp`, 0, Math.PI * 2),
      rotateCycles: rndInt(`${s}-rc`, 1, 3) * (rndRange(`${s}-rd`, 0, 1) < 0.5 ? -1 : 1),
      rotatePhase: rndRange(`${s}-rp`, 0, Math.PI * 2),
    };
  });

  return { particles, spanTop, spanHeight };
};

export type ParticleState = {
  x: number;
  y: number;
  size: number;
  tone: 0 | 1 | 2;
  alpha: number;
  rotation: number;
};

/**
 * Where one particle is, and how bright, at `frame`.
 *
 * `settings.direction` is the ONE signed value that separates rising embers
 * from falling snow: +1 walks the span upward, -1 walks it downward. Nothing
 * below tests the variant name.
 */
export const particleAt = (
  spec: ParticleSpec,
  field: ParticleFieldSpec,
  settings: ParticleSettings,
  frame: number,
): ParticleState => {
  const t = loopT(frame);
  const travelled = spec.offset + spec.cycles * t;
  const p = wrap(travelled, 1);
  const lap = Math.floor(travelled);

  // direction +1 => p climbing means moving up the frame (y decreasing).
  const along = settings.direction === 1 ? 1 - p : p;
  const y = field.spanTop + along * field.spanHeight;

  const lane = spec.lanes[wrap(lap, spec.cycles)];
  const x =
    lane +
    spec.wander *
      (loopSin(t, spec.wanderCycles, spec.wanderPhase) +
        0.45 * loopSin(t, spec.wanderCycles2, spec.wanderPhase2));

  // Fade to nothing at both ends of the span. The lane switch happens exactly
  // at p = 0, where alpha is already zero, so a wrapping particle never pops.
  const edgeFade = clamp(Math.min(p, 1 - p) / 0.09, 0, 1);

  let brightness = 1;
  if (settings.flicker) {
    const a = 0.5 + 0.5 * loopSin(t, spec.flickerCyclesA, spec.flickerPhaseA);
    const b = 0.5 + 0.5 * loopSin(t, spec.flickerCyclesB, spec.flickerPhaseB);
    brightness = 0.32 + 0.68 * a * b;
  } else if (settings.opacityDrift) {
    const d = 0.5 + 0.5 * loopSin(t, spec.driftCycles, spec.driftPhase);
    brightness = 0.42 + 0.58 * d;
  }

  return {
    x,
    y,
    size: spec.size,
    tone: spec.tone,
    alpha: spec.alpha * brightness * edgeFade,
    rotation: settings.rotate
      ? spec.rotatePhase + 2 * Math.PI * wrap(spec.rotateCycles * t, 1)
      : 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sprites. Three tones are pre-rendered once; every particle is a blit, never
// a per-instance createRadialGradient().
// ─────────────────────────────────────────────────────────────────────────────

const SPRITE_PX = 128;

/**
 * `coreHardness` 1 gives a small hot core with a halo around it — an ember.
 * 0 gives an even soft falloff all the way in — a snowflake. `aspect` squashes
 * the sprite vertically so that per-particle rotation is actually visible.
 */
export const buildParticleSprites = (
  palette: Palette,
  coreHardness: number,
  aspect = 1,
): HTMLCanvasElement[] => {
  const tones = [palette.particleHot, palette.particleMid, palette.particleCool];
  return tones.map((tone) => {
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_PX;
    canvas.height = SPRITE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const r = SPRITE_PX / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    const core = mixHex(tone, palette.particleHot, coreHardness * 0.55);
    grad.addColorStop(0, core);
    grad.addColorStop(
      lerp(0.42, 0.14, coreHardness),
      withAlpha(tone, lerp(0.5, 0.92, coreHardness)),
    );
    grad.addColorStop(lerp(0.72, 0.46, coreHardness), withAlpha(tone, 0.3));
    grad.addColorStop(1, withAlpha(tone, 0));
    ctx.translate(r, r);
    ctx.scale(1, aspect);
    ctx.translate(-r, -r);
    ctx.fillStyle = grad;
    ctx.fillRect(-SPRITE_PX, -SPRITE_PX, SPRITE_PX * 3, SPRITE_PX * 3);
    return canvas;
  });
};

export const drawParticle = (
  ctx: CanvasRenderingContext2D,
  sprites: HTMLCanvasElement[],
  state: ParticleState,
) => {
  if (state.alpha <= 0.004) return;
  const sprite = sprites[state.tone];
  const d = state.size;
  ctx.globalAlpha = state.alpha;
  if (state.rotation === 0) {
    ctx.drawImage(sprite, state.x - d / 2, state.y - d / 2, d, d);
    return;
  }
  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.rotate(state.rotation);
  ctx.drawImage(sprite, -d / 2, -d / 2, d, d);
  ctx.restore();
};
