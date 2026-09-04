import { useMemo } from "react";
import * as THREE from "three";
import { getCircuitTexture } from "../lib/circuit";
import { hexToRgb } from "../lib/color";
import type { Palette } from "../palettes";

/**
 * The circuit-board ground plane.
 *
 * All the detail lives in the fragment shader: the tile is sampled twice, at
 * two scales and rotations, so the repeat never reads as a repeat; a low
 * frequency noise field makes the routing dense in places and sparse in
 * others; and the build-on is a radial wavefront rather than a fade, with each
 * trace's own random offset staggering when it catches light.
 *
 * Blended additively over the background gradient, so unlit board contributes
 * nothing and the plane simply dissolves into darkness toward the horizon —
 * there is no horizon line to hide.
 */
const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTrace;
uniform vec3 uUnlit;
uniform vec3 uCore;
uniform float uReveal;
uniform float uPulseT;
uniform float uShimmer;
uniform float uCoreGlow;
uniform float uMaster;
uniform float uFadeNear;
uniform float uFadeFar;

varying vec3 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 p = vWorld.xz;
  float dist = length(p);

  vec4 s1 = texture2D(uMap, p * 0.145);
  float ca = cos(0.83);
  float sa = sin(0.83);
  vec2 p2 = mat2(ca, -sa, sa, ca) * p;
  vec4 s2 = texture2D(uMap, p2 * 0.058 + vec2(0.37, 0.62));

  float density = vnoise(p * 0.052) * 0.75 + vnoise(p * 0.0155) * 0.55;
  density = smoothstep(0.2, 0.86, density);

  float inkA = s1.r * mix(0.34, 1.05, density);
  float inkB = s2.r * mix(0.18, 0.9, density);
  float ink = clamp(inkA + inkB, 0.0, 1.4);

  // Build-on: a wavefront travelling out from the centre, with a per-trace
  // offset so nearby traces don't all catch light on the same frame.
  float stagger = (s1.b - 0.5) * 5.0;
  float lit = 1.0 - smoothstep(uReveal + stagger - 5.0, uReveal + stagger, dist);

  // Slow, per-trace shimmer so the board never sits perfectly still.
  float shimmer = 0.72 + 0.28 * sin(uShimmer + s1.b * 47.0);

  vec3 col = mix(uUnlit, uTrace, lit * shimmer) * ink;

  // Travelling pulses. Only traces with a non-zero carrier phase take part.
  float carrier = step(0.004, s1.g);
  float pos = fract(uPulseT + s1.g);
  float dd = abs(fract(s1.b - pos + 0.5) - 0.5);
  float pulse = carrier * (1.0 - smoothstep(0.0, 0.05, dd)) * lit * inkA;
  col += uCore * pulse * 2.6;

  // The core casts a pool of light across the board.
  float pool = exp(-dist * 0.135);
  col += uCore * uCoreGlow * pool * (0.05 + ink * 0.5);

  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
  gl_FragColor = vec4(col * fade * uMaster, 1.0);
}
`;

export const CircuitPlane: React.FC<{
  palette: Palette;
  reveal: number;
  pulseT: number;
  shimmer: number;
  coreGlow: number;
  master: number;
}> = ({ palette, reveal, pulseT, shimmer, coreGlow, master }) => {
  const material = useMemo(() => {
    const trace = hexToRgb(palette.trace);
    const unlit = hexToRgb(palette.traceUnlit);
    const core = hexToRgb(palette.core);
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: getCircuitTexture() },
        uTrace: { value: new THREE.Vector3(trace.r, trace.g, trace.b) },
        uUnlit: { value: new THREE.Vector3(unlit.r, unlit.g, unlit.b) },
        uCore: { value: new THREE.Vector3(core.r, core.g, core.b) },
        uReveal: { value: 0 },
        uPulseT: { value: 0 },
        uShimmer: { value: 0 },
        uCoreGlow: { value: 0 },
        uMaster: { value: 0 },
        uFadeNear: { value: 12 },
        uFadeFar: { value: 31 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }, [palette]);

  material.uniforms.uReveal.value = reveal;
  material.uniforms.uPulseT.value = pulseT;
  material.uniforms.uShimmer.value = shimmer;
  material.uniforms.uCoreGlow.value = coreGlow;
  material.uniforms.uMaster.value = master * palette.boardGain;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[300, 300, 1, 1]} />
    </mesh>
  );
};
