import type * as THREE from "three";
import type { ToneMap } from "./output";

/** Static look settings shared by Version 1 and Version 2 (see src/look.ts). */
export interface Look {
  toneMap: ToneMap;
  exposure: number;
  /** MSAA samples for the scene render */
  msaa: number;
  bloom: {
    /** linear-light luminance where bloom starts */
    threshold: number;
    /** soft knee width (linear light) */
    knee: number;
    /** tight core + wide halo, as two mip-blur layers */
    coreIntensity: number;
    coreRadius: number;
    haloIntensity: number;
    haloRadius: number;
    /** mip levels of each layer: fewer = tighter (at 960x540) */
    coreLevels: number;
    haloLevels: number;
  };
  dof: {
    enabled: boolean;
    /** blur size, in 1080p pixels */
    bokehScale: number;
    /** world-space depth range that stays sharp around the focus distance */
    focusRange: number;
  };
  fringe: { amount: number; power: number };
  vignette: {
    strength: number;
    inner: number;
    outer: number;
    center: [number, number];
    aspect: number;
  };
  grade: {
    contrast: number;
    saturation: number;
    gamma: number;
    lift: [number, number, number];
    gain: [number, number, number];
  };
  grain: number;
  dither: number;
  /** unsharp-mask amount (0 = off) */
  sharpen: number;
}

/** Per-frame values a world hands back to the pipeline. */
export interface FrameLook {
  /** world-space focus distance from the camera */
  focus: number;
  bokehScale?: number;
  focusRange?: number;
  exposureMul?: number;
  bloomMul?: number;
  flash?: number;
  vignetteMul?: number;
  grainMul?: number;
  /** motion blur: number of sub-frame renders and shutter length in frames */
  motionSamples?: number;
  shutter?: number;
}

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /**
   * Put the whole scene into the state of (possibly fractional) frame `f`.
   * Must be a pure function of `f` - no clocks, no accumulated state.
   */
  apply(f: number): FrameLook;
  dispose?(): void;
}
