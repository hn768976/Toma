/**
 * remotion-lib — shared components for Remotion stock-footage projects.
 *
 * Import from a subpath rather than from here where you can
 * (`remotion-lib/src/strokes`), so a composition pulls in only what it
 * uses. This barrel exists for convenience and for discovery.
 *
 * See CATALOG.md for the full component list, and README.md for the
 * conventions every file in here follows.
 */
export * from "./types";
export * from "./random";
export * from "./geo";
export * from "./effects";
export * from "./strokes";
export * from "./generators";
export * from "./shapes";
