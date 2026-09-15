// Single-pass depth of field.
//
// The obvious choice, three's BokehPass, renders the scene a second time
// for depth. These frames are software-rasterised, so doubling the scene
// cost is not affordable across ~2300 of them. Instead the scene is drawn
// once into a target that carries a depth texture, and one full-screen
// pass reads that depth, derives a circle of confusion and gathers a small
// Poisson disc. It is not a true bokeh -- highlights do not bloom into
// discs -- but it gives the background separation the reference macro
// shots have, for roughly a third of the cost of a second scene pass.
//
// Taking over rendering via a prioritised useFrame is deliberate: at
// priority > 0, react-three-fiber stops auto-rendering and hands control
// here, and ThreeCanvas's advance() still drives it once per Remotion frame.

import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import {
  DepthTexture,
  Mesh,
  HalfFloatType,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedShortType,
  WebGLRenderTarget,
} from "three";

const FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uRange;
uniform float uMaxBlur;
uniform float uForegroundBlur;

varying vec2 vUv;

// 12-tap Poisson disc, pre-rotated so the ring pattern does not line up
// with the pixel grid.
const vec2 TAPS[12] = vec2[12](
  vec2( 0.000,  1.000), vec2( 0.866,  0.500), vec2( 0.866, -0.500),
  vec2( 0.000, -1.000), vec2(-0.866, -0.500), vec2(-0.866,  0.500),
  vec2( 0.433,  0.750), vec2( 0.866,  0.000), vec2( 0.433, -0.750),
  vec2(-0.433, -0.750), vec2(-0.866,  0.000), vec2(-0.433,  0.750)
);

float linearDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float ndc = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}

float coc(float dist) {
  float signedBlur = (dist - uFocus) / max(uRange, 1e-4);
  // Foreground blur is usually dialled down: an out-of-focus near edge
  // needs samples from behind it that a single-layer gather cannot supply,
  // so pushing it hard just smears the subject.
  float amount = signedBlur < 0.0 ? abs(signedBlur) * uForegroundBlur : signedBlur;
  return clamp(amount, 0.0, 1.0);
}

void main() {
  float centreDepth = linearDepth(vUv);
  float centreCoc = coc(centreDepth);
  float radius = centreCoc * uMaxBlur;

  if (radius < 0.55) {
    gl_FragColor = texture2D(tColor, vUv);
    #include <colorspace_fragment>
    return;
  }

  // One ring of 12, at alternating radii. Two full rings looked marginally
  // smoother and cost twice as much in a software rasteriser, which across
  // the whole set is measured in hours.
  vec4 sum = texture2D(tColor, vUv);
  float weight = 1.0;
  for (int i = 0; i < 12; i++) {
    float r = radius * (i % 2 == 0 ? 1.0 : 0.58);
    vec2 uv = vUv + TAPS[i] * r * uTexel;
    float sampleDepth = linearDepth(uv);
    float sampleCoc = coc(sampleDepth);
    // Reject samples that sit well in front of the centre and are
    // themselves sharp, or a focused foreground bleeds outwards.
    float accept = (sampleDepth < centreDepth - 0.002 && sampleCoc < centreCoc * 0.5)
      ? 0.0
      : 1.0;
    float w = accept * mix(0.35, 1.0, sampleCoc);
    sum += texture2D(tColor, uv) * w;
    weight += w;
  }
  gl_FragColor = sum / weight;
  #include <colorspace_fragment>
}
`;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export type DepthOfFieldProps = {
  /**
   * Distance from the camera that stays sharp, in world units. Omit to
   * focus on whatever the camera is looking at, which is what every shot
   * in this set wants and saves keeping two numbers in sync as a move
   * pushes in.
   */
  focus?: number;
  /** How far past the focus plane blur reaches its maximum. */
  range: number;
  /** Blur radius at full circle of confusion, in pixels at 1080p. */
  maxBlur?: number;
  /** Scale applied to near-field blur; keep low, see the shader note. */
  foregroundBlur?: number;
};

export const DepthOfField: React.FC<DepthOfFieldProps & { autoFocus?: number }> = ({
  focus,
  autoFocus,
  range,
  maxBlur = 14,
  foregroundBlur = 0.45,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const { target, quadScene, quadCamera, material } = useMemo(() => {
    const depthTexture = new DepthTexture(1, 1, UnsignedShortType);
    depthTexture.minFilter = NearestFilter;
    depthTexture.magFilter = NearestFilter;
    // three always writes linear into a plain render target, whatever the
    // texture's colorSpace says, so the scene arrives here un-encoded and
    // this pass owns the conversion to sRGB (see the end of the shader).
    // Half-float storage keeps the linear darks from banding on the way.
    const rt = new WebGLRenderTarget(1, 1, {
      depthTexture,
      depthBuffer: true,
      type: HalfFloatType,
    });
    const mat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uTexel: { value: [1, 1] },
        uNear: { value: 0.01 },
        uFar: { value: 40 },
        uFocus: { value: 1 },
        uRange: { value: 1 },
        uMaxBlur: { value: 12 },
        uForegroundBlur: { value: 0.45 },
      },
    });
    const s = new Scene();
    s.add(new Mesh(new PlaneGeometry(2, 2), mat));
    return {
      target: rt,
      quadScene: s,
      quadCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
      material: mat,
    };
  }, []);

  useEffect(() => () => target.dispose(), [target]);

  useFrame(() => {
    const u = material.uniforms;

    // Sizing happens here rather than in an effect: Remotion captures the
    // frame that useFrame draws, and an effect that has not run yet would
    // leave the pass sampling with a one-texel-per-screen step -- which
    // blurs the entire image to a flat average.
    const w = Math.max(1, Math.round(size.width * dpr));
    const h = Math.max(1, Math.round(size.height * dpr));
    if (target.width !== w || target.height !== h) {
      target.setSize(w, h);
    }
    (u.uTexel.value as number[])[0] = 1 / w;
    (u.uTexel.value as number[])[1] = 1 / h;

    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = focus ?? autoFocus ?? 1;
    u.uRange.value = range;
    // Blur radius is authored at 1080p and scaled with the real buffer so
    // the 4K composition matches the 1080p one instead of looking sharper.
    u.uMaxBlur.value = maxBlur * (h / 1080);
    u.uForegroundBlur.value = foregroundBlur;

    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    u.tColor.value = target.texture;
    u.tDepth.value = target.depthTexture;
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
};
