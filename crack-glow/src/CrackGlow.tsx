import React, { useMemo } from "react";
import { z } from "zod";
import { ShaderCanvas, Uniforms } from "./ShaderCanvas";
import { crackFragmentShader } from "./crackShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const crackGlowSchema = z.object({
  crackA: rgb,
  crackB: rgb,
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
  /** 1 = full 4K shader resolution. Lower only for quick previews. */
  internalScale: z.number().min(0.05).max(1),
});

export type CrackGlowProps = z.infer<typeof crackGlowSchema>;

/** Frames per energy pulse: the reference plays the same pulse twice. */
export const CRACK_CYCLE_FRAMES = 91;

/** Version 1 - matches the reference: violet cracks with amber accents. */
export const crackGlowV1: CrackGlowProps = {
  crackA: [0.62, 0.16, 1.0],
  crackB: [1.0, 0.52, 0.12],
  streak: [1.0, 0.22, 0.38],
  flare: [0.95, 0.35, 1.0],
  tile: [0.30, 0.27, 0.40],
  spec: [0.55, 0.52, 0.70],
  bg: [0.010, 0.006, 0.020],
  accentAmount: 0.0,
  camYaw: 0.0,
  camTilt: 0.66,
  camDist: 4.6,
  camOrbit: 0.18,
  camPush: 0.12,
  internalScale: 1,
};

/**
 * Version 2 - alternative colour palette: electric cyan energy with molten
 * gold accents on cold slate-blue stone (same fracture, timing and camera).
 */
export const crackGlowV2: CrackGlowProps = {
  ...crackGlowV1,
  crackA: [0.05, 0.78, 1.0],
  crackB: [1.0, 0.78, 0.22],
  streak: [0.55, 0.95, 1.0],
  flare: [0.45, 0.95, 1.0],
  tile: [0.22, 0.30, 0.36],
  spec: [0.50, 0.66, 0.74],
  bg: [0.004, 0.010, 0.016],
};

export const CrackGlow: React.FC<CrackGlowProps> = (props) => {
  const uniforms: Uniforms = useMemo(
    () => ({
      uCycle: CRACK_CYCLE_FRAMES,
      uCrackA: props.crackA,
      uCrackB: props.crackB,
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
