import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GLSL_HASH } from "./glsl";
import { setResUniforms } from "./materials";

/**
 * Post chain, all in half-float targets:
 *   scene → RT (RGBA16F) → bloom mip chain (5 levels, 13-tap down / tent up)
 *   → final: scene + bloom, vignette, soft shoulder, grain (1.5%) and ±1/255
 *     triangular dither from an integer hash of (pixel, frame mod period).
 *
 * R3F's useFrame is used only as the "render now" hook (priority 1 replaces
 * the default render). Its clock/delta are never read: every value comes from
 * the `frame` prop, i.e. useCurrentFrame().
 */

const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
vec3 tap(vec2 o) { return texture(uSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = tap(vec2(-2,-2)), b = tap(vec2(0,-2)), c = tap(vec2(2,-2));
  vec3 d = tap(vec2(-1,-1)), e = tap(vec2(1,-1));
  vec3 f = tap(vec2(-2,0)), g = tap(vec2(0,0)), h = tap(vec2(2,0));
  vec3 i = tap(vec2(-1,1)), j = tap(vec2(1,1));
  vec3 k = tap(vec2(-2,2)), l = tap(vec2(0,2)), m = tap(vec2(2,2));
  vec3 col = (d+e+i+j) * 0.125 + (a+c+k+m) * 0.03125 + (b+f+h+l) * 0.0625 + g * 0.125;
  if (uThreshold > 0.0) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= w;
  }
  fragColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uLow; uniform sampler2D uHigh; uniform vec2 uTexel; uniform float uMixHigh;
void main() {
  vec3 s = vec3(0.0);
  s += texture(uLow, vUv + vec2(-1,-1) * uTexel).rgb;
  s += texture(uLow, vUv + vec2( 0,-1) * uTexel).rgb * 2.0;
  s += texture(uLow, vUv + vec2( 1,-1) * uTexel).rgb;
  s += texture(uLow, vUv + vec2(-1, 0) * uTexel).rgb * 2.0;
  s += texture(uLow, vUv).rgb * 4.0;
  s += texture(uLow, vUv + vec2( 1, 0) * uTexel).rgb * 2.0;
  s += texture(uLow, vUv + vec2(-1, 1) * uTexel).rgb;
  s += texture(uLow, vUv + vec2( 0, 1) * uTexel).rgb * 2.0;
  s += texture(uLow, vUv + vec2( 1, 1) * uTexel).rgb;
  fragColor = vec4(s / 16.0 + texture(uHigh, vUv).rgb * uMixHigh, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uScene; uniform sampler2D uBloom;
uniform float uBloomStrength; uniform float uVignette; uniform float uExposure;
uniform float uGrain; uniform uint uFrame; uniform vec3 uLift; uniform float uSat; uniform float uCA; uniform vec2 uTexel;
${GLSL_HASH}
float shoulder(float c) { return c < 0.75 ? c : 0.75 + 0.25 * (1.0 - exp(-(c - 0.75) / 0.25)); }
void main() {
  // slight radial chromatic fringing (uCA px at the frame edge)
  vec2 dir = (vUv - 0.5) * 2.0 * uCA * uTexel;
  vec3 sc = vec3(texture(uScene, vUv + dir).r, texture(uScene, vUv).g, texture(uScene, vUv - dir).b);
  vec3 col = sc + texture(uBloom, vUv).rgb * (uBloomStrength * 0.2);
  col *= uExposure;
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.15, 0.85, dot(q, q) * 2.2);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSat), 0.0);
  col = col + uLift * (1.0 - col);
  col = vec3(shoulder(col.r), shoulder(col.g), shoulder(col.b));
  uvec2 p = uvec2(gl_FragCoord.xy);
  // grain: fixed formula of pixel position and frame (mod composition period)
  float g = (h3(p.x, p.y, uFrame) + h3(p.y + 7919u, p.x, uFrame + 104729u) - 1.0);
  col += g * uGrain;
  // ±1/255 triangular dither for the 8-bit output
  float d = (h3(p.x + 31u, p.y + 17u, uFrame * 3u + 1u) + h3(p.x + 101u, p.y + 211u, uFrame * 3u + 2u) - 1.0) / 255.0;
  col += d;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const LEVELS = 5;

export type PipelineProps = {
  frame: number;
  /** grain/dither pattern repeats with this period (composition length) */
  period: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  vignette?: number;
  exposure?: number;
  grain?: number;
  lift?: [number, number, number];
  saturation?: number;
  /** chromatic fringe at the frame edge, px at 2160p */
  chroma?: number;
  background?: THREE.ColorRepresentation;
};

const makeMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export const Pipeline: React.FC<PipelineProps> = ({
  frame,
  period,
  bloomStrength = 0.6,
  bloomThreshold = 0.0,
  vignette = 0.35,
  exposure = 1,
  grain = 0.015,
  lift = [0, 0, 0],
  saturation = 1,
  chroma = 0,
  background = "#000000",
}) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const viewportDpr = useThree((s) => s.viewport.dpr);

  const w = Math.max(1, Math.round(size.width * viewportDpr));
  const h = Math.max(1, Math.round(size.height * viewportDpr));

  const res = useMemo(() => {
    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      colorSpace: THREE.NoColorSpace,
    } as const;
    const scene = new THREE.WebGLRenderTarget(w, h, { ...opts, depthBuffer: true });
    const down: THREE.WebGLRenderTarget[] = [];
    const up: THREE.WebGLRenderTarget[] = [];
    let lw = w;
    let lh = h;
    for (let i = 0; i < LEVELS; i++) {
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
      down.push(new THREE.WebGLRenderTarget(lw, lh, opts));
      up.push(new THREE.WebGLRenderTarget(lw, lh, opts));
    }
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    quadScene.add(quad);
    const downMat = makeMat(DOWN_FRAG, {
      uSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0 },
      uKnee: { value: 0.2 },
    });
    const upMat = makeMat(UP_FRAG, {
      uLow: { value: null },
      uHigh: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uMixHigh: { value: 1 },
    });
    const finalMat = makeMat(FINAL_FRAG, {
      uScene: { value: scene.texture },
      uBloom: { value: up[0].texture },
      uBloomStrength: { value: 0.6 },
      uVignette: { value: 0.35 },
      uExposure: { value: 1 },
      uGrain: { value: 0.015 },
      uFrame: { value: 0 },
      uLift: { value: new THREE.Vector3() },
      uSat: { value: 1 },
      uCA: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
    });
    return { scene, down, up, quadScene, quadCam, quad, downMat, upMat, finalMat };
  }, [w, h]);

  useEffect(() => {
    return () => {
      res.scene.dispose();
      res.down.forEach((r) => r.dispose());
      res.up.forEach((r) => r.dispose());
    };
  }, [res]);

  // per-frame uniforms, from the frame prop only
  res.finalMat.uniforms.uBloomStrength.value = bloomStrength;
  res.finalMat.uniforms.uVignette.value = vignette;
  res.finalMat.uniforms.uExposure.value = exposure;
  res.finalMat.uniforms.uGrain.value = grain;
  res.finalMat.uniforms.uFrame.value = ((frame % period) + period) % period;
  res.finalMat.uniforms.uLift.value.set(lift[0], lift[1], lift[2]);
  res.finalMat.uniforms.uSat.value = saturation;
  res.finalMat.uniforms.uCA.value = chroma * (h / 2160);
  res.downMat.uniforms.uThreshold.value = bloomThreshold;
  const bg = useMemo(() => new THREE.Color(background), [background]);

  useFrame(({ scene, camera }) => {
    // keep resolution-dependent uniforms (DoF px, point sizes) in sync
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m && (m as THREE.ShaderMaterial).isShaderMaterial) setResUniforms(m, w, h);
    });
    gl.autoClear = true;
    gl.setClearColor(bg, 1);
    gl.setRenderTarget(res.scene);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    // bloom: down chain
    let src: THREE.Texture = res.scene.texture;
    let sw = w;
    let sh = h;
    res.quad.material = res.downMat;
    for (let i = 0; i < LEVELS; i++) {
      res.downMat.uniforms.uSrc.value = src;
      res.downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      res.downMat.uniforms.uThreshold.value = i === 0 ? bloomThreshold : 0;
      gl.setRenderTarget(res.down[i]);
      gl.render(res.quadScene, res.quadCam);
      src = res.down[i].texture;
      sw = res.down[i].width;
      sh = res.down[i].height;
    }
    // up chain: up[L-1] = down[L-1]; up[i] = blur(up[i+1]) + down[i]
    res.quad.material = res.upMat;
    let low: THREE.Texture = res.down[LEVELS - 1].texture;
    let lowW = res.down[LEVELS - 1].width;
    let lowH = res.down[LEVELS - 1].height;
    for (let i = LEVELS - 2; i >= 0; i--) {
      res.upMat.uniforms.uLow.value = low;
      res.upMat.uniforms.uHigh.value = res.down[i].texture;
      res.upMat.uniforms.uTexel.value.set(1 / lowW, 1 / lowH);
      res.upMat.uniforms.uMixHigh.value = 1;
      gl.setRenderTarget(res.up[i]);
      gl.render(res.quadScene, res.quadCam);
      low = res.up[i].texture;
      lowW = res.up[i].width;
      lowH = res.up[i].height;
    }
    res.finalMat.uniforms.uBloom.value = res.up[0].texture;
    res.quad.material = res.finalMat;
    gl.setRenderTarget(null);
    gl.render(res.quadScene, res.quadCam);
  }, 1);

  return null;
};
