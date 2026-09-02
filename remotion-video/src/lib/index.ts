// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
/**
 * remotion-lib — deterministic canvas building blocks for Remotion pieces.
 *
 * Everything here is a pure function of its arguments plus a stable string
 * seed, so a render is identical no matter which worker draws which frame.
 * Nothing in this directory reads a palette, a project constant or the current
 * time: colours, sizes and strengths all arrive as parameters.
 */
export * from "./seededRandom";
export * from "./noiseField";
export * from "./colorUtils";
export * from "./tornEdge";
export * from "./paperTexture";
export * from "./fillerText";
export * from "./justifiedColumns";
export * from "./canvasType";
export * from "./halftone";
export * from "./filmFinish";
