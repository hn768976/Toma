/**
 * geo/ — map projection and dot-map generation.
 *
 * Projections are implemented inline (no d3-geo dependency) behind an
 * interface d3-geo also satisfies, so a project can swap in Robinson or
 * Natural Earth 1 without changing anything downstream. GeoJSON loading
 * is deliberately NOT here — the library does no I/O. See projection.ts.
 */
export * from "./projection";
export * from "./dotMapFromLand";
