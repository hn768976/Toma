/**
 * Shared types for the library.
 *
 * These exist so every module speaks the same vocabulary for the two things
 * that recur everywhere: a 2D canvas context, and a point.
 */

/** A 2D canvas rendering context. Aliased so call sites stay short. */
export type Ctx = CanvasRenderingContext2D;

/** A point in whatever space the calling function documents. */
export type Point = { x: number; y: number };

/**
 * A callable that lays a path onto a context without stroking or filling it.
 *
 * Multi-pass techniques (see `strokes/neonStroke`) need to re-lay the same
 * geometry once per pass. Passing the path as a thunk keeps the geometry in
 * one place instead of forcing the caller to duplicate it per pass.
 */
export type PathFn = (ctx: Ctx) => void;

/** A deterministic generator returning values in [0, 1). */
export type Rng = () => number;
