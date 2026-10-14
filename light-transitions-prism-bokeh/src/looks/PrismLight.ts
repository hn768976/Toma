import { Container } from "pixi.js";
import { fullscreenMesh, GLSL_COMMON } from "../lib/gl";
import type { LookBuilder } from "../lib/stage";
import { hexToRgb } from "../lib/timeline";
import { mulberry32, range } from "../lib/random";

export interface PrismLightParams {
  /** Six-stop cyclic spectrum. */
  spectrum: [string, string, string, string, string, string];
  coreColor: string;
}

const LOOP = 600;
const BASE = 5; // 5 base shards x 6-fold symmetry = 30 shards

const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform float uAspect;
uniform float uPhi;                 // global rotation (0 .. TAU/6 over the loop)
uniform vec3 uSpec[6];
uniform vec3 uCoreCol;
uniform vec4 uShA[${BASE}];        // angle, rIn, rOut, halfWidth(rad)
uniform vec4 uShB[${BASE}];        // hue, intensity, twist, kind (0 wedge .. 1 triangle)
${GLSL_COMMON}

vec3 spectrum(float h) {
  h = fract(h) * 6.0;
  int i = int(floor(h));
  float f = smoothstep(0.0, 1.0, fract(h));
  vec3 a = uSpec[i];
  vec3 b = uSpec[(i + 1) % 6];
  return mix(a, b, f);
}

void main() {
  vec2 p = vec2(vUV.x * uAspect, vUV.y);
  vec2 d = p - vec2(0.5 * uAspect, 0.5);
  float r = length(d);
  float a = atan(d.y, d.x) - uPhi;
  const float SECTOR = TAU / 6.0;
  // Background: blurred radial light streaks over an indigo field. Every angular
  // term has a whole number of periods per 60 degrees, so the 6-fold symmetry is exact.
  float st = 0.5 + 0.26 * sin(a * 6.0 + 1.3 + 2.0 * r) + 0.16 * sin(a * 12.0 - 0.7 - 3.0 * r);
  st = mix(0.5, st, smoothstep(0.05, 0.45, r));   // no sharp convergence at the centre
  vec3 acc = mix(uSpec[2] * vec3(0.7, 0.5, 1.0), uSpec[1], 0.5 + 0.5 * sin(a * 6.0 + 0.9 * r)) * (0.2 + 0.36 * st);
  acc += uSpec[0] * 0.12 * (0.5 + 0.5 * sin(a * 6.0 + 2.4));
  vec3 bg = acc;
  acc = vec3(0.0);
  // Fold into one 60-degree sector.
  float af = mod(a, SECTOR);
  float sumM = 0.0, sumM2 = 0.0;
  for (int k = 0; k < ${BASE}; k++) {
    vec4 A = uShA[k];
    vec4 B = uShB[k];
    for (int j = -1; j <= 1; j++) {
      float ang = A.x + B.z * (r - A.y);              // swirl: angle drifts with radius
      float da = af - ang + float(j) * SECTOR;
      float u = sat((r - A.y) / max(A.z - A.y, 1e-3)); // 0 inner .. 1 outer
      float hw = A.w * mix(0.85, 0.35 + 0.65 * (1.0 - u), B.w);   // blocks (kind 0) or tapering blades (kind 1)
      float arc = da * r;
      float half_ = hw * r + 0.01;
      float soft = 0.018 + 0.035 * r;                  // soft facet edges, softer far out
      float m = smoothstep(half_ + soft, half_ - soft, abs(arc));
      m *= smoothstep(A.y - 0.04, A.y + 0.04, r) * (1.0 - smoothstep(A.z - 0.06, A.z + 0.06, r));
      // Facets: a faint internal edge splits each shard into two planes.
      float facet = mix(0.75, 1.0, smoothstep(-0.02, 0.02, arc - 0.25 * half_));
      m *= B.y * facet;
      // Dispersion: hue sweeps across the shard (a rainbow band), stronger on "triangle" shards.
      float t = arc / max(half_, 1e-3);
      // Solid facet colour, with a rainbow fringe running along one edge only.
      float fringe = smoothstep(0.35, 0.95, t);
      float hue = B.x + 0.04 * t + 0.08 * r + fringe * 0.7 * (t - 0.45);
      acc += spectrum(hue) * m * (1.0 + 0.5 * fringe);
      sumM += m; sumM2 += m * m;
    }
  }
  // Facets cover the background (they read as solid light, not as a tint on blue).
  acc += bg * (1.0 - 0.75 * min(sumM, 1.0));
  // White glints where shards overlap (sum of pairwise products).
  float overlap = max(0.5 * (sumM * sumM - sumM2), 0.0);
  acc += vec3(1.0) * smoothstep(0.5, 1.6, overlap) * 0.6;
  // Darker violet centre.
  acc *= mix(0.4, 1.0, smoothstep(0.03, 0.3, r));
  acc += uCoreCol * exp(-r * r / 0.02) * 0.35;
  // Deep indigo toward the edges and corners.
  acc *= mix(1.0, 0.5, smoothstep(0.65, 1.1, r));
  vec3 c = 1.0 - exp(-acc * 1.05);
  c = sat3(mix(vec3(luma(c)), c, 1.35));   // keep the refracted colours saturated
  finalColor = vec4(c, 1.0);
}`;

// Shard layout: generated once at module level from a fixed seed.
const rng = mulberry32(0x9c1a4e);
const SHARDS = Array.from({ length: BASE }, (_, k) => ({
  angle: (k / BASE) * ((Math.PI * 2) / 6) + range(rng, -0.08, 0.08),
  rIn: range(rng, 0.22, 0.75),
  len: range(rng, 0.25, 0.6),
  halfWidth: range(rng, 0.12, 0.26),
  hue: (k / BASE + 0.66) % 1 + range(rng, -0.03, 0.03), // k = 0 gold, k = 1 salmon-pink, then magenta, violet, cyan
  intensity: k === 0 ? range(rng, 0.85, 1.0) : k === 1 ? range(rng, 0.9, 1.15) : range(rng, 0.5, 1.0),
  twist: range(rng, -0.9, 0.9),
  kind: rng() < 0.35 ? 0 : 1,
  // Radial pulse: whole cycles per loop so frame 600 == frame 0.
  cycles: 1 + Math.floor(rng() * 3),
  phase: rng(),
}));

export const buildPrismLight: LookBuilder<PrismLightParams> = ({ width, height }, params) => {
  const aspect = width / height;
  const spec = new Float32Array(18);
  params.spectrum.forEach((h, i) => spec.set(hexToRgb(h), i * 3));
  const { mesh, u } = fullscreenMesh(width, height, FRAG, {
    uAspect: { value: aspect, type: "f32" },
    uPhi: { value: 0, type: "f32" },
    uSpec: { value: spec, type: "vec3<f32>", size: 6 },
    uCoreCol: { value: new Float32Array(hexToRgb(params.coreColor)), type: "vec3<f32>" },
    uShA: { value: new Float32Array(4 * BASE), type: "vec4<f32>", size: BASE },
    uShB: { value: new Float32Array(4 * BASE), type: "vec4<f32>", size: BASE },
  });
  const scene = new Container();
  scene.addChild(mesh);

  return {
    scene,
    update(frame) {
      // Loop phase is computed from frame mod 600, so frame 600 is bit-identical to 0.
      const f = ((frame % LOOP) + LOOP) % LOOP;
      const ph = f / LOOP;
      // Exactly 1/6 turn per loop; with 6-fold symmetry the loop is exact.
      u.uPhi = ph * ((Math.PI * 2) / 6);
      const A = u.uShA as Float32Array;
      const B = u.uShB as Float32Array;
      SHARDS.forEach((s, k) => {
        const w = Math.sin(2 * Math.PI * (s.cycles * ph + s.phase));
        const pulse = 1 + 0.16 * w;
        A.set([s.angle, s.rIn * pulse, (s.rIn + s.len) * (1 + 0.1 * w), s.halfWidth], k * 4);
        B.set([s.hue + 0.06 * w, s.intensity * (0.85 + 0.15 * w), s.twist, s.kind], k * 4);
      });
    },
  };
};
