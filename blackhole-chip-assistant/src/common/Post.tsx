import { EffectComposer } from "@react-three/postprocessing";
import {
  BloomEffect,
  Effect,
  KernelSize,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import React, { useMemo } from "react";
import { HalfFloatType } from "three";
import { GrainEffect } from "./GrainEffect";

/**
 * Post chain shared by looks 1 and 2:
 *   [optional depth of field] -> bloom (HDR threshold, only the bright parts)
 *   -> ACES filmic tonemapping -> grain + dither -> sRGB output.
 * Effects are created once and passed as primitives so that per-frame
 * uniform updates never rebuild (and recompile) them.
 */
export const usePostEffects = (opts: {
  bloomThreshold: number;
  bloomIntensity: number;
  bloomRadius: number;
  grain: number;
}) => {
  const { bloomThreshold, bloomIntensity, bloomRadius, grain } = opts;
  return useMemo(() => {
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: bloomThreshold,
      luminanceSmoothing: 0.25,
      intensity: bloomIntensity,
      radius: bloomRadius,
      kernelSize: KernelSize.LARGE,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const grainFx = new GrainEffect(grain);
    return { bloom, tone, grain: grainFx };
  }, [bloomThreshold, bloomIntensity, bloomRadius, grain]);
};

export const Post: React.FC<{
  pre?: Effect[];
  bloom: Effect | null;
  tone: Effect;
  grain: Effect | null;
  multisampling?: number;
}> = ({ pre, bloom, tone, grain, multisampling = 4 }) => {
  // Children must keep their identity between frames: EffectComposer
  // rebuilds its passes whenever its children change.
  const preKey = pre ?? EMPTY;
  const children = useMemo(
    () =>
      [...preKey, bloom, tone, grain].filter((fx): fx is Effect => fx !== null).map((fx, i) => (
        <primitive key={i} object={fx} />
      )),
    [preKey, bloom, tone, grain],
  );
  return (
    <EffectComposer multisampling={multisampling} frameBufferType={HalfFloatType}>
      {children}
    </EffectComposer>
  );
};

const EMPTY: Effect[] = [];
