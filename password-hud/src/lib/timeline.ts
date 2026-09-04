import { Easing, interpolate } from "remotion";
import { hslLighten, mixHsl, type Rgb } from "./color";
import { COLORS } from "./design";
import { mulberry32 } from "./random";

export type Outcome = "granted" | "denied";

export const FPS = 30;
export const DURATION_IN_FRAMES = 360;

/** Frame ranges for every beat of the sequence. */
export const T = {
  panelIn: [0, 40],
  labelType: [30, 90],
  entry: [90, 240],
  resolve: [240, 280],
  aftermath: [280, 330],
  hold: [330, 360],
} as const;

export const LABEL = "PASSWORD";
export const MASK_LENGTH = 16;
/** The denied field empties in a single frame. */
export const CLEAR_FRAME = 280;

export const STILL_FRAME: Record<Outcome, number> = { granted: 300, denied: 260 };

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const easeOut = Easing.out(Easing.cubic);

/**
 * When each asterisk lands. Seeded rather than evenly spaced so the entry has a
 * human rhythm — including a hesitation partway through and a beat before the
 * last two characters.
 */
export const keystrokeFrames: number[] = (() => {
  const rng = mulberry32(0x5eed01);
  const gaps: number[] = [];
  for (let i = 0; i < MASK_LENGTH; i += 1) {
    let gap = 0.55 + rng() * 1.15;
    if (i === 5) gap += 1.6;
    if (i === MASK_LENGTH - 2) gap += 1.0;
    gaps.push(gap);
  }
  const total = gaps.reduce((a, b) => a + b, 0);
  const span = T.entry[1] - 8 - T.entry[0];
  let at = T.entry[0];
  return gaps.map((gap) => {
    at += (gap / total) * span;
    return at;
  });
})();

export const filledCount = (frame: number, outcome: Outcome): number => {
  if (outcome === "denied" && frame >= CLEAR_FRAME) {
    return 0;
  }
  let count = 0;
  for (const at of keystrokeFrames) {
    if (frame >= at) count += 1;
  }
  return count;
};

/** Start frame of the fade-in for character `i` of the PASSWORD label. */
export const labelCharStart = (i: number) =>
  T.labelType[0] + (i * (T.labelType[1] - T.labelType[0] - 8)) / LABEL.length;

const pulse = (frame: number, center: number, rise: number, fall: number) =>
  interpolate(frame, [center - rise, center, center + fall], [0, 1, 0], {
    easing: Easing.inOut(Easing.quad),
    ...clamp,
  });

export type SceneState = {
  /** State colour with the brightness overshoot folded in. */
  color: Rgb;
  /** State colour without the overshoot — for fills that shouldn't blow out. */
  base: Rgb;
  /** 0..1 extra bloom on the shield and the state glow. */
  glow: number;
  /** 0..1 red -> green progress (granted only). */
  transition: number;
  /** 0..1 rejection flash (denied only). */
  flash: number;
  /** 0..1 how far the background accents have taken the state colour. */
  accent: number;
  /** Horizontal shake amplitude for the asterisks, in design px. */
  shake: number;
  cleared: boolean;
};

export const getSceneState = (frame: number, outcome: Outcome): SceneState => {
  // A slow idle breathing on the shield glow before anything resolves.
  const idle = (0.5 + 0.5 * Math.sin(frame * 0.085)) * 0.14;

  if (outcome === "granted") {
    const transition = interpolate(frame, [240, 255], [0, 1], {
      easing: easeInOut,
      ...clamp,
    });
    // The overshoot: the cross-fade briefly runs brighter than either state.
    const overshoot = interpolate(frame, [240, 249, 258, 274], [0, 1, 0.32, 0], {
      easing: Easing.inOut(Easing.quad),
      ...clamp,
    });
    const base = mixHsl(COLORS.red, COLORS.green, transition);
    return {
      base,
      color: hslLighten(base, overshoot * 0.34),
      glow: Math.max(idle, overshoot),
      transition,
      flash: 0,
      accent: interpolate(frame, [276, 306], [0, 1], { easing: easeOut, ...clamp }),
      shake: 0,
      cleared: false,
    };
  }

  // Two distinct flashes with a clean dip between them. The second is placed so
  // the V2 still frame (260) lands mid-flash rather than in the gap.
  const flash = Math.max(pulse(frame, 248, 7, 7), pulse(frame, 264, 8, 10));
  return {
    base: COLORS.red,
    color: hslLighten(COLORS.red, flash * 0.16),
    glow: Math.max(idle, flash),
    transition: 0,
    flash,
    accent: interpolate(frame, [278, 304], [0, 1], { easing: easeOut, ...clamp }),
    shake: flash * 16,
    cleared: frame >= CLEAR_FRAME,
  };
};

/** Expanding confirmation rings on the granted outcome. */
export const RING_STARTS = [250, 266] as const;
export const ringProgress = (frame: number, start: number) =>
  interpolate(frame, [start, start + 36], [0, 1], { easing: easeOut, ...clamp });

export const panelEntrance = (frame: number) => ({
  opacity: interpolate(frame, [0, 26], [0, 1], { easing: easeOut, ...clamp }),
  rise: interpolate(frame, [0, 40], [30, 0], { easing: easeOut, ...clamp }),
  scale: interpolate(frame, [0, 40], [0.988, 1], { easing: easeOut, ...clamp }),
});
