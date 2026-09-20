/**
 * Additive glow decals.
 *
 * A neon strip is a continuous line source. Approximating it with a handful
 * of point lights puts a row of discrete hotspots on every nearby surface -
 * obvious the moment you look at the floor - and enough lights to smooth that
 * out is not affordable on a software rasteriser. These are the spill instead:
 * analytic falloffs, additive, no lighting cost, no hotspots.
 *
 * They contribute nothing to shading, so they are used only where the source
 * is already emissive and what is missing is its spill.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Ring-shaped pool, for the light a plinth's edge strips throw on the floor. */
const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uPeak;
uniform float uWidth;
uniform float uHaze;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  // vUv is 0..1 across the quad; remap so the centre is the plinth's axis.
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);

  // A bright band just outside the plinth's edge, plus a broad haze that
  // carries further out.
  float band = exp(-pow((r - uPeak) / uWidth, 2.0));
  float haze = exp(-r / uHaze) * 0.45;
  float falloff = 1.0 - smoothstep(0.85, 1.0, r);

  gl_FragColor = vec4(uColor * (band + haze) * uIntensity * falloff, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** One-sided falloff, for the wash a wall-foot strip throws up a wall. */
const stripFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uHeight;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  float up = exp(-vUv.y / uHeight);
  // Fade the ends so the quad's edges never show.
  float ends = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
  gl_FragColor = vec4(uColor * up * ends * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const useGlowMaterial = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        // Additive spill should not be occluded by the surface it lies on,
        // but must still sit behind anything in front of it.
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    // Uniform objects are stable; only the shader identity matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fragmentShader],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
};

export const RingGlow: React.FC<{
  color: string;
  /** Quad half-extent in world units. */
  extent: number;
  /** Where the bright band sits, as a fraction of `extent`. */
  peak: number;
  width: number;
  haze: number;
  intensity: number;
  position: [number, number, number];
}> = ({ color, extent, peak, width, haze, intensity, position }) => {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uPeak: { value: peak },
      uWidth: { value: width },
      uHaze: { value: haze },
      uIntensity: { value: intensity },
    }),
    [color, peak, width, haze, intensity],
  );
  const material = useGlowMaterial(ringFragment, uniforms);
  material.uniforms = uniforms;

  return (
    <mesh material={material} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[extent * 2, extent * 2]} />
    </mesh>
  );
};

export const StripGlow: React.FC<{
  color: string;
  width: number;
  height: number;
  /** Falloff height as a fraction of the quad. */
  falloff: number;
  intensity: number;
  position: [number, number, number];
}> = ({ color, width, height, falloff, intensity, position }) => {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uHeight: { value: falloff },
      uIntensity: { value: intensity },
    }),
    [color, falloff, intensity],
  );
  const material = useGlowMaterial(stripFragment, uniforms);
  material.uniforms = uniforms;

  return (
    <mesh material={material} position={position}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
};
