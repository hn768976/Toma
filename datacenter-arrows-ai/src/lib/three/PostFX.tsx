/**
 * Post chain built synchronously (so the very first frame a fresh tab
 * renders already has it): scene → [depth of field] → bloom → ACES/AgX
 * tonemap → grain + ±1/255 dither. Rendered from useFrame(priority 1),
 * i.e. inside R3F's advance() that @remotion/three calls once per frame.
 * No temporal effects, no luminance adaptation, nothing carried between
 * frames.
 */
import { useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { GRAIN_GLSL } from "./grainShader";

class GrainDitherEffect extends Effect {
  constructor() {
    super("GrainDither", GRAIN_GLSL, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ["uFrame", new THREE.Uniform(0)],
        ["uGrain", new THREE.Uniform(0.02)],
      ]),
    });
  }
}

export type BloomSettings = {
  intensity: number;
  threshold: number;
  smoothing?: number;
  radius?: number;
  levels?: number;
};

export type DofSettings = {
  /** World-space focus distance from the camera. */
  focusDistance: number;
  /** World-space range that stays sharp. */
  focusRange: number;
  bokehScale: number;
};

export const PostFX: React.FC<{
  /** Frame index used to seed grain (already wrapped for loops). */
  grainFrame: number;
  grain?: number;
  bloom: BloomSettings;
  dof?: DofSettings | null;
  toneMapping?: "aces" | "agx";
  multisampling?: number;
}> = ({ grainFrame, grain = 0.02, bloom, dof, toneMapping = "aces", multisampling = 4 }) => {
  const { gl, scene, camera } = useThree();
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  // Blur sizes are in buffer texels; keep them a constant fraction of the
  // frame so a 720p preview and a 4K master look the same.
  const res = (size.width * dpr) / 1280;

  const chain = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling,
    });
    composer.addPass(new RenderPass(scene, camera));
    let dofEffect: DepthOfFieldEffect | null = null;
    if (dof) {
      dofEffect = new DepthOfFieldEffect(camera, {
        worldFocusDistance: dof.focusDistance,
        worldFocusRange: dof.focusRange,
        bokehScale: dof.bokehScale * res,
      });
      composer.addPass(new EffectPass(camera, dofEffect));
    }
    const bloomEffect = new BloomEffect({
      mipmapBlur: true,
      intensity: bloom.intensity,
      luminanceThreshold: bloom.threshold,
      luminanceSmoothing: bloom.smoothing ?? 0.2,
      radius: bloom.radius ?? 0.75,
      levels: Math.max(4, Math.round((bloom.levels ?? 8) + Math.log2(Math.max(res, 0.25)))),
    });
    const tone = new ToneMappingEffect({
      mode: toneMapping === "agx" ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC,
    });
    const grainEffect = new GrainDitherEffect();
    composer.addPass(new EffectPass(camera, bloomEffect, tone, grainEffect));
    return { composer, dofEffect, bloomEffect, grainEffect };
    // Built once per canvas; settings below are applied every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, res]);

  useLayoutEffect(() => () => chain.composer.dispose(), [chain]);

  // Per-frame parameters (may be animated by the caller).
  chain.bloomEffect.intensity = bloom.intensity;
  chain.bloomEffect.luminanceMaterial.threshold = bloom.threshold;
  (chain.grainEffect.uniforms.get("uFrame") as THREE.Uniform).value = grainFrame;
  (chain.grainEffect.uniforms.get("uGrain") as THREE.Uniform).value = grain;
  if (chain.dofEffect && dof) {
    const coc = chain.dofEffect.cocMaterial;
    coc.adoptCameraSettings(camera);
    coc.worldFocusDistance = dof.focusDistance;
    coc.worldFocusRange = dof.focusRange;
    chain.dofEffect.bokehScale = dof.bokehScale * res;
  }

  useLayoutEffect(() => {
    chain.composer.setSize(size.width, size.height);
  }, [chain, size.width, size.height, dpr]);

  useFrame(() => {
    chain.composer.render(0);
  }, 1);
  return null;
};
