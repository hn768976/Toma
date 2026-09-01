/**
 * effects/ — full-frame canvas passes.
 *
 * All five take a CanvasRenderingContext2D and mutate it, restoring every
 * context property they touch (alpha, filter, composite op, smoothing) so
 * passes compose in any order without leaking state.
 *
 * The conventional order for a frame:
 *   1. lowResUpscale  — atmospheric gradients, cheap
 *   2. threeBufferDOF — the depth-bucketed subject
 *   3. bloomPass      — glow on emissive elements
 *   4. vignettePass   — hold the eye
 *   5. grainPass      — last, at output resolution, over everything
 */
export * from "./threeBufferDOF";
export * from "./grainPass";
export * from "./vignettePass";
export * from "./bloomPass";
export * from "./lowResUpscale";
