// GLSL for Look 3. All animation comes in through uniforms/attributes that are
// computed from the Remotion frame; nothing reads a clock.
import { GLSL_HASH } from "../../lib/glsl";

// ── Circuit board ───────────────────────────────────────────────────────────
// Depth of field is analytic: every trace/pad is widened and dimmed by its own
// circle of confusion (aperture * |d - focus| / focus, in world units).
export const boardVert = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const boardFrag = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vWorld;
out vec4 outColor;
uniform vec3 uCam;
uniform float uFocus;
uniform float uAperture;
uniform vec3 uBase;
uniform vec3 uTraceA;
uniform vec3 uTraceB;
uniform vec3 uStack;
uniform float uStackGlow;   // 0..1 how much the stack lights the board
uniform vec2 uStackHalf;    // stack footprint half size
${GLSL_HASH}

float h2(ivec2 c, uint s) { return hash3u(uvec3(uint(c.x + 4096), uint(c.y + 4096), s)); }

// Blurred line profile: width w, blur b; energy-preserving.
float lineP(float d, float w, float b) {
  float s = w + b;
  return (w / s) * exp(-2.5 * d * d / (s * s));
}
// Blurred filled rectangle (centered), half size hs.
float boxP(vec2 q, vec2 hs, float b) {
  vec2 d = abs(q) - hs;
  float o = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float hm = min(hs.x, hs.y);
  float k = hm / (hm + b);            // spreads and dims with defocus
  return k * k * exp(-2.0 * max(o, 0.0) * max(o, 0.0) / (b * b + 1e-6)) * (o < 0.0 ? 1.0 : 1.0);
}
float chipP(vec2 q, vec2 hs, float b) {
  vec2 d = abs(q) - hs;
  float o = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  return 1.0 - smoothstep(-b, b + 1e-4, o);
}
// Smooth value noise for large-scale brightness variation.
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  float a = h2(c, 7u), b = h2(c + ivec2(1, 0), 7u), cc = h2(c + ivec2(0, 1), 7u), d = h2(c + ivec2(1, 1), 7u);
  return mix(mix(a, b, f.x), mix(cc, d, f.x), f.y);
}

void main() {
  vec2 p = vWorld.xz;
  float dist = length(uCam - vWorld);
  float coc = uAperture * abs(dist - uFocus) / uFocus;
  float pix = length(fwidth(p));
  float b = coc + pix * 0.7;

  float region = 0.35 + 0.9 * vnoise(p * 0.11) + 0.4 * vnoise(p * 0.37 + 11.0);

  // Major bus lines every 6 units, doubled.
  vec2 g6 = abs(fract(p / 6.0 + 0.5) - 0.5) * 6.0;
  float major = lineP(g6.x, 0.035, b) + lineP(g6.y, 0.035, b);
  major += 0.6 * (lineP(abs(g6.x - 0.22), 0.02, b) + lineP(abs(g6.y - 0.22), 0.02, b));

  // Traces on a 1-unit lattice: each cell may carry a horizontal/vertical run.
  ivec2 c1 = ivec2(floor(p));
  vec2 f1 = fract(p) - 0.5;
  float rh = h2(c1, 1u), rv = h2(c1, 2u), ri = h2(c1, 3u);
  float traces = 0.0;
  if (rh < 0.38) traces += (0.4 + ri) * lineP(f1.y, 0.018, b);
  if (rv < 0.30) traces += (0.4 + ri) * lineP(f1.x, 0.018, b);
  // finer offset traces
  vec2 f1b = fract(p + 0.25) - 0.5;
  ivec2 c1b = ivec2(floor(p + 0.25));
  if (h2(c1b, 4u) < 0.22) traces += 0.6 * lineP(f1b.y, 0.012, b);
  if (h2(c1b, 5u) < 0.18) traces += 0.6 * lineP(f1b.x, 0.012, b);

  // Pads on a 0.25 lattice
  vec2 p4 = p * 4.0;
  ivec2 c4 = ivec2(floor(p4));
  vec2 f4 = (fract(p4) - 0.5) / 4.0;
  float pads = h2(c4, 6u) < 0.07 ? boxP(f4, vec2(0.03), b) * (0.5 + h2(c4, 8u)) : 0.0;

  // Chips on a 3-unit lattice: dark body, thin bright outline.
  vec2 p3 = p / 3.0;
  ivec2 c3 = ivec2(floor(p3));
  vec2 f3 = (fract(p3) - 0.5) * 3.0;
  float chipBody = 0.0, chipEdge = 0.0;
  if (h2(c3, 9u) < 0.35) {
    vec2 hs = vec2(0.45 + 0.6 * h2(c3, 10u), 0.35 + 0.5 * h2(c3, 11u));
    chipBody = chipP(f3, hs, b);
    vec2 d = abs(f3) - hs;
    float o = abs(max(d.x, d.y));
    chipEdge = lineP(o, 0.012, b) * step(max(d.x, d.y), 0.05 + b);
  }

  // Stack light pooling on the board.
  vec2 q = abs(p) - uStackHalf;
  float sd = length(max(q, 0.0));
  float pool = exp(-sd * sd / 0.5) * 0.9 + exp(-sd / 2.2) * 0.16;
  float lit = uStackGlow * pool;

  vec3 col = uBase * (1.0 + 0.6 * region);
  col = mix(col, uBase * 0.5, chipBody * 0.8);
  col += uTraceA * major * 0.9 * region;
  col += mix(uTraceB, uTraceA, ri) * traces * 0.55 * region;
  col += uTraceA * chipEdge * 0.7 * region;
  col += mix(uTraceA, vec3(1.0), 0.3) * pads * 0.9 * region;
  // traces near the stack pick up its colour
  col += uStack * lit * (0.12 + 1.8 * (traces + major + pads));
  // distance falloff into darkness
  col *= exp(-max(dist - 10.0, 0.0) * 0.035);
  outColor = vec4(col, 1.0);
}
`;

// ── Small lights / particles: instanced camera-facing discs ────────────────
// Defocused lights grow into bokeh discs and dim to keep their energy.
export const spriteVert = /* glsl */ `
in vec3 aOffset;
in vec3 aColor;
in vec2 aSizePhase;  // world radius, twinkle phase
in float aRate;      // twinkle rate (radians per frame)
uniform vec3 uCam;
uniform float uFocus;
uniform float uAperture;
uniform float uFrame;
uniform float uGain;
out vec2 vUv;
out vec3 vColor;
out float vEnergy;
out float vSharp;
void main() {
  float dist = length(uCam - aOffset);
  float coc = uAperture * abs(dist - uFocus) / uFocus;
  float r = aSizePhase.x;
  float R = r + coc * 0.9;
  vec4 mv = viewMatrix * vec4(aOffset, 1.0);
  mv.xy += position.xy * R * 2.0;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0; // -1..1
  float tw = 0.65 + 0.35 * sin(aRate * uFrame + aSizePhase.y);
  vColor = aColor * tw * uGain;
  vEnergy = (r * r) / (R * R);
  vSharp = r / R;
}
`;

export const spriteFrag = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vColor;
in float vEnergy;
in float vSharp;
out vec4 outColor;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  // sharp: bright core with soft falloff; defocused: flat disc with soft rim
  float core = exp(-d * d * 6.0);
  float disc = (1.0 - smoothstep(0.82, 1.0, d)) * (0.85 + 0.15 * smoothstep(0.5, 0.95, d));
  float shape = mix(disc, core, vSharp * vSharp);
  outColor = vec4(vColor * shape * vEnergy * 3.0, 1.0);
}
`;

// ── Glass slabs and outline box ────────────────────────────────────────────
export const glassVert = /* glsl */ `
in float aAppear;
in float aFlash;
out vec3 vLocal;
out vec3 vN;
out vec3 vWorld;
out float vAppear;
out float vFlash;
void main() {
  vLocal = position;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(m) * normal);
  vAppear = aAppear;
  vFlash = aFlash;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const glassFrag = /* glsl */ `
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vN;
in vec3 vWorld;
in float vAppear;
in float vFlash;
out vec4 outColor;
uniform vec3 uCam;
uniform vec3 uColor;
uniform vec3 uHalf;      // half extents of the geometry
uniform float uBase;     // body fill
uniform float uEdge;     // edge brightness
uniform float uGrid;     // inner grid/dots on the top face
uniform float uBright;   // whole-stack brightening
uniform float uShimmer;  // world-y of the shimmer band (or -99)
${GLSL_HASH}
void main() {
  vec3 V = normalize(uCam - vWorld);
  vec3 N = normalize(vN);
  float fres = pow(1.0 - abs(dot(N, V)), 3.0);
  vec3 an = abs(N);
  vec3 d = max(uHalf - abs(vLocal), 0.0);     // distance to each pair of faces
  // distance to the nearest edge of the face we are on
  float e = an.y > 0.5 ? min(d.x, d.z) : (an.x > 0.5 ? min(d.y, d.z) : min(d.x, d.y));
  float pixel = length(fwidth(vLocal));
  float edge = exp(-e / max(0.012, pixel)) + 0.35 * exp(-e / 0.08);
  float top = step(0.5, N.y);
  // faint inner grid and dots on the top face
  vec2 g = abs(fract(vLocal.xz / 0.24 + 0.5) - 0.5) * 0.24;
  float grid = exp(-min(g.x, g.y) / max(0.004, pixel * 0.6)) * top;
  ivec2 c = ivec2(floor(vLocal.xz / 0.12 + 64.0));
  float dots = 0.0;
  if (hash3u(uvec3(uint(c.x), uint(c.y), 77u)) < 0.12) {
    vec2 f = fract(vLocal.xz / 0.12) - 0.5;
    dots = exp(-dot(f, f) * 60.0) * top;
  }
  float sy = (vWorld.y - uShimmer) / 0.22;
  float shimmer = exp(-min(sy * sy, 60.0));
  float body = uBase * (0.55 + 0.45 * top) + 0.35 * fres;
  float I = body + uEdge * edge * (1.0 + 3.5 * vFlash) + uGrid * (0.35 * grid + 0.9 * dots) + 0.6 * shimmer * (edge + 0.4);
  vec3 col = uColor * I * uBright * vAppear;
  col += vec3(1.0) * uEdge * edge * vFlash * 0.8 * vAppear; // white-hot flash on landing
  outColor = vec4(col, 1.0);
}
`;

// ── Post: downsample / upsample (bloom) and composite ──────────────────────
export const fsVert = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const downFrag = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uPrefilter;
void main() {
  vec2 t = uTexel;
  vec3 a = texture(uSrc, vUv + t * vec2(-2.0, 2.0)).rgb;
  vec3 b = texture(uSrc, vUv + t * vec2(0.0, 2.0)).rgb;
  vec3 c = texture(uSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 d = texture(uSrc, vUv + t * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture(uSrc, vUv).rgb;
  vec3 f = texture(uSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture(uSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture(uSrc, vUv + t * vec2(0.0, -2.0)).rgb;
  vec3 i = texture(uSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 j = texture(uSrc, vUv + t * vec2(-1.0, 1.0)).rgb;
  vec3 k = texture(uSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  vec3 l = texture(uSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture(uSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter > 0.5) {
    float br = max(o.r, max(o.g, o.b));
    o *= smoothstep(0.5, 2.0, br);
  }
  outColor = vec4(o, 1.0);
}
`;

export const upFrag = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;   // lower (smaller) level, being upsampled
uniform sampler2D uBase;  // current level
uniform vec2 uTexel;
void main() {
  vec2 t = uTexel;
  vec3 s = texture(uSrc, vUv).rgb * 4.0;
  s += (texture(uSrc, vUv + t * vec2(-1.0, 0.0)).rgb + texture(uSrc, vUv + t * vec2(1.0, 0.0)).rgb +
        texture(uSrc, vUv + t * vec2(0.0, -1.0)).rgb + texture(uSrc, vUv + t * vec2(0.0, 1.0)).rgb) * 2.0;
  s += texture(uSrc, vUv + t * vec2(-1.0, -1.0)).rgb + texture(uSrc, vUv + t * vec2(1.0, -1.0)).rgb +
       texture(uSrc, vUv + t * vec2(-1.0, 1.0)).rgb + texture(uSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  outColor = vec4(texture(uBase, vUv).rgb + s / 16.0, 1.0);
}
`;

export const compositeFrag = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uCA;        // chromatic aberration at the corners (uv units)
uniform float uExposure;
uniform uint uFrame;
${GLSL_HASH}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 fetch(vec2 uv) {
  return texture(uScene, uv).rgb + uBloomStrength * texture(uBloom, uv).rgb;
}
void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c * vec2(1.0, 0.5625));
  float k = uCA * r2 * 4.0;   // zero in the middle, strongest at the frame edges
  vec3 col;
  col.r = fetch(0.5 + c * (1.0 + k)).r;
  col.g = fetch(vUv).g;
  col.b = fetch(0.5 + c * (1.0 - k)).b;
  col *= uExposure;
  col *= 1.0 - 0.35 * smoothstep(0.15, 0.75, length(c * vec2(1.0, 0.75)));
  vec3 srgb = toSRGB(aces(col));
  uvec3 key = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uFrame);
  srgb += 0.02 * 0.5 * tri(key);                          // ~2% grain (peak-to-peak)
  srgb += (hash3u(key + uvec3(101u, 211u, 307u)) - 0.5) * (2.0 / 255.0); // ±1/255 dither
  outColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;
