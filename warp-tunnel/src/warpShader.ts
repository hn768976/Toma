/**
 * "Warp Tunnel" — a hyperspace flight through a violet nebula tunnel.
 * Fibrous light streams radiate from a dark vanishing point while star
 * streaks rush past the camera. Camera (vanishing point, roll, travel) and
 * intensity envelopes are supplied as uniforms from TypeScript so each
 * version can define its own camera move.
 */
export const warpFragmentShader = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

uniform vec2 uCenter;    // vanishing point, in height units from frame centre
uniform float uRoll;     // camera roll (radians)
uniform float uTravel;   // distance travelled down the tunnel
uniform float uDensity;  // nebula density envelope
uniform float uFlare;    // cyan/white flare envelope
uniform float uHole;     // radius of the dark core

uniform vec3 uDeep;
uniform vec3 uViolet;
uniform vec3 uLavender;
uniform vec3 uCyan;
uniform vec3 uBlue;
uniform vec3 uPink;

out vec4 outColor;

const float TAU = 6.28318530718;

float hash1(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 157.0 + 113.0 * i.z;
  return mix(
    mix(mix(hash1(n + 0.0), hash1(n + 1.0), f.x),
        mix(hash1(n + 157.0), hash1(n + 158.0), f.x), f.y),
    mix(mix(hash1(n + 113.0), hash1(n + 114.0), f.x),
        mix(hash1(n + 270.0), hash1(n + 271.0), f.x), f.y), f.z);
}

float fbm3(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

// Star streaks laid out on a polar grid (angle x log-radius) so that they
// accelerate outward like objects passing a moving camera.
float starLayer(float a, float r, float cells, float lr, float travel, float seed, float density) {
  float A = (a / TAU + 0.5) * cells;
  float L = log(r) * lr - travel;
  vec2 id = floor(vec2(A, L));
  vec2 f = fract(vec2(A, L));
  id.x = mod(id.x, cells);
  float h = hash2(id + seed);
  if (h > density) return 0.0;
  vec2 c = vec2(0.3 + 0.4 * hash2(id + seed + 7.1), 0.3 + 0.4 * hash2(id + seed + 3.7));
  float dA = (f.x - c.x) * (TAU * r / cells);   // tangential distance (height units)
  float dR = (f.y - c.y) * (r / lr);             // radial distance
  float size = 0.6 + 0.8 * hash2(id + seed + 9.9);
  float w = (0.0015 + 0.0008 * r) * size;
  float len = (0.004 + 0.026 * r * r) * size;
  float s = exp(-pow(dA / w, 2.0) - pow(dR / len, 2.0));
  return s * (0.35 + 0.85 * hash2(id + seed + 1.3)) * smoothstep(uHole * 1.1, uHole * 1.1 + 0.18, r);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  vec2 q = rot(uRoll) * (p - uCenter);
  float r = length(q);
  float a = atan(q.y, q.x);
  vec2 dir = vec2(cos(a), sin(a));

  // Perspective depth of the tunnel wall seen at this radius
  float z = 0.32 / max(r, 0.002);
  float w = z * 0.55 - uTravel;

  // Broad nebula clouds + fine fibres (high angular frequency)
  float broad = fbm3(vec3(dir * 1.6, w * 0.35));
  float clumps = fbm3(vec3(dir * 4.5 + 3.0, w * 0.7));
  float fibre = fbm3(vec3(dir * 12.0, w * 1.6));
  float fine = noise3(vec3(dir * 55.0, w * 3.0));

  float body = broad * 0.6 + clumps * 0.4;
  float neb = smoothstep(0.50 - 0.20 * uDensity, 0.66 - 0.06 * uDensity, body);
  // Fibrous light streams: strongest inside the clouds, faint wisps outside
  float strands = smoothstep(0.35, 0.75, fibre);
  neb = neb * (0.35 + 0.95 * strands) + 0.10 * strands * uDensity;
  neb += 0.18 * (fine - 0.5) * neb;
  // Painterly clumps travelling outward along each stream
  float lr = log(r);
  float clumpTex = fbm3(vec3(dir * 26.0, lr * 5.0 - uTravel * 2.2));
  neb *= 0.55 + 0.9 * smoothstep(0.3, 0.7, clumpTex);
  // Dim, grainy nebula floor so the gaps between streams are never empty
  float floorNeb = (0.13 + 0.2 * fibre) * smoothstep(0.25, 0.6, body) * uDensity;
  neb = max(neb, floorNeb);
  // Fibrous grain / dust inside the streams
  float grain = noise3(vec3(dir * 150.0, lr * 26.0 - uTravel * 3.0));
  float dust = noise3(vec3(dir * 70.0 + 5.0, lr * 12.0 - uTravel * 2.6));
  neb *= 0.68 + 0.45 * grain + 0.25 * (dust - 0.5);
  neb = clamp(neb, 0.0, 1.4);

  // Dark core with an irregular, soft rim
  float holeR = uHole * (0.75 + 0.5 * fbm3(vec3(dir * 2.2, uTime * 0.35)));
  float core = smoothstep(holeR, holeR + 0.16, r);
  float radial = core * (0.55 + 0.6 * smoothstep(0.1, 0.9, r));

  vec3 col = uDeep * neb * 1.5;
  col = mix(col, uViolet, smoothstep(0.2, 0.75, neb) * 0.95);
  col += uBlue * smoothstep(0.55, 0.95, clumps) * neb * 0.35;
  col = mix(col, uLavender, smoothstep(0.85, 1.25, neb) * 0.65);
  // Occasional pink / magenta accents inside dense clumps
  float pinkMask = smoothstep(0.66, 0.82, fbm3(vec3(dir * 5.0 + 21.0, w * 0.8)));
  col = mix(col, uPink * (0.6 + 0.6 * neb), pinkMask * smoothstep(0.4, 0.9, neb) * 0.55);
  col *= radial * 1.1;

  // Cyan / white flares racing past
  float fl = fbm3(vec3(dir * 2.4 + 11.0, w * 0.5));
  float flareMask = smoothstep(0.60 - 0.08 * uFlare, 0.72, fl) * uFlare * core;
  float flare = flareMask * (0.45 + 0.75 * strands) * (0.6 + 0.6 * smoothstep(0.3, 0.7, clumpTex));
  flare *= smoothstep(0.12, 0.45, r) * (0.3 + 0.9 * smoothstep(0.1, 0.6, neb));
  col = mix(col, uLavender, clamp(flare * 0.8, 0.0, 0.6));
  col += uCyan * flare * 1.9;
  col += vec3(0.9, 0.97, 1.0) * pow(clamp(flare, 0.0, 1.0), 1.5) * 1.1;

  // Star streaks (three depth layers)
  float stars = 0.0;
  stars += starLayer(a, r, 220.0, 9.0, uTravel * 2.6, 1.0, 0.13);
  stars += starLayer(a, r, 380.0, 14.0, uTravel * 3.4, 17.0, 0.06) * 0.8;
  stars += starLayer(a, r, 600.0, 22.0, uTravel * 4.6, 41.0, 0.04) * 0.6;
  col += mix(vec3(0.85, 0.85, 1.0), uCyan, 0.25) * stars * 1.1;

  // Subtle grain to keep gradients clean after compression
  col += (hash2(gl_FragCoord.xy + fract(uTime * 7.13) * 97.0) - 0.5) / 255.0;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
