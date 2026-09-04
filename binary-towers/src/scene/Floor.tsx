import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Palette } from "./palette";

const VERT = /* glsl */ `
varying vec2 vWorld;
varying float vDepth;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xz;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/**
 * Dark glossy plane with a fine grid that converges to the vanishing point.
 * It is deliberately translucent: the mirrored tower meshes are drawn beneath
 * it, so the floor's own dark base is what dims the reflections.
 */
const FRAG = /* glsl */ `
precision highp float;

uniform vec3 baseColor;
uniform vec3 gridColor;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float baseAlpha;

varying vec2 vWorld;
varying float vDepth;

/**
 * Analytic grid: the line half-width grows with depth so a line stays roughly
 * two pixels wide all the way to the vanishing point. Derivative-based widths
 * collapse at the grazing angles this camera sits at.
 */
float gridMask(vec2 p, float scale, float baseWidth, float growth) {
  vec2 c = p / scale;
  vec2 d = abs(fract(c - 0.5) - 0.5);
  float w = max(baseWidth, vDepth * growth);
  return 1.0 - smoothstep(0.0, w, min(d.x, d.y));
}

void main() {
  float fine = gridMask(vWorld, 2.0, 0.004, 0.0004) * 0.55;
  float major = gridMask(vWorld, 16.0, 0.0007, 0.00007);
  float mask = clamp(fine + major, 0.0, 1.0);

  float f = clamp(1.0 - exp(-pow(fogDensity * vDepth, 2.0)), 0.0, 1.0);

  // A broad sheen close to the camera: the floor reads as polished rather than
  // as a flat matte card.
  float sheen = exp(-vDepth / 16.0) * 0.3;
  vec3 rgb = mix(baseColor * (1.0 + sheen), gridColor * (1.0 + major * 0.5), mask);
  rgb = mix(rgb, fogColor, f * 0.85);

  // Fades out with distance rather than turning opaque: an opaque far floor
  // meeting the backdrop would draw exactly the horizon line we do not want.
  float a = (baseAlpha + mask * 0.4) * (1.0 - f);

  gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0));
}
`;

export const Floor: React.FC<{ palette: Palette }> = ({ palette }) => {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        baseColor: { value: new THREE.Color(palette.floorBase) },
        gridColor: { value: new THREE.Color(palette.floorGrid) },
        fogColor: { value: new THREE.Color(palette.fog) },
        fogDensity: { value: palette.fogDensity },
        baseAlpha: { value: palette.floorAlpha },
      },
    });
  }, [palette]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} renderOrder={8}>
      <planeGeometry args={[700, 700]} />
    </mesh>
  );
};
