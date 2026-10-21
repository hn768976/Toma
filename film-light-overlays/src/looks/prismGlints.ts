import { Vector3, Vector4 } from "three";
import type { Look } from "../lib/ShaderOverlay";
import { LOOP, TAU, mulberry32, range } from "../lib/random";
import { PALETTE, hexToRgb } from "../palette";

const GLINTS = 30;

// Each glint lives a whole number of times per loop. In each life it sits at a
// position fixed for that (glint, life) pair and drifts slowly; it is invisible
// at the start and end of a life, so jumping to the next position never shows.
const rng = mulberry32(0x9e15);
const glints = Array.from({ length: GLINTS }, () => {
  const lives = 1 + Math.floor(rng() * 3);
  const big = rng() < 0.2;
  return {
    lives,
    phase: rng(),
    spots: Array.from({ length: lives }, () => ({
      x: range(rng, -0.74, 0.86),
      y: range(rng, -0.47, 0.47),
      vx: range(rng, -0.05, 0.05),
      vy: range(rng, -0.03, 0.03),
    })),
    size: big ? range(rng, 0.02, 0.032) : range(rng, 0.006, 0.013),
    gain: big ? range(rng, 0.9, 1.0) : rng() < 0.65 ? range(rng, 0.03, 0.1) : range(rng, 0.3, 0.6),
    // Smear direction: mostly up-right, like light split by one prism edge.
    dir: range(rng, -0.25, 0.75) + (rng() < 0.25 ? Math.PI : 0),
    split: range(rng, 1.3, 2.2),
    twF: 3 + Math.floor(rng() * 6),
    twP: rng() * TAU,
    flip: rng() < 0.5 ? 1 : -1,
  };
});

export const prismGlints: Look = {
  createUniforms: () => {
    const c = PALETTE.PrismGlints;
    return {
      uG: { value: Array.from({ length: GLINTS }, () => new Vector4()) },
      uG2: { value: Array.from({ length: GLINTS }, () => new Vector4()) },
      uHaze: { value: new Vector3(...hexToRgb(c.haze)) },
      uRayCol: { value: new Vector3(...hexToRgb(c.rays)) },
      uCoreCol: { value: new Vector3(...hexToRgb(c.core)) },
      uStreakCol: { value: new Vector3(...hexToRgb(c.streak)) },
    };
  },
  update: (frame, u) => {
    const ph = (frame % LOOP) / LOOP;
    const A = u.uG.value as Vector4[];
    const B = u.uG2.value as Vector4[];
    glints.forEach((g, i) => {
      const cyc = g.lives * ph + g.phase;
      const k = ((Math.floor(cyc) % g.lives) + g.lives) % g.lives;
      const f = cyc - Math.floor(cyc);
      const s = g.spots[k];
      const env = Math.pow(Math.sin(Math.PI * f), 2);
      const twinkle = 0.75 + 0.25 * Math.sin(TAU * g.twF * ph + g.twP);
      A[i].set(s.x + s.vx * (f - 0.5), s.y + s.vy * (f - 0.5), g.gain * env * twinkle, g.size);
      B[i].set(g.dir, g.split * g.flip, 0, 0);
    });
  },
  fragment: /* glsl */ `
uniform vec4 uG[${GLINTS}];
uniform vec4 uG2[${GLINTS}];
uniform vec3 uHaze;
uniform vec3 uRayCol;
uniform vec3 uCoreCol;
uniform vec3 uStreakCol;

// Red on one side, blue on the other, white-yellow in the middle.
vec3 prism(float x) {
  // Blue/cyan on one side, white in the middle, orange/red on the other; no green band.
  vec3 warm = mix(mix(vec3(1.0, 0.9, 0.3), vec3(1.0, 0.5, 0.1), smoothstep(0.25, 0.6, x)), vec3(1.0, 0.1, 0.12), smoothstep(0.6, 1.0, x));
  vec3 cool = mix(mix(vec3(0.45, 1.0, 0.7), vec3(0.15, 0.8, 1.0), smoothstep(0.2, 0.5, -x)), vec3(0.2, 0.2, 1.0), smoothstep(0.55, 1.0, -x));
  vec3 c = x > 0.0 ? warm : cool;
  return mix(vec3(1.0), c, smoothstep(0.0, 0.3, abs(x)));
}

void main() {
  vec2 p = frameP();
  vec2 uv = frameUV();
  float A = aspect() * 0.5;

  // Dark teal haze: soft, slowly churning, black along the far left edge and
  // fading out towards the bottom-left corner.
  float hn = 0.5 + 0.5 * fbmLoop(p * 1.1, 0.45, 3.0, 3);
  float region = smoothstep(0.035, 0.2, uv.x) * (0.25 + 0.75 * smoothstep(0.35, 1.35, uv.y * 0.8 + uv.x));
  vec3 col = uHaze * region * (0.28 + 0.6 * hn);
  // Soft diagonal beam from the top-right corner.
  vec2 bo = vec2(A + 0.05, 0.55);
  vec2 bd = normalize(vec2(-1.0, -0.85));
  vec2 br = p - bo;
  float bt = dot(br, bd);
  float bperp = abs(dot(br, vec2(-bd.y, bd.x)));
  float beam = exp(-pow(bperp / (0.06 + 0.12 * max(bt, 0.0)), 2.0)) * smoothstep(0.0, 0.1, bt) * (1.0 - smoothstep(0.3, 0.75, bt));
  col += uRayCol * beam * (0.2 + 0.08 * nLoop(vec2(bt * 3.0, 0.0), 0.4, 6.0));
  col += uHaze * 0.5 * exp(-length((p - vec2(A, 0.5)) * vec2(0.8, 1.2)) / 0.45);

  // Faint light rays fanning in from the left edge (lower half).
  vec2 o = vec2(-A - 0.25, -0.38);
  vec2 d = p - o;
  float ang = atan(d.y, d.x);
  float dist = length(d);
  float fan = 0.5 + 0.5 * nLoop(vec2(ang * 6.0, 0.0), 0.6, 9.0);
  fan = pow(fan, 2.5) + 0.3 * pow(0.5 + 0.5 * nLoop(vec2(ang * 14.0, 1.0), 0.8, 4.0), 4.0);
  float fanMask = smoothstep(0.25, 0.4, dist) * (1.0 - smoothstep(0.35, 0.95, dist)) * smoothstep(-0.55, -0.05, ang) * (1.0 - smoothstep(0.1, 0.45, ang));
  col += uRayCol * fan * fanMask * 0.16;

  // Glints.
  float px = pxSize();
  for (int i = 0; i < ${GLINTS}; i++) {
    vec4 g = uG[i];
    if (g.z <= 0.002) continue;
    vec2 q = p - g.xy;
    float s = g.w;
    // Long anamorphic streak (horizontal) is the widest feature.
    if (dot(q, q) > s * s * 196.0) continue;
    vec4 g2 = uG2[i];
    vec2 ax = vec2(cos(g2.x), sin(g2.x));
    float u = dot(q, ax);
    float v = dot(q, vec2(-ax.y, ax.x));
    float split = g2.y;
    // White core.
    float core = exp(-(u * u + v * v) / pow(s * 0.26 + px * 0.5, 2.0));
    // Chromatic smear along the axis.
    float L = s * abs(split);
    // Lopsided smear: the spectrum sits mostly on one side of the core.
    float uo = u - 0.45 * L * sign(split);
    float sm = exp(-pow(uo / L, 2.0) - pow(v / (s * 0.65 + px * 0.5), 2.0));
    vec3 smear = prism(sign(split) * u / (L * 1.3)) * sm;
    // Soft halo.
    float halo = exp(-length(q) / (s * 1.6)) * 0.12;
    // Anamorphic streak.
    float streak = exp(-pow(v / (s * 0.8 + px * 0.6), 2.0)) * exp(-abs(u) / (s * 3.5)) * 0.07;
    float hot = smoothstep(0.012, 0.02, s);
    vec3 c = uCoreCol * core * (1.6 + 2.5 * hot) + smear * 2.0 + uStreakCol * (streak + halo * (1.0 + 1.5 * hot));
    col += c * g.z;
  }
  col = 1.0 - exp(-col * 1.15);
  outColor = vec4(col, 1.0);
}
`,
};
