// Where the headline block sits on the panel, in dot units.
//
// The headline shares the data rows' baseline grid rather than floating
// over it — on the reference panel the red words sit in the same two rows
// the blue hex is running through, and the hex simply resumes on the far
// side of them. Everything downstream (camera framing, the reserved gap
// in the data rows) is derived from this one measurement.

import {
  HEADLINE_CELL_W,
  ROW_PITCH,
  HEADLINE_GAP,
  ICON_TEXT_GAP,
  BASE_DIST,
  type Variant,
} from "./constants";
import { GLYPH_H } from "./font5x7";
import { SPRITES } from "./icons";

export type Layout = {
  iconU: number;
  iconV: number;
  iconW: number;
  iconH: number;
  textU: number;
  lineV: [number, number];
  // u-range on the two headline rows that the data must leave empty.
  reservedU0: number;
  reservedU1: number;
  centerU: number;
  centerV: number;
  dist: number;
};

// The block width the camera distance is tuned against. Framing is
// derived from the block rather than fixed, so a longer headline pulls
// the camera back instead of running off the panel.
const REFERENCE_BLOCK_W = 75;

export const computeLayout = (variant: Variant): Layout => {
  const sprite = SPRITES[variant.sprite];
  const textW =
    Math.max(variant.lines[0].length, variant.lines[1].length) * HEADLINE_CELL_W;
  const blockW = sprite.width + ICON_TEXT_GAP + textW;

  // The two headline rows span from the top of line 0 to the bottom of
  // line 1; the icon is centred on that band and snapped to a whole dot.
  const blockTop = 0;
  const blockBottom = ROW_PITCH + GLYPH_H;
  const centerV = (blockTop + blockBottom) / 2;

  const u0 = -blockW / 2;
  return {
    iconU: Math.round(u0),
    iconV: Math.round(centerV - sprite.height / 2),
    iconW: sprite.width,
    iconH: sprite.height,
    textU: Math.round(u0) + sprite.width + ICON_TEXT_GAP,
    lineV: [blockTop, ROW_PITCH],
    reservedU0: Math.round(u0) - HEADLINE_GAP,
    reservedU1: Math.round(u0) + blockW + HEADLINE_GAP,
    centerU: 0,
    centerV,
    dist: (BASE_DIST * blockW) / REFERENCE_BLOCK_W,
  };
};
