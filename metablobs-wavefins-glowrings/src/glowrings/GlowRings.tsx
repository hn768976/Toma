import React, { useCallback } from "react";
import * as THREE from "three";
import { hexToLinear } from "../common/color";
import { FullscreenPass, passMaterial } from "../common/gl";
import { NOISE_GLSL } from "../common/glsl";
import { FrameRenderer, Stage } from "../common/Stage";
import { LOOP_FRAMES, loopPhase } from "../common/constants";

export type GlowRingsProps = {
  ring: string; // main ring colour
  tint: string; // inner chromatic tint
  background: string;
  grain: number; // fraction of full scale (0.025 = 2.5 %)
};

const FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform float uPhase;     // 0..1 over the 600-frame loop
uniform int uFrameMod;
uniform vec3 uRing;
uniform vec3 uTint;
uniform vec3 uBg;
uniform float uGrain;
${NOISE_GLSL}

const float TAU = 6.28318530718;
const int RINGS = 6;

// Smooth 3D value noise from an integer hash: deterministic everywhere.
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec3 b = ivec3(i) + 4096;
  float n000 = hash33u(uvec3(b)).x;
  float n100 = hash33u(uvec3(b + ivec3(1, 0, 0))).x;
  float n010 = hash33u(uvec3(b + ivec3(0, 1, 0))).x;
  float n110 = hash33u(uvec3(b + ivec3(1, 1, 0))).x;
  float n001 = hash33u(uvec3(b + ivec3(0, 0, 1))).x;
  float n101 = hash33u(uvec3(b + ivec3(1, 0, 1))).x;
  float n011 = hash33u(uvec3(b + ivec3(0, 1, 1))).x;
  float n111 = hash33u(uvec3(b + ivec3(1, 1, 1))).x;
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

// Brightness along the arc. The angle enters through (cos, sin) and time through
// a circle, so the pattern is periodic in both and loops seamlessly.
float arcBrightness(float ang, float id) {
  float tp = uPhase * TAU;
  float a = ang + tp;                    // bright stretches slide one turn per loop
  vec3 p = vec3(cos(a), sin(a), 0.0) * 0.85;
  p += vec3(cos(tp) * 0.9, sin(tp) * 0.9, id * 3.71 + 11.0);
  float n = vnoise(p) * 0.8 + vnoise(p * 2.03 + 5.2) * 0.2;
  return 0.02 + 1.35 * smoothstep(0.38, 0.78, n);
}

void main() {
  float H = uRes.y;
  // Frame-height units, y pointing down from the top edge.
  vec2 q = vec2(gl_FragCoord.x / H, (uRes.y - gl_FragCoord.y) / H);
  float aspect = uRes.x / uRes.y;
  float tp = uPhase * TAU;
  vec2 c = vec2(0.5 * aspect, -0.25) + vec2(0.035 * sin(tp), 0.02 * sin(2.0 * tp + 0.7));
  vec2 d = q - c;
  float r = length(d);
  float ang = atan(d.x, d.y); // 0 straight down

  vec3 col = uBg;
  for (int i = 0; i < RINGS; i++) {
    float life = fract(uPhase + float(i) / float(RINGS));
    float R = mix(0.20, 1.60, pow(life, 1.12));
    float fade = smoothstep(0.1, 0.35, life) * (1.0 - smoothstep(0.52, 0.82, life));
    float sigma = mix(0.042, 0.075, life);          // widens with growth: more defocus
    vec2 dc = q - (c + vec2(0.09 * sin(float(i) * 2.17 + 0.6), 0.03 * cos(float(i) * 1.37)));
    float r = length(dc);
    float x = (r - R) / sigma;
    float core = exp(-0.5 * x * x);
    float xh = (r - R) / (sigma * 3.2);
    float halo = exp(-0.5 * xh * xh) * 0.05;
    float b = arcBrightness(atan(dc.x, dc.y), float(i));
    col += uRing * (core + halo) * b * fade * 0.095;
    // secondary tint: smaller, dimmer copy shifted inward
    float Rt = R - sigma * 0.9;
    float xt = (r - Rt) / (sigma * 0.8);
    float bt = arcBrightness(atan(dc.x, dc.y) + 0.6, float(i) + 0.5);
    col += uTint * exp(-0.5 * xt * xt) * bt * fade * 0.095 * 0.25;
  }
  // faint breathing centre glow at the top
  vec2 gc = vec2(0.5 * aspect + 0.03 * sin(tp + 1.3), 0.06);
  float gd = length((q - gc) * vec2(0.75, 1.0));
  col += uRing * exp(-gd * gd / (2.0 * 0.085 * 0.085)) * 0.30 * (1.0 + 0.2 * sin(tp));
  // faint tint haze beside the hot spot
  vec2 hc = vec2(0.42 * aspect + 0.04 * sin(tp + 2.0), -0.02);
  float hd = length(q - hc);
  col += uTint * exp(-hd * hd / (2.0 * 0.14 * 0.14)) * 0.05;
  // slight vignette
  vec2 vq = q / vec2(aspect, 1.0) - 0.5;
  col *= 1.0 - 0.55 * smoothstep(0.2, 0.75, length(vq));

  vec3 srgb = linearToSrgb(col);
  srgb = grainAndDither(srgb, uGrain, 0.0, uFrameMod);
  outColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

class GlowRingsRenderer implements FrameRenderer {
  private pass = new FullscreenPass();
  private mat: THREE.RawShaderMaterial;
  constructor(p: GlowRingsProps) {
    this.mat = passMaterial(FRAG, {
      uRes: { value: new THREE.Vector2() },
      uPhase: { value: 0 },
      uFrameMod: { value: 0 },
      uRing: { value: hexToLinear(p.ring) },
      uTint: { value: hexToLinear(p.tint) },
      uBg: { value: hexToLinear(p.background) },
      uGrain: { value: p.grain },
    });
  }
  render(gl: THREE.WebGLRenderer, frame: number, w: number, h: number) {
    const u = this.mat.uniforms;
    u.uRes.value.set(w, h);
    u.uPhase.value = loopPhase(frame);
    u.uFrameMod.value = frame % LOOP_FRAMES;
    this.pass.render(gl, this.mat, null);
  }
  dispose() {
    this.mat.dispose();
    this.pass.dispose();
  }
}

export const GlowRings: React.FC<GlowRingsProps> = (props) => {
  const create = useCallback(() => new GlowRingsRenderer(props), [props]);
  return <Stage create={create} background={props.background} />;
};
