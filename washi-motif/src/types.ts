import type { Palette } from "./palettes";
import type { Rng } from "./rng";

/** The traditional forms in the set. */
export type MotifKind =
  | "circle"
  | "ring"
  | "chrysanthemum"
  | "sakura"
  | "seigaiha"
  | "ringFlower"
  | "kumo"
  | "dotCluster";

/** How a motif's area is inked. */
export type FillKind =
  | "solid"
  | "stipple"
  | "lineFill"
  | "dotGrid"
  | "outline"
  | "metallic"
  | "woven";

/** Which of the palette's three inks a motif uses. */
export type InkIndex = 0 | 1 | 2;

/**
 * One motif instance. Positions are fractions of the frame and may fall
 * outside 0..1 — that is how motifs get cropped by the frame edge.
 */
export type MotifSpec = {
  readonly motif: MotifKind;
  readonly fill: FillKind;
  /** Centre x as a fraction of frame width. */
  readonly x: number;
  /** Centre y as a fraction of frame height. */
  readonly y: number;
  /** Radius as a fraction of frame height. */
  readonly r: number;
  /** Rotation in degrees. */
  readonly rotate?: number;
  readonly ink?: InkIndex;
  readonly alpha?: number;
  /** Also stroke the region boundary in ink (outline-with-fill motifs). */
  readonly outline?: boolean;
  /** Stroke weight as a fraction of frame height. */
  readonly stroke?: number;
  /** Direction of the stipple density gradient / the line-fill angle, degrees. */
  readonly fillAngle?: number;
  /** Multiplier on dot or line density, 1 = the treatment's default. */
  readonly fillDensity?: number;
  /** Petal or lobe count (chrysanthemum, ring flower, kumo). */
  readonly petals?: number;
  /** Width : height ratio, kumo only. */
  readonly aspect?: number;
  /** Concentric arcs per seigaiha unit. */
  readonly rings?: number;
};

/** Paper treatment, chosen per composition. */
export type PaperTone = "light" | "dark";

export type CompositionSpec = {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly tone: PaperTone;
  /**
   * The protected middle of the frame, as fractions of width and height.
   * No motif may intrude into it.
   */
  readonly openCentre: { readonly w: number; readonly h: number };
  /** Fibre strand count scales with this; 1 = the standard washi surface. */
  readonly fibreDensity?: number;
  readonly motifs: readonly MotifSpec[];
};

/** Everything a draw function needs. Passed down instead of re-derived. */
export type DrawContext = {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /**
   * Height relative to the 2560px reference frame. Every dimension in the
   * generator is multiplied by this, so a contact-sheet tile is a true
   * miniature of the full-size still.
   */
  readonly scale: number;
  readonly palette: Palette;
  readonly composition: CompositionSpec;
  readonly rng: Rng;
};
