/**
 * shapes/ — reusable SVG path builders.
 *
 * Every export returns a path STRING (or an array of them) and carries no
 * colour, stroke width or opacity. Put the path in an element and style
 * it there. That keeps these usable for fills, strokes, clip paths and
 * masks without variants.
 */
export * from "./blobPath";
export * from "./tornEdge";
export * from "./rings";
