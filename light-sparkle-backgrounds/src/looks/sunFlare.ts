import { UniformGroup } from "pixi.js";
import type { LookFactory } from "../kit/engine";
import { DESIGN_H, DESIGN_W, hexToNum, hexToRgb, pulse, TAU } from "../kit/loop";
import { addParticle, group, layer, setSize } from "../kit/particles";
import { mulberry32, pick, range } from "../kit/random";

export type SunFlareParams = {
  seed: number;
  skyTop: string;
  skyBottom: string;
  skyNear: string; // sky tint close to the sun
  sunCore: string;
  sunGlow: string;
  /** Closed path: the sun eases A -> B -> A over the loop (fractions of the frame). */
  pathA: [number, number];
  pathB: [number, number];
  ghostTints: string[];
};

const NARMS = 8;
const NFINE = 40;
const NCLOUDS = 4;

const GLSL = /* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform vec3 uSkyNear;
uniform vec3 uSunCore;
uniform vec3 uSunGlow;
uniform vec2 uSun;
uniform vec4 uArms[${NARMS}]; // angle, length, intensity, base width
uniform vec4 uFine[${NFINE}]; // angle, length, intensity, width
uniform vec4 uClouds[${NCLOUDS}]; // cx, cy, rx, ry
uniform vec4 uCloudsB[${NCLOUDS}]; // strength, tilt, -, -
uniform float uCloudScroll;

float spike(vec2 v, float r, float ang, float len, float w0) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float along = dot(v, dir);
  if (along <= 0.0) return 0.0;
  float perp = abs(dot(v, vec2(-dir.y, dir.x)));
  float w = w0 * (1.0 - 0.6 * smoothstep(0.0, 1.6 * len, along)) + 3.0;
  return exp(-(perp * perp) / (w * w)) * exp(-along / len);
}

vec3 background(vec2 p) {
  float y = p.y / 2160.0;
  // Sky stays saturated: the lighter bottom stop only comes in low in the frame.
  vec3 sky = mix(uSkyTop, uSkyBot, 0.5 * smoothstep(0.2, 1.6, y));
  vec2 v = p - uSun;
  float r = length(v);
  float ang = atan(v.y, v.x);
  sky = mix(sky, uSkyNear, 0.55 * exp(-abs(v.x) / 2000.0 - abs(v.y) / 3000.0));
  // Faint low-contrast mottling, like real sky haze (periodic, scrolls one period per loop).
  // 4 cells x 700 px = 2800 px period; it scrolls exactly one period per loop.
  sky *= 1.0 + 0.06 * (fbmp(vec2((p.x - 0.875 * uCloudScroll) / 700.0, p.y / 500.0), vec2(4.0, 32.0)) - 0.5);

  // Faint blotchy haze: soft envelopes x periodic fbm scrolling by whole periods per loop.
  float env = 0.0;
  for (int i = 0; i < ${NCLOUDS}; i++) {
    vec2 d = p - uClouds[i].xy;
    float t = uCloudsB[i].y;
    vec2 dr = vec2(cos(t) * d.x + sin(t) * d.y, -sin(t) * d.x + cos(t) * d.y);
    env += uCloudsB[i].x * exp(-dot(dr / uClouds[i].zw, dr / uClouds[i].zw));
  }
  if (env > 0.002) {
    vec2 np = vec2((p.x - uCloudScroll) / 400.0, p.y / 260.0);
    float n = fbmp(np, vec2(8.0, 64.0));
    sky = mix(sky, mix(sky, vec3(1.0), 0.6), env * smoothstep(0.3, 0.85, n));
    sky *= 1.0 - 0.06 * env * smoothstep(0.55, 0.25, n);
  }

  // Starburst: 8 main spikes (soft, wide) + 40 faint fine spikes.
  float sp = 0.0;
  float veil = 0.0;
  for (int i = 0; i < ${NARMS}; i++) {
    sp += uArms[i].z * spike(v, r, uArms[i].x, uArms[i].y, uArms[i].w);
    // Broad, hazy veil along each ray (camera-like scatter).
    veil += uArms[i].z * spike(v, r, uArms[i].x, uArms[i].y * 1.8, uArms[i].w * 4.5);
  }
  float fs = 0.0;
  for (int i = 0; i < ${NFINE}; i++) fs += uFine[i].z * spike(v, r, uFine[i].x, uFine[i].y, uFine[i].w);
  float near = smoothstep(120.0, 420.0, r);

  // Irregular, horizontally stretched blown-out core.
  float wob = 1.0 + 0.26 * (vnoisep(vec2(ang / TAU * 7.0, 0.5), vec2(7.0, 1.0)) - 0.5) * 2.0;
  float re = length(v * vec2(0.78, 1.0)) / wob;
  float glow = 1.8 * exp(-re / 300.0) + 0.4 * exp(-re / 700.0) + 0.22 * exp(-r / 2100.0);
  float light = glow + (1.25 * sp + 0.22 * veil + 0.12 * fs) * near;
  // Faint rainbow fringe at the edge of the glow (red outside, blue inside).
  float R = 1050.0;
  vec3 fringe = vec3(exp(-pow((r - R - 80.0) / 110.0, 2.0)), exp(-pow((r - R) / 110.0, 2.0)), exp(-pow((r - R + 80.0) / 110.0, 2.0)));
  fringe -= dot(fringe, vec3(0.3333));
  // Blend towards the sun colour (no additive clipping, so no cyan cast).
  vec3 col = mix(sky, uSunGlow, 1.0 - exp(-1.3 * light));
  col += 0.03 * fringe;
  float core = 1.0 - smoothstep(260.0, 450.0, re);
  col = mix(col, uSunCore, core);
  return col;
}
`;

export const sunFlare =
  (params: SunFlareParams): LookFactory =>
  (kit) => {
    const rng = mulberry32(params.seed);
    const sunAt = (ph: number) => {
      const e = 0.5 - 0.5 * Math.cos(TAU * ph); // 0 -> 1 -> 0, smooth, closed
      return {
        x: DESIGN_W * (params.pathA[0] + (params.pathB[0] - params.pathA[0]) * e),
        y: DESIGN_H * (params.pathA[1] + (params.pathB[1] - params.pathA[1]) * e),
      };
    };

    // Main spikes: four lines through the sun -> 8 arms (vertical, near-horizontal, two diagonals).
    const lineAngles = [Math.PI / 2, 0.04, (34 * Math.PI) / 180, (-36 * Math.PI) / 180];
    const lineGain = [1.0, 0.65, 0.75, 0.65];
    const lineLen = [2.6, 0.6, 1.0, 0.9];
    const lineW = [1.7, 1.3, 1.9, 1.8];
    type Arm = { a: number; len: number; i0: number; w: number; k: number; p: number };
    const arms: Arm[] = [];
    lineAngles.forEach((la, li) => {
      for (const flip of [0, Math.PI]) {
        arms.push({ a: la + flip, len: range(rng, 600, 1000) * lineLen[li], i0: range(rng, 0.75, 1.0) * lineGain[li], w: range(rng, 48, 64) * lineW[li], k: pick(rng, [1, 2, 3]), p: rng() * TAU });
      }
    });
    const armData = new Float32Array(NARMS * 4);
    const fines: Arm[] = [];
    for (let i = 0; i < NFINE; i++) {
      fines.push({ a: (TAU * (i + range(rng, -0.35, 0.35))) / NFINE, len: range(rng, 250, 900), i0: range(rng, 0.15, 0.6), w: range(rng, 3, 7), k: pick(rng, [2, 3, 4, 5, 6, 8]), p: rng() * TAU });
    }
    const fineData = new Float32Array(NFINE * 4);

    const clouds = new Float32Array(NCLOUDS * 4);
    const cloudsB = new Float32Array(NCLOUDS * 4);
    type Cloud = { x: number; y: number; rx: number; ry: number; s: number; t: number; ax: number; p: number };
    const cl: Cloud[] = [];
    for (let i = 0; i < NCLOUDS; i++) {
      cl.push({ x: range(rng, 0.05, 0.95) * DESIGN_W, y: range(rng, 0.05, 0.75) * DESIGN_H, rx: range(rng, 900, 1600), ry: range(rng, 220, 420), s: range(rng, 0.12, 0.2), t: range(rng, -0.6, -0.2), ax: range(rng, 80, 200), p: rng() * TAU });
    }

    // ---- Lens flare ghosts along the line sun -> frame centre -> beyond ------------
    const discs = layer(kit.bokehSoft);
    const rings = layer(kit.ring);
    const hexes = layer(kit.bokehHex);
    const dots = layer(kit.dot);
    type Ghost = { p: ReturnType<typeof addParticle>; s: number; size: number; a: number };
    const ghosts: Ghost[] = [];
    const tints = params.ghostTints.map(hexToNum);
    const spec: [ReturnType<typeof layer>, typeof kit.dot, number, number, number][] = [
      // container, texture, position along line, size (design px), opacity
      [discs, kit.bokehSoft, 0.55, 300, 0.035],
      [rings, kit.ring, 0.9, 560, 0.02],
      [hexes, kit.bokehSoft, 1.2, 320, 0.03],
      [discs, kit.bokehSoft, 1.45, 270, 0.09],
      [hexes, kit.bokehHex, 1.7, 200, 0.025],
      [rings, kit.ring, 2.0, 700, 0.018],
      [discs, kit.bokehSoft, 2.3, 150, 0.04],
    ];
    spec.forEach(([pc, tex, s, size, a], i) => {
      const p = addParticle(pc, tex);
      p.tint = tints[i % tints.length];
      ghosts.push({ p, s, size, a });
    });
    // A tiny anamorphic rainbow ghost: three thin offset streaks (R, G, B).
        const rainbow = [0xff50b0, 0xffc040, 0x70ff70, 0x40d0ff, 0x4080ff, 0x3060ff].map((t) => {
      const p = addParticle(discs, kit.bokehSoft);
      p.tint = t;
      return p;
    });

    const uniforms = new UniformGroup({
      uSkyTop: { value: new Float32Array(hexToRgb(params.skyTop)), type: "vec3<f32>" },
      uSkyBot: { value: new Float32Array(hexToRgb(params.skyBottom)), type: "vec3<f32>" },
      uSkyNear: { value: new Float32Array(hexToRgb(params.skyNear)), type: "vec3<f32>" },
      uSunCore: { value: new Float32Array(hexToRgb(params.sunCore)), type: "vec3<f32>" },
      uSunGlow: { value: new Float32Array(hexToRgb(params.sunGlow)), type: "vec3<f32>" },
      uSun: { value: new Float32Array(2), type: "vec2<f32>" },
      uArms: { value: armData, type: "vec4<f32>", size: NARMS },
      uFine: { value: fineData, type: "vec4<f32>", size: NFINE },
      uClouds: { value: clouds, type: "vec4<f32>", size: NCLOUDS },
      uCloudsB: { value: cloudsB, type: "vec4<f32>", size: NCLOUDS },
      uCloudScroll: { value: 0, type: "f32" },
    });

    return {
      glsl: GLSL,
      uniforms,
      sprites: group(discs, rings, hexes, dots),
      post: { bloom1: 0.3, bloom2: 0.3, grain: 0.015, dither: true, spriteGain: 1, screen: true },
      update(frame) {
        const ph = frame / 600;
        const sun = sunAt(ph);
        const u = uniforms.uniforms;
        (u.uSun as Float32Array).set([sun.x, sun.y]);
        // Starburst rotates gently back and forth (closed, one cycle) and shimmers.
        const spin = 0.05 * Math.sin(TAU * ph);
        arms.forEach((a, i) => armData.set([a.a + spin, a.len * (0.9 + 0.1 * pulse(ph, a.k, a.p, 1)), a.i0 * (0.8 + 0.2 * pulse(ph, a.k, a.p + 1, 1)), a.w], i * 4));
        fines.forEach((f, i) => fineData.set([f.a + spin * 0.6, f.len, f.i0 * (0.25 + 0.75 * pulse(ph, f.k, f.p, 2)), f.w], i * 4));
        cl.forEach((c, i) => {
          clouds.set([c.x + c.ax * Math.sin(TAU * ph + c.p), c.y + 0.3 * c.ax * Math.cos(TAU * ph + c.p), c.rx, c.ry], i * 4);
          cloudsB.set([c.s, c.t, 0, 0], i * 4);
        });
        u.uCloudScroll = 3200 * ph; // one whole noise period (8 cells x 400 px) per loop

        const cx = DESIGN_W / 2;
        const cy = DESIGN_H / 2;
        for (const g of ghosts) {
          g.p.x = sun.x + (cx - sun.x) * g.s;
          g.p.y = sun.y + (cy - sun.y) * g.s;
          g.p.alpha = g.a;
          setSize(g.p, g.size);
        }
        // Iridescent smear far along the flare axis: overlapping ovals, pink -> yellow-green -> cyan.
        // It sits on the sun's height, mirrored across the frame centre horizontally.
        const rs = 2.2;
        rainbow.forEach((p, i) => {
          p.x = sun.x + (cx - sun.x) * rs + (i - 1) * 75;
          p.y = sun.y;
          p.alpha = i < 4 ? 0.6 : 0.3 - (i - 4) * 0.1;
          setSize(p, i < 4 ? 190 : 260, 85);
        });
      },
    };
  };
