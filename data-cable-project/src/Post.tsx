import { useFrame, useThree } from "@react-three/fiber";
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import React, { useEffect, useMemo } from "react";
import { HalfFloatType } from "three";
import { GrainDitherEffect } from "./GrainDither";
import { POST_FB, POST_FX } from "./env";
import { DURATION, LookConfig } from "./looks";

/**
 * The post chain, driven directly.
 *
 * <ThreeCanvas> runs with frameloop="never" and advances the loop by hand, and
 * @react-three/postprocessing's <EffectComposer> does not get its pass chain
 * wired up in time for that single advance -- the canvas comes back black.
 * Owning the composer here sidesteps that entirely.
 *
 * These are the same effect classes the React wrapper mounts; only the
 * scheduling differs. Every one is a spatial shader, so the output stays a
 * pure function of the frame.
 */
export const Post: React.FC<{ config: LookConfig; frame: number }> = ({
  config,
  frame,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const { composer, grain } = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: POST_FB === "half" ? HalfFloatType : undefined,
      multisampling: 0,
    });
    composer.addPass(new RenderPass(scene, camera));

    const effects = [];

    // Depth-based blur. Focus sits on one strand; everything else falls away.
    if (POST_FX.includes("dof")) {
      const dof = new DepthOfFieldEffect(camera, {
        worldFocusDistance: config.dof.worldFocusDistance,
        worldFocusRange: config.dof.worldFocusRange,
        bokehScale: config.dof.bokehScale,
      });
      effects.push(dof);
    }

    // Threshold kept high so only the hottest digits and the rim bloom.
    if (POST_FX.includes("bloom")) {
      effects.push(
        new BloomEffect({
          luminanceThreshold: config.bloom.threshold,
          luminanceSmoothing: config.bloom.smoothing,
          intensity: config.bloom.intensity,
          radius: config.bloom.radius,
          mipmapBlur: true,
        }),
      );
    }

    if (POST_FX.includes("tonemap")) {
      effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    }

    const grain = new GrainDitherEffect({ grain: 0.02, dither: 2 / 255 });
    if (POST_FX.includes("grain")) effects.push(grain);

    if (effects.length > 0) {
      composer.addPass(new EffectPass(camera, ...effects));
    }
    return { composer, grain };
  }, [gl, scene, camera, config]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useEffect(() => () => composer.dispose(), [composer]);

  const uFrame = grain.uniforms.get("uFrame");
  if (uFrame) uFrame.value = frame % DURATION;

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};
