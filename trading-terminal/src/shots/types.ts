import { Clock, Series } from "../engine/data";
import { Version } from "../engine/versions";
import { Painter } from "../draw/primitives";
import { Camera } from "../render/camera";

export interface ShotDef {
  /** Screen size in logical units (= CSS px at magnification 1). */
  W: number;
  H: number;
  /**
   * Part of the screen that is ever visible [x0, y0, x1, y1]. Only this
   * region is rasterised, so the texture budget goes where the camera looks.
   */
  crop: [number, number, number, number];
  camera: (frame: number) => Camera;
  /** Logical point whose depth is in focus. */
  focus: (frame: number) => [number, number];
  dof: { k: number; max: number; base?: number };
  /** Texture px per logical unit at devicePixelRatio 1. */
  oversample: number;
  bloom: { wide: number; tight: number };
  vignette: number;
  draw: (p: Painter, v: Version, s: Series, clock: Clock) => void;
}
