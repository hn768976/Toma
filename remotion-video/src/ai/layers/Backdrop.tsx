// Full-frame background gradient, drawn inside the WebGL scene.
//
// The background deliberately does NOT come from gl.setClearColor: that path
// runs the colour through three's colour-management plumbing and, in this
// renderer configuration, lands a #020818 clear as #00204e on screen. A value
// written straight out of a fragment shader round-trips exactly (verified with
// src/ai/AiProbe.tsx), so the backdrop is painted by one screen-space quad and
// the clear colour is left at pure black, which cannot drift.
//
// Drawing it in-scene also means it is behind everything the bloom pass sees,
// so the references' centre-lit falloff comes for free.

import React, { useMemo } from "react";
import * as THREE from "three";

export type BackdropProps = {
  /** Colour at the centre of the glow. */
  inner: string;
  /** Colour at the edges of the frame. */
  outer: string;
  /** Centre of the radial falloff, in -1..1 screen space. */
  focus?: [number, number];
  /** Radius of the falloff, in screen heights. */
  radius?: number;
  /** How strongly the corners are darkened beyond `outer`. */
  vignette?: number;
  /** Aspect ratio, so the falloff stays circular rather than stretched. */
  aspect: number;
  /** Strength of the fine dither that keeps wide gradients from banding. */
  dither?: number;
};

const hexToVec = (hex: string) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return new THREE.Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
};

const VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy * 2.0;
    // Bypass the camera entirely: the quad is placed straight in clip space at
    // the far plane, so it fills the frame whatever the version's camera does.
    gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uInner;
  uniform vec3  uOuter;
  uniform vec2  uFocus;
  uniform float uRadius;
  uniform float uVignette;
  uniform float uAspect;
  uniform float uDither;
  varying vec2 vNdc;

  void main() {
    vec2 p = vNdc - uFocus;
    p.x *= uAspect;
    float d = length(p) / max(uRadius, 0.001);

    vec3 colour = mix(uInner, uOuter, smoothstep(0.0, 1.0, d));
    colour *= 1.0 - uVignette * smoothstep(0.55, 1.65, length(vec2(vNdc.x * uAspect, vNdc.y)));

    // Ordered-ish dither. Wide, very dark gradients band badly in 8-bit
    // output; a sub-LSB jitter costs nothing and removes the rings.
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    colour += (n - 0.5) * uDither;

    gl_FragColor = vec4(max(colour, 0.0), 1.0);
  }
`;

export const Backdrop: React.FC<BackdropProps> = ({
  inner,
  outer,
  focus = [0, 0],
  radius = 1.15,
  vignette = 0.35,
  aspect,
  dither = 0.006,
}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uInner: { value: new THREE.Vector3() },
          uOuter: { value: new THREE.Vector3() },
          uFocus: { value: new THREE.Vector2() },
          uRadius: { value: 1.15 },
          uVignette: { value: 0.35 },
          uAspect: { value: 1 },
          uDither: { value: 0.006 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uInner.value.copy(hexToVec(inner));
  u.uOuter.value.copy(hexToVec(outer));
  u.uFocus.value.set(focus[0], focus[1]);
  u.uRadius.value = radius;
  u.uVignette.value = vignette;
  u.uAspect.value = aspect;
  u.uDither.value = dither;

  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
};
