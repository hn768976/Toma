import * as THREE from "three";
import { GlassColorway } from "../colorways";
import { hexToSrgb } from "../common/color";
import { LOOP } from "../common/constants";
import { FullscreenPass } from "../common/FullscreenPass";
import { GRAIN_DITHER, HASH } from "../common/glsl";
import { LoopRenderer } from "../common/GLLoop";
import { loopNoise, makeNoise2D } from "../common/noise";
import { mulberry32, range } from "../common/rng";

// ---- Seeded layout (module level) -------------------------------------------
const BLOB_COUNT = 6;
const noise = makeNoise2D(0x9e3779b1);
type Blob = { bx: number; by: number; amp: number; r: number; w: number; nx: number; ny: number };
// Composition (x in [0, 16/9], y in [0, 1]): a dark core in the middle ringed
// by brighter areas, the brightest light along the bottom edge. Each blob then
// wanders around its home on a loop-safe noise path.
const HOMES: [number, number, number, number][] = [
  // x, y, radius, weight (negative = dark)
  [0.72, 0.5, 0.22, -0.75],
  [0.4, 0.0, 0.3, 0.75],
  [1.15, -0.04, 0.28, 0.6],
  [0.05, 0.62, 0.3, 0.3],
  [1.5, 0.75, 0.3, 0.25],
  [1.75, 1.05, 0.18, -0.35],
];
const layoutRng = mulberry32(0x61a55b10);
const BLOBS: Blob[] = HOMES.map(([bx, by, r, w]) => ({
  bx,
  by,
  r,
  w,
  amp: range(layoutRng, 0.14, 0.26),
  nx: range(layoutRng, 0, 100),
  ny: range(layoutRng, 100, 200),
}));

/** Squares across the frame. */
const CELLS_ACROSS = 70;

const FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform vec3 uBlob[${BLOB_COUNT}];   // xy = centre (y in [0,1], x in [0,aspect]), z = radius
uniform float uBlobW[${BLOB_COUNT}];
uniform vec2 uWarp;                  // loop-phase warp (cos, sin)
uniform vec3 cDeep, cDark, cMid, cUpper, cBright;
uniform float uCell;                 // cell size in "p" units
${HASH}
${GRAIN_DITHER}

// Gradient noise (integer-hashed gradients), ~[0,1].
vec2 grd(vec2 i) {
  float a = hash33u(uvec3(ivec2(i) + 4096, 11u)).x * 6.2831853;
  return vec2(cos(a), sin(a));
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grd(i), f);
  float b = dot(grd(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(grd(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(grd(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.9 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Loop-safe fbm: the sample point travels around a closed circle in noise space.
float fbm(vec2 p) {
  vec2 o = uWarp * 0.9;
  float v = 0.0;
  v += 0.55 * vnoise(p + o);
  v += 0.30 * vnoise(p * 2.03 - o * 1.0 + 17.0);
  v += 0.15 * vnoise(p * 4.1 + vec2(o.y, -o.x) + 31.0);
  return v;
}

float field(vec2 p) {
  // Gentle domain warp: integer-frequency sin/cos of the loop phase.
  p += 0.035 * vec2(sin(p.y * 3.1 + uWarp.x * 1.7), cos(p.x * 2.7 + uWarp.y * 1.9));
  float f = 0.4 + 0.6 * (fbm(p * 3.2) - 0.5);
  for (int i = 0; i < ${BLOB_COUNT}; i++) {
    vec2 d = p - uBlob[i].xy;
    f += uBlobW[i] * exp(-dot(d, d) / (uBlob[i].z * uBlob[i].z));
  }
  return f;
}

vec3 ramp(float f) {
  f = clamp(f, 0.0, 1.25);
  // Dark end: the deep colour tinted towards both the dark colour and a
  // shadowed mid-tone, so shadows read navy/teal-black rather than flat violet.
  vec3 shadow = mix(cDark, cMid * 0.28, 0.15);
  vec3 c = mix(cDeep, shadow, smoothstep(-0.3, 0.25, f));
  c = mix(c, cMid, smoothstep(0.24, 0.58, f));
  c = mix(c, cUpper, smoothstep(0.6, 0.88, f));
  c = mix(c, cBright, smoothstep(0.86, 1.18, f));
  return c;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);

  // ---- glass block grid (gently rippled, as if the panel is not quite flat)
  vec2 pg = p + 0.006 * vec2(sin(p.y * 4.3 + uWarp.x * 1.3), sin(p.x * 3.1 + uWarp.y * 1.1));
  vec2 g = pg / uCell;
  vec2 id = floor(g);
  vec2 c = fract(g) - 0.5;                    // [-0.5, 0.5]
  vec2 centre = (id + 0.5) * uCell;

  // Bevelled pyramid: four facets meeting at a small rounded top. n2 is the
  // (smoothed) facet slope direction.
  vec2 ac = abs(c);
  float kx = smoothstep(-0.16, 0.16, ac.x - ac.y);
  vec2 n2 = vec2(sign(c.x) * kx, sign(c.y) * (1.0 - kx));
  float slope = smoothstep(0.0, 0.3, max(ac.x, ac.y));
  n2 *= slope;

  // Refraction: each block shows an inverted, magnified view of the gradient
  // around it, pushed sideways by the facet it is seen through.
  vec2 q = centre - c * uCell * 2.2 + n2 * uCell * 0.75;
  float f = field(q);
  vec3 col = ramp(f);

  // Shading lit from the top-left: one corner bright, the opposite one near black.
  float diag = clamp(0.5 + (-c.x + c.y) * 0.95, 0.0, 1.0);
  float facet = dot(n2, normalize(vec2(-1.0, 1.0)));       // -1..1
  float shade = mix(diag, 0.5 + 0.5 * facet, 0.45);
  col *= mix(0.14, 1.3, shade);
  // Specular glint on the lit bevel, stronger where the light behind is bright.
  float spec = pow(max(facet, 0.0), 3.0) * slope;
  col += mix(cMid, cBright, smoothstep(0.5, 1.0, f)) * spec * 0.35 * smoothstep(0.15, 0.7, f);

  // Soft glow of the bright light bleeding through the blocks.
  float glow = smoothstep(0.6, 1.2, field(p));
  col += cBright * glow * 0.28 + cMid * glow * 0.1;
  // Dark gaps between blocks (the bevels meet in a shadowed groove).
  float rimD = 0.5 - max(ac.x, ac.y);
  col *= mix(0.22, 1.0, smoothstep(0.0, 0.09, rimD));
  // Soft vignette, darker along the top edge.
  vec2 vq = vUv - 0.5;
  col *= (1.0 - 0.5 * dot(vq, vq)) * mix(0.65, 1.0, smoothstep(1.0, 0.82, vUv.y));

  col = clamp(col, 0.0, 1.0);
  outColor = vec4(grainDither(col), 1.0);
}
`;

export class GlassBlockRenderer implements LoopRenderer {
  private pass: FullscreenPass;

  constructor(cw: GlassColorway) {
    const v3 = (hex: string) => new THREE.Vector3(...hexToSrgb(hex));
    this.pass = new FullscreenPass(FRAG, {
      uRes: { value: new THREE.Vector2(1, 1) },
      uBlob: { value: BLOBS.map(() => new THREE.Vector3()) },
      uBlobW: { value: BLOBS.map((b) => b.w) },
      uWarp: { value: new THREE.Vector2() },
      cDeep: { value: v3(cw.deep) },
      cDark: { value: v3(cw.dark) },
      cMid: { value: v3(cw.mid) },
      cBright: { value: v3(cw.bright) },
      cUpper: { value: v3(cw.upper) },
      uCell: { value: 1 },
      uGrainFrame: { value: 0 },
      uGrain: { value: 0.02 },
    });
  }

  render(gl: THREE.WebGLRenderer, frame: number, w: number, h: number) {
    const phase = (frame % LOOP) / LOOP;
    const u = this.pass.uniforms;
    const aspect = w / h;
    u.uRes.value.set(w, h);
    u.uCell.value = aspect / CELLS_ACROSS;
    BLOBS.forEach((b, i) => {
      const x = b.bx + b.amp * 1.3 * loopNoise(noise, phase, b.nx, b.ny, 0.9);
      const y = b.by + b.amp * loopNoise(noise, phase, b.ny, b.nx, 0.9);
      const r = b.r * (1 + 0.18 * loopNoise(noise, phase, b.nx + 50, b.ny + 50, 0.7));
      (u.uBlob.value as THREE.Vector3[])[i].set(x, y, r);
    });
    const a = phase * Math.PI * 2;
    u.uWarp.value.set(Math.cos(a), Math.sin(a));
    u.uGrainFrame.value = frame % LOOP;
    this.pass.render(gl, null);
  }

  dispose() {
    this.pass.dispose();
  }
}
