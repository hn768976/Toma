import * as THREE from 'three/webgpu';
import {
  color,
  dot,
  float,
  fract,
  mix,
  nodeObject,
  pass,
  renderOutput,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';

export interface PostResult {
  post: THREE.RenderPipeline;
  update: (s: FrameState, focusDistance: number) => void;
  dispose: () => void;
}

/**
 * The grade.
 *
 * Order matters, and it is split deliberately across the tone map:
 *
 *   linear HDR : chromatic aberration, depth of field, exposure, bloom
 *   --- ACES tone map + sRGB transfer ---
 *   display    : seating flash, vignette, saturation/contrast/lift, grain
 *
 * Light-like operations belong before the tone map (an exposure lift should
 * bloom harder; bloom should see real HDR values). Everything after is a
 * colourist's move and is defined against 0..1 display values — a contrast
 * pivot at 0.5 or a grain amplitude of 0.02 is meaningless applied to
 * unbounded linear light, which is why `outputColorTransform` is switched
 * off and the transform is placed explicitly in the middle of the chain.
 *
 * Everything animatable is a uniform, so a frame's look is a pure function
 * of its `FrameState` — no pass is allowed to accumulate between frames
 * (which rules out temporal effects like motion blur or TAA here).
 */
/**
 * Stages of the grade, in order. `stopAfter` truncates the chain, which is
 * how you find out which pass broke a look (or a driver).
 */
export const POST_STAGES = [
  'scene',
  'aberration',
  'dof',
  'exposure',
  'bloom',
  'flash',
  'vignette',
  'grade',
  'grain',
] as const;

export const createPost = (
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  theme: Theme,
  stopAfter: number = POST_STAGES.length - 1,
): PostResult => {
  const upTo = (stage: (typeof POST_STAGES)[number]) => POST_STAGES.indexOf(stage) <= stopAfter;
  const p = theme.post;

  const uFocus = uniform(30);
  const uFlash = uniform(0);
  const uGrainSeed = uniform(0);
  const uExposureTrim = uniform(1);

  // 4x MSAA on the scene pass: the board is full of one-pixel copper traces
  // that crawl badly without it.
  const scenePass = pass(scene, camera, { samples: 4 });
  const sceneColor = scenePass.getTextureNode('output');
  const viewZ = scenePass.getViewZNode();

  // --- chromatic aberration --------------------------------------------
  // Applied on the raw scene texture (the only node here that can be
  // resampled at an offset uv) and before the defocus, so the fringing
  // blurs along with everything else instead of sitting on top of it.
  const vUv = uv();
  const dir = vUv.sub(vec2(0.5, 0.5));
  const ca = float(p.chromatic);
  const aberrated = upTo('aberration')
    ? vec4(
        sceneColor.sample(vUv.add(dir.mul(ca))).r,
        sceneColor.sample(vUv).g,
        sceneColor.sample(vUv.sub(dir.mul(ca))).b,
        float(1),
      )
    : vec4(sceneColor.rgb, float(1));

  // --- depth of field ---------------------------------------------------
  // Depth of field: one separable blur at half resolution, mixed back in by
  // a circle-of-confusion derived from scene depth.
  //
  // three ships a DepthOfFieldNode, but it runs five extra full-screen passes
  // (near/far CoC, a CoC blur, a 64-tap and a 16-tap bokeh) which is far too
  // much on a software rasteriser, and its composite blows out to white on
  // this backend. This is the cheap textbook version: sharp and blurred
  // copies lerped by CoC. It has no bokeh shaping, but at these apertures the
  // references are showing smooth defocus rather than distinct highlights.
  let focused = aberrated;
  if (upTo('dof')) {
    const blurred = nodeObject(
      gaussianBlur(aberrated, null, p.dofSigma, { resolutionScale: 0.5 }),
    ) as unknown as ReturnType<typeof vec4>;
    // viewZ is negative in front of the camera, hence the negate().
    const signedDistance = viewZ.negate().sub(uFocus);
    const coc = smoothstep(float(0), float(p.dofFocusRange), signedDistance.abs());
    focused = vec4(
      mix(aberrated.rgb, blurred.rgb, coc.mul(float(p.dofStrength))),
      float(1),
    );
  }

  // --- exposure -------------------------------------------------------
  // Applied here, before the bloom, so an exposure lift also blooms harder.
  // Animating renderer.toneMappingExposure instead would not work: the
  // render pipeline bakes the tone-mapping settings into its output node.
  const lit = upTo('exposure') ? focused.rgb.mul(uExposureTrim) : focused.rgb;

  // --- bloom ------------------------------------------------------------
  let linearRgb = lit;
  if (upTo('bloom')) {
    const bloomPass = bloom(vec4(lit, float(1)), p.bloomStrength, p.bloomRadius, p.bloomThreshold);
    linearRgb = lit.add(bloomPass.rgb);
  }

  // --- tone map + transfer function ------------------------------------
  // Typed explicitly: the display-space steps below reassign `outRgb` with
  // differently-shaped node types, which TS will not widen on its own.
  let outRgb: ReturnType<typeof vec3> = nodeObject(
    renderOutput(vec4(linearRgb, float(1)), THREE.ACESFilmicToneMapping, THREE.SRGBColorSpace),
  ).rgb as unknown as ReturnType<typeof vec3>;

  // --- seating flash ----------------------------------------------------
  if (upTo('flash')) outRgb = mix(outRgb, vec3(1, 1, 1), uFlash) as ReturnType<typeof vec3>;

  // --- vignette ---------------------------------------------------------
  // smoothstep() with edge0 > edge1 is undefined in WGSL (it does not flip
  // the ramp the way one might expect), so every falling edge in this file is
  // written as a rising smoothstep inverted with oneMinus().
  const d = dir.length();
  const vignette = smoothstep(float(0.3), float(0.85), d).oneMinus();
  if (upTo('vignette')) {
    outRgb = outRgb.mul(mix(float(1), vignette, float(p.vignette))) as ReturnType<typeof vec3>;
  }

  // --- saturation, contrast, lift ---------------------------------------
  if (upTo('grade')) {
    const luma = dot(outRgb, vec3(0.2126, 0.7152, 0.0722));
    outRgb = mix(vec3(luma, luma, luma), outRgb, float(p.saturation)) as ReturnType<typeof vec3>;
    outRgb = outRgb.sub(0.5).mul(float(p.contrast)).add(0.5) as ReturnType<typeof vec3>;
    // Lift the shadows toward the theme's cast, leaving highlights alone.
    const shadowMask = smoothstep(float(0), float(0.55), luma).oneMinus();
    outRgb = outRgb.add(color(p.liftColor).mul(float(p.lift)).mul(shadowMask)) as ReturnType<typeof vec3>;
  }

  // --- grain ------------------------------------------------------------
  // Deterministic per frame: the seed is a uniform driven by frame time.
  if (upTo('grain')) {
    const noise = fract(sin(dot(vUv.add(uGrainSeed), vec2(12.9898, 78.233))).mul(43758.5453));
    outRgb = outRgb.add(noise.sub(0.5).mul(float(p.grain))) as ReturnType<typeof vec3>;
  }

  const post = new THREE.RenderPipeline(renderer);
  // The transform is applied explicitly above, in the middle of the chain.
  post.outputColorTransform = false;
  post.outputNode = vec4(outRgb, float(1));

  return {
    post,
    update: (s, focusDistance) => {
      uFocus.value = focusDistance;
      uFlash.value = Math.min(0.92, s.flash * 0.55);
      // One grain pattern per frame, stable for a given frame index.
      uGrainSeed.value = Math.round(s.seconds * 1000) % 997;
      uExposureTrim.value = s.exposure / p.exposure;
    },
    dispose: () => {
      post.dispose();
    },
  };
};
