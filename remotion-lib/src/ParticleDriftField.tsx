import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { LayerCanvas } from "./useLayerCanvas";
import { applyBloom } from "./bloom";
import { cameraDrift, loopSin, loopT } from "./loop";
import { mixHex, withAlpha } from "./color";
import { clamp, lerp, rndInt, rndPick, rndPow, rndRange, wrap } from "./random";

/**
 * A field of small drifting particles, travelling steadily in one vertical
 * direction with a horizontal wander, wrapping when they leave the frame.
 *
 * ONE system covers behaviours that look nothing alike. `direction: 1` with
 * `flicker` and a hard core gives rising embers or sparks; `direction: -1`
 * with `opacityDrift`, `rotate`, a wide wander and a soft core gives falling
 * snow, ash or blossom. Writing those as two systems is a mistake — the sign
 * and the behaviour flags are the entire difference.
 *
 * Everything closes exactly at the end of the loop:
 *  - each particle completes a whole number of traversals;
 *  - the wander and flicker sines run at whole cycle counts, reduced through
 *    loopSin so the first and last frame are bit-identical;
 *  - a particle that wraps re-enters at a NEW seeded x, but the lane list is
 *    indexed by lap modulo its own cycle count, so after a full loop it is
 *    back on the first lane.
 */

/**
 * Flicker is two sines at incommensurate periods MULTIPLIED, which gives an
 * irregular spark rather than a clean pulse. Both period sets divide the loop
 * exactly, so however they beat against each other the product returns to its
 * starting value.
 */
const SLOW_FLICKER_PERIODS = [48, 40, 30, 24] as const;
const FAST_FLICKER_PERIODS = [16, 15, 12, 10] as const;

export type ParticleBehaviour = {
  /** +1 travels up the frame, -1 travels down it. The one signed value. */
  direction: 1 | -1;
  count: number;
  /** Sprite diameter range, in composition pixels. */
  sizeMin: number;
  sizeMax: number;
  /** 1 = a small hot core with a halo; 0 = an even soft falloff. */
  coreHardness: number;
  /** Vertical squash of the sprite. Rotation on a round sprite is invisible. */
  spriteAspect: number;
  flicker: boolean;
  /** Instead of flicker: a slow fade in and out, as through passing haze. */
  opacityDrift: boolean;
  /** Horizontal wander amplitude, as a fraction of frame width. */
  wanderMin: number;
  wanderMax: number;
  rotate: boolean;
  /** Larger particles travel faster — right for embers, wrong for snow. */
  speedFollowsSize: boolean;
  /** Fraction caught in a draught, and how many extra traversals they get. */
  fastFraction: number;
  fastBoost: number;
  /** Whole traversals of the span completed in one loop. */
  cyclesMin: number;
  cyclesMax: number;
  /** 'lighter' for light (embers); 'source-over' for matter (snow). */
  blend: "lighter" | "source-over";
  bloomRadius: number;
  bloomStrength: number;
};

export type ParticleSpec = {
  size: number;
  tone: 0 | 1 | 2;
  cycles: number;
  offset: number;
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

export type ParticleSet = {
  particles: ParticleSpec[];
  spanTop: number;
  spanHeight: number;
};

export type BuildParticlesOptions = {
  seed: string;
  count: number;
  width: number;
  /** Travel span in composition pixels; particles wrap across it. */
  spanTop: number;
  spanHeight: number;
  behaviour: ParticleBehaviour;
  /** Multiplier on the configured size range. */
  sizeScale?: number;
  /** Number of frames in one loop; sets the flicker cycle counts. */
  loopFrames: number;
};

export const buildParticles = ({
  seed,
  count,
  width,
  spanTop,
  spanHeight,
  behaviour,
  sizeScale = 1,
  loopFrames,
}: BuildParticlesOptions): ParticleSet => {
  const particles = new Array(count).fill(0).map((_, i) => {
    const s = `${seed}-${i}`;
    // Size drives depth: bigger particles read as nearer, so they are
    // brighter and — where speedFollowsSize is on — faster.
    const sizeT = Math.pow(rndRange(`${s}-size`, 0, 1), 1.6);
    const size = lerp(behaviour.sizeMin, behaviour.sizeMax, sizeT) * sizeScale;

    const toneRoll = rndRange(`${s}-tone`, 0, 1) * (0.55 + 0.45 * (1 - sizeT));
    const tone: 0 | 1 | 2 = toneRoll < 0.1 ? 0 : toneRoll < 0.55 ? 1 : 2;

    const fast = rndRange(`${s}-fast`, 0, 1) < behaviour.fastFraction;
    const paced = behaviour.speedFollowsSize
      ? Math.round(lerp(behaviour.cyclesMin, behaviour.cyclesMax, sizeT))
      : rndInt(`${s}-cyc`, behaviour.cyclesMin, behaviour.cyclesMax);
    const cycles = Math.max(1, paced + (fast ? behaviour.fastBoost : 0));

    return {
      size,
      tone,
      cycles,
      offset: rndRange(`${s}-offset`, 0, 1),
      lanes: new Array(cycles)
        .fill(0)
        .map((__, lap) => rndRange(`${s}-lane-${lap}`, -0.08, 1.08) * width),
      wander:
        lerp(
          behaviour.wanderMin,
          behaviour.wanderMax,
          rndRange(`${s}-wan`, 0, 1),
        ) * width,
      wanderCycles: rndInt(`${s}-wc`, 1, 3),
      wanderPhase: rndRange(`${s}-wp`, 0, Math.PI * 2),
      wanderCycles2: rndInt(`${s}-wc2`, 4, 6),
      wanderPhase2: rndRange(`${s}-wp2`, 0, Math.PI * 2),
      alpha: rndPow(`${s}-alpha`, 0.45, 1, 0.7) * (0.6 + 0.4 * sizeT),
      flickerCyclesA: loopFrames / rndPick(`${s}-fa`, SLOW_FLICKER_PERIODS),
      flickerCyclesB: loopFrames / rndPick(`${s}-fb`, FAST_FLICKER_PERIODS),
      flickerPhaseA: rndRange(`${s}-fpa`, 0, Math.PI * 2),
      flickerPhaseB: rndRange(`${s}-fpb`, 0, Math.PI * 2),
      driftCycles: rndInt(`${s}-dc`, 1, 2),
      driftPhase: rndRange(`${s}-dp`, 0, Math.PI * 2),
      rotateCycles:
        rndInt(`${s}-rc`, 1, 3) * (rndRange(`${s}-rd`, 0, 1) < 0.5 ? -1 : 1),
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

/** Where one particle is, and how bright, at loop position `t` (0..1). */
export const particleAt = (
  spec: ParticleSpec,
  set: ParticleSet,
  behaviour: ParticleBehaviour,
  t: number,
): ParticleState => {
  const travelled = spec.offset + spec.cycles * t;
  const p = wrap(travelled, 1);
  const lap = Math.floor(travelled);

  const along = behaviour.direction === 1 ? 1 - p : p;
  const y = set.spanTop + along * set.spanHeight;

  const x =
    spec.lanes[wrap(lap, spec.cycles)] +
    spec.wander *
      (loopSin(t, spec.wanderCycles, spec.wanderPhase) +
        0.45 * loopSin(t, spec.wanderCycles2, spec.wanderPhase2));

  // Fade to nothing at both ends of the span. The lane switch happens exactly
  // at p = 0, where alpha is already zero, so a wrapping particle never pops.
  const edgeFade = clamp(Math.min(p, 1 - p) / 0.09, 0, 1);

  let brightness = 1;
  if (behaviour.flicker) {
    const a = 0.5 + 0.5 * loopSin(t, spec.flickerCyclesA, spec.flickerPhaseA);
    const b = 0.5 + 0.5 * loopSin(t, spec.flickerCyclesB, spec.flickerPhaseB);
    brightness = 0.32 + 0.68 * a * b;
  } else if (behaviour.opacityDrift) {
    brightness =
      0.42 + 0.58 * (0.5 + 0.5 * loopSin(t, spec.driftCycles, spec.driftPhase));
  }

  return {
    x,
    y,
    size: spec.size,
    tone: spec.tone,
    alpha: spec.alpha * brightness * edgeFade,
    rotation: behaviour.rotate
      ? spec.rotatePhase + 2 * Math.PI * wrap(spec.rotateCycles * t, 1)
      : 0,
  };
};

const SPRITE_PX = 128;

/**
 * Three tone sprites, pre-rendered once. Every particle is then a blit, never
 * a per-instance createRadialGradient().
 *
 * `tones` runs brightest to dimmest. `coreHardness` 1 gives a hot core with a
 * halo (an ember); 0 gives an even soft falloff (a flake). `aspect` squashes
 * the sprite so that per-particle rotation is actually visible.
 */
export const buildParticleSprites = (
  tones: readonly [string, string, string],
  coreHardness: number,
  aspect = 1,
): HTMLCanvasElement[] =>
  tones.map((tone) => {
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_PX;
    canvas.height = SPRITE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const r = SPRITE_PX / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, mixHex(tone, tones[0], coreHardness * 0.55));
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

export const drawParticle = (
  ctx: CanvasRenderingContext2D,
  sprites: HTMLCanvasElement[],
  state: ParticleState,
) => {
  if (state.alpha <= 0.004) return;
  const d = state.size;
  ctx.globalAlpha = state.alpha;
  if (state.rotation === 0) {
    ctx.drawImage(sprites[state.tone], state.x - d / 2, state.y - d / 2, d, d);
    return;
  }
  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.rotate(state.rotation);
  ctx.drawImage(sprites[state.tone], -d / 2, -d / 2, d, d);
  ctx.restore();
};

export const ParticleDriftField: React.FC<{
  behaviour: ParticleBehaviour;
  /** Brightest, mid and dimmest particle colours, as hex strings. */
  tones: readonly [string, string, string];
  seed: string;
  /**
   * Travel span in composition pixels. Overshoot the frame at both ends so
   * particles are fully faded before they reach the visible edge.
   */
  spanTop: number;
  spanHeight: number;
  driftAmount?: number;
  /**
   * Frames in one loop. Defaults to the composition's own duration, which is
   * the usual case; set it when the loop is shorter than the composition —
   * a 120-frame cycle played twice in a 240-frame comp, or a composition
   * given one extra frame so that frame N can be compared against frame 0.
   */
  loopFrames?: number;
}> = ({
  behaviour,
  tones,
  seed,
  spanTop,
  spanHeight,
  driftAmount = 0,
  loopFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const loop = loopFrames ?? durationInFrames;

  const sprites = useMemo(
    () =>
      buildParticleSprites(tones, behaviour.coreHardness, behaviour.spriteAspect),
    [tones, behaviour.coreHardness, behaviour.spriteAspect],
  );

  const set = useMemo(
    () =>
      buildParticles({
        seed,
        count: behaviour.count,
        width,
        spanTop,
        spanHeight,
        behaviour,
        loopFrames: loop,
      }),
    [seed, behaviour, width, spanTop, spanHeight, loop],
  );

  const bloom = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width / 2));
    c.height = Math.max(1, Math.round(height / 2));
    return c;
  }, [width, height]);

  const t = loopT(frame, loop);
  const drift = cameraDrift(t, driftAmount);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.translate(drift.x, drift.y);
    ctx.globalCompositeOperation = behaviour.blend;
    for (const spec of set.particles) {
      drawParticle(ctx, sprites, particleAt(spec, set, behaviour, t));
    }
    ctx.restore();

    applyBloom(
      ctx,
      bloom,
      width,
      height,
      behaviour.bloomRadius,
      behaviour.bloomStrength,
    );
  };

  return <LayerCanvas width={width} height={height} draw={draw} />;
};
