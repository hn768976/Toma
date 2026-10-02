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
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getQuality } from "../lib/quality";

// ---------------------------------------------------------------------------
// Final grade: dither + film grain, computed in sRGB after tone mapping and
// bloom. Both come from an integer hash of (pixel, frame), never from
// Math.random(), so a frame always comes out identical.
// The value is converted back to linear at the end because postprocessing
// applies the linear -> sRGB output transform after the last effect.
// ---------------------------------------------------------------------------
const finishFrag = /* glsl */ `
uniform float uFrameF;
uniform float uGrain;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 fromSRGB(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrameF + 0.5)));
  vec3 r = vec3(h & uvec3(0xffffu)) / 65535.0;
  vec3 s = toSRGB(inputColor.rgb);
  // triangular-distributed dither, +/- 1/255
  float dither = (r.x + r.y - 1.0) / 255.0;
  // monochrome grain, ~2%, a little softer in the highlights
  float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float grain = (r.z - 0.5) * 2.0 * uGrain * mix(1.0, 0.55, luma);
  s = clamp(s + dither + grain, 0.0, 1.0);
  outputColor = vec4(fromSRGB(s), inputColor.a);
}
`;

class FinishEffect extends Effect {
  constructor() {
    super("FinishEffect", finishFrag, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, THREE.Uniform>([
        ["uFrameF", new THREE.Uniform(0)],
        ["uGrain", new THREE.Uniform(0.02)],
      ]),
    });
  }
}

export type PostFXHandle = {
  composer: EffectComposer;
  dof: DepthOfFieldEffect;
  finish: FinishEffect;
};

export type DofSettings = { rangeFactor: number; bokehScale: number };

/**
 * Builds the composer synchronously (no async state), so the very first
 * frame rendered from a cold start already has every effect in place.
 * Rendering happens in a priority-1 useFrame: R3F runs it after the floor
 * reflector's priority-0 update within the same advance() call.
 */
export const usePostFX = (dofSettings: DofSettings): PostFXHandle => {
  const { gl, scene, camera } = useThree();
  const handle = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: getQuality().msaa,
    });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, {
      focusDistance: 30,
      focusRange: dofSettings.rangeFactor * 30,
      bokehScale: dofSettings.bokehScale,
      resolutionScale: 0.5,
    });
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 1.35,
      luminanceSmoothing: 0.25,
      intensity: 0.85,
      radius: 0.72,
      levels: 8,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const finish = new FinishEffect();
    composer.addPass(new EffectPass(camera, dof));
    composer.addPass(new EffectPass(camera, bloom, tone, finish));
    return { composer, dof, finish };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => () => handle.composer.dispose(), [handle]);
  return handle;
};

const sizeVec = new THREE.Vector2();
const cssVec = new THREE.Vector2();

export const PostFXRenderer: React.FC<{ fx: PostFXHandle; baseBokeh: number }> = ({ fx, baseBokeh }) => {
  const { gl } = useThree();
  useFrame(() => {
    gl.getDrawingBufferSize(sizeVec);
    const input = fx.composer.inputBuffer;
    if (input.width !== sizeVec.x || input.height !== sizeVec.y) {
      gl.getSize(cssVec);
      fx.composer.setSize(cssVec.x, cssVec.y, false);
    }
    // keep the bokeh size proportional to frame height (1080p reference)
    fx.dof.bokehScale = baseBokeh * (sizeVec.y / 1080);
    fx.composer.render(0);
  }, 1);
  return null;
};
