import { SILK_WEAVE_FRAG } from "../shaders/silkWeave";
import { CAUSTIC_BLOOM_FRAG } from "../shaders/causticBloom";
import type { UniformSpec } from "../ShaderStage";

const rgb = (hex: string): Float32Array => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new Float32Array([
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ]);
};

export type LookDef = {
  id: string;
  label: string;
  fragment: string;
  /** Loop length in frames at 30fps. */
  durationInFrames: number;
  uniforms: UniformSpec;
};

/**
 * Four looks, one per supplied reference.
 *
 * Durations follow the references: the two silk clips run 450 frames (15s) and
 * the two caustic clips 600 frames (20s). The references are 29.97fps and
 * 30.00fps respectively; both are produced here at a flat 30fps as requested,
 * which makes the silk pair 15.000s instead of 15.015s - a 15ms difference,
 * and the only way to hold an integer frame count at 30fps.
 */
export const LOOKS: LookDef[] = [
  {
    id: "SilkWeaveNavy",
    label: "Silk Weave / Navy",
    fragment: SILK_WEAVE_FRAG,
    durationInFrames: 450,
    uniforms: {
      uDeep: { value: rgb("#01040f"), type: "vec3<f32>" },
      uMid: { value: rgb("#0b3f9e"), type: "vec3<f32>" },
      uBright: { value: rgb("#4ea8ff"), type: "vec3<f32>" },
      uSeed: { value: 0.0, type: "f32" },
      uWeaveAmount: { value: 0.055, type: "f32" },
      uVignette: { value: 1.0, type: "f32" },
    },
  },
  {
    id: "SilkWeaveMagenta",
    label: "Silk Weave / Magenta",
    fragment: SILK_WEAVE_FRAG,
    durationInFrames: 450,
    uniforms: {
      uDeep: { value: rgb("#0b0110"), type: "vec3<f32>" },
      uMid: { value: rgb("#5a1275"), type: "vec3<f32>" },
      uBright: { value: rgb("#c257e8"), type: "vec3<f32>" },
      uSeed: { value: 2.0, type: "f32" },
      uWeaveAmount: { value: 0.07, type: "f32" },
      uVignette: { value: 1.0, type: "f32" },
    },
  },
  {
    id: "CausticBloomRose",
    label: "Caustic Bloom / Rose",
    fragment: CAUSTIC_BLOOM_FRAG,
    durationInFrames: 600,
    uniforms: {
      uWarm: { value: rgb("#e8305f"), type: "vec3<f32>" },
      uCool: { value: rgb("#3a2ee0"), type: "vec3<f32>" },
      uGlow: { value: rgb("#ffd8ec"), type: "vec3<f32>" },
      uSeed: { value: 0.0, type: "f32" },
      uWarmBias: { value: 0.46, type: "f32" },
      uStreak: { value: 0.30, type: "f32" },
    },
  },
  {
    id: "CausticBloomAzure",
    label: "Caustic Bloom / Azure",
    fragment: CAUSTIC_BLOOM_FRAG,
    durationInFrames: 600,
    uniforms: {
      uWarm: { value: rgb("#1f6ff0"), type: "vec3<f32>" },
      uCool: { value: rgb("#6b2fd6"), type: "vec3<f32>" },
      uGlow: { value: rgb("#d8e8ff"), type: "vec3<f32>" },
      uSeed: { value: 1.3, type: "f32" },
      uWarmBias: { value: 0.52, type: "f32" },
      uStreak: { value: 0.26, type: "f32" },
    },
  },
];
