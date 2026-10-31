import { POOL_DEPTH, RING_R, RING_r } from "./config";

const f = (n: number) => n.toFixed(5);

/**
 * GLSL shared by the float material and the water material: uniforms, the
 * analytic torus, the float's surface pattern and its lighting model.
 * Everything is shaded in linear space and gamma-encoded at the very end.
 */
export const COMMON_GLSL = /* glsl */ `
precision highp float;

#define TAU 6.28318530718
#define PI 3.14159265359
const float RING_R = ${f(RING_R)};
const float RING_r = ${f(RING_r)};
const float POOL_DEPTH = ${f(POOL_DEPTH)};

uniform float uTime;
uniform vec3 uCam;
uniform vec3 uSunDir;          // unit vector pointing towards the sun
uniform vec3 uLightPos;        // key light position (casts the slightly enlarged floor shadow)
uniform mat4 uRing;            // ring local -> world
uniform mat4 uRingInv;         // world -> ring local
uniform float uKind;           // 0 = stripes, 1 = watermelon
uniform vec3 uFloatA;
uniform vec3 uFloatB;
uniform vec3 uFloatC;
uniform vec3 uSeeds;
uniform vec3 uSky;
uniform vec3 uWaterTint;

float sdTorus(vec3 p) {
  vec2 q = vec2(length(p.xz) - RING_R, p.y);
  return length(q) - RING_r;
}

vec3 torusNormal(vec3 p) {
  vec2 dir = normalize(p.xz + 1e-6);
  vec3 c = vec3(dir.x * RING_R, 0.0, dir.y * RING_R);
  return normalize(p - c);
}

/* Width of an angle's screen-space derivative that ignores the +-PI seam. */
float angleWidth(float a, float aAlt) {
  float w1 = fwidth(a);
  float w2 = fwidth(aAlt);
  return min(w1, w2);
}

float aaStep(float edge, float x, float w) {
  return smoothstep(edge - w, edge + w, x);
}

vec3 stripesAlbedo(float phi, float th, float wPhi, float wTh) {
  const float N = 22.0;           // stripe pairs around the ring
  // Stripes are straight across the outer wall and sweep sideways by exactly
  // one stripe period over the top of the tube towards the hole (S-curve).
  // A whole period keeps the pattern seamless where th wraps at +-PI.
  float g = smoothstep(-0.6, 2.9, th);
  float gx = clamp((th + 0.6) / 3.5, 0.0, 1.0);
  float dg = 6.0 * gx * (1.0 - gx) / 3.5;
  float s = phi / TAU * N - g;
  float w = (wPhi / TAU * N + wTh * dg) * 0.7 + 1e-4;
  w = min(w, 0.2);
  float tri = abs(fract(s) - 0.5);
  float m = aaStep(0.25, tri, w);
  return mix(uFloatB, uFloatA, m);
}

/* Teardrop seed: rounded head, tail pointing along +y. Returns coverage. */
float seed(vec2 q, float aa) {
  float rad = 0.062;
  float len = 0.125;
  float d;
  if (q.y < 0.0) {
    d = length(q) - rad;
  } else {
    float hw = rad * (1.0 - q.y / len);
    d = max(abs(q.x) - hw, q.y - len);
    d = min(d, length(q) - rad);
  }
  return 1.0 - smoothstep(-aa, aa, d);
}

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

vec3 watermelonAlbedo(float phi, float th, float wPhi, float wTh) {
  float h = sin(th);                       // +1 top of the tube, -1 bottom
  float aa = max(wTh, 1e-4) * 0.9;
  // wavy boundary between flesh and rind, above the outer equator so it reads from above
  float wave = 0.012 * sin(phi * 19.0 + 0.6);
  float zig = abs(fract(phi / TAU * 64.0) - 0.5) * 2.0;          // 0..1 triangle
  // outer wall: wide rind band; inner wall (hole): only a thin dark crescent low down
  float outerness = smoothstep(-0.6, 0.4, cos(th));
  float b1 = mix(-0.22, 0.5 + wave, outerness);                  // flesh / rind
  float b2 = b1 - mix(0.1, 0.22, outerness) + 0.07 * zig * outerness + 0.02 * sin(phi * 7.0); // rind / skin
  float hw = aa * abs(cos(th)) + 0.004;

  // dark green skin with soft stripes
  float stripe = 0.5 + 0.5 * sin(phi * 30.0 + 2.2 * sin(th * 2.0));
  vec3 skin = mix(uFloatC, uFloatC * 0.55, smoothstep(0.35, 0.75, stripe));
  vec3 col = skin;
  col = mix(col, uFloatB, aaStep(b2, h, hw));
  col = mix(col, uFloatA, aaStep(b1, h, hw));

  // seeds, in rows across the top of the tube
  float cov = 0.0;
  for (int k = 0; k < 4; k++) {
    float thk = 0.9 + float(k) * 0.55;
    float circ = TAU * (RING_R + RING_r * cos(thk));
    float n = floor(circ / 0.41);
    float off = mod(float(k), 2.0) * 0.5 + 0.13 * float(k);
    float u = phi / TAU * n + off;
    float cell = floor(u);
    float jit = hash11(cell + float(k) * 17.0) - 0.5;
    float jit2 = hash11(cell * 1.3 + float(k) * 31.0) - 0.5;
    vec2 q = vec2((fract(u) - 0.5 + jit * 0.25) * circ / n,
                  (th - thk - jit2 * 0.12) * RING_r);
    float pxw = (wPhi / TAU * circ + wTh * RING_r) * 0.6 + 1e-4;
    cov = max(cov, seed(q, pxw));
  }
  float flesh = aaStep(b1 + 0.1, h, hw);
  col = mix(col, uSeeds, cov * flesh);
  return col;
}

vec3 floatAlbedo(vec3 p) {
  float phi = atan(p.z, p.x);
  float phiAlt = atan(-p.z, -p.x);
  float rad = length(p.xz);
  float th = atan(p.y, rad - RING_R);
  float thAlt = atan(-p.y, -(rad - RING_R));
  float wPhi = angleWidth(phi, phiAlt);
  float wTh = angleWidth(th, thAlt);
  if (uKind < 0.5) return stripesAlbedo(phi, th, wPhi, wTh);
  return watermelonAlbedo(phi, th, wPhi, wTh);
}

vec3 skyRadiance(vec3 dir) {
  float up = clamp(dir.y, -1.0, 1.0);
  vec3 zenith = uSky * 1.25;
  vec3 horizon = mix(uSky, vec3(1.0), 0.55) * 1.15;
  vec3 below = uWaterTint * 0.9;
  vec3 c = up > 0.0 ? mix(horizon, zenith, pow(up, 0.6)) : mix(horizon, below, pow(-up, 0.5));
  float s = max(dot(dir, uSunDir), 0.0);
  c += vec3(1.0, 0.97, 0.92) * (pow(s, 8.0) * 0.8 + pow(s, 40.0) * 0.9);
  return c;
}

/* Glossy inflatable PVC. */
vec3 shadeFloat(vec3 albedo, vec3 N, vec3 V, float occl) {
  float ndl = max(dot(N, uSunDir), 0.0);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 hemi = mix(uWaterTint * 0.4, mix(uSky, vec3(1.0), 0.5), smoothstep(-0.8, 1.0, N.y));
  vec3 diffuse = albedo * (hemi * 0.72 + vec3(1.0, 0.98, 0.95) * ndl * 1.3 * occl);
  vec3 R = reflect(-V, N);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  vec3 env = skyRadiance(R);
  vec3 H = normalize(uSunDir + V);
  float spec = (pow(max(dot(N, H), 0.0), 50.0) * 0.3 + pow(max(dot(N, H), 0.0), 14.0) * 0.12) * occl;
  return diffuse + env * mix(0.022, 0.55, fres) + vec3(spec);
}

vec3 toSRGB(vec3 c) {
  c = c / (1.0 + 0.08 * c);   // very gentle shoulder
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;

export const FLOAT_VERTEX = /* glsl */ `
out vec3 vLocal;
out vec3 vWorld;
out vec3 vNormalW;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const FLOAT_FRAGMENT = /* glsl */ `
${COMMON_GLSL}
in vec3 vLocal;
in vec3 vWorld;
in vec3 vNormalW;
out vec4 outColor;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(uCam - vWorld);
  vec3 albedo = floatAlbedo(vLocal);
  // self-shadow: the far half of the tube shades the inner wall a little
  vec3 nl = torusNormal(vLocal);
  float inner = smoothstep(0.2, -0.6, dot(normalize(vec3(vLocal.x, 0.0, vLocal.z)), nl));
  float occl = 1.0 - 0.25 * inner * smoothstep(0.3, -0.2, nl.y);
  vec3 col = shadeFloat(albedo, N, V, occl);
  // underside picks up the bright blue of the water it sits on
  float under = smoothstep(-0.05, -0.7, N.y);
  col = mix(col, uWaterTint * 1.35, under * 0.55);
  // parts below the waterline (seen through the mesh where water is thin)
  float sub = smoothstep(0.0, -0.06, vWorld.y);
  col = mix(col, col * uWaterTint * 1.4, sub * 0.6);
  outColor = vec4(toSRGB(col), 1.0);
}
`;

export const WATER_VERTEX = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const WATER_FRAGMENT = /* glsl */ `
${COMMON_GLSL}
uniform vec3 uFloorLit;
uniform vec3 uFloorDark;
uniform vec3 uShadow;
uniform vec3 uCaustic;
uniform float uCausticGain;

in vec3 vWorld;
out vec4 outColor;

/* ---------- surface waves ---------- */
const int NW = 8;
vec3 waveDirAmp(int i) {
  // direction.xy, amplitude
  if (i == 0) return vec3(normalize(vec2(1.0, 0.35)), 0.016);
  if (i == 1) return vec3(normalize(vec2(-0.6, 1.0)), 0.012);
  if (i == 2) return vec3(normalize(vec2(0.2, -1.0)), 0.009);
  if (i == 3) return vec3(normalize(vec2(-1.0, -0.45)), 0.007);
  if (i == 4) return vec3(normalize(vec2(0.85, 0.9)), 0.005);
  if (i == 5) return vec3(normalize(vec2(-0.25, 0.7)), 0.004);
  if (i == 6) return vec3(normalize(vec2(0.9, -0.3)), 0.001);
  return vec3(normalize(vec2(-0.7, -0.8)), 0.0007);
}
vec2 waveKW(int i) {
  // wavenumber, angular speed
  if (i == 0) return vec2(2.3, 1.15);
  if (i == 1) return vec2(3.1, 1.45);
  if (i == 2) return vec2(4.4, 1.9);
  if (i == 3) return vec2(5.7, 2.2);
  if (i == 4) return vec2(8.3, 2.9);
  if (i == 5) return vec2(11.0, 3.4);
  if (i == 6) return vec2(16.0, 4.1);
  return vec2(21.0, 4.7);
}

vec3 waterNormal(vec2 p, float t) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < NW; i++) {
    vec3 da = waveDirAmp(i);
    vec2 kw = waveKW(i);
    float ph = dot(da.xy, p) * kw.x - kw.y * t * 3.2 + float(i) * 1.7;
    g += da.xy * da.z * kw.x * cos(ph);
  }
  return normalize(vec3(-g.x, 1.0, -g.y));
}

/* ---------- caustics (animated Voronoi border network) ---------- */
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), fr = fract(p);
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  float a = hash2(i).x, b = hash2(i + vec2(1, 0)).x;
  float c = hash2(i + vec2(0, 1)).x, d = hash2(i + vec2(1, 1)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// x: distance to the nearest cell border, y: per-cell random, z: distance to point
vec3 voronoi(vec2 x, float t) {
  vec2 n = floor(x), fr = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash2(n + g);
    o = 0.5 + 0.4 * sin(t + TAU * o);
    vec2 r = g + o - fr;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  float bd = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = hash2(n + g);
    o = 0.5 + 0.4 * sin(t + TAU * o);
    vec2 r = g + o - fr;
    vec2 dd = r - mr;
    if (dot(dd, dd) > 1e-5) bd = min(bd, dot(0.5 * (mr + r), normalize(dd)));
  }
  return vec3(bd, hash2(n + mg).y, sqrt(md));
}

// returns (line brightness, cell darkness)
vec2 caustics(vec2 p, float t) {
  vec2 warp = vec2(vnoise(p * 0.55 + vec2(t * 0.5, 3.1)), vnoise(p * 0.55 + vec2(7.3, -t * 0.42))) - 0.5;
  vec2 q = p * 1.9 + warp * 1.5;
  vec3 a = voronoi(q, t * 4.6);
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  vec3 b = voronoi(rot * q * 1.63 + vec2(4.2, 1.3), t * 5.9 + 2.0);
  float wa = 0.09 + 0.07 * vnoise(q * 1.3 + t * 1.1);
  float brk = smoothstep(0.25, 0.75, vnoise(q * 1.6 - t * 0.9));
  float la = exp(-pow(a.x / wa, 2.0)) * (0.35 + 0.65 * brk);
  float lb = exp(-pow(b.x / (wa * 0.8), 2.0)) * smoothstep(0.3, 0.8, vnoise(q * 2.3 + 5.0));
  float glow = exp(-a.x / 0.22) * 0.3;
  float lines = max(la, lb * 0.45) + glow;
  float dark = smoothstep(0.06, 0.3, a.x) * smoothstep(0.25, 0.9, a.y) + 0.35 * smoothstep(0.1, 0.35, b.x) * step(0.6, b.y);
  float blot = smoothstep(0.55, 0.85, vnoise(p * 0.8 + vec2(-t * 0.15, t * 0.1)));
  dark = max(dark, blot * 0.9);
  return vec2(lines, dark);
}

/* ---------- float shadow on the floor ---------- */
float ringShadow(vec3 start, vec3 dir, float maxT) {
  // Penumbra centred on the true silhouette: march against a tube shrunk by W
  // and fade over +-W, so the shadow (and its hole) keep their real size.
  const float W = 0.045;
  float dmin = 1e3;
  float t = 0.0;
  for (int i = 0; i < 48; i++) {
    vec3 pl = (uRingInv * vec4(start + dir * t, 1.0)).xyz;
    float d = sdTorus(pl) + W;
    dmin = min(dmin, d);
    if (d < 0.001) return 0.0;
    t += clamp(d, 0.012, 0.3);
    if (t > maxT) break;
  }
  return smoothstep(0.0, 2.0 * W, dmin);
}

vec3 floorColor(vec3 F, float t) {
  vec2 c = caustics(F.xz, t);
  vec3 lit = mix(uFloorLit, uFloorDark, c.y * 0.85);
  lit += (uCaustic - lit) * clamp(c.x * uCausticGain, 0.0, 1.0);

  // light path: refracted sunlight through the wavy surface
  // The key light is a distant-but-finite source, so the shadow is slightly
  // magnified like in the reference.
  vec3 Ld = normalize(uLightPos - F);
  vec3 Lw = refract(-Ld, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  vec3 S = F - Lw * (F.y / Lw.y);
  Ld = normalize(uLightPos - S);
  vec3 n = waterNormal(S.xz, t);
  Lw = refract(-Ld, n, 1.0 / 1.333);
  S = F - Lw * (F.y / Lw.y);
  Ld = normalize(uLightPos - S);

  vec3 ringC = (uRing * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sh = 1.0;
  if (length(S.xz - ringC.xz) < RING_R + RING_r + 0.6) {
    // underwater part of the ray first, then the air part
    vec3 up = -Lw;
    float sUnder = ringShadow(S - up * 0.5, up, 0.5);
    float sAir = ringShadow(S, Ld, 4.0);
    sh = min(sUnder, sAir);
  }
  return mix(uShadow, lit, sh);
}

void main() {
  float t = uTime;
  vec3 P = vWorld;
  vec3 V = normalize(uCam - P);
  vec3 N = waterNormal(P.xz, t);
  vec3 rd = refract(-V, N, 1.0 / 1.333);

  vec3 col;
  bool hitFloat = false;
  vec3 ringC = (uRing * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  // submerged part of the float, seen through the water
  if (length(P.xz - ringC.xz) < RING_R + RING_r + 0.9) {
    float tt = 0.0;
    for (int i = 0; i < 36; i++) {
      vec3 pw = P + rd * tt;
      vec3 pl = (uRingInv * vec4(pw, 1.0)).xyz;
      float d = sdTorus(pl);
      if (d < 0.002) {
        vec3 nl = torusNormal(pl);
        vec3 nw = normalize(transpose(mat3(uRingInv)) * nl);
        vec3 alb = floatAlbedo(pl);
        vec3 c = shadeFloat(alb, nw, -rd, 0.8);
        float depth = clamp(-pw.y, 0.0, 1.0);
        col = mix(c * mix(vec3(1.0), uWaterTint * 1.6, 0.55), uWaterTint, 0.25 + 0.5 * depth);
        hitFloat = true;
        break;
      }
      tt += max(d, 0.01);
      if (pw.y < -0.7 || tt > 2.5) break;
    }
  }

  if (!hitFloat) {
    vec3 F = P + rd * ((-POOL_DEPTH - P.y) / rd.y);
    col = floorColor(F, t);
    float dist = length(F - P);
    col = mix(col, uWaterTint, 1.0 - exp(-dist * 0.035));
  }

  // facet shading: tilted surface patches read lighter / darker
  float facet = dot(N.xz, normalize(vec2(0.3, -1.0)));
  col *= 1.0 + clamp(facet * 2.5, -0.1, 0.1);

  // surface reflection
  vec3 R = reflect(-V, N);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col = mix(col, skyRadiance(R), fres * 0.15);
  

  outColor = vec4(toSRGB(col), 1.0);
}
`;
