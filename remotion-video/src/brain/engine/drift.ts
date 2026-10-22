import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";
import { mulberry32, range } from "./random";
import { ADDITIVE, POINT_GLSL } from "./primitives";
import type { Post } from "./post";
import { pxScale } from "./post";

// Periodic drifting particles (dust, embers, bokeh specks). Each particle moves
// by a whole number of box lengths per period, wrapping inside the box, so the
// field is identical at frame 0 and frame `period`. Particles fade near the box
// faces so the wrap never pops.

export type DriftOpts = {
  seed: number;
  count: number;
  min: [number, number, number];
  max: [number, number, number];
  /** box lengths travelled per period along each axis (integers for loops) */
  laps: [number, number, number];
  period: number;
  size: [number, number]; // world diameter range
  minPx: number;
  color: [number, number, number]; // linear
  colorB?: [number, number, number]; // optional second colour (mixed per particle)
  intensity: number;
  twinkle: number; // 0..1
  /** circle-of-confusion: world-space focus distance and strength (0 = off) */
  focus?: number;
  coc?: number;
  /** wobble amplitude (world units), periodic */
  wobble?: number;
  soft?: number; // 1 = gaussian blob, 0 = hard disc
};

const VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aR; // r1..r4
uniform float uPhase; // 0..1 over the period
uniform vec3 uMin;
uniform vec3 uMax;
uniform vec3 uLaps;
uniform vec2 uSize;
uniform float uMinPx;
uniform float uTwinkle;
uniform float uFocus;
uniform float uCoc;
uniform float uWobble;
out float vI;
out float vMix;
out float vSoft;
const float TAU = 6.28318530718;
void main() {
  vec3 L = uMax - uMin;
  vec3 p = position + L * uLaps * uPhase;
  p += uWobble * vec3(sin(TAU * (uPhase * 2.0 + aR.x)), sin(TAU * (uPhase * 3.0 + aR.y)), cos(TAU * (uPhase * 2.0 + aR.z)));
  p = uMin + mod(p - uMin, L);
  vec3 e = min(p - uMin, uMax - p) / L;
  float edge = smoothstep(0.0, 0.08, min(e.x, min(e.y, e.z)));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float s = mix(uSize.x, uSize.y, aR.w * aR.w);
  float px = pointSize(s, mv.z, uMinPx);
  float coc = uCoc > 0.0 ? abs(1.0 / max(-mv.z, 0.05) - 1.0 / uFocus) * uCoc * uRes.y * uPx : 0.0;
  float tot = max(px, coc);
  float spread = px / tot;
  gl_PointSize = min(tot, 256.0 * uPx + 8.0);
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(TAU * (uPhase * (3.0 + floor(aR.y * 4.0)) + aR.x)));
  vI = edge * tw * vPtAlpha * spread * spread;
  vMix = aR.z;
  vSoft = coc > px ? 0.35 : 1.0;
  gl_Position = mv.z < -0.05 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColorB;
uniform float uIntensity;
uniform float uSoftness;
in float vI;
in float vMix;
in float vSoft;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float soft = exp(-r2 * 3.5);
  float disc = smoothstep(1.0, 0.75, r2) * (0.75 + 0.25 * r2);
  float a = mix(disc, soft, uSoftness * vSoft + (1.0 - vSoft) * 0.0);
  vec3 c = mix(uColor, uColorB, step(0.5, vMix));
  outColor = vec4(c * uIntensity * vI * a, 0.0);
}`;

export const makeDrift = (o: DriftOpts, post: Post, projY: number) => {
  const rng = mulberry32(o.seed);
  const pos = new Float32Array(o.count * 3);
  const r = new Float32Array(o.count * 4);
  for (let i = 0; i < o.count; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = range(rng, o.min[k], o.max[k]);
    for (let k = 0; k < 4; k++) r[i * 4 + k] = rng();
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aR", new BufferAttribute(r, 4));
  const mat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uRes: { value: post.size },
      uPx: { value: pxScale(post) },
      uProjY: { value: projY },
      uPhase: { value: 0 },
      uMin: { value: new Vector3(...o.min) },
      uMax: { value: new Vector3(...o.max) },
      uLaps: { value: new Vector3(...o.laps) },
      uSize: { value: o.size },
      uMinPx: { value: o.minPx },
      uTwinkle: { value: o.twinkle },
      uFocus: { value: o.focus ?? 1 },
      uCoc: { value: o.coc ?? 0 },
      uWobble: { value: o.wobble ?? 0 },
      uColor: { value: new Vector3(...o.color) },
      uColorB: { value: new Vector3(...(o.colorB ?? o.color)) },
      uIntensity: { value: o.intensity },
      uSoftness: { value: o.soft ?? 1 },
    },
    ...ADDITIVE,
    depthTest: true,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return {
    points,
    mat,
    set(frame: number) {
      mat.uniforms.uPhase.value = (((frame % o.period) + o.period) % o.period) / o.period;
    },
    dispose() {
      g.dispose();
      mat.dispose();
    },
  };
};
