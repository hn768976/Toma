import React, { useCallback, useMemo } from "react";
import { hexToLinear, hexToOD } from "../lib/color";
import { hashString, mulberry32, range } from "../lib/random";
import { Stage, type FrameContext } from "../lib/Stage";
import type { BloomColourway } from "../palettes";

export const BLOOM_COUNT = 8;
export const BLOOM_SPRITES = Array.from({ length: BLOOM_COUNT }, (_, i) => `layers/bloom_${i}.png`);
// painted wash radius / sprite size (see paint/layers.ts bloomLayer)
const SPRITE_R = 0.36;
// every cycle length divides the 600-frame loop
const CYCLES = [600, 300, 600, 200, 600, 300, 600, 300];

const SCENE = /* glsl */ `
uniform sampler2DArray uSprites;
uniform vec4 uB0[8];   // centre.xy, radius, rotation
uniform vec4 uB1[8];   // growth, wetness, alpha, sprite layer
uniform vec4 uB2[8];   // aspect x, aspect y
uniform vec3 uOD[8];   // pigment optical density
uniform vec3 uOD2[8];  // wet-in-wet second pigment
uniform float uSpriteR;
uniform float uStill;  // 1 = still: everything dry and settled

void main() {
  vec2 q = screenComp();
  // gentle flow distortion: noise sampled on a time circle so it loops
  vec2 flow = (noiseAt(q * 0.6 + timeCircle(260.0, 0.0), 2400.0).xy - 0.5) * 34.0;
  vec2 qf = q + flow;

  float cov[8];
  float len[8];
  float pres[8];
  vec3 od = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 a = uB0[i];
    vec4 b = uB1[i];
    vec2 d = qf - a.xy;
    float cs = cos(a.w), sn = sin(a.w);
    vec2 s = mat2(cs, sn, -sn, cs) * d / a.z / uB2[i].xy;
    // gravity: pigment pools along the lower side of a drying wash
    float pool = smoothstep(-0.3, 0.9, d.y / a.z);
    float l = length(s);
    len[i] = l;
    cov[i] = 0.0;
    pres[i] = 0.0;
    if (b.z <= 0.001 || l > 1.6) continue;
    vec2 local = s * a.z + float(i) * 937.0;
    vec4 n = noiseAt(local, 900.0);
    vec4 nf = noiseAt(local, 260.0);
    float edgeN = (n.x - 0.5) * 0.30 + (nf.y - 0.5) * 0.06;
    // wet paint is soft (blurred mip), dry paint is crisp
    float wet = b.y;
    vec2 uv = 0.5 + s * uSpriteR;
    float dSharp = 1.0 - texture(uSprites, vec3(uv, b.w)).r;
    float dSoft = 1.0 - textureLod(uSprites, vec3(uv, b.w), 3.0).r;
    float D = mix(dSharp, dSoft, wet * 0.75);
    float g = b.x;
    float front = l + edgeN;
    float mask = smoothstep(g + 0.03 + 0.04 * wet, g - 0.03 - 0.05 * wet, front);
    // pigment collects at the moving wet edge
    // half-gaussian: crisp on the outside (the mask), soft towards the middle
    float rimW = 0.05 + 0.05 * wet;
    float rim = exp(-pow(min(0.0, front - g) / rimW, 2.0)) * wet * step(g, 1.15);
    rim *= mask;
    // the wet edge breaks: stronger in places, almost gone in others
    float gate = smoothstep(0.32, 0.62, noiseAt(local + 77.0, 1700.0).z);
    rim *= (0.25 + 0.75 * gate) * (0.6 + 0.8 * pool);
    float dens = D * mask * (1.0 + 0.35 * pool * smoothstep(0.55, 1.0, l)) + rim * 0.5 * smoothstep(0.02, 0.12, D + 0.05);
    // lifting: the middle fades before the dried edge
    float edgeKeep = smoothstep(0.55, 1.0, l / max(g, 0.05));
    float alpha = b.z;
    dens *= mix(alpha * alpha, alpha, edgeKeep);
    cov[i] = mask * alpha * step(0.04, D);
    pres[i] = smoothstep(0.02, 0.1, dSoft);
    len[i] = front;
    float hue = smoothstep(0.35, 0.75, noiseAt(local + 400.0, 1500.0).z);
    vec3 pig = mix(uOD[i], uOD2[i], hue * 0.45);
    od += dens * 1.45 * pig * granulate(q, 0.25 + 0.5 * (1.0 - wet));
  }
  // backruns: a still-wet bloom pushing into a neighbour leaves a
  // cauliflower edge, and lightens the pigment it floods
  for (int i = 0; i < 8; i++) {
    float wet = uB1[i].y;
    if (wet < 0.05 || uB1[i].z < 0.01) continue;
    float other = 0.0;
    for (int j = 0; j < 8; j++) if (j != i) other += cov[j];
    other = clamp(other, 0.0, 1.0);
    if (other < 0.01) continue;
    vec2 local = (qf - uB0[i].xy) + float(i) * 311.0;
    float cauli = (noiseAt(local, 520.0).x - 0.5) * 0.14 + (noiseAt(local, 210.0).y - 0.5) * 0.05;
    float f = len[i] + cauli - uB1[i].x;
    float brGate = smoothstep(0.3, 0.65, noiseAt(local + 191.0, 1300.0).w);
    float br = exp(-pow(min(0.0, f) / 0.05, 2.0)) * step(f, 0.0) * wet * other * uB1[i].z * pres[i] * brGate;
    float inside = smoothstep(0.02, -0.06, f) * wet * other * uB1[i].z;
    od = od * (1.0 - 0.18 * inside) + br * 0.4 * uOD[i];
  }
  vec3 col = paperBase(q) * exp(-od);
  outColor = vec4(col, 1.0);
}
`;

type Bloom = { x: number; y: number; r: number; rot: number; cycle: number; phase: number; drift: number; ax: number; ay: number; ci: number };

export const makeBlooms = (id: string, W: number, H: number, scale = 1): Bloom[] => {
  const rng = mulberry32(hashString(id));
  // jittered 4x2 grid so blooms spread over the whole frame
  return Array.from({ length: BLOOM_COUNT }, (_, i) => {
    const gx = i % 4;
    const gy = Math.floor(i / 4);
    return {
      x: ((gx + 0.5 + range(rng, -0.42, 0.42)) / 4) * W,
      y: ((gy + 0.5 + range(rng, -0.4, 0.4)) / 2) * H,
      r: range(rng, 0.1, 0.21) * W * scale,
      ax: range(rng, 0.75, 1.25),
      ay: range(rng, 0.75, 1.2),
      ci: Math.floor(rng() * 4),
      rot: rng() * Math.PI * 2,
      cycle: CYCLES[i],
      phase: Math.floor(rng() * CYCLES[i]),
      drift: rng() * Math.PI * 2,
    };
  });
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// One bloom's life over its cycle: wet drop -> spread -> dry -> fade.
export const bloomState = (u: number) => {
  const g = u < 0.06 ? 0.3 * easeOut(u / 0.06) : 0.3 + 0.75 * easeOut((u - 0.06) / 0.38);
  const wet = 1 - smooth(0.4, 0.62, u);
  const alpha = smooth(0, 0.025, u) * (1 - smooth(0.7, 0.99, u));
  return { g, wet, alpha };
};

export type BloomProps = { loopCheck?: boolean; colourway: BloomColourway; seedId: string; still?: boolean; density?: number };

export const WatercolourBloom: React.FC<BloomProps> = ({ colourway, seedId, still = false, density = 1 }) => {
  const blooms = useMemo(() => makeBlooms(seedId, 3840, 2160, density), [seedId, density]);
  const ods = useMemo(() => colourway.pigments.map(hexToOD), [colourway]);

  const onFrame = useCallback(
    ({ comp, frame: rawFrame }: FrameContext) => {
      const frame = rawFrame % 600; // loop-exact: frame 600 == frame 0
      const b0 = new Float32Array(32);
      const b1 = new Float32Array(32);
      const b2 = new Float32Array(32);
      const o1 = new Float32Array(24);
      const o2 = new Float32Array(24);
      blooms.forEach((b, i) => {
        const t = (frame + b.phase) % b.cycle;
        const rep = Math.floor((frame + b.phase) / b.cycle) % (600 / b.cycle);
        const u = t / b.cycle;
        const st = still ? { g: 1.02, wet: 0, alpha: 1 } : bloomState(u);
        // each recurrence lands a little elsewhere, with another sprite/colour
        const jx = Math.sin(rep * 2.1 + i) * 160;
        const jy = Math.cos(rep * 1.7 + i) * 110;
        const loopA = (Math.PI * 2 * frame) / 600 + b.drift;
        const x = b.x + jx + Math.cos(loopA) * 40;
        const y = b.y + jy + Math.sin(loopA) * 30;
        b0.set([x, y, b.r * (1 + 0.05 * u), b.rot + 0.15 * u], i * 4);
        b1.set([st.g, st.wet, st.alpha, (i + rep * 3) % BLOOM_COUNT], i * 4);
        b2.set([b.ax, b.ay, 0, 0], i * 4);
        o1.set(ods[(b.ci + rep) % 4], i * 3);
        o2.set(ods[(b.ci + rep + 1 + (i % 2)) % 4], i * 3);
      });
      const a = (Math.PI * 2 * frame) / 600;
      comp.render(frame, 600, {
        uB0: { type: "4fv", value: b0 },
        uB1: { type: "4fv", value: b1 },
        uB2: { type: "4fv", value: b2 },
        uOD: { type: "3fv", value: o1 },
        uOD2: { type: "3fv", value: o2 },
        uSpriteR: SPRITE_R,
        uStill: still ? 1 : 0,
        uPaperColor: hexToLinear(colourway.paper),
        uCam: [Math.cos(a) * 24, Math.sin(a) * 14],
      });
    },
    [blooms, ods, colourway, still],
  );

  return <Stage sceneSrc={SCENE} imageArrays={{ uSprites: BLOOM_SPRITES }} onFrame={onFrame} />;
};
