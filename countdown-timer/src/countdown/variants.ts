/**
 * The ONLY thing that differs between the three published versions.
 *
 * Buyers search for a specific timer length, so the set exists purely to
 * offer 30 / 60 / 90 seconds of the same graphic. Palette, bar count,
 * digit construction, glow and drift all live in `theme.ts` and are
 * shared verbatim — deliberately nothing else is parameterised here.
 *
 * `durationInFrames` is the timer itself (totalSeconds * fps) plus
 * HOLD_FRAMES, during which the display rests on 00:00.
 */
export const VARIANTS = {
  sixty: { totalSeconds: 60, durationInFrames: 1830 },
  thirty: { totalSeconds: 30, durationInFrames: 930 },
  ninety: { totalSeconds: 90, durationInFrames: 2730 },
} as const;

export type VariantName = keyof typeof VARIANTS;
