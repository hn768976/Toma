import { createContext, useContext } from "react";
import type { CompositionConfig, CompositionName } from "./compositions";
import type { ResolvedPalette } from "./palettes";

/**
 * The field is carried between stages as an unquantised float buffer, three
 * channels per pixel in 0..255 space. Nothing is rounded to 8 bits until the
 * very end, which is what keeps the smooth dark transitions free of banding:
 * every intermediate stage would otherwise re-quantise and lock the bands in.
 */
export type FieldState = {
  readonly width: number;
  readonly height: number;
  /** length 3 * width * height, interleaved RGB. */
  readonly rgb: Float32Array;
  readonly composition: CompositionConfig;
  readonly compositionName: CompositionName;
  readonly palette: ResolvedPalette;
  /** Seed base derived from the composition name. */
  readonly seed: number;
};

export type Stage = {
  /** Stages run in ascending order regardless of mount order. */
  readonly order: number;
  readonly run: (state: FieldState) => void;
};

export type Pipeline = {
  readonly register: (stage: Stage) => void;
};

export const PipelineContext = createContext<Pipeline | null>(null);

export const usePipeline = (): Pipeline => {
  const pipeline = useContext(PipelineContext);
  if (!pipeline) {
    throw new Error("Render stages must be used inside <GrainGradient>");
  }
  return pipeline;
};

export const STAGE_ORDER = {
  colourField: 10,
  edgeFalloff: 20,
  grain: 30,
} as const;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
