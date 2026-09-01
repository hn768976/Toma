/**
 * types.ts — shared vocabulary for the whole library.
 *
 * WHAT IT IS
 *   The handful of structural types that recur across random/, geo/,
 *   effects/, strokes/, generators/ and shapes/. Kept in one place so a
 *   `Point` produced by a generator drops straight into a shape builder
 *   without adapters.
 *
 * WHAT IT IS FOR
 *   Keeping module boundaries honest. Every public function in this
 *   library speaks in these types rather than in bare tuples or
 *   `{[k: string]: number}` bags.
 *
 * CONVENTIONS THIS LIBRARY FOLLOWS (see README.md for the long form)
 *   - Pure. No component holds state, reads Date.now(), or schedules rAF.
 *   - Time enters as `frame` (integer) or `progress` (0..1). Never both.
 *   - Determinism enters as `seed` (integer). Same seed + same frame =>
 *     byte-identical output, on any worker, in any order.
 *   - Colour is always a parameter. Nothing in src/ contains a hex code
 *     or an hsl()/rgb() literal used as a visual default.
 */

/** A 2D point in composition pixel space (origin top-left, y down). */
export type Point = {
  x: number;
  y: number;
};

/** An axis-aligned rectangle in composition pixel space. */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A CSS colour string. Deliberately a bare `string` rather than a union:
 * the library never inspects or interpolates colour, it only passes it
 * through to canvas/SVG, so any form the host understands is valid
 * ("#0af", "rgb(0 170 255 / 0.5)", "var(--accent)", "currentColor").
 */
export type Color = string;

/**
 * Any function returning uniform floats in [0, 1). Produced by
 * `makeRng(seed)` in random/seededRandom.ts. Passed explicitly wherever
 * a helper needs many draws, so the caller controls the stream and two
 * helpers never silently share one.
 */
export type Rng = () => number;

/** A sample from a generator that walks a path over time. */
export type PathSample = Point & {
  /** Position along the path, 0 at the start, 1 at the end. */
  t: number;
};
