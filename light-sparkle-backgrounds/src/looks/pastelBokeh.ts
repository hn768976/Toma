import { UniformGroup } from "pixi.js";
import type { LookFactory } from "../kit/engine";
import { CYCLES, DESIGN_H, DESIGN_W, glintEnvelope, hexToRgb, mod, pulse, TAU, type Glint } from "../kit/loop";
import { addParticle, group, layer, setSize } from "../kit/particles";
import { mulberry32, pick, range, type Rng } from "../kit/random";

export type PastelBokehParams = { seed: number; top: string; mid: string; bottom: string };

const NLINES = 4;

const GLSL = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBot;
uniform vec4 uLineA[${NLINES}]; // y0, amp1, cycles1 across width, phase1
uniform vec4 uLineB[${NLINES}]; // amp2, cycles2, phase2, intensity
uniform float uBandPhase;

float lineY(int i, float x) {
  vec4 a = uLineA[i];
  vec4 b = uLineB[i];
  float u = x / 3840.0;
  return a.x + a.y * sin(TAU * a.z * u + a.w) + b.x * sin(TAU * b.y * u + b.z);
}
float lineSlope(int i, float x) {
  vec4 a = uLineA[i];
  vec4 b = uLineB[i];
  float u = x / 3840.0;
  return (a.y * TAU * a.z * cos(TAU * a.z * u + a.w) + b.x * TAU * b.y * cos(TAU * b.y * u + b.z)) / 3840.0;
}

vec3 background(vec2 p) {
  float y = p.y / 2160.0;
  // Multi-stop gradient in float; smoothstep keeps each segment C1 at the stops.
  vec3 g = y < 0.5 ? mix(uTop, uMid, smoothstep(0.0, 0.5, y)) : mix(uMid, uBot, smoothstep(0.5, 1.0, y));
  // Soft white glow band across the middle, slowly undulating (whole cycles).
  float by = 0.52 + 0.025 * sin(TAU * p.x / 3840.0 * 0.8 + uBandPhase);
  float band = exp(-pow((y - by) / 0.16, 2.0));
  g = mix(g, vec3(1.0), 0.22 * band);
  // Thin glowing wavy lines, white at ~40%.
  float lines = 0.0;
  for (int i = 0; i < ${NLINES}; i++) {
    float fy = lineY(i, p.x);
    float sl = lineSlope(i, p.x);
    float d = abs(p.y - fy) / sqrt(1.0 + sl * sl);
    float fade = smoothstep(0.0, 0.25, p.x / 3840.0) * smoothstep(1.0, 0.75, p.x / 3840.0) * 0.6 + 0.4;
    float core = exp(-d * d / (2.0 * 3.2 * 3.2));
    float glow = exp(-d * d / (2.0 * 22.0 * 22.0));
    lines += uLineB[i].w * fade * (0.85 * core + 0.35 * glow);
  }
  g = g + (1.0 - g) * clamp(0.55 * lines, 0.0, 1.0);
  return g;
}
`;

export const pastelBokeh =
  (params: PastelBokehParams): LookFactory =>
  (kit) => {
    const rng = mulberry32(params.seed);
    // Bias positions towards the bright middle band.
    const yMid = (r: Rng) => {
      if (r() < 0.7) return range(r, 0, DESIGN_H);
      const g = (r() + r() + r() - 1.5) / 1.5; // ~triangular in [-1,1]
      return DESIGN_H * (0.52 + 0.45 * g);
    };

    // ---- Wavy lines (JS mirror of the shader so sparkles can ride them) -------
    type Line = { y0: number; a1: number; c1: number; p1: number; m1: number; a2: number; c2: number; p2: number; m2: number; inten: number; ik: number; ip: number };
    const lines: Line[] = [];
    for (let i = 0; i < NLINES; i++) {
      lines.push({
        y0: DESIGN_H * (0.42 + 0.05 * i + range(rng, -0.02, 0.02)),
        a1: range(rng, 90, 200),
        c1: range(rng, 0.6, 1.3),
        p1: rng() * TAU,
        m1: pick(rng, [1, -1, 2]),
        a2: range(rng, 20, 60),
        c2: range(rng, 1.8, 3.2),
        p2: rng() * TAU,
        m2: pick(rng, [-1, 1, 2, -2]),
        inten: range(rng, 0.6, 1.0),
        ik: pick(rng, [1, 2]),
        ip: rng() * TAU,
      });
    }
    const lineA = new Float32Array(NLINES * 4);
    const lineB = new Float32Array(NLINES * 4);
    const setLines = (ph: number) => {
      lines.forEach((l, i) => {
        lineA.set([l.y0, l.a1, l.c1, l.p1 + TAU * l.m1 * ph], i * 4);
        lineB.set([l.a2, l.c2, l.p2 + TAU * l.m2 * ph, l.inten * (0.75 + 0.25 * Math.cos(TAU * l.ik * ph + l.ip))], i * 4);
      });
    };
    const lineY = (i: number, x: number) => {
      const u = x / DESIGN_W;
      return lineA[i * 4] + lineA[i * 4 + 1] * Math.sin(TAU * lineA[i * 4 + 2] * u + lineA[i * 4 + 3]) + lineB[i * 4] * Math.sin(TAU * lineB[i * 4 + 1] * u + lineB[i * 4 + 2]);
    };

    // ---- Bokeh: 900 discs in 3 depth layers --------------------------------------
    const back = layer(kit.bokehSoft);
    const midR = layer(kit.bokehRound);
    const midH = layer(kit.bokehHex);
    const front = layer(kit.bokehRound);
    type Disc = { p: ReturnType<typeof addParticle>; margin: number; x0: number; y0: number; wrap: number; n: number; bobA: number; bobK: number; bobP: number; size: number; a: number; k: number; phi: number };
    const discs: Disc[] = [];
    const LAYERS = [
      { count: 180, pcs: [back], tex: [kit.bokehSoft], size: [300, 600], alpha: [0.05, 0.11], n: 1 },
      { count: 300, pcs: [midR, midH], tex: [kit.bokehRound, kit.bokehHex], size: [120, 280], alpha: [0.09, 0.2], n: 1 },
      { count: 420, pcs: [front], tex: [kit.bokehRound], size: [40, 130], alpha: [0.16, 0.32], n: 2 },
    ];
    for (const L of LAYERS) {
      const margin = L.size[1] * 0.6;
      const wrap = DESIGN_W + 2 * margin;
      for (let i = 0; i < L.count; i++) {
        const which = Math.floor(rng() * L.pcs.length) % L.pcs.length;
        const p = addParticle(L.pcs[which], L.tex[which]);
        discs.push({
          p,
          margin,
          x0: range(rng, 0, wrap) - margin,
          y0: yMid(rng),
          wrap,
          n: L.n,
          bobA: range(rng, 10, 45),
          bobK: pick(rng, [1, 2]),
          bobP: rng() * TAU,
          size: range(rng, L.size[0], L.size[1]),
          a: range(rng, L.alpha[0], L.alpha[1]),
          k: pick(rng, [1, 2, 3, 4]),
          phi: rng() * TAU,
        });
      }
    }

    // ---- Sparkles ---------------------------------------------------------------
    const points = layer(kit.dot);
    const flares = layer(kit.flare4);
    type Pt = { p: ReturnType<typeof addParticle>; x0: number; y0: number; n: number; line: number; size: number; a: number; k: number; phi: number; sh: number; bobP: number };
    const pts: Pt[] = [];
    const PW = DESIGN_W + 100;
    for (let i = 0; i < 3000; i++) {
      const p = addParticle(points, kit.dot);
      pts.push({ p, x0: range(rng, 0, PW), y0: yMid(rng), n: rng() < 0.5 ? 1 : 0, line: -1, size: 26 + 60 * Math.pow(rng(), 2.5), a: range(rng, 0.25, 0.95), k: pick(rng, CYCLES), phi: rng() * TAU, sh: range(rng, 2, 5), bobP: rng() * TAU });
    }
    // Sparkles riding the wavy lines.
    for (let li = 0; li < NLINES; li++) {
      for (let j = 0; j < 30; j++) {
        const p = addParticle(points, kit.dot);
        pts.push({ p, x0: range(rng, 0, PW), y0: 0, n: pick(rng, [1, 2]), line: li, size: 40 + 50 * rng(), a: range(rng, 0.6, 1.0), k: pick(rng, CYCLES), phi: rng() * TAU, sh: range(rng, 1, 3), bobP: rng() * TAU });
      }
    }
    type Fl = { p: ReturnType<typeof addParticle>; x: number; y: number; size: number; a: number; k: number; phi: number };
    const fls: Fl[] = [];
    for (let i = 0; i < 60; i++) {
      const p = addParticle(flares, kit.flare4);
      p.rotation = range(rng, -0.1, 0.1);
      fls.push({ p, x: range(rng, 0, DESIGN_W), y: yMid(rng), size: range(rng, 110, 300), a: range(rng, 0.35, 0.75), k: pick(rng, CYCLES), phi: rng() * TAU });
    }
    const glints: Glint[] = [];
    for (let i = 0; i < 24; i++) glints.push({ target: Math.floor(rng() * fls.length), start: Math.floor(rng() * 600), dur: Math.floor(range(rng, 10, 16)), gain: range(rng, 0.8, 1.3) });
    const boost = new Float32Array(fls.length);

    const uniforms = new UniformGroup({
      uTop: { value: new Float32Array(hexToRgb(params.top)), type: "vec3<f32>" },
      uMid: { value: new Float32Array(hexToRgb(params.mid)), type: "vec3<f32>" },
      uBot: { value: new Float32Array(hexToRgb(params.bottom)), type: "vec3<f32>" },
      uLineA: { value: lineA, type: "vec4<f32>", size: NLINES },
      uLineB: { value: lineB, type: "vec4<f32>", size: NLINES },
      uBandPhase: { value: 0, type: "f32" },
    });

    return {
      glsl: GLSL,
      uniforms,
      sprites: group(back, midR, midH, front, points, flares),
      post: { bloom1: 0.25, bloom2: 0.0, grain: 0.02, dither: true, spriteGain: 1, screen: true },
      update(frame) {
        const ph = frame / 600;
        setLines(ph);
        uniforms.uniforms.uBandPhase = TAU * ph;
        for (const d of discs) {
          const m = d.margin;
          d.p.x = mod(d.x0 + m + d.n * d.wrap * ph, d.wrap) - m;
          d.p.y = d.y0 + d.bobA * Math.sin(TAU * d.bobK * ph + d.bobP);
          const tw = pulse(ph, d.k, d.phi, 1);
          d.p.alpha = d.a * (0.75 + 0.25 * tw);
          setSize(d.p, d.size);
        }
        for (const s of pts) {
          let x: number;
          let y: number;
          if (s.line >= 0) {
            x = mod(s.x0 + s.n * PW * ph, PW) - 50;
            y = lineY(s.line, x);
          } else if (s.n > 0) {
            x = mod(s.x0 + PW * ph, PW) - 50;
            y = s.y0 + 20 * Math.sin(TAU * ph + s.bobP);
          } else {
            x = s.x0 - 50 + 18 * Math.cos(TAU * ph + s.bobP);
            y = s.y0 + 18 * Math.sin(TAU * ph + s.bobP);
          }
          s.p.x = x;
          s.p.y = y;
          const tw = pulse(ph, s.k, s.phi, s.sh);
          s.p.alpha = s.a * (0.15 + 0.85 * tw);
          setSize(s.p, s.size * (0.7 + 0.4 * tw));
        }
        boost.fill(0);
        for (const g of glints) boost[g.target] = Math.max(boost[g.target], g.gain * glintEnvelope(frame, g));
        fls.forEach((f, i) => {
          const tw = pulse(ph, f.k, f.phi, 2);
          const b = boost[i];
          f.p.x = f.x;
          f.p.y = f.y;
          f.p.alpha = Math.min(1, f.a * (0.3 + 0.7 * tw) * (1 + b));
          setSize(f.p, f.size * (0.7 + 0.3 * tw) * (1 + 0.8 * b));
        });
      },
    };
  };
