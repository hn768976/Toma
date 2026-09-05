import type { HudPalette } from "../palette";
import type { ColorKey, Layout } from "../layout";

export type LayerProps = {
  layout: Layout;
  palette: HudPalette;
  /** Frame height in pixels — every dimension in the layout is a fraction of it. */
  h: number;
};

export const colorOf = (palette: HudPalette, key: ColorKey) => palette[key];
