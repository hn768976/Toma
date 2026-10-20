import type { Painter } from "../engine/painter";
import type { Noise, Rng } from "../engine/rng";

export type LayoutCtx = {
  painter: Painter;
  rng: Rng;
  noise: Noise;
  colors: string[];
  density: number;
  W: number;
  H: number;
};

export type Layout = {
  /** used in the file name, e.g. BloomField */
  label: string;
  paint: (ctx: LayoutCtx) => Promise<void>;
  /** multiplies the palette's granulation */
  granulationBoost?: number;
  /** drying-rim strength override */
  edge?: number;
};
