import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LOOP } from "../lib/time";
import { HASH } from "./glsl";
import type { SharedUniforms } from "./shared";

/**
 * Scene -> half-float, 4x MSAA target -> (bloom) -> final pass.
 *
 * Final pass: soft highlight shoulder, linear -> sRGB, film grain (fixed
 * hash of pixel position and frame % 600, faded to zero below ~3%
 * luminance so empty space stays clean) and +-1/255 triangular dither
 * against banding.
 */
const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uFrame: { value: 0 },
    uExposure: { value: 1 },
    uGrain: { value: 0.015 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    ${HASH}
    uniform sampler2D tDiffuse;
    uniform float uFrame;
    uniform float uExposure;
    uniform float uGrain;
    varying vec2 vUv;
    vec3 shoulder(vec3 x) {
      vec3 k = vec3(0.78);
      vec3 over = max(x - k, 0.0);
      return min(x, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
    }
    vec3 toSRGB(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
      vec3 s = toSRGB(shoulder(max(c, 0.0)));
      float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
      uvec3 px = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
      float g = hash3u(px) - 0.5;
      float d1 = hash3u(px + uvec3(0u, 0u, 7919u));
      float d2 = hash3u(px + uvec3(0u, 0u, 15731u));
      s += 2.0 * uGrain * g * smoothstep(0.03, 0.07, lum);
      s += (d1 + d2 - 1.0) / 255.0;
      gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
    }
  `,
};

export const PostFX: React.FC<{
  frame: number;
  exposure: number;
  bloom: null | { strength: number; radius: number; threshold: number };
  shared: SharedUniforms;
}> = ({ frame, exposure, bloom, shared }) => {
  const { gl, scene, camera } = useThree();

  const pipeline = useMemo(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: 4,
      depthBuffer: true,
    });
    const composer = new EffectComposer(gl, target);
    composer.setPixelRatio(1);
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, camera));
    if (bloom) {
      composer.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(size.x, size.y),
          bloom.strength,
          bloom.radius,
          bloom.threshold,
        ),
      );
    }
    const final = new ShaderPass(FINAL);
    composer.addPass(final);
    return { composer, final, size };
  }, [gl, scene, camera, bloom]);

  useLayoutEffect(() => {
    pipeline.final.uniforms.uFrame.value = ((frame % LOOP) + LOOP) % LOOP;
    pipeline.final.uniforms.uExposure.value = exposure;
  }, [pipeline, frame, exposure]);

  useLayoutEffect(() => () => pipeline.composer.dispose(), [pipeline]);

  // Priority 1 takes over R3F's render. This callback ignores R3F's clock
  // and delta entirely: every value it draws was set from the Remotion frame.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== pipeline.size.x || size.y !== pipeline.size.y) {
      pipeline.composer.setSize(size.x, size.y);
      pipeline.size.copy(size);
    }
    shared.uResolution.value.set(size.x, size.y);
    shared.uPxScale.value = size.y / 720;
    pipeline.composer.render(0);
  }, 1);

  return null;
};
