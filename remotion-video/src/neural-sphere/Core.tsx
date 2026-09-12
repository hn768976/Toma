import React, { useMemo } from "react";
import * as THREE from "three";
import type { Palette } from "./palettes";

/**
 * Billboarding: the quad is positioned entirely from the object's origin
 * in view space, so it always faces the camera at a fixed world size.
 */
const billboardVertex = /* glsl */ `
uniform float uScale;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 origin = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  origin.xy += position.xy * uScale;
  gl_Position = projectionMatrix * origin;
}
`;

/** Soft radial bloom — the halo bleeding off the core. */
const haloFragment = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uIntensity;
uniform float uFalloff;

varying vec2 vUv;

void main() {
  float r = length(vUv * 2.0 - 1.0);
  if (r > 1.0) discard;
  float a = exp(-r * r * uFalloff) * uIntensity;
  // Trim the very edge so the quad's boundary never shows.
  a *= 1.0 - smoothstep(0.85, 1.0, r);
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

/** The blown-out white ball at the centre. */
const coreFragment = /* glsl */ `
precision highp float;

uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uIntensity;
uniform float uTime;

varying vec2 vUv;

void main() {
  float r = length(vUv * 2.0 - 1.0);
  if (r > 1.0) discard;

  // Flat, fully saturated disc out to ~0.55 of the radius, then a fast
  // roll-off — that's what reads as "overexposed" rather than as a
  // gradient blob.
  float breath = 1.0 + 0.035 * sin(uTime * 1.1);
  float rr = r / breath;
  float disc = 1.0 - smoothstep(0.42, 0.92, rr);
  float rim = exp(-rr * rr * 4.5) * 0.6;

  float a = (disc + rim) * uIntensity;
  vec3 color = mix(uColorOuter, uColorInner, clamp(disc, 0.0, 1.0));
  gl_FragColor = vec4(color * a, 1.0);
}
`;

/** Fine star-burst spikes radiating off the core. */
const raysFragment = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;

varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;

  float angle = atan(p.y, p.x);
  float spin = uTime * 0.06;

  // Three overlapping spike frequencies keep the burst from looking
  // mechanically regular.
  float spikes =
      pow(abs(sin(angle * 19.0 + spin * 3.1)), 24.0) * 0.55
    + pow(abs(sin(angle * 11.0 - spin * 2.2 + 1.7)), 16.0) * 0.45
    + pow(abs(sin(angle * 5.0 + spin * 1.3 + 0.6)), 9.0) * 0.32;

  float radial = exp(-r * 4.2) * (1.0 - smoothstep(0.7, 1.0, r));
  float a = spikes * radial * uIntensity;

  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

const useBillboardMaterial = (
  fragmentShader: string,
  extraUniforms: Record<string, THREE.IUniform>,
) =>
  useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: billboardVertex,
        fragmentShader,
        uniforms: {
          uScale: { value: 1 },
          uIntensity: { value: 1 },
          ...extraUniforms,
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

type Props = {
  palette: Palette;
  time: number;
  radius: number;
  intensity: number;
};

/**
 * The core is drawn as a stack of additive camera-facing quads rather than
 * with a post-process bloom pass: it renders identically on every worker,
 * costs almost nothing, and gives direct control over the disc / halo /
 * spike balance that defines the look.
 */
export const Core: React.FC<Props> = ({ palette, time, radius, intensity }) => {
  const quad = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const coreMat = useBillboardMaterial(coreFragment, {
    uColorInner: { value: new THREE.Color() },
    uColorOuter: { value: new THREE.Color() },
    uTime: { value: 0 },
  });
  const innerHaloMat = useBillboardMaterial(haloFragment, {
    uColor: { value: new THREE.Color() },
    uFalloff: { value: 7.0 },
  });
  const outerHaloMat = useBillboardMaterial(haloFragment, {
    uColor: { value: new THREE.Color() },
    uFalloff: { value: 3.1 },
  });
  const wideHaloMat = useBillboardMaterial(haloFragment, {
    uColor: { value: new THREE.Color() },
    uFalloff: { value: 1.6 },
  });
  const raysMat = useBillboardMaterial(raysFragment, {
    uColor: { value: new THREE.Color() },
    uTime: { value: 0 },
  });

  coreMat.uniforms.uScale.value = radius * 1.14;
  coreMat.uniforms.uIntensity.value = 1.30 * intensity;
  coreMat.uniforms.uColorInner.value.setRGB(...palette.coreInner);
  coreMat.uniforms.uColorOuter.value.setRGB(...palette.coreOuter);
  coreMat.uniforms.uTime.value = time;

  innerHaloMat.uniforms.uScale.value = radius * 3.0;
  innerHaloMat.uniforms.uIntensity.value = 0.78 * intensity;
  innerHaloMat.uniforms.uColor.value.setRGB(...palette.coreOuter);

  outerHaloMat.uniforms.uScale.value = radius * 6.4;
  outerHaloMat.uniforms.uIntensity.value = 0.30 * intensity;
  outerHaloMat.uniforms.uColor.value.setRGB(...palette.coreHalo);

  wideHaloMat.uniforms.uScale.value = radius * 24.0;
  wideHaloMat.uniforms.uIntensity.value = 0.21 * intensity;
  wideHaloMat.uniforms.uColor.value.setRGB(...palette.coreHalo);

  raysMat.uniforms.uScale.value = radius * 12.0;
  raysMat.uniforms.uIntensity.value = 0.40 * intensity;
  raysMat.uniforms.uColor.value.setRGB(...palette.rays);
  raysMat.uniforms.uTime.value = time;

  return (
    <group>
      <mesh geometry={quad} material={wideHaloMat} frustumCulled={false} renderOrder={10} />
      <mesh geometry={quad} material={outerHaloMat} frustumCulled={false} renderOrder={11} />
      <mesh geometry={quad} material={raysMat} frustumCulled={false} renderOrder={12} />
      <mesh geometry={quad} material={innerHaloMat} frustumCulled={false} renderOrder={13} />
      <mesh geometry={quad} material={coreMat} frustumCulled={false} renderOrder={14} />
    </group>
  );
};
