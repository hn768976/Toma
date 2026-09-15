// Perspective wireframe floor.
//
// Two references stand the hero over a lit grid that runs off to a horizon.
// Drawing it as a shader on one large plane rather than as line geometry keeps
// the lines a constant screen width all the way into the distance and lets them
// fade out before they alias into moire, which is what a tessellated grid does
// at the horizon.

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { toRgb } from "../palette";

export type GridFloorProps = {
  colour: string;
  /** Colour of the concentric rings pulsing out from the origin. */
  ringColour?: string;
  /** Size of the plane, in world units. */
  size?: number;
  /** Grid spacing, in world units. */
  pitch?: number;
  /** Line half-width, as a fraction of the pitch. */
  lineWidth?: number;
  /** Units per second the grid scrolls toward the camera. */
  scroll?: number;
  /** Distance at which the grid has fully faded out. */
  fadeDistance?: number;
  brightness?: number;
  /** Strength of the rings radiating from the origin. 0 disables them. */
  rings?: number;
  /** Seconds per ring cycle. */
  ringPeriod?: number;
  opacity?: number;
  position?: [number, number, number];
};

const VERT = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColour;
  uniform vec3  uRingColour;
  uniform float uPitch;
  uniform float uLineWidth;
  uniform float uScroll;
  uniform float uTime;
  uniform float uFade;
  uniform float uBrightness;
  uniform float uRings;
  uniform float uRingPeriod;
  uniform float uOpacity;
  varying vec2 vLocal;

  // Screen-space-ish line: divide the distance to the nearest gridline by the
  // rate the coordinate changes per pixel, so the stroke stays one width in the
  // distance instead of collapsing into aliasing.
  float gridLine(float coord, float pitch, float width) {
    float g = abs(fract(coord / pitch - 0.5) - 0.5) * pitch;
    float w = fwidth(coord) * width;
    return 1.0 - smoothstep(0.0, max(w, 1e-5), g);
  }

  void main() {
    float y = vLocal.y + uTime * uScroll;
    float lines = max(
      gridLine(vLocal.x, uPitch, uLineWidth),
      gridLine(y, uPitch, uLineWidth)
    );

    float dist = length(vLocal);
    float fade = 1.0 - smoothstep(uFade * 0.25, uFade, dist);

    float energy = lines * uBrightness * fade;
    vec3 colour = uColour;

    if (uRings > 0.0) {
      // Rings expand from the origin and fade as they go, like a sonar ping.
      float phase = fract(uTime / uRingPeriod);
      float ringDist = dist - phase * uFade;
      float ring = exp(-pow(ringDist * 1.6, 2.0));
      float ring2 = exp(-pow((ringDist + uFade * 0.5) * 1.6, 2.0));
      float r = (ring + ring2 * 0.6) * uRings * fade;
      colour = mix(colour, uRingColour, clamp(r, 0.0, 1.0));
      energy += r;
    }

    float alpha = clamp(energy, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(colour * energy * uOpacity, alpha);
  }
`;

export const GridFloor: React.FC<GridFloorProps> = ({
  colour,
  ringColour,
  size = 60,
  pitch = 0.9,
  lineWidth = 1.1,
  scroll = 0.35,
  fadeDistance = 22,
  brightness = 0.85,
  rings = 0,
  ringPeriod = 6,
  opacity = 1,
  position = [0, -2, 0],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColour: { value: new THREE.Vector3() },
          uRingColour: { value: new THREE.Vector3() },
          uPitch: { value: 0.9 },
          uLineWidth: { value: 1.1 },
          uScroll: { value: 0.35 },
          uTime: { value: 0 },
          uFade: { value: 22 },
          uBrightness: { value: 0.85 },
          uRings: { value: 0 },
          uRingPeriod: { value: 6 },
          uOpacity: { value: 1 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uColour.value.set(...toRgb(colour));
  u.uRingColour.value.set(...toRgb(ringColour ?? colour));
  u.uPitch.value = pitch;
  u.uLineWidth.value = lineWidth;
  u.uScroll.value = scroll;
  u.uTime.value = frame / fps;
  u.uFade.value = fadeDistance;
  u.uBrightness.value = brightness;
  u.uRings.value = rings;
  u.uRingPeriod.value = ringPeriod;
  u.uOpacity.value = opacity;

  return (
    <mesh
      material={material}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[size, size]} />
    </mesh>
  );
};
