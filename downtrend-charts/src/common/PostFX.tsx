import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const BLOOM_REFERENCE_HEIGHT = 1080;

/**
 * Post-processing chain: multisampled HDR render -> optional bloom -> tone map / sRGB.
 * Takes over rendering (useFrame priority 1), which @remotion/three drives
 * deterministically once per video frame.
 */
export const PostFX: React.FC<{
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
}> = ({ bloomStrength, bloomRadius, bloomThreshold }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const { composer, bloom } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 0.5, 0.8);
    // The bloom blur kernels are measured in pixels, so the glow would get
    // tighter as resolution rises. Run the bloom at a fixed 1080-line working
    // resolution (upsampled when compositing) so 1080p and 4K renders match.
    const setBloomSize = b.setSize.bind(b);
    b.setSize = (w: number, h: number) => {
      const k = Math.min(1, BLOOM_REFERENCE_HEIGHT / h);
      setBloomSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    };
    c.addPass(b);
    c.addPass(new OutputPass());
    return { composer: c, bloom: b };
  }, [gl, scene, camera]);

  useEffect(() => () => composer.dispose(), [composer]);

  bloom.strength = bloomStrength;
  bloom.radius = bloomRadius;
  bloom.threshold = bloomThreshold;
  bloom.enabled = bloomStrength > 0;

  useFrame(() => {
    // Size synchronously right before rendering: the first deterministic
    // render can happen before React effects have run.
    const w = Math.round(size.width * dpr);
    const h = Math.round(size.height * dpr);
    if (composer.renderTarget1.width !== w || composer.renderTarget1.height !== h) {
      composer.setPixelRatio(dpr);
      composer.setSize(size.width, size.height);
    }
    composer.render();
  }, 1);

  return null;
};
