/**
 * generators/ — algorithms that produce geometry or series.
 *
 * These are the expensive ones. Every function here is meant to be called
 * ONCE, inside a useMemo, and then animated by moving what it returned —
 * not re-run per frame. Re-running them per frame is the single most
 * common cause of a composition that renders slowly and boils on screen.
 */
export * from "./midpointDisplacement";
export * from "./trendingWalk";
export * from "./noiseField";
export * from "./particleFromMask";
