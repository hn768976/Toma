// Deterministic post-processing for the three.js looks:
//   scene (HDR, MSAA) → optional pre pass (e.g. DOF) → UnrealBloom →
//   final pass: exposure, ACES filmic, chromatic edge, vignette, sRGB encode,
//   ~2% grain from a fixed hash of (pixel, frame), ±1/255 dither.
// No temporal effects: every output depends only on the current frame.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";

export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uExposure: { value: 1.0 },
    uFrame: { value: 0 },
    uGrain: { value: 0.02 },
    uChroma: { value: 0.0 },
    uVignette: { value: 0.25 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uExposure, uFrame, uGrain, uChroma, uVignette;
    uniform vec2 uResolution;
    uniform vec3 uLift;
    varying vec2 vUv;

    // Narkowicz/Hill ACES fit (same curve as three's ACESFilmicToneMapping).
    vec3 RRTAndODTFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 aces(vec3 color) {
      const mat3 ACESInputMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 ACESOutputMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      color *= 1.0 / 0.6;
      color = ACESInputMat * color;
      color = RRTAndODTFit(color);
      color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    // Integer hash (pcg-style) of pixel position and frame. No Math.random.
    float hash(vec2 p, float f) {
      uvec3 v = uvec3(uvec2(p), uint(f));
      v = v * 1664525u + 1013904223u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      v ^= v >> 16u;
      v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
      return float(v.x & 0x00ffffffu) / float(0x01000000);
    }
    void main() {
      vec2 d = vUv - 0.5;
      vec3 col;
      if (uChroma > 0.0) {
        vec2 off = d * uChroma * dot(d, d) * 4.0;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - off).b;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }
      col = col * uExposure + uLift;
      float vig = 1.0 - uVignette * smoothstep(0.2, 0.9, length(d * vec2(1.0, 0.75)) * 1.4);
      col *= vig;
      col = toSRGB(aces(col));
      vec2 px = floor(vUv * uResolution);
      float g = hash(px, uFrame) - 0.5;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += g * uGrain * (0.35 + 0.65 * sqrt(l));
      float dth = hash(px + vec2(7919.0, 104729.0), uFrame + 977.0) - 0.5;
      col += dth * (2.0 / 255.0);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export type PostOptions = {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
  grain?: number;
  chroma?: number;
  vignette?: number;
  // Frame value fed to the grain hash; pass frame % loopLength for loops.
  loopFrames?: number;
  // Passes inserted between scene render and bloom (e.g. DOF).
  prePasses?: Pass[];
  onBeforeRender?: (frame: number) => void;
  lift?: [number, number, number];
};

export const PostRender: React.FC<PostOptions> = (opts) => {
  const { gl, scene, camera, size } = useThree();
  const frame = useCurrentFrame();
  const dpr = gl.getPixelRatio();
  const w = Math.round(size.width * dpr);
  const h = Math.round(size.height * dpr);

  const composer = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, rt);
    c.setPixelRatio(1);
    c.setSize(w, h);
    c.addPass(new RenderPass(scene, camera));
    for (const p of opts.prePasses ?? []) c.addPass(p);
    c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), opts.bloomStrength, opts.bloomRadius, opts.bloomThreshold));
    const final = new ShaderPass(FinalShader);
    c.addPass(final);
    return { c, final };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, w, h]);

  useEffect(() => () => composer.c.dispose(), [composer]);

  // useFrame is used only as R3F's render hook (priority 1 = we render).
  // Nothing reads R3F's clock: every value comes from Remotion's frame.
  useFrame(() => {
    opts.onBeforeRender?.(frame);
    const u = composer.final.uniforms;
    u.uExposure.value = opts.exposure;
    u.uGrain.value = opts.grain ?? 0.02;
    u.uChroma.value = opts.chroma ?? 0;
    u.uVignette.value = opts.vignette ?? 0.25;
    u.uFrame.value = opts.loopFrames ? frame % opts.loopFrames : frame;
    u.uResolution.value.set(w, h);
    u.uLift.value.set(...(opts.lift ?? [0, 0, 0]));
    const bloom = composer.c.passes.find((p) => p instanceof UnrealBloomPass) as UnrealBloomPass;
    bloom.strength = opts.bloomStrength;
    bloom.radius = opts.bloomRadius;
    bloom.threshold = opts.bloomThreshold;
    composer.c.render(0);
  }, 1);
  return null;
};
