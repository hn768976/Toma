import React, { useMemo } from "react";
import { z } from "zod";
import { ShaderCanvas, Uniforms } from "./ShaderCanvas";
import { crackFragmentShader } from "./crackShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const crackGlowSchema = z.object({
  crackA: rgb,
  crackB: rgb,
  crackM: rgb,
  streak: rgb,
  flare: rgb,
  tile: rgb,
  spec: rgb,
  bg: rgb,
  accentAmount: z.number(),
  camYaw: z.number(),
  camTilt: z.number(),
  camDist: z.number(),
  camOrbit: z.number(),
  camPush: z.number(),
  target: z.tuple([z.number(), z.number()]),
  /** 1 = full 4K shader resolution. Lower only for quick previews. */
  internalScale: z.number().min(0.05).max(1),
});

export type CrackGlowProps = z.infer<typeof crackGlowSchema>;

/** Frames per energy pulse: the reference plays the same pulse twice. */
export const CRACK_CYCLE_FRAMES = 91;

/**
 * Version 1 - matches the reference: violet / magenta cracks turning hot
 * orange on the upper-right side of the impact, near-black stone, static camera.
 */
export const crackGlowV1: CrackGlowProps = {
  crackA: [0.48, 0.06, 1.0],
  crackM: [1.0, 0.10, 0.78],
  crackB: [1.0, 0.30, 0.04],
  streak: [1.0, 0.20, 0.32],
  flare: [1.0, 0.45, 0.85],
  tile: [0.30, 0.26, 0.58],
  spec: [0.55, 0.50, 0.85],
  bg: [0.002, 0.001, 0.004],
  accentAmount: 0.0,
  camYaw: 0.0,
  camTilt: 0.5,
  camDist: 4.6,
  camOrbit: 0.0,
  camPush: 0.0,
  target: [0.45, 0.1],
  internalScale: 1,
};

/**
 * Version 2 - alternative colour palette: a fully cool "ice" scheme of deep
 * blue, electric cyan and mint-green energy on cold slate stone. Fracture,
 * timing and camera are the same as V1.
 */
export const crackGlowV2: CrackGlowProps = {
  ...crackGlowV1,
  crackA: [0.12, 0.25, 1.0],
  crackM: [0.02, 0.80, 1.0],
  crackB: [0.30, 1.0, 0.55],
  streak: [0.60, 0.95, 1.0],
  flare: [0.55, 0.95, 1.0],
  tile: [0.26, 0.36, 0.44],
  spec: [0.50, 0.70, 0.80],
  bg: [0.001, 0.002, 0.004],
};

export const CrackGlow: React.FC<CrackGlowProps> = (props) => {
  const uniforms: Uniforms = useMemo(
    () => ({
      uCycle: CRACK_CYCLE_FRAMES,
      uCrackA: props.crackA,
      uCrackB: props.crackB,
      uCrackM: props.crackM,
      uTarget: props.target,
      uStreak: props.streak,
      uFlare: props.flare,
      uTile: props.tile,
      uSpec: props.spec,
      uBg: props.bg,
      uAccentAmount: props.accentAmount,
      uCamYaw: props.camYaw,
      uCamTilt: props.camTilt,
      uCamDist: props.camDist,
      uCamOrbit: props.camOrbit,
      uCamPush: props.camPush,
    }),
    [props],
  );
  return <ShaderCanvas
      fragmentShader={crackFragmentShader}
      uniforms={uniforms}
      internalScale={props.internalScale}
    />;
};
