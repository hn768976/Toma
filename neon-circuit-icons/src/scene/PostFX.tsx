import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import {
  BlendFunction, BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, Effect, EffectComposer,
  EffectPass, KernelSize, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { HalfFloatType, Uniform, Vector2 } from 'three';
import { TARGET } from './camera';
import { LOOP } from '../lib/loop';

// Grain + dither AFTER bloom and tonemapping, in display (sRGB) space.
// Grain is a fixed integer hash of (pixel, frame % 600) — never Math.random().
const FINISH_FRAG = /* glsl */ `
uniform float uFrame;
uniform float uGrain;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
vec3 toLinear(vec3 c) {
  return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, vec3(lessThanEqual(c, vec3(0.04045))));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 s = toSRGB(inputColor.rgb);
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame)));
  vec3 r = vec3(h & uvec3(0xffffffu)) / 16777216.0;
  float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
  // ~2% film grain (monochrome, slightly reduced in deep blacks)
  float grain = (r.x - 0.5) * 2.0 * uGrain * (0.6 + 0.4 * sqrt(clamp(luma, 0.0, 1.0)));
  // ±1/255 triangular dither
  float dither = (r.y + r.z - 1.0) / 255.0;
  s += grain + dither;
  outputColor = vec4(toLinear(clamp(s, 0.0, 1.0)), inputColor.a);
}
`;

class FinishEffect extends Effect {
  constructor() {
    super('FinishEffect', FINISH_FRAG, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ['uFrame', new Uniform(0)],
        ['uGrain', new Uniform(0.02)],
      ]),
    });
  }
}

export const PostFX = ({ frame }: { frame: number }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 4 });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, {
      focusDistance: 5,
      focusRange: 2.0,
      bokehScale: 3,
      resolutionScale: 0.5,
    });
    dof.target = TARGET.clone();
    const ca = new ChromaticAberrationEffect({
      offset: new Vector2(0.0007, 0.0005),
      radialModulation: true,
      modulationOffset: 0.35,
    });
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.9,
      luminanceSmoothing: 0.35,
      intensity: 1.15,
      radius: 0.78,
      levels: 8,
      kernelSize: KernelSize.LARGE,
    });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const finish = new FinishEffect();
    composer.addPass(new EffectPass(camera, dof));
    composer.addPass(new EffectPass(camera, ca));
    composer.addPass(new EffectPass(camera, bloom, vignette, tone, finish));
    return { composer, dof, finish };
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    fx.composer.setSize(size.width, size.height, false);
    // pixel-based parameters follow the output resolution (1080p reference)
    const buf = gl.getDrawingBufferSize(new Vector2());
    fx.dof.bokehScale = 6.0 * (buf.y / 1080);
  }, [fx, gl, size.width, size.height]);

  useLayoutEffect(() => () => fx.composer.dispose(), [fx]);

  fx.finish.uniforms.get('uFrame')!.value = ((frame % LOOP) + LOOP) % LOOP;

  // Rendering only — no clock. Priority 1 takes over R3F's default render.
  useFrame(() => {
    fx.composer.render(0);
  }, 1);
  return null;
};
