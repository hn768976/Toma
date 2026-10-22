// GLSL for the cells, membranes and backdrop. Everything is procedural; no
// textures are loaded.

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Ashima simplex noise, range ~[-1, 1].
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

// Worley noise: returns (F1, F2) distances.
vec2 worley(vec3 p) {
  vec3 id = floor(p);
  vec3 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 o = vec3(float(i), float(j), float(k));
    vec3 r = o + hash3(id + o) * 0.85 - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return sqrt(vec2(f1, f2));
}

mat3 rotAxis(vec3 a, float ang) {
  a = normalize(a);
  float s = sin(ang), c = cos(ang), oc = 1.0 - c;
  return mat3(
    oc * a.x * a.x + c,       oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s,
    oc * a.x * a.y - a.z * s, oc * a.y * a.y + c,       oc * a.y * a.z + a.x * s,
    oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c);
}
`;

// Shared backdrop so cells can haze toward exactly the colour behind them.
const BACKDROP = /* glsl */ `
uniform vec3 uBgDark;
uniform vec3 uBgMid;
uniform vec3 uBgGlow;
uniform vec3 uBgStrip;
uniform float uTime;

// uv: 0..1, origin top-left, y down. aspect = 1192 / 672.
vec3 backdrop(vec2 uv) {
  float aspect = 1192.0 / 672.0;
  // Horizontal band of light through the middle of the frame.
  float band = exp(-pow((uv.y - 0.5) / 0.4, 2.0));
  band = max(band, 0.55 * smoothstep(0.6, 1.0, uv.y));
  vec3 col = mix(uBgDark, uBgMid, band * 0.55);
  // Darker vertical column left of centre, darker right edge.
  col = mix(col, uBgDark, 0.55 * exp(-pow((uv.x - 0.34) / 0.13, 2.0)));
  // Large soft backlight glow right of centre, elongated vertically and
  // leaning toward the top, drifting very slightly.
  // The backlight drifts in behind the hero cell and tightens as the scene
  // turns, so the frame edges darken over the clip.
  float k = smoothstep(0.0, 9.0, uTime);
  vec2 gc = vec2(mix(0.78, 0.55, k), mix(0.4, 0.46, k));
  float gs = mix(1.0, 0.68, k);
  vec2 d = (uv - gc) * vec2(aspect, 1.0);
  d = mat2(0.94, 0.34, -0.34, 0.94) * d;
  d *= vec2(1.0, 0.72) / gs;
  col = mix(col, uBgMid, 0.7 * exp(-dot(d, d) / 0.24));
  col = mix(col, uBgGlow, 0.97 * exp(-dot(d, d) / 0.075));
  // Fall off toward the right edge.
  col = mix(col, uBgDark * 0.95, smoothstep(0.86, 1.02, uv.x) * 0.85);
  // Pale light strip down the left edge, strongest at mid-height.
  float strip = exp(-pow(uv.x / 0.1, 2.0)) * (0.45 + 0.55 * band);
  col = mix(col, uBgStrip, strip * 0.85);
  // Darken top corners slightly.
  col *= 1.0 - 0.25 * smoothstep(0.25, 0.0, uv.y) * smoothstep(0.3, 1.0, uv.x);
  return col;
}

vec2 worldToUv(vec2 w) {
  return vec2(w.x / 1192.0 + 0.5, 0.5 - w.y / 672.0);
}
`;

export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const backgroundFragment = /* glsl */ `
${BACKDROP}
varying vec2 vUv;
float hashf(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 col = backdrop(vUv);
  // Fine dither to avoid banding in the smooth gradients.
  col += (hashf(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

// Height field of the cell surface: rounded blackberry-like lumps (Worley F1
// domes at two scales) over a soft low-frequency wobble.
const CELL_HEIGHT = /* glsl */ `
uniform float uSeed;
uniform mat3 uSpin;
float cellHeight(vec3 p) {
  vec3 q = uSpin * p + uSeed * 3.17;
  vec2 w = worley(q * 3.4);
  float lumps = 1.0 - w.x * w.x;
  vec2 w2 = worley(q * 7.5 + 11.0);
  float small = 1.0 - w2.x * w2.x;
  float wr = snoise(q * 1.5) + 0.5 * snoise(q * 3.1);
  return lumps * 0.5 + small * 0.2 + wr * 0.45;
}
`;

export const cellVertex = /* glsl */ `
${NOISE}
${CELL_HEIGHT}
uniform float uAmp;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec2 vWorld;

vec3 displaced(vec3 p) {
  return p * (1.0 + uAmp * cellHeight(p));
}

void main() {
  vec3 p = normalize(position);
  vec3 t1 = normalize(cross(p, abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(p, t1);
  float e = 0.012;
  vec3 a = displaced(p);
  vec3 b = displaced(normalize(p + t1 * e));
  vec3 c = displaced(normalize(p + t2 * e));
  vec3 n = normalize(cross(b - a, c - a));
  if (dot(n, p) < 0.0) n = -n;
  vObj = p;
  vNormalV = normalize(normalMatrix * n);
  vec4 world = modelMatrix * vec4(a, 1.0);
  vWorld = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const cellFragment = /* glsl */ `
${NOISE}
${BACKDROP}
${CELL_HEIGHT}
uniform vec3 uCore;
uniform vec3 uBody;
uniform vec3 uRim;
uniform vec3 uSeam;
uniform float uHaze;
uniform float uBump;
uniform float uSoft;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec2 vWorld;

// Fine wrinkles that only shade (no geometry).
float fineHeight(vec3 p) {
  vec3 q = uSpin * p + uSeed * 3.17;
  vec2 w = worley(q * 7.5 + 11.0);
  return (1.0 - w.x * w.x) * 0.35 + snoise(q * 12.0) * 0.04;
}

void main() {
  // The camera has no rotation, so object-space normals are view-space normals.
  vec3 n = normalize(vNormalV);
  vec3 p = normalize(vObj);
  vec3 t1 = normalize(cross(p, abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(p, t1);
  float e = 0.006;
  float h0 = fineHeight(p);
  float h1 = fineHeight(normalize(p + t1 * e));
  float h2 = fineHeight(normalize(p + t2 * e));
  vec3 nb = normalize(n - uBump * ((h1 - h0) / e * t1 + (h2 - h0) / e * t2));

  float ndv = clamp(n.z, 0.0, 1.0);
  float fres = 1.0 - ndv;
  float cav = smoothstep(0.05, 0.6, h0);

  // Translucent body: dark in the middle, lumps catching a soft key light.
  vec3 L = normalize(vec3(-0.35, 0.6, 0.72));
  float dif = max(dot(nb, L), 0.0);
  float back = pow(max(dot(nb, normalize(vec3(0.5, 0.1, -0.2))), 0.0), 2.0);
  vec3 col = mix(uCore, uBody, (0.02 + 0.9 * dif * dif * (0.3 + 0.7 * cav)) * (0.5 + 0.5 * smoothstep(0.0, 0.7, fres)));
  col += uSeam * back * 0.35;
  // Light scattering through the lumps towards the limb.
  col = mix(col, uSeam, smoothstep(0.45, 1.0, fres) * (0.2 + 0.25 * cav));
  // Backlit rim.
  col = mix(col, uRim, clamp(pow(fres, 2.1) * 1.3, 0.0, 1.0));
  col += uRim * pow(fres, 8.0) * 0.5;
  vec3 bg = backdrop(worldToUv(vWorld));
  col = mix(col, bg, uHaze);
  float alpha = smoothstep(0.0, uSoft, ndv);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

// Thin halo hugging the silhouette, so the rim glows slightly outside the body.
export const haloFragment = /* glsl */ `
uniform vec3 uRim;
uniform float uStrength;
varying vec3 vN;
void main() {
  float ndv = clamp(normalize(vN).z, 0.0, 1.0);
  float a = pow(1.0 - ndv, 3.0) * smoothstep(0.0, 0.25, ndv) * uStrength;
  gl_FragColor = vec4(uRim, a);
  #include <colorspace_fragment>
}
`;

// Membranes are drawn on camera-facing discs so the outline can be irregular,
// soft and broken in places, like the faint rings in the reference.
export const membraneVertex = /* glsl */ `
varying vec2 vLocal;
varying vec2 vWorld;
void main() {
  vLocal = position.xy;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const membraneFragment = /* glsl */ `
${NOISE}
${BACKDROP}
uniform vec3 uMembrane;
uniform float uOpacity;
uniform float uSeed;
uniform float uCoreRatio;
varying vec2 vLocal;
varying vec2 vWorld;
void main() {
  float ang = atan(vLocal.y, vLocal.x);
  vec2 dir = vec2(cos(ang), sin(ang));
  float slow = uTime * 0.15;
  // Wavy outline.
  float wav = snoise(vec3(dir * 1.3, uSeed + slow)) * 0.035
            + snoise(vec3(dir * 4.0, uSeed * 2.0 + slow)) * 0.012;
  float rho = length(vLocal) / (0.93 * (1.0 + wav));
  // Line strength varies around the ring; some stretches nearly vanish.
  float vis = smoothstep(-0.35, 0.6, snoise(vec3(dir * 1.1, uSeed * 3.0 + 7.0 + slow)));
  float line = exp(-pow((rho - 1.0) / 0.014, 2.0));
  float shadow = exp(-pow((rho - 0.975) / 0.02, 2.0));
  // Soft translucent fill, brightest just outside the nucleus.
  float fill = smoothstep(1.0, uCoreRatio, rho) * 0.12;
  vec3 bg = backdrop(worldToUv(vWorld));
  float aLine = line * (0.04 + 0.22 * vis) * uOpacity;
  float aShadow = shadow * 0.16 * vis * uOpacity;
  float aFill = fill * uOpacity;
  float outA = clamp(aLine + aShadow + aFill, 0.0, 1.0);
  vec3 outCol = (uMembrane * (aLine + aFill) + bg * 0.7 * aShadow) / max(aLine + aShadow + aFill, 1e-4);
  if (rho > 1.1) discard;
  gl_FragColor = vec4(outCol, outA);
  #include <colorspace_fragment>
}
`;

export const haloVertex = /* glsl */ `
varying vec3 vN;
void main() {
  vN = normalize(normalMatrix * normalize(position));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
