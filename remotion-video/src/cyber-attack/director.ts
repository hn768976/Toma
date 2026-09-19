import { FPS } from "./constants";
import { rand } from "./random";

// The edit. Every time-based decision lives here so the piece can be
// re-timed from one file: how violent the glitch is, what colour the
// signal is bleeding, and which title is on screen.
//
// Times are in seconds against the 20s master.

type Key<T> = [time: number, value: T];

const sampleNumber = (keys: readonly Key<number>[], t: number): number => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      // Smoothstep, so intensity ramps feel driven rather than linear.
      return v0 + (v1 - v0) * (k * k * (3 - 2 * k));
    }
  }
  return keys[keys.length - 1][1];
};

/**
 * Overall glitch violence, 0..1. Shaped to match the reference's rhythm:
 * five bursts separated by passages that fall almost completely quiet.
 */
const INTENSITY: readonly Key<number>[] = [
  [0.0, 0.62],
  [0.35, 0.14],
  [1.75, 0.38],
  [2.05, 0.12],
  [2.4, 0.72],
  [3.5, 0.9],
  [4.15, 0.34],
  [4.45, 0.6],
  [5.2, 0.74],
  [6.35, 0.86],
  [6.72, 0.11],
  [8.0, 0.14],
  [8.15, 0.6],
  [8.95, 0.9],
  [9.5, 0.8],
  [10.1, 0.52],
  [10.3, 0.17],
  [10.55, 0.62],
  [11.05, 0.19],
  [11.35, 0.48],
  [12.6, 0.94],
  [13.4, 1.0],
  [14.0, 0.68],
  [14.25, 0.14],
  [16.5, 0.17],
  [16.75, 0.7],
  [17.25, 0.94],
  [18.3, 1.0],
  [18.85, 0.72],
  [19.05, 0.28],
  [19.6, 0.18],
  [20.0, 0.36],
];

/** Signal moods the grade lerps between. */
const MOODS = {
  blue: { r: 0.42, g: 0.58, b: 1.0, heat: 0.0 },
  red: { r: 1.0, g: 0.26, b: 0.3, heat: 1.0 },
  magenta: { r: 1.0, g: 0.3, b: 0.92, heat: 0.8 },
  green: { r: 0.55, g: 1.0, b: 0.5, heat: 0.4 },
  amber: { r: 1.0, g: 0.72, b: 0.2, heat: 0.6 },
} as const;

type MoodName = keyof typeof MOODS;

const MOOD_KEYS: readonly Key<MoodName>[] = [
  [0.0, "blue"],
  [2.6, "blue"],
  [2.95, "red"],
  [3.4, "blue"],
  [5.1, "green"],
  [5.5, "blue"],
  [5.9, "red"],
  [6.3, "magenta"],
  [6.8, "blue"],
  [8.6, "magenta"],
  [9.0, "green"],
  [9.35, "red"],
  [9.9, "blue"],
  [10.6, "amber"],
  [10.9, "blue"],
  [11.4, "red"],
  [12.1, "magenta"],
  [12.7, "green"],
  [13.2, "red"],
  [13.85, "green"],
  [14.15, "blue"],
  [17.25, "magenta"],
  [17.7, "green"],
  [18.15, "blue"],
  [18.4, "red"],
  [18.7, "blue"],
  [20.0, "blue"],
];

export type MoodColor = { r: number; g: number; b: number; heat: number };

const sampleMood = (t: number): MoodColor => {
  let i = 0;
  while (i < MOOD_KEYS.length - 1 && t > MOOD_KEYS[i + 1][0]) i += 1;
  const [t0, n0] = MOOD_KEYS[i];
  const [t1, n1] = MOOD_KEYS[Math.min(i + 1, MOOD_KEYS.length - 1)];
  const a = MOODS[n0];
  const b = MOODS[n1];
  const k = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const e = k * k * (3 - 2 * k);
  return {
    r: a.r + (b.r - a.r) * e,
    g: a.g + (b.g - a.g) * e,
    b: a.b + (b.b - a.b) * e,
    heat: a.heat + (b.heat - a.heat) * e,
  };
};

export type TitleKind = "hacked" | "cyber";

type TitleCue = { kind: TitleKind; from: number; to: number };

/**
 * Title schedule. The two lock-ups trade off through the piece, each one
 * fading up inside a burst and getting torn apart on the way out.
 */
const TITLE_CUES: readonly TitleCue[] = [
  { kind: "hacked", from: 0.3, to: 1.35 },
  { kind: "hacked", from: 3.25, to: 4.75 },
  { kind: "cyber", from: 5.65, to: 7.7 },
  { kind: "hacked", from: 9.25, to: 10.6 },
  { kind: "cyber", from: 11.35, to: 13.45 },
  { kind: "hacked", from: 15.15, to: 17.3 },
  { kind: "cyber", from: 17.65, to: 18.9 },
  { kind: "hacked", from: 19.15, to: 20.0 },
];

export type TitleState = {
  kind: TitleKind;
  /** 0..1 visibility, including the fade in and out. */
  opacity: number;
  /** 0..1 position through the cue, drives the slow drift and bloom. */
  progress: number;
} | null;

const sampleTitle = (t: number, frame: number): TitleState => {
  for (const cue of TITLE_CUES) {
    if (t < cue.from || t > cue.to) continue;
    const span = cue.to - cue.from;
    const progress = (t - cue.from) / span;
    const fadeIn = Math.min(1, (t - cue.from) / 0.22);
    const fadeOut = Math.min(1, (cue.to - t) / 0.3);
    // A dropout every so often: the panel loses signal for a few frames
    // rather than holding a clean, video-ish fade.
    const dropout = rand(Math.floor(frame / 2), 0x7171) < 0.09 ? 0.15 : 1;
    return {
      kind: cue.kind,
      opacity: Math.max(0, fadeIn * fadeOut * dropout),
      progress,
    };
  }
  return null;
};

export type DirectorState = {
  time: number;
  intensity: number;
  mood: MoodColor;
  title: TitleState;
  /** Full-frame white/colour blowout, 0..1. */
  flash: number;
  /** True for the handful of frames the signal inverts completely. */
  invert: boolean;
};

export const direct = (frame: number): DirectorState => {
  const time = frame / FPS;
  const intensity = sampleNumber(INTENSITY, time);
  const block = Math.floor(frame / 3);

  // Blowouts only fire inside a burst, and only on a held block, so they
  // land as deliberate hits rather than single-frame sparkle.
  const flashRoll = rand(block, 0x515f);
  const flash =
    intensity > 0.55 && flashRoll < 0.12 * intensity
      ? 0.4 + rand(block, 0x9911) * 0.6
      : 0;

  const invert = intensity > 0.8 && rand(block, 0x2b2b) < 0.05;

  return {
    time,
    intensity,
    mood: sampleMood(time),
    title: sampleTitle(time, frame),
    flash,
    invert,
  };
};
