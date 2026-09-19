// Resolves the scheduled GLITCH_EVENTS into a per-frame glitch state, and
// derives the concrete slice/offset geometry a frame needs to draw.
//
// Everything here is a pure function of `frame`, so any worker rendering
// any frame in any order produces the same break-up.

import {
  FPS,
  GLITCH_EVENTS,
  type GlitchKind,
  MOSAIC_RESHUFFLE_PERIOD,
} from "./constants";
import { clamp, hash2, hash3 } from "./random";

export type GlitchState = {
  /** 0 = clean picture, 1 = maximum break-up. */
  intensity: number;
  kind: GlitchKind;
  /** How far the RGB channels separate, in 1x pixels. */
  rgbSplit: number;
  /** Foreground (triangle + headline) visibility, 0..1. */
  foregroundAlpha: number;
  /** Multiplier on the background field's brightness. */
  backgroundGain: number;
  /** Horizontal slice tearing bands, in normalised 0..1 coordinates. */
  slices: { y: number; h: number; dx: number; dy: number; alpha: number }[];
  /** Extra ghost copies of the headline, offset and semi-transparent. */
  headlineGhosts: { dx: number; dy: number; alpha: number }[];
  /** Whole-frame vertical roll, in 1x pixels. */
  roll: number;
};

const CLEAN: GlitchState = {
  intensity: 0,
  kind: "soft",
  rgbSplit: 0,
  foregroundAlpha: 1,
  backgroundGain: 1,
  slices: [],
  headlineGhosts: [],
  roll: 0,
};

// An event ramps in fast and falls off over its remaining life, so a hit
// lands hard on the first frame instead of easing in politely.
const eventEnvelope = (t: number) => {
  if (t < 0 || t > 1) return 0;
  const attack = 0.12;
  if (t < attack) return t / attack;
  const decay = (t - attack) / (1 - attack);
  // Stepped falloff: glitches stutter out rather than fade smoothly.
  return (1 - decay) * (1 - decay);
};

export const getGlitchState = (frame: number): GlitchState => {
  const seconds = frame / FPS;

  // Find the strongest event currently active. Overlapping events don't
  // add up — the loudest one owns the frame.
  let intensity = 0;
  let kind: GlitchKind = "soft";
  let eventId = 0;
  let progress = 0;

  // A plain loop rather than forEach: TypeScript does not track
  // assignments made inside a callback, so `kind` would stay narrowed to
  // its initial literal type.
  for (let i = 0; i < GLITCH_EVENTS.length; i++) {
    const event = GLITCH_EVENTS[i];
    const t = (seconds - event.at) / event.dur;
    const value = eventEnvelope(t) * event.intensity;
    if (value > intensity) {
      intensity = value;
      kind = event.kind;
      eventId = i + 1;
      progress = t;
    }
  }

  // A constant low-level nervousness so the picture is never perfectly
  // still, even between scheduled hits.
  const idle = hash2(frame, 7717) < 0.06 ? 0.14 : 0;
  if (intensity < idle) {
    intensity = idle;
    kind = "soft";
    eventId = 999;
  }

  if (intensity <= 0.001) return CLEAN;

  // Glitches hold a pose for a couple of frames instead of re-rolling
  // every frame — that stutter is what reads as "digital", not "noisy".
  const step = Math.floor(frame / MOSAIC_RESHUFFLE_PERIOD);
  const r = (n: number) => hash3(eventId * 131 + n, step, 4241);

  const heavy = kind === "heavy";
  const drop = kind === "drop";

  const sliceCount = heavy
    ? Math.round(3 + intensity * 14)
    : drop
      ? Math.round(2 + intensity * 6)
      : Math.round(intensity * 4);

  const slices: GlitchState["slices"] = [];
  for (let i = 0; i < sliceCount; i++) {
    const h = 0.012 + r(i * 5) * (heavy ? 0.11 : 0.05);
    slices.push({
      y: r(i * 5 + 1) * (1 - h),
      h,
      // Tear distance in normalised width; sign flips per slice.
      dx: (r(i * 5 + 2) - 0.5) * 2 * intensity * (heavy ? 0.16 : 0.05),
      dy: (r(i * 5 + 3) - 0.5) * intensity * 0.012,
      alpha: 0.78 + r(i * 5 + 4) * 0.22,
    });
  }

  // "drop" events cut the foreground to near-nothing: the signal-loss
  // beats in the reference, where the alert vanishes for half a second
  // while the field carries on. Doubling the triangular curve before
  // clamping gives a flat-topped hold rather than an instant dip, so the
  // alert stays gone long enough to register.
  const dropCurve = drop
    ? clamp((1 - Math.abs(progress - 0.5) * 2.2) * 2)
    : 0;
  const foregroundAlpha = drop
    ? clamp(1 - dropCurve * (0.75 + intensity * 0.25))
    : heavy && r(90) < 0.25 * intensity
      ? 0.25
      : 1;

  const headlineGhosts: GlitchState["headlineGhosts"] = [];
  if (heavy) {
    const ghostCount = Math.round(1 + intensity * 3);
    for (let i = 0; i < ghostCount; i++) {
      headlineGhosts.push({
        dx: (r(200 + i * 3) - 0.5) * 60 * intensity,
        dy: (r(201 + i * 3) - 0.5) * 34 * intensity,
        alpha: 0.2 + r(202 + i * 3) * 0.45,
      });
    }
  }

  return {
    intensity,
    kind,
    rgbSplit: intensity * (heavy ? 22 : drop ? 12 : 6),
    foregroundAlpha,
    backgroundGain: drop ? 1 - dropCurve * 0.3 : 1 + intensity * 0.1,
    slices,
    headlineGhosts,
    roll: heavy ? (r(77) - 0.5) * 30 * intensity : 0,
  };
};
