import { REFERENCE_HEIGHT } from "../constants";
import { applyVignette, drawGround } from "../grounds";
import { paintFill } from "../fills/treatments";
import { drawMotifInstance } from "./motif";
import { resolveMotifs } from "./motif";
import type { SurfaceSpec } from "../surfaces";
import type { Palette } from "../palettes";
import type { CompositionSpec } from "../types";

/**
 * A surface reuses the motif pipeline, so it needs the same shape of spec.
 * Surfaces have no open centre — they are the sheet itself, edge to edge — so
 * the guard is given a zero-size protected region and never fires.
 */
const asComposition = (surface: SurfaceSpec): CompositionSpec => ({
  id: surface.id,
  label: surface.label,
  note: surface.note,
  tone: surface.ground.tone ?? "light",
  openCentre: { w: 0, h: 0 },
  fibreDensity: surface.ground.fibreDensity,
  motifs: surface.motifs,
});

export type SurfaceOptions = {
  surface: SurfaceSpec;
  palette: Palette;
  width: number;
  height: number;
};

/** Ground, then motifs in table order, then the vignette over everything. */
export const drawSurface = (
  ctx: CanvasRenderingContext2D,
  { surface, palette, width, height }: SurfaceOptions,
): void => {
  const env = { ctx, width, height, palette, seed: surface.id };
  drawGround(env, surface.ground);

  const composition = asComposition(surface);
  const motifEnv = { width, height, palette, composition };
  for (const instance of resolveMotifs(composition, width, height)) {
    drawMotifInstance(ctx, instance, motifEnv, (options) =>
      paintFill(instance.spec.fill, options),
    );
  }

  applyVignette(env, surface.ground);
};

/** Exposed so the proof and sheet compositions agree on the reference scale. */
export const surfaceScale = (height: number) => height / REFERENCE_HEIGHT;
