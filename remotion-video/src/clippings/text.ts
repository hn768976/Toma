import { rndInt, rndRange } from "../lib/seededRandom";

/**
 * Newspaper-specific text bits. The filler-prose generator that used to live
 * here is now ../lib/fillerText — it is not specific to newspapers and is
 * shared. What is left is the byline treatment.
 *
 * Bylines are generic desk names, never real people.
 */

/** Byline text, uppercased for a small-caps setting. */
export const bylineText = (seed: string, bylines: string[]): string => {
  const pick = bylines[rndInt(`${seed}:byline`, 0, bylines.length)];
  return pick.toUpperCase();
};

/** Letter spacing used when drawing the byline glyph by glyph. */
export const bylineTracking = (seed: string, fontSize: number): number =>
  fontSize * rndRange(`${seed}:tracking`, 0.1, 0.16);
