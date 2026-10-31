/**
 * "Crack Glow" fragment shader (WebGL 2 / GLSL ES 3.00).
 *
 * A dark Voronoi-fractured stone surface viewed through a perspective camera.
 * A light streak strikes the surface, and an energy wave travels outward
 * through the cracks, lighting them up (two colour families: a primary and an
 * accent colour), with a starburst and volumetric-style rays at the impact.
 *
 * Everything is a pure function of the frame number, so the render is
 * deterministic and loops exactly every CYCLE frames.
 */
export const crackFragmentShader = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uFrame;

// Timing / camera
uniform float uCycle;        // frames per energy-pulse cycle
uniform float uCamYaw;       // extra camera yaw (radians) - used by variants
uniform float uCamTilt;      // camera tilt from straight-down (radians)
uniform float uCamDist;      // base camera distance
uniform float uCamOrbit;     // amount of orbit across the cycle (radians)
uniform float uCamPush;      // dolly amount across the cycle

// Palette
uniform vec3 uCrackA;        // primary crack colour
uniform vec3 uCrackB;        // accent crack colour
uniform vec3 uStreak;        // light-streak colour
uniform vec3 uFlare;         // impact starburst colour
uniform vec3 uTile;          // diffuse tint of the stone tiles
uniform vec3 uSpec;          // edge highlight tint
uniform vec3 uBg;            // ambient / fog colour
uniform float uAccentAmount; // how much of the network uses the accent colour

out vec4 outColor;

const float PI = 3.14159265359;

uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
uint hash2u(ivec2 p) {
  return hashu(uint(p.x) * 0x9e3779b1u ^ hashu(uint(p.y) + 0x632be5abu));
}
float h1(ivec2 p) { return float(hash2u(p)) * (1.0 / 4294967295.0); }
vec2 h2(ivec2 p) {
  uint a = hash2u(p);
  uint b = hashu(a ^ 0x27d4eb2fu);
  return vec2(float(a), float(b)) * (1.0 / 4294967295.0);
}

float vnoise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = h1(i), b = h1(i + ivec2(1, 0));
  float c = h1(i + ivec2(0, 1)), d = h1(i + ivec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float noise1(float x, float seed) {
  float i = floor(x); float f = fract(x);
  float a = h1(ivec2(int(i), int(seed)));
  float b = h1(ivec2(int(i) + 1, int(seed)));
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}

// Voronoi with exact border distance (after I. Quilez).
// Returns: x = distance to nearest border, yz = border normal (towards neighbour)
// Outputs: cell id, neighbour id across the nearest border, offset to cell centre.
vec3 voronoi(vec2 x, out ivec2 cellId, out ivec2 nbId, out vec2 toCenter) {
  ivec2 n = ivec2(floor(x));
  vec2 f = fract(x);
  ivec2 mg = ivec2(0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    ivec2 g = ivec2(i, j);
    vec2 o = 0.12 + 0.76 * h2(n + g);
    vec2 r = vec2(g) + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  vec2 bn = vec2(1.0, 0.0);
  ivec2 nb = n + mg;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    ivec2 g = mg + ivec2(i, j);
    vec2 o = 0.12 + 0.76 * h2(n + g);
    vec2 r = vec2(g) + o - f;
    vec2 dr = r - mr;
    if (dot(dr, dr) > 1e-5) {
      vec2 dn = normalize(dr);
      float e = dot(0.5 * (mr + r), dn);
      if (e < md) { md = e; bn = dn; nb = n + g; }
    }
  }
  cellId = n + mg;
  nbId = nb;
  toCenter = mr;
  return vec3(md, bn);
}

struct Cam { vec3 ro; vec3 fw; vec3 rt; vec3 up; float focal; };

Cam makeCam(float tc) {
  float k = tc / uCycle;                       // 0..1 across the pulse
  float ease = k * k * (3.0 - 2.0 * k);
  float yaw = uCamYaw + mix(-0.5, 0.5, ease) * uCamOrbit;
  float dist = uCamDist * (1.0 + uCamPush * (ease - 0.5));
  vec3 target = vec3(0.35 + 0.25 * ease, 0.15 - 0.10 * ease, 0.0);
  float tilt = uCamTilt;
  vec3 offs = vec3(sin(yaw) * sin(tilt), -cos(yaw) * sin(tilt), cos(tilt)) * dist;
  Cam c;
  c.ro = target + offs;
  c.fw = normalize(target - c.ro);
  float roll = -0.10 + 0.12 * ease;
  vec3 worldUp = normalize(vec3(-sin(yaw), cos(yaw), 0.0) + vec3(cos(yaw), sin(yaw), 0.0) * roll);
  c.rt = normalize(cross(c.fw, worldUp));
  c.up = cross(c.rt, c.fw);
  c.focal = 1.55;
  return c;
}

vec2 projectToScreen(Cam c, vec3 p) {
  vec3 q = p - c.ro;
  float z = dot(q, c.fw);
  return vec2(dot(q, c.rt), dot(q, c.up)) / z * c.focal;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;   // y up, height = 1
  float tc = mod(uFrame, uCycle);                          // frame inside the cycle

  Cam cam = makeCam(tc);
  vec3 rd = normalize(cam.fw * cam.focal + uv.x * cam.rt + uv.y * cam.up);
  float tHit = -cam.ro.z / rd.z;
  vec3 P = cam.ro + rd * tHit;           // hit point on the z = 0 plane
  vec2 p = P.xy;
  float pixelWorld = tHit / (cam.focal * uResolution.y);  // world size of a pixel

  // ---- Voronoi fracture ----------------------------------------------------
  const float CELL = 1.45;               // cells per world unit
  ivec2 cid, nid; vec2 toC;
  vec3 vor = voronoi(p * CELL, cid, nid, toC);
  float ed = vor.x / CELL;              // world distance to nearest border
  vec2 bdir = vor.yz;                   // border normal, towards neighbour
  float aa = max(pixelWorld * 1.2, 1e-4);

  // edge identity (order independent) for per-crack variation
  ivec2 lo = min(cid, nid), hi = max(cid, nid);
  float eRand = h1(lo * 31 + hi * 7 + ivec2(13, 71));
  float eRand2 = h1(lo * 11 + hi * 53 + ivec2(5, 3));

  float gapW = 0.010 + 0.010 * eRand2;  // half-width of the crack gap
  float gap = 1.0 - smoothstep(gapW - aa, gapW + aa, ed);

  // ---- Tile shading --------------------------------------------------------
  vec2 cr = h2(cid * 3 + ivec2(7, 1)) - 0.5;
  vec3 nTile = normalize(vec3(cr * 0.55, 1.0));
  float bevelW = 0.032;
  float bev = 1.0 - smoothstep(gapW, gapW + bevelW, ed);
  vec3 nBevel = normalize(vec3(bdir * 1.4, 0.55));
  vec3 N = normalize(mix(nTile, nBevel, bev * bev));

  vec3 Ldir = normalize(vec3(-0.80, -0.30, 0.32));
  vec3 V = normalize(cam.ro - P);
  vec3 H = normalize(Ldir + V);
  float diff = max(dot(N, Ldir), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 60.0);
  // the key light is a broad soft spot that favours the left side of frame
  float spot = 0.15 + 0.85 * smoothstep(0.9, -0.75, uv.x + 0.35 * uv.y);
  float cellVar = 0.65 + 0.7 * h1(cid + ivec2(91, 17));
  vec3 tile = uTile * 0.010 * (0.02 + 0.98 * diff * diff * diff) * spot * cellVar;
  tile += uSpec * 0.035 * spec * (0.15 + 1.4 * bev) * spot;
  tile += uBg * 0.35;
  tile *= 1.0 - gap * 0.92;

  // ---- Energy wave through the cracks -------------------------------------
  vec3 impact = vec3(0.55, 0.55, 0.0);
  float r = length(p - impact.xy);
  float t0 = 4.0;
  float x = clamp((tc - t0) / 78.0, 0.0, 1.0);
  float R = 6.4 * pow(x, 0.72);                      // lit radius
  // each crack segment ignites slightly early or late -> ragged, organic front
  float behind = R - r - (eRand2 - 0.5) * 0.9 - (fbm(p * 1.3) - 0.5) * 0.8;
  float lit = smoothstep(-0.15, 0.10, behind);
  float decay = exp(-max(behind, 0.0) / (0.45 + 0.6 * x));
  float front = exp(-pow(behind / 0.35, 2.0));
  float flash = exp(-r / 0.9) * exp(-max(tc - 9.0, 0.0) / 6.0) * smoothstep(3.0, 7.0, tc);
  float env = smoothstep(2.5, 6.0, tc) * (1.0 - smoothstep(58.0, 86.0, tc));
  float energy = (lit * (0.55 * decay + 0.75 * front) + 1.6 * flash) * env;

  // per-crack flicker / variation: some cracks stay dark, some burn hotter
  float edgeOn = smoothstep(0.22, 0.42, eRand) * (0.55 + 0.75 * eRand2);
  energy *= edgeOn;

  // accent colour lives in patches, biased towards the upper-right of impact
  vec2 rel = p - impact.xy;
  float accentField = fbm(p * 0.55 + vec2(3.7, 1.3)) + 0.35 * dot(normalize(rel + 1e-4), normalize(vec2(0.6, 0.8)));
  float accent = smoothstep(0.62 - uAccentAmount, 0.80 - uAccentAmount, accentField);
  vec3 crackCol = mix(uCrackA, uCrackB, accent);
  crackCol = mix(crackCol, mix(crackCol, vec3(1.0), 0.5), 0.25 * front * env);

  float core = exp(-max(ed - gapW * 0.2, 0.0) / (0.006 + aa));
  float halo = exp(-ed / 0.03);
  float bloom = exp(-ed / 0.16);
  vec3 glow = crackCol * energy * (2.2 * core * mix(0.35, 1.0, gap) + 0.20 * halo + 0.006 * bloom);
  // glow reflected on the near bevel faces of the slabs

  vec3 col = tile + glow;

  // ---- Screen-space effects (streak, starburst, rays) ----------------------
  vec2 s = projectToScreen(cam, impact);
  vec2 d = uv - s;
  float dl = length(d);

  // diagonal light streak coming in from the top of frame
  vec2 sdir = normalize(vec2(-0.42, 1.0));
  float along = dot(d, sdir);
  float perp = abs(dot(d, vec2(-sdir.y, sdir.x)));
  float streakEnv = smoothstep(1.5, 4.0, tc) * (1.0 - smoothstep(8.0, 18.0, tc));
  float streakLen = smoothstep(-0.25, 0.05, along) * (1.0 - smoothstep(0.6, 1.6, along));
  float streak = (exp(-perp / 0.0035) * 1.4 + exp(-perp / 0.03) * 0.35 + exp(-perp / 0.12) * 0.10);
  col += uStreak * streak * streakLen * streakEnv * 1.6;

  // impact starburst
  float ang = atan(d.y, d.x);
  float burstEnv = smoothstep(3.0, 6.0, tc) * exp(-max(tc - 8.0, 0.0) / 9.0);
  float spikes = pow(noise1(ang * 9.0 / PI * 4.0, 1.0), 4.0) + 0.6 * pow(noise1(ang * 3.0 / PI * 4.0, 2.0), 6.0);
  float burst = exp(-dl / 0.02) * 1.4 + exp(-dl / 0.10) * 0.18 + spikes * exp(-dl / 0.24) * 0.3;
  col += uFlare * burst * burstEnv;

  // volumetric-style rays radiating from the lit region
  float rayEnv = smoothstep(4.0, 10.0, tc) * (1.0 - smoothstep(18.0, 44.0, tc));
  float rays = pow(noise1(ang * 22.0 / PI, 5.0), 3.0) * 0.8 + pow(noise1(ang * 7.0 / PI, 9.0), 3.0) * 0.6;
  col += mix(uCrackA, uFlare, 0.5) * rays * exp(-dl / 0.55) * smoothstep(0.03, 0.25, dl) * rayEnv * 0.05;

  // ambient haze lit by the energy
  col += mix(uCrackA, uCrackB, 0.25) * 0.006 * env * exp(-dl / 0.6) * exp(-x * 3.0);

  // ---- Grade --------------------------------------------------------------
  float vig = smoothstep(1.25, 0.25, length(uv * vec2(0.85, 1.1)));
  col *= mix(0.35, 1.0, vig);
  col = max(col - 0.0012, 0.0);
  col = 1.0 - exp(-col * 1.15);                  // soft filmic shoulder
  col = pow(col, vec3(1.0 / 2.2));
  // tiny deterministic dither against banding
  col += (h1(ivec2(frag) + ivec2(int(uFrame) * 7, 3)) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
