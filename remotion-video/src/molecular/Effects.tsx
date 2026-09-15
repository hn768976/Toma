import React, { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import * as THREE from "three";
import type { PostSpec } from "./types";

/**
 * Post chain, wired up by hand.
 *
 * <EffectComposer> from @react-three/postprocessing builds its composer inside
 * a `useEffect` and stores it in state, so its `useFrame` callback bails out
 * until a second commit lands. That is invisible in a normal rAF loop, but
 * @remotion/three renders exactly one `advance()` per frame — and because the
 * composer holds render priority, r3f skips its own draw too. The result is a
 * blank first frame on *every* render worker. Constructing the composer in
 * `useMemo` means it is live before the first advance.
 *
 * It also owns tone mapping: the composer forces NoToneMapping on the renderer,
 * so mapping has to happen as the last effect in the chain rather than in the
 * material shaders.
 */
export const Effects: React.FC<{
  post: PostSpec;
  resolutionScale: number;
}> = ({ post, resolutionScale }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    const instance = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      // The RenderPass draws into its own target, so the canvas's own
      // `antialias` never applies — without this the silhouettes crawl.
      multisampling: 0,
    });
    instance.addPass(new RenderPass(scene, camera));

    const dof = new DepthOfFieldEffect(camera, {
      focusDistance: post.focusDistance,
      focusRange: post.focusRange,
      bokehScale: post.bokehScale * resolutionScale,
      resolutionScale: 0.55,
    });
    const bloom = new BloomEffect({
      intensity: post.bloomIntensity,
      luminanceThreshold: post.bloomThreshold,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
    });
    const vignette = new VignetteEffect({ offset: 0.3, darkness: post.vignette });
    // Khronos PBR Neutral: rolls the specular crescents off without the
    // desaturation ACES puts on these pastel palettes.
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });

    instance.addPass(new EffectPass(camera, dof, bloom, vignette, tone));
    return instance;
  }, [gl, scene, camera, post, resolutionScale]);

  useLayoutEffect(() => {
    // Exposure is baked into scene radiance instead (see environment.ts and
    // Backdrop.tsx) because the chain, not the materials, now tone maps.
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);

  useLayoutEffect(() => {
    if (size.width > 0 && size.height > 0) {
      composer.setSize(size.width, size.height);
    }
  }, [composer, size.width, size.height]);

  useLayoutEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};
