import type { NodeSpec } from "./scene";

/**
 * How much room a node actually occupies, in board units.
 *
 * There is one copy of these numbers because two very different things
 * need them: the components, to lay a node out, and the scene resolver,
 * to work out where a connector should stop. Letting those drift apart is
 * exactly how lines end up ploughing through the middle of a label.
 */
export type Extents = {
  /** Half-width and half-height of the node's visual box. */
  rx: number;
  ry: number;
  /** True when the box is an ellipse rather than a rectangle. */
  elliptical: boolean;
};

/**
 * Capsule width for a V1 label, from its character count.
 *
 * Rajdhani is embedded and fixed, so the advance width per character is
 * known and this stays in step with the text -- which is why the font is
 * self-hosted: a fallback face would change every width here and pull the
 * layout apart.
 */
export const blobWidth = (text: string, size: number) => size * (0.72 + 0.08 * text.length);

/** Font size used inside a V1 capsule, as a fraction of its height. */
export const BLOB_FONT_RATIO = 0.22;

/**
 * Width of a V2 bare label. Rajdhani's brackets are much narrower than
 * its capitals, so they are counted separately rather than averaged in.
 */
export const bareWidth = (text: string, size: number) => {
  const brackets = (text.match(/[[\]{}]/g) ?? []).length;
  const letters = text.length - brackets;
  return size * (0.31 * brackets + 0.52 * letters);
};

export const nodeExtents = (node: NodeSpec): Extents => {
  if (node.shape === "blob") {
    return { rx: blobWidth(node.text ?? "", node.size) / 2, ry: node.size / 2, elliptical: true };
  }
  if (node.shape === "bare") {
    // A text box, so a rectangle -- an ellipse would let connectors run
    // under the first and last characters.
    return { rx: bareWidth(node.text ?? "", node.size) / 2, ry: node.size * 0.42, elliptical: false };
  }
  // Rings. The hero's dashed circle is the outer edge that matters, not
  // the box the mark sits in.
  const radius = node.kind === "hero" ? node.size * 0.42 : node.size / 2;
  return { rx: radius, ry: radius, elliptical: true };
};

/**
 * Distance from a node's centre to its boundary, along a direction.
 *
 * This is what a connector has to skip so it meets the node's edge rather
 * than crossing it.
 */
export const edgeDistance = (node: NodeSpec, dx: number, dy: number) => {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const { rx, ry, elliptical } = nodeExtents(node);

  if (elliptical) {
    return 1 / Math.hypot(ux / rx, uy / ry);
  }
  // Rectangle: whichever side the ray leaves through first.
  const tx = ux === 0 ? Infinity : Math.abs(rx / ux);
  const ty = uy === 0 ? Infinity : Math.abs(ry / uy);
  return Math.min(tx, ty);
};
