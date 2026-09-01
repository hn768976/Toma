/**
 * strokes/ — line construction.
 *
 * neonStroke is the four-pass emissive construction; taperedStroke gives
 * a mark width/alpha falloff; drawOn reveals a path over time; strokeFor
 * stops a scaled icon's outline thickening into a blob.
 */
export * from "./neonStroke";
export * from "./taperedStroke";
export * from "./drawOn";
export * from "./strokeFor";
