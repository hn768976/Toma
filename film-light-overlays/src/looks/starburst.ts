import { Vector3, Vector4 } from "three";
import type { Look } from "../lib/ShaderOverlay";
import { LOOP, TAU, clamp, mulberry32, periodicNoise } from "../lib/random";
import { PALETTE, hexToRgb } from "../palette";

const RAYS = 40;
const SPACING = TAU / RAYS;
const TURN_SLOTS = 8; // the rays rotate by exactly 8 ray spacings per 600-frame loop

// Ray properties are smooth periodic functions of the ray's *slot* position
// s = i + 8 * t / 600 (period 40) and of t (period 600). At t = 600 ray i sits
// in slot i + 8 and looks exactly like ray i + 8 did at t = 0, so the loop closes.
const rng = mulberry32(0x5ab0);
const slotFn = () => {
  const terms = Array.from({ length: 14 }, (_, k) => ({
    f: 2 + k * 3 + Math.floor(rng() * 3), // whole cycles per 40 slots
    a: 0.4 + rng(),
    p: rng() * TAU,
  }));
  const norm = Math.sqrt(terms.reduce((s, t) => s + t.a * t.a, 0) * 0.5);
  return (s: number, t: number, m: number) =>
    clamp(
      terms.reduce((acc, tm, k) => acc + tm.a * Math.sin((TAU * tm.f * s) / RAYS + (TAU * ((k % 3) * m) * t) / LOOP + tm.p), 0) /
        norm /
        1.5,
      -1,
      1,
    );
};
const jitterF = slotFn();
const lengthF = slotFn();
const brightF = slotFn();
const widthF = slotFn();
const pulseA = periodicNoise(mulberry32(0x5ab1), 2, 5);

export const starburst: Look = {
  createUniforms: () => {
    const c = PALETTE.Starburst;
    return {
      uRays: { value: Array.from({ length: RAYS }, () => new Vector4()) },
      uCore: { value: 0.04 },
      uGlow: { value: 1 },
      uRot: { value: 0 },
      uCoreCol: { value: new Vector3(...hexToRgb(c.core)) },
      uRayCol: { value: new Vector3(...hexToRgb(c.rays)) },
      uHazeCol: { value: new Vector3(...hexToRgb(c.haze)) },
    };
  },
  update: (frame, u) => {
    const t = frame % LOOP;
    const ph = t / LOOP;
    // Core pulse: +-25% in size, three main beats per loop plus a slower swell.
    const pulse = 0.72 * Math.sin(TAU * 3 * ph) + 0.28 * pulseA(ph);
    u.uCore.value = 0.04 * (1 + 0.25 * pulse);
    u.uGlow.value = 0.85 + 0.2 * pulse;
    const rays = u.uRays.value as Vector4[];
    for (let i = 0; i < RAYS; i++) {
      const s = i + (TURN_SLOTS * t) / LOOP;
      const angle = s * SPACING + 0.42 * SPACING * jitterF(s, t, 0);
      const lj = 0.5 + 0.5 * lengthF(s, t, 1);
      const len = 0.4 + 0.55 * Math.pow(lj, 1.2); // longest ~0.92 (reaches the left/right edges)
      const bright = (0.25 + 0.6 * Math.pow(0.5 + 0.5 * brightF(s, t, 1), 1.5)) * (0.9 + 0.12 * pulse);
      const width = 0.0022 + 0.007 * Math.pow(0.5 + 0.5 * widthF(s, t, 0), 2);
      rays[i].set(angle, len, bright, width);
    }
  },
  fragment: /* glsl */ `
uniform vec4 uRays[${RAYS}];
uniform float uCore;
uniform float uGlow;
uniform vec3 uCoreCol;
uniform vec3 uRayCol;
uniform vec3 uHazeCol;

void main() {
  vec2 p = frameP();
  float r = length(p);
  float a = atan(p.y, p.x);
  float px = pxSize();

  // Core: a flat white disc with a soft shoulder.
  float ce = uCore * (1.0 + 0.12 * nLoop(vec2(cos(a), sin(a)) * 1.5, 0.6, 2.0));
  float core = 1.0 - smoothstep(ce * 0.55, ce * 1.25, r);

  // Glow: two soft lobes, with a finite cut-off so the corners stay black.
  float cut = 1.0 - smoothstep(0.45, 0.88, r);
  float glow = (2.6 * exp(-r / (uCore * 1.9)) + 0.8 * exp(-r / (uCore * 5.5))) * uGlow * cut;

  // Faint grey haze around the burst.
  float hz = 1.0 - smoothstep(0.05, 0.86, r);
  float haze = 0.34 * hz * (0.75 + 0.25 * hz) * uGlow;

  // Rays: soft spikes of different lengths and widths.
  float rays = 0.0;
  for (int i = 0; i < ${RAYS}; i++) {
    vec4 ry = uRays[i];
    float d = abs(mod(a - ry.x + PI, TAU) - PI);
    if (d > 0.6) continue;
    float perp = r * sin(d);
    float w = ry.w * (0.5 + 2.2 * r) + px * 0.8;
    float prof = 0.5 * exp(-perp * perp / (w * w * 2.0)) + 0.4 * exp(-perp * perp / (w * w * 14.0));
    float along = clamp(r / ry.y, 0.0, 1.0);
    float fall = (0.55 * pow(1.0 - along, 2.2) + 0.45 * pow(1.0 - along, 0.9)) * (1.0 - smoothstep(0.86, 0.93, r));
    rays += ry.z * prof * fall;
  }
  // Rays start inside the core and are hidden by it there.
  rays *= smoothstep(uCore * 0.3, uCore * 1.4, r) * 0.85 + 0.15;

  vec3 col = uCoreCol * (core * 5.0 + glow * 1.3) + uRayCol * rays * 1.15 + uHazeCol * haze * 0.6;
  // Soft shoulder so the core blooms into white instead of clipping hard.
  col = 1.0 - exp(-col);
  outColor = vec4(col, 1.0);
}
`,
};
