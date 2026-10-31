import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const BLOOM_REFERENCE_HEIGHT = 1080;

/**
 * Final +-1 LSB triangular dither (static per-pixel pattern, deterministic)
 * to break up 8-bit banding in the dark, smooth floor gradients.
 */
const DitherShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 17.31) - 1.0;
      gl_FragColor = vec4(c.rgb + n / 255.0, c.a);
    }`,
};

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
    c.addPass(new ShaderPass(DitherShader));
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
