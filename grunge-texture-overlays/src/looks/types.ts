import type { Rng } from "../lib/rng";
import type { PersistEvent } from "../lib/schedule";

export type LookId = "ScratchGrunge" | "PhotocopyGrunge" | "CharcoalGrunge" | "BrushFrame";

/**
 * Pixel geometry of a card. Cards are larger than the frame by BLEED on every side.
 * W/H: frame size in px; cw/ch: card size in px; (ox, oy): where the frame's top-left sits in the card;
 * u: one "unit" = 1/1000 of the frame height in px (all sizes are written in units so the look is
 * identical at 720p and 4K).
 */
export type Frame = { W: number; H: number; cw: number; ch: number; ox: number; oy: number; u: number };

/** Frame fraction (x right, y down) -> card px */
export const X = (F: Frame, fx: number) => F.ox + fx * F.W;
export const Y = (F: Frame, fy: number) => F.oy + fy * F.H;

export type Vec4 = [number, number, number, number];

export type CardUniforms = {
  /** Look-specific parameters, read by the card shader as uP[0..3]. */
  p: [Vec4, Vec4, Vec4, Vec4];
};

export type LookDef = {
  id: LookId;
  /** GLSL: defines `float lookInk(vec2 P, vec2 F)` (P: height units, y down; F: frame fraction, y down). */
  shader: string;
  /**
   * Number of p5.brush layers (0–4). Each layer is painted into its own canvas; the shader reads
   * their coverage (1 - luminance) as vec4 and must define `float brushInk(vec4 cov, vec2 P)` when > 0.
   */
  brushLayers: number;
  schedule: { window: number; exposureJumps: boolean; persistArea: "any" | "border" };
  cardUniforms: (r: Rng, density: number, card: number) => CardUniforms;
  /** Canvas 2D line work for one card: draw ink as white on the (already black) canvas. */
  drawLines: (ctx: CanvasRenderingContext2D, F: Frame, r: Rng, cu: CardUniforms, density: number) => void;
  /** p5.brush layer `layer` of one card (already loaded, seeded and cleared to white): paint coverage in grey/black. */
  paintBrush?: (F: Frame, r: Rng, cu: CardUniforms, density: number, layer: number) => void;
  /** Line-type persistent mark (Canvas 2D, white on black), drawn at its drifted position. */
  drawPersist: (ctx: CanvasRenderingContext2D, F: Frame, ev: PersistEvent, r: Rng) => void;
  /** Stain-type persistent mark, evaluated in the display shader: [radius (height units), strength, grain, roughness]. */
  stain: (r: Rng) => Vec4;
  /** Keep the centre (75% x 65%) clean. */
  clearCentre: boolean;
};
