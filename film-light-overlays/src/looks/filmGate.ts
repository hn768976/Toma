import { Vector2, Vector4 } from "three";
import type { Look } from "../lib/ShaderOverlay";
import { TAU, mulberry32, pairKey, pairRng, periodicNoise, range } from "../lib/random";
import { GATE_EDGE_U, getGateEdgeTexture, getScratchTexture } from "../lib/textures";
import { PALETTE, hexToRgb } from "../palette";

const SCRATCHES = 14;
const DUST = 40;

// Gate weave: +-0.3% of the width, held for 2 frames, periodic over 300 pairs.
const weaveX = periodicNoise(mulberry32(0x6a01), 3, 11);
const weaveY = periodicNoise(mulberry32(0x6a02), 3, 11);

export const filmGate: Look = {
  ditherHi: 0.985, // keep the frame area at exactly 255
  createUniforms: () => {
    const c = PALETTE.FilmGate;
    const fr = hexToRgb(c.frame);
    return {
      uWeave: { value: new Vector2() },
      uEdgeTex: { value: getGateEdgeTexture(c.edgeCode) },
      uScratchTex: { value: getScratchTexture() },
      uScr: { value: Array.from({ length: SCRATCHES }, () => new Vector4()) },
      uScrB: { value: Array.from({ length: SCRATCHES }, () => new Vector4()) },
      uDust: { value: Array.from({ length: DUST }, () => new Vector4()) },
      uFrameCol: { value: fr },
      uScratchCol: { value: hexToRgb(c.scratch) },
    };
  },
  update: (frame, u) => {
    const k = pairKey(frame) / 300;
    const W = 16 / 9;
    (u.uWeave.value as Vector2).set(0.003 * W * weaveX(k), 0.0018 * weaveY(k));
    const rng = pairRng(frame, 0x6a5c);
    const S = u.uScr.value as Vector4[];
    const SB = u.uScrB.value as Vector4[];
    const n = 5 + Math.floor(rng() * (SCRATCHES - 5));
    for (let i = 0; i < SCRATCHES; i++) {
      if (i >= n) {
        S[i].set(0, 0, 0, 0);
        continue;
      }
      // Mostly near-vertical fine scratches, a few short diagonal nicks.
      const long = rng() < 0.35;
      const ang = Math.PI / 2 + range(rng, -0.25, 0.25) + (rng() < 0.15 ? range(rng, -0.6, 0.6) : 0);
      S[i].set(range(rng, -0.66, 0.66), range(rng, -0.42, 0.42), long ? range(rng, 0.08, 0.3) : range(rng, 0.01, 0.05), range(rng, 0.25, 1));
      SB[i].set(ang, Math.floor(rng() * 16), rng(), long ? 1 : 0);
    }
    const D = u.uDust.value as Vector4[];
    const nd = 16 + Math.floor(rng() * (DUST - 16));
    for (let i = 0; i < DUST; i++) {
      if (i >= nd) {
        D[i].set(0, 0, 0, 0);
        continue;
      }
      D[i].set(range(rng, -0.68, 0.68), range(rng, -0.45, 0.45), range(rng, 0.0008, 0.0028), rng() * TAU);
    }
  },
  fragment: /* glsl */ `
uniform vec2 uWeave;
uniform sampler2D uEdgeTex;
uniform sampler2D uScratchTex;
uniform vec4 uScr[${SCRATCHES}];
uniform vec4 uScrB[${SCRATCHES}];
uniform vec4 uDust[${DUST}];
uniform vec3 uFrameCol;
uniform vec3 uScratchCol;

void main() {
  float A = aspect() * 0.5;
  float px = pxSize();
  vec2 p = frameP() - uWeave;

  // Frame area (from the reference): x 11.7%..89.8% of width, y 3.4%..97.0% of height.
  vec2 lo = vec2(-A + 0.117 * 2.0 * A, -0.5 + 0.030);
  vec2 hi = vec2(-A + 0.898 * 2.0 * A, 0.5 - 0.034);
  vec2 c = (lo + hi) * 0.5;
  vec2 b = (hi - lo) * 0.5;
  vec2 q = p - c;
  // Slightly irregular, filed edges: a fixed wobble that belongs to the gate.
  // Continuous in position, so there is no seam where the edges meet.
  // Irregularities concentrated in a few places, not an even wobble.
  float spots = smoothstep(0.1, 0.6, snoise(vec4(q * 3.0, 5.0, 0.0)));
  float wob = (0.0008 + 0.0035 * spots) * snoise(vec4(q * 7.0, 0.0, 0.0))
            + (0.0004 + 0.0014 * spots) * snoise(vec4(q * 26.0, 1.0, 0.0))
            + 0.0004 * snoise(vec4(q * 110.0, 2.0, 0.0));
  float d = sdRoundBox(q, b, 0.032) + wob;
  float inside = 1.0 - smoothstep(-px * 1.8, px * 1.8, d);

  // Fine scratches and dust on the frame area (light grey, subtle).
  float dark = 0.0;
  for (int i = 0; i < ${SCRATCHES}; i++) {
    vec4 s = uScr[i];
    if (s.w <= 0.0) continue;
    vec4 sb = uScrB[i];
    vec2 dir = vec2(cos(sb.x), sin(sb.x));
    vec2 r = p - s.xy;
    float t = dot(r, dir);
    if (abs(t) > s.z) continue;
    float perp = abs(dot(r, vec2(-dir.y, dir.x)) + 0.004 * s.z * sin(t * 40.0 + sb.z * 6.0));
    float w = 0.00045 + px * 0.55;
    float prof = exp(-pow(perp / w, 2.0));
    float ends = 1.0 - smoothstep(0.6, 1.0, abs(t) / s.z);
    float tex = texture(uScratchTex, vec2((sb.y + 0.5) / 16.0, fract(t * 2.0 + sb.z))).r;
    dark += prof * ends * mix(0.45, 1.0, tex) * s.w * mix(0.18, 0.3, sb.w);
  }
  for (int i = 0; i < ${DUST}; i++) {
    vec4 s = uDust[i];
    if (s.z <= 0.0) continue;
    vec2 r = p - s.xy;
    if (dot(r, r) > s.z * s.z * 9.0) continue;
    float ang = atan(r.y, r.x);
    float rr = s.z * (0.8 + 0.3 * snoise(vec4(cos(ang), sin(ang), s.w, 2.0)));
    dark += (1.0 - smoothstep(-px * 0.9, px * 0.9, length(r) - rr)) * 0.4;
  }
  vec3 frameCol = mix(uFrameCol, uScratchCol, clamp(dark, 0.0, 0.6) / 0.6 * 0.6);
  vec3 col = frameCol * inside;

  // Surround: pure black with the orange-brown perforation outline on the left.
  vec2 uv = (p + vec2(A, 0.5)) / vec2(2.0 * A, 1.0);
  if (uv.x < ${GATE_EDGE_U.toFixed(3)} && uv.y > -0.01 && uv.y < 1.01) {
    vec3 e = texture(uEdgeTex, vec2(uv.x / ${GATE_EDGE_U.toFixed(3)}, clamp(uv.y, 0.0, 1.0))).rgb;
    col += e * (1.0 - inside);
  }
  outColor = vec4(col, 1.0);
}
`,
};
