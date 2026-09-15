// Bloom, implemented as an explicit render-target chain.
//
// This started out as three's UnrealBloomPass, which turned out to put colour
// through transforms this project cannot afford: a pure #00ff00 backdrop came
// out of the composer as #93e459, and #020818 as #00204e, while the very same
// colours rendered directly were pixel-exact (see src/ai/AiProbe.tsx). Since
// every palette in palette.ts is authored as a final display value, a pipeline
// that quietly re-grades them is worse than no bloom at all.
//
// So the glow is done by hand. Every pass is a RawShaderMaterial drawn over a
// fullscreen triangle, which three does not inject tone-mapping or colour-space
// chunks into, and every target is plain 8-bit with NoColorSpace. What a shader
// writes is what reaches the frame, and the bright-pass curve and blur spread
// are tunable per version instead of being fixed by the library.

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type GlowProps = {
  /** Overall glow intensity added on top of the scene. */
  strength?: number;
  /** Luminance below which nothing glows. */
  threshold?: number;
  /** Softness of the threshold, so bright edges ramp in instead of popping. */
  knee?: number;
  /** Weight of the wide second octave, which gives the broad halo. */
  spread?: number;
  /** Blur tap spacing, in target pixels. Larger reads as a softer, bigger glow. */
  radius?: number;
};

const TRIANGLE = (() => {
  // One oversized triangle beats a quad: no diagonal seam, one less vertex,
  // and the UVs still land 0..1 across the visible area.
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  g.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
  );
  return g;
})();

const VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uSrc;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uSrc, vUv).rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // Soft knee: a hard cutoff makes the glow flicker on and off as a moving
    // highlight crosses the threshold from frame to frame.
    float w = smoothstep(uThreshold, uThreshold + max(uKnee, 0.0001), luma);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uSrc;
  uniform vec2 uDir;      // texel-sized step, already scaled by radius
  varying vec2 vUv;
  void main() {
    // Nine-tap Gaussian, separable: run once horizontally, once vertically.
    float w0 = 0.227027;
    float w1 = 0.1945946;
    float w2 = 0.1216216;
    float w3 = 0.054054;
    float w4 = 0.016216;
    vec3 sum = texture2D(uSrc, vUv).rgb * w0;
    sum += texture2D(uSrc, vUv + uDir * 1.0).rgb * w1;
    sum += texture2D(uSrc, vUv - uDir * 1.0).rgb * w1;
    sum += texture2D(uSrc, vUv + uDir * 2.0).rgb * w2;
    sum += texture2D(uSrc, vUv - uDir * 2.0).rgb * w2;
    sum += texture2D(uSrc, vUv + uDir * 3.0).rgb * w3;
    sum += texture2D(uSrc, vUv - uDir * 3.0).rgb * w3;
    sum += texture2D(uSrc, vUv + uDir * 4.0).rgb * w4;
    sum += texture2D(uSrc, vUv - uDir * 4.0).rgb * w4;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uScene;
  uniform sampler2D uGlowNear;
  uniform sampler2D uGlowFar;
  uniform float uStrength;
  uniform float uSpread;
  varying vec2 vUv;
  void main() {
    vec3 scene = texture2D(uScene, vUv).rgb;
    vec3 glow = texture2D(uGlowNear, vUv).rgb
              + texture2D(uGlowFar, vUv).rgb * uSpread;
    gl_FragColor = vec4(scene + glow * uStrength, 1.0);
  }
`;

const makeTarget = (w: number, h: number, depth: boolean) => {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: depth,
    stencilBuffer: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  rt.texture.generateMipmaps = false;
  return rt;
};

export const Glow: React.FC<GlowProps> = ({
  strength = 1,
  threshold = 0.45,
  knee = 0.25,
  spread = 0.6,
  radius = 1.4,
}) => {
  const { gl, scene, camera, size } = useThree();

  const rig = useMemo(() => {
    const w = Math.max(1, Math.floor(size.width));
    const h = Math.max(1, Math.floor(size.height));
    const w4 = Math.floor(w / 4);
    const h4 = Math.floor(h / 4);
    const w8 = Math.floor(w / 8);
    const h8 = Math.floor(h / 8);

    // The triangle's vertices reach outside the ortho frustum by design, so it
    // has to opt out of culling or the whole chain silently renders nothing.
    const quad = new THREE.Mesh(TRIANGLE, new THREE.MeshBasicMaterial());
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);

    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.RawShaderMaterial({
        vertexShader: VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

    return {
      scene: makeTarget(w, h, true),
      bright: makeTarget(w4, h4, false),
      nearA: makeTarget(w4, h4, false),
      nearB: makeTarget(w4, h4, false),
      farA: makeTarget(w8, h8, false),
      farB: makeTarget(w8, h8, false),
      dims: { w, h, w4, h4, w8, h8 },
      brightMat: mk(BRIGHT_FRAG, {
        uSrc: { value: null },
        uThreshold: { value: 0.45 },
        uKnee: { value: 0.25 },
      }),
      blurMat: mk(BLUR_FRAG, {
        uSrc: { value: null },
        uDir: { value: new THREE.Vector2() },
      }),
      compositeMat: mk(COMPOSITE_FRAG, {
        uScene: { value: null },
        uGlowNear: { value: null },
        uGlowFar: { value: null },
        uStrength: { value: 1 },
        uSpread: { value: 0.6 },
      }),
      quad,
      ortho: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      quadScene,
    };
  }, [size.width, size.height]);

  useEffect(() => {
    return () => {
      rig.scene.dispose();
      rig.bright.dispose();
      rig.nearA.dispose();
      rig.nearB.dispose();
      rig.farA.dispose();
      rig.farB.dispose();
      rig.brightMat.dispose();
      rig.blurMat.dispose();
      rig.compositeMat.dispose();
    };
  }, [rig]);

  useFrame(() => {
    const { dims } = rig;
    const prevTarget = gl.getRenderTarget();

    const blit = (
      material: THREE.Material,
      target: THREE.WebGLRenderTarget | null,
    ) => {
      rig.quad.material = material;
      gl.setRenderTarget(target);
      gl.render(rig.quadScene, rig.ortho);
    };

    // 1. The scene itself, into an 8-bit target with no colour management.
    gl.setRenderTarget(rig.scene);
    gl.clear();
    gl.render(scene, camera);

    // 2. Isolate what is bright enough to glow, at quarter resolution.
    rig.brightMat.uniforms.uSrc.value = rig.scene.texture;
    rig.brightMat.uniforms.uThreshold.value = threshold;
    rig.brightMat.uniforms.uKnee.value = knee;
    blit(rig.brightMat, rig.bright);

    // 3. Near octave: separable blur at 1/4 res.
    rig.blurMat.uniforms.uSrc.value = rig.bright.texture;
    rig.blurMat.uniforms.uDir.value.set(radius / dims.w4, 0);
    blit(rig.blurMat, rig.nearA);
    rig.blurMat.uniforms.uSrc.value = rig.nearA.texture;
    rig.blurMat.uniforms.uDir.value.set(0, radius / dims.h4);
    blit(rig.blurMat, rig.nearB);

    // 4. Far octave: blur the near result again at 1/8 res for the wide halo.
    rig.blurMat.uniforms.uSrc.value = rig.nearB.texture;
    rig.blurMat.uniforms.uDir.value.set(radius / dims.w8, 0);
    blit(rig.blurMat, rig.farA);
    rig.blurMat.uniforms.uSrc.value = rig.farA.texture;
    rig.blurMat.uniforms.uDir.value.set(0, radius / dims.h8);
    blit(rig.blurMat, rig.farB);

    // 5. Scene plus glow, straight to the canvas.
    rig.compositeMat.uniforms.uScene.value = rig.scene.texture;
    rig.compositeMat.uniforms.uGlowNear.value = rig.nearB.texture;
    rig.compositeMat.uniforms.uGlowFar.value = rig.farB.texture;
    rig.compositeMat.uniforms.uStrength.value = strength;
    rig.compositeMat.uniforms.uSpread.value = spread;
    blit(rig.compositeMat, null);

    gl.setRenderTarget(prevTarget);
  }, 1);

  return null;
};
