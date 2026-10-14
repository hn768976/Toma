import type { V3 } from "./math";

// World units. The wallet is centred on the origin, its front face toward +z.
export const WALLET = {
  w: 2.0,
  h: 2.0,
  d: 0.36, // 18% of the width
  r: 0.26, // corner radius
};
export const FRONT_Z = WALLET.d / 2;
export const FLOOR_Y = -1.62;

export const BLOCK = { size: 0.27, pitch: 0.285, radius: 0.03 };

export type Slot = {
  pos: V3;
  normal: V3; // the direction a block slides in from
  edge: "left" | "top";
  along: number; // 0 at the top-left corner, growing away from it
  layer: number; // 0 = just behind the card, then further back
};

// The block slot sits behind the wallet card: a slab of blocks along the left
// and top edges, peeking out ~11 cm past the card's outline (as in the
// references). Nothing is buried inside the body, where thin silhouettes of
// hidden geometry could glint through the face.
const PEEK = 0.11;
const LEFT_X = -WALLET.w / 2 + BLOCK.size / 2 - PEEK;
const TOP_Y = WALLET.h / 2 - BLOCK.size / 2 + PEEK;
const LEFT_ROWS = 6;
const TOP_COLS = 7; // includes the corner block

// The block slot: down the left side and along the top edge, `layers` blocks
// deep behind the card.
export const makeSlots = (layers: number): Slot[] => {
  const slots: Slot[] = [];
  const s = Math.SQRT1_2;
  for (let layer = 0; layer < layers; layer++) {
    const z = -FRONT_Z - BLOCK.size / 2 - 0.006 - layer * BLOCK.pitch;
    for (let c = 0; c < TOP_COLS; c++) {
      slots.push({
        pos: [LEFT_X + c * BLOCK.pitch, TOP_Y, z],
        normal: c === 0 ? [-s, s, 0] : [0, 1, 0],
        edge: "top",
        along: c,
        layer,
      });
    }
    for (let r = 0; r < LEFT_ROWS; r++) {
      slots.push({
        pos: [LEFT_X, TOP_Y - (r + 1) * BLOCK.pitch, z],
        normal: [-1, 0, 0],
        edge: "left",
        along: r + 1,
        layer,
      });
    }
  }
  return slots;
};
