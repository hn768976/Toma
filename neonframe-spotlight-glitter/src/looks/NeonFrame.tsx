import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useFrame } from "@react-three/fiber";
import {
  GLSL_GRAIN,
  loopFrame,
  LOOP_FRAMES,
  useBackingScale,
} from "../common";
import type { NeonFrameColorway } from "../colorways";

const vert = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uLoopFrame;
uniform float uLoopLen;
uniform vec3 uRamp[8];
uniform vec3 uRamp2[8];
uniform int uCount;
uniform int uCount2;
uniform vec3 uHazeA;
uniform vec3 uHazeB;
uniform vec3 uInner;
uniform float uGrain;
${GLSL_GRAIN}

const float TAU = 6.28318530718;

// cyclic colour ramp over uCount stops (<= 8), smooth blend between stops
vec3 ramp(float u, vec3 s[8], int count) {
  float x = fract(u) * float(count);
  int i = int(floor(x));
  float f = x - float(i);
  f = f * f * (3.0 - 2.0 * f);
  return mix(s[i], s[(i + 1) % count], f);
}

// smooth maximum (removes the diagonal crease of a plain box distance)
float smax(float a, float b, float k) {
  float m = max(a, b);
  return m + k * log(exp((a - m) / k) + exp((b - m) / k));
}

// signed distance to a rounded rectangle (negative inside), creaseless inside
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(smax(q.x, q.y, 0.05) - 0.05 * 0.6931, 0.0) - r;
}

// 0..1 position around the frame: angle in a (half-)stretched space, so iso-lines
// are smooth radial lines (no creases) and each edge gets a comparable share.
float around(vec2 q, vec2 b) {
  float k = sqrt(b.x / b.y);
  return fract(atan(q.y / b.y, q.x / (b.x / k)) / TAU);
}

float softplus(float x, float k) { return k * log(1.0 + exp(x / k)); }

void main() {
  float lf = uLoopFrame;
  float ph = lf / uLoopLen;                 // 0..1 over the loop
  float aspect = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy / uRes - 0.5) * vec2(aspect, 1.0);   // height units, y up

  float inset = 0.035;
  vec2 hb = vec2(aspect * 0.5 - inset, 0.5 - inset);
  float radius = 0.14;
  float d = sdRoundRect(p, hb, radius);      // <0 inside the dark rectangle

  float t = around(p, hb);

  // --- brightness around the frame: sum of sinusoids with integer spatial and
  // temporal frequencies => smooth, and exactly periodic in space and in the loop.
  float n = 0.0;
  n += 0.50 * sin(TAU * (3.0 * t + 1.0 * ph) + 1.3);
  n += 0.40 * sin(TAU * (5.0 * t - 2.0 * ph) + 4.1);
  n += 0.30 * sin(TAU * (2.0 * t + 3.0 * ph) + 0.7);
  n += 0.18 * sin(TAU * (8.0 * t + 4.0 * ph) + 2.2);
  float B = smoothstep(-0.95, 0.85, n);
  B = 0.45 + 0.55 * B;

  // --- glow profile: one smooth function of the distance inside the dark rectangle.
  // softplus keeps it flat (bright) out to the frame edge, with no visible outline.
  float e = softplus(-d, 0.012);
  float g = 0.78 * exp(-e / 0.016) + 0.48 * exp(-(e * e) / (2.0 * 0.034 * 0.034))
          + 0.20 * exp(-e / 0.065) + 0.05 * exp(-e / 0.16);

  // --- colour field: two counter-rotating ramps (whole turns per loop)
  vec3 c1 = ramp(2.0 * t + 2.0 * ph, uRamp, uCount);
  vec3 c2 = ramp(1.0 * t - 1.0 * ph + 0.35, uRamp2, uCount2);
  vec3 col = mix(c1, c2, 0.10);

  float I = g * B;
  vec3 light = col * I;

  // pale haze: where the glow is strongest, and towards the frame boundary
  float edgeDist = min(0.5 * aspect - abs(p.x), 0.5 - abs(p.y));   // distance to frame edge
  float frameHaze = exp(-edgeDist / 0.012);
  float strong = smoothstep(1.5, 2.6, I);
  float haze = clamp(strong * 0.30 + frameHaze * (0.02 + 0.30 * B * B) * smoothstep(0.3, 1.2, I), 0.0, 1.0);
  vec3 hazeCol = mix(uHazeA, uHazeB, smoothstep(0.5, 1.0, haze));
  light = mix(light, hazeCol * (0.30 + 0.70 * min(I, 1.3)), haze * 0.5);

  // soft tone-map towards white at highlights
  vec3 mapped = 1.0 - exp(-light * 1.45);
  mapped = mix(vec3(dot(mapped, vec3(0.299, 0.587, 0.114))), mapped, 1.18);   // keep it saturated, not pastel
  vec3 outc = uInner + mapped * (1.0 - uInner);

  outc = ditherGrain(outc, gl_FragCoord.xy, lf, uGrain);
  gl_FragColor = vec4(outc, 1.0);
}
`;

// display-referred sRGB values, no colour-space conversion
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const toVec3 = (hex: string) => new THREE.Vector3(...hexToRgb(hex));

const pad8 = (hexes: string[]) =>
  Array.from({ length: 8 }, (_, i) => toVec3(hexes[Math.min(i, hexes.length - 1)]));

const Scene: React.FC<{ colorway: NeonFrameColorway; grain: number }> = ({
  colorway,
  grain,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = useBackingScale();
  // Constant uniforms (colours); the animated ones are written in useFrame below.
  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uLoopFrame: { value: 0 },
      uLoopLen: { value: LOOP_FRAMES },
      uRamp: { value: pad8(colorway.ramp) },
      uRamp2: { value: pad8(colorway.ramp2) },
      uCount: { value: colorway.ramp.length },
      uCount2: { value: colorway.ramp2.length },
      uHazeA: { value: toVec3(colorway.hazeA) },
      uHazeB: { value: toVec3(colorway.hazeB) },
      uInner: { value: toVec3(colorway.inner) },
      uGrain: { value: grain },
    }),
    [colorway, grain],
  );
  // R3F clones the uniforms object given to <shaderMaterial>, so values must be written
  // through the material itself, every frame, from the frame number only.
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => {
    const u = matRef.current!.uniforms;
    u.uLoopFrame.value = loopFrame(frame);
    u.uRes.value.set(Math.round(width * scale), Math.round(height * scale));
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

export const NeonFrame: React.FC<{
  colorway: NeonFrameColorway;
  grain?: number;
}> = ({ colorway, grain = 0.015 }) => {
  const { width, height } = useVideoConfig();
  const scale = useBackingScale();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={scale}
      flat
      gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false }}
    >
      <Scene colorway={colorway} grain={grain} />
    </ThreeCanvas>
  );
};
