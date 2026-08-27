/**
 * Frame -> motion. Every function here is a pure function of `frame` and a
 * stable string seed; nothing reads a clock or holds state.
 */

import type {BandDef, GlitchConfig, Variant} from '../variants';
import {
  backOut,
  clamp,
  easeInOutSine,
  easeOutCubic,
  easeOutExpo,
  rnd,
  rndInt,
} from './util';

const EASES = {
  cubic: easeOutCubic,
  expo: easeOutExpo,
  sine: easeInOutSine,
} as const;

/** 0 -> 1 build-in for band `index`, centre outward. */
export const assemblyProgress = (
  v: Variant,
  index: number,
  frame: number
): number => {
  const {start, stagger, duration, overshoot, ease} = v.assembly;
  const t = clamp((frame - (start + index * stagger)) / duration);
  if (t <= 0) return 0;
  return overshoot > 0 ? backOut(t, overshoot) : EASES[ease](t);
};

/**
 * "breach" stutter: hold 10-25 frames, snap 15-40 degrees over 2 frames, hold
 * again. The schedule is seeded and rebuilt from frame % 490, so it is stable
 * and loops cleanly.
 */
const stutterAngle = (
  band: BandDef,
  frame: number,
  cycle: number
): number => {
  const f = ((frame % cycle) + cycle) % cycle;
  const dir = Math.sign(band.speed) || 1;
  let cursor = 0;
  let angle = 0;
  for (let i = 0; i < 64 && cursor < cycle; i++) {
    const hold = rnd(`${band.id}-hold-${i}`, 10, 25);
    const magnitude = rnd(`${band.id}-jump-${i}`, 15, 40);
    // Mostly keeps its direction; the occasional reversal reads as a fault.
    const sign = rnd(`${band.id}-flip-${i}`) < 0.2 ? -dir : dir;
    const jump = magnitude * sign;
    if (f < cursor + hold) return angle;
    if (f < cursor + hold + 2) return angle + jump * ((f - cursor - hold) / 2);
    angle += jump;
    cursor += hold + 2;
  }
  return angle;
};

export interface BandMotion {
  /** Radians. */
  rotation: number;
  /** Multiplier on the band radius. */
  scale: number;
  alpha: number;
}

export const bandMotion = (
  v: Variant,
  band: BandDef,
  index: number,
  frame: number,
  durationInFrames: number
): BandMotion => {
  const build = assemblyProgress(v, index, frame);

  let degrees = 0;
  let scale = build;

  if (v.rotation === 'pulse') {
    // Bubbles do not spin — the assembly breathes outward in a slow ripple.
    const p = v.bandPulse;
    if (p) {
      const phase = index * p.phaseStep;
      scale = build * (1 + p.amp * Math.sin((frame / p.period) * Math.PI * 2 + phase));
    }
  } else if (v.rotation === 'erratic' && band.stutter) {
    degrees = stutterAngle(band, frame, durationInFrames);
  } else {
    degrees = band.speed * frame;
  }

  return {
    rotation: (degrees * Math.PI) / 180,
    scale,
    alpha: clamp(build * 1.6) * band.alpha,
  };
};

/* ----------------------------------------------------------- shockwave rings */

export interface Shockwave {
  emittedAt: number;
}

/**
 * Seeded, irregular emission schedule. Gaps vary inside the configured window
 * so the alarm never lands on a metronome beat.
 */
export const shockwaveSchedule = (
  seed: string,
  firstFrame: number,
  minGap: number,
  maxGap: number,
  until: number
): number[] => {
  const out: number[] = [];
  let f = firstFrame;
  let i = 0;
  while (f < until && i < 64) {
    out.push(f);
    f += rndInt(`${seed}-gap-${i}`, minGap, maxGap);
    i++;
  }
  return out;
};

/* ------------------------------------------------------------ glitch events */

export interface GlitchEvent {
  start: number;
  length: number;
  index: number;
}

/** Irregular, occasionally clustered glitch bursts across the whole timeline. */
export const glitchSchedule = (
  g: GlitchConfig,
  until: number
): GlitchEvent[] => {
  const out: GlitchEvent[] = [];
  let f = g.firstFrame;
  let i = 0;
  while (f < until && i < 64) {
    const length = rndInt(`${g.seed}-len-${i}`, g.minLen, g.maxLen);
    out.push({start: f, length, index: i});
    const clustered = rnd(`${g.seed}-cluster-${i}`) < g.clusterChance;
    f += clustered
      ? length + rndInt(`${g.seed}-tight-${i}`, 4, 12)
      : rndInt(`${g.seed}-gap-${i}`, g.minGap, g.maxGap);
    i++;
  }
  return out;
};

export const activeGlitch = (
  events: GlitchEvent[],
  frame: number
): GlitchEvent | null =>
  events.find((e) => frame >= e.start && frame < e.start + e.length) ?? null;

/* -------------------------------------------------------------- camera drift */

/** A closed Lissajous path — returns to its start at `durationInFrames`. */
export const cameraDrift = (
  frame: number,
  durationInFrames: number,
  amount: number
): {x: number; y: number} => {
  const t = (frame / durationInFrames) * Math.PI * 2;
  return {
    x: Math.sin(t) * amount,
    y: Math.sin(t * 2 + 1.1) * amount * 0.8,
  };
};
