import { Vector3, Vector4 } from "three";
import type { Look } from "../lib/ShaderOverlay";
import { LOOP, TAU, mulberry32, periodicNoise, range } from "../lib/random";
import { PALETTE, hexToRgb } from "../palette";

const BLOBS = 10;
const ASPECT = 16 / 9;

// Each blob drifts on a closed path (whole-number frequencies), swells, and
// fades in and out a whole number of times per loop; a global wave swings the
// frame between nearly filled and nearly black twice per loop.
const rng = mulberry32(0xb0ce);
const blobs = Array.from({ length: BLOBS }, (_, i) => ({
  cx: range(rng, -0.45, 0.45),
  cy: range(rng, -0.22, 0.25),
  ax: range(rng, 0.12, 0.38),
  ay: range(rng, 0.06, 0.22),
  fx: 1 + Math.floor(rng() * 2),
  fy: 1 + Math.floor(rng() * 2),
  px: rng() * TAU,
  py: rng() * TAU,
  radius: range(rng, 0.15, 0.2), // up to 40% of frame height across
  swell: periodicNoise(mulberry32(0xb100 + i), 1, 3),
  life: 1 + Math.floor(rng() * 3),
  lifePhase: rng(),
  colour: [0, 1, 0, 1, 1, 0, 1, 2, 0, 1][i],
  gain: range(rng, 0.7, 1.1),
  seed: rng() * 10,
}));
const wave = periodicNoise(mulberry32(0xb0cf), 2, 3);

export const bokeh: Look = {
  createUniforms: () => {
    const c = PALETTE.BokehWarm;
    return {
      uBlob: { value: Array.from({ length: BLOBS }, () => new Vector4()) },
      uBlobB: { value: Array.from({ length: BLOBS }, () => new Vector4()) },
      uCol: { value: [new Vector3(...hexToRgb(c.a)), new Vector3(...hexToRgb(c.b)), new Vector3(...hexToRgb(c.c))] },
    };
  },
  update: (frame, u) => {
    const ph = (frame % LOOP) / LOOP;
    // Global wave: two swells per loop, from ~0 to full.
    const w = 0.5 + 0.5 * Math.sin(TAU * 2 * ph - Math.PI / 2) * 0.85 + 0.15 * wave(ph);
    const A = u.uBlob.value as Vector4[];
    const B = u.uBlobB.value as Vector4[];
    blobs.forEach((b, i) => {
      const x = b.cx + b.ax * Math.sin(TAU * b.fx * ph + b.px);
      const y = b.cy + b.ay * Math.sin(TAU * b.fy * ph + b.py);
      const r = b.radius * (0.85 + 0.2 * b.swell(ph));
      const l = Math.sin(Math.PI * (((b.life * ph + b.lifePhase) % 1 + 1) % 1));
      const inten = Math.max(0, w) * (0.55 + 0.45 * l * l) * b.gain;
      A[i].set(Math.max(-ASPECT, Math.min(ASPECT, x)), y, r, inten);
      B[i].set(b.colour, b.seed, 0, 0);
    });
  },
  fragment: /* glsl */ `
uniform vec4 uBlob[${BLOBS}];
uniform vec4 uBlobB[${BLOBS}];
uniform vec3 uCol[3];

void main() {
  vec2 p = frameP();
  vec3 acc = vec3(0.0);
  vec3 haze = vec3(0.0);
  for (int i = 0; i < ${BLOBS}; i++) {
    vec4 b = uBlob[i];
    if (b.w <= 0.0005) continue;
    vec2 q = p - b.xy;
    float sq = 0.7 + 0.35 * fract(uBlobB[i].y * 3.7);
    q *= vec2(1.0 / sq, sq);
    float d = length(q);
    float R = b.z;
    // Wide ambient spill that joins neighbouring blobs into one wash.
    haze += uCol[int(uBlobB[i].x + 0.5)] * b.w * (1.0 - smoothstep(0.0, R * 3.2, length(p - b.xy)));
    if (d > R * 2.0) continue;
    // Slightly irregular, out-of-focus disc: the edge wobbles with angle.
    vec2 dir = q / max(d, 1e-5);
    float seed = uBlobB[i].y;
    float wob = nLoop(dir * 1.3 + seed, 0.35, seed);
    float Re = R * (1.0 + 0.12 * wob);
    float body = 1.0 - smoothstep(0.0, Re * 1.9, d);
    body = body * body * (1.6 - 0.6 * body);
    // Cat's-eye: towards the frame edge the disc is clipped by the lens barrel.
    vec2 off = -b.xy * 0.45 * R;
    float d2 = length(q - off * vec2(1.0 / sq, sq));
    body *= 1.0 - 0.6 * smoothstep(Re * 0.9, Re * 1.9, d2);
    // Slightly brighter rim, as on a defocused lens aperture.
    float rim = exp(-pow((d - Re * 0.95) / (Re * 0.18), 2.0));
    // Soft internal mottling.
    float tex = 0.85 + 0.15 * nLoop(p * 3.0 + seed, 0.5, seed + 2.0);
    // Faint onion-ring texture from the lens elements.
    float onion = 1.0 + 0.012 * sin(d / Re * 15.0 + seed) * smoothstep(Re * 1.4, Re * 0.3, d);
    float v = (body * 1.0 * tex * onion + rim * 0.2) * b.w;
    int ci = int(uBlobB[i].x + 0.5);
    acc += uCol[ci] * v;
  }
  // Gentle shoulder so overlapping blobs bloom instead of clipping.
  vec3 col = 1.0 - exp(-(acc * 1.7 + haze * 0.35));
  // Fine sensor-like grain on lit areas only.
  col *= 1.0 + 0.05 * (hash2(uvec2(gl_FragCoord.xy), pairKey() + 9u) - 0.5);
  outColor = vec4(col, 1.0);
}
`,
};
