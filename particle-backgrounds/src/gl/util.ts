import * as THREE from "three";

// Colours are authored as display (sRGB) values and blended in that space;
// disable three's automatic sRGB->linear conversion of hex inputs.
THREE.ColorManagement.enabled = false;

export const vec3Of = (hex: string) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

/** Projection scale in 4K px: 0.5 * 2160 / tan(fov/2). */
export const projScale = (fovDeg: number) => (0.5 * 2160) / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);

export const additive = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  glslVersion: THREE.GLSL3,
} as const;

/** Uniforms every DOF particle material uses. */
export const dofUniforms = (fovDeg: number, focus: number, aperture: number, maxCoc = 260, bokehPow = 1) => ({
  uPxScale: { value: 1 / 3 },
  uFocus: { value: focus },
  uAperture: { value: aperture },
  uMaxCoc: { value: maxCoc },
  uProj: { value: projScale(fovDeg) },
  uPhase: { value: 0 },
  uBokehPow: { value: bokehPow },
});
