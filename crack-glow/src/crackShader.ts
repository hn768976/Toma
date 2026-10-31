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
uniform vec2 uTarget;        // camera target = impact point on the surface

// Palette
uniform vec3 uCrackA;        // primary crack colour
uniform vec3 uCrackB;        // accent (warm side) crack colour
uniform vec3 uCrackM;        // mid-tone crack colour
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

// 1D value noise repeating every \`period\` cells (seamless around a circle)
float noise1p(float x, int period, float seed) {
  float i = floor(x); float f = fract(x);
  int i0 = ((int(i) % period) + period) % period;
  int i1 = (i0 + 1) % period;
  float a = h1(ivec2(i0, int(seed)));
  float b = h1(ivec2(i1, int(seed)));
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}
// angle (radians) -> seamless noise with \`cycles\` cells around the circle
float angNoise(float ang, int cycles, float seed) {
  return noise1p((ang / (2.0 * PI) + 0.5) * float(cycles), cycles, seed);
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
  float yaw = uCamYaw + (ease - 0.5) * uCamOrbit;
  float dist = uCamDist * (1.0 + uCamPush * (ease - 0.5));
  vec3 target = vec3(uTarget, 0.0);
  float tilt = uCamTilt;
  vec3 offs = vec3(sin(yaw) * sin(tilt), -cos(yaw) * sin(tilt), cos(tilt)) * dist;
  Cam c;
  c.ro = target + offs;
  c.fw = normalize(target - c.ro);
  float roll = -0.05;
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
  // The stone is almost black; only bevelled shard edges catch a faint rim
  // light, mostly towards the frame borders (the centre reads as a dark pit).
  vec2 cr = h2(cid * 3 + ivec2(7, 1)) - 0.5;
  vec3 nTile = normalize(vec3(cr * 0.6, 1.0));
  float bevelW = 0.05;
  float bevT = 1.0 - smoothstep(gapW, gapW + bevelW, ed);
  float bev = bevT * bevT * (3.0 - 2.0 * bevT);
  vec3 nBevel = normalize(vec3(bdir * 1.2, 0.6));
  vec3 N = normalize(mix(nTile, nBevel, bev));

  vec3 Ldir = normalize(vec3(-0.80, -0.30, 0.32));
  vec3 V = normalize(cam.ro - P);
  vec3 H = normalize(Ldir + V);
  float diff = max(dot(N, Ldir), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 40.0);
  float rimZone = smoothstep(0.45, 1.05, length(uv * vec2(0.85, 1.35)));
  float cellVar = 0.5 + h1(cid + ivec2(91, 17));
  vec3 tile = uTile * 0.006 * (0.10 + diff * diff) * (0.25 + 0.75 * rimZone) * cellVar;
  tile += uSpec * 0.09 * spec * bev * rimZone * cellVar;
  tile += uBg * 0.15;
  tile *= 1.0 - gap;

  // ---- Energy wave through the cracks -------------------------------------
  // The impact point is the camera target, so it sits at frame centre.
  vec3 impact = vec3(uTarget, 0.0);
  vec2 rel = p - impact.xy;
  float r = length(rel);
  float x = clamp((tc - 4.0) / 62.0, 0.0, 1.0);
  float R = 3.8 * pow(x, 0.6);                        // radius of the wavefront
  // each crack segment ignites slightly early or late -> ragged, organic front
  float behind = R - r - (eRand2 - 0.5) * 0.5 - (fbm(p * 1.3) - 0.5) * 0.5;
  float lit = smoothstep(-0.12, 0.08, behind);
  float trail = exp(-max(behind, 0.0) / 0.42);      // centre goes dark behind the front
  float energy = lit * trail;
  energy *= mix(0.55, 1.0, smoothstep(3.0, 16.0, tc)) * (1.0 - smoothstep(54.0, 80.0, tc)) * step(4.0, tc);

  // per-crack variation: some cracks stay dark, some burn hotter
  float edgeOn = smoothstep(0.18, 0.40, eRand) * (0.55 + 0.75 * eRand2);
  energy *= edgeOn;

  // colour follows direction from the impact: accent (warm) towards the
  // upper right, mid tone in between, primary towards the lower left.
  float dirW = dot(normalize(rel + 1e-4), normalize(vec2(0.75, 0.66)));
  dirW += 0.45 * (fbm(p * 0.8 + vec2(3.7, 1.3)) - 0.5) + uAccentAmount;
  vec3 crackCol = mix(uCrackA, uCrackM, smoothstep(-0.55, 0.0, dirW));
  crackCol = mix(crackCol, uCrackB, smoothstep(0.15, 0.55, dirW));

  float core = exp(-max(ed - gapW * 0.2, 0.0) / (0.005 + aa));
  float halo = exp(-ed / 0.022);
  float glowAmt = 0.80 * core * mix(0.4, 1.0, gap) + 0.16 * halo;
  vec3 glow = crackCol * energy * glowAmt;
  // the hottest cracks near the leading edge flare slightly brighter
  glow *= 1.0 + 0.6 * exp(-pow(behind / 0.25, 2.0));

  vec3 col = tile + glow;

  // ---- Screen-space effects (streak, small impact burst) -------------------
  vec2 s = projectToScreen(cam, impact);
  vec2 d = uv - s;
  float dl = length(d);

  // thin light streak arriving diagonally from the top of frame
  vec2 sdir = normalize(vec2(-0.42, 1.0));
  float along = dot(d, sdir);
  float perp = abs(dot(d, vec2(-sdir.y, sdir.x)));
  float streakEnv = smoothstep(1.0, 3.0, tc) * (1.0 - smoothstep(7.0, 15.0, tc));
  float streakLen = smoothstep(-0.18, 0.02, along) * (1.0 - smoothstep(0.5, 1.2, along));
  float streak = exp(-perp / 0.0025) * 1.1 + exp(-perp / 0.015) * 0.18;
  col += uStreak * streak * streakLen * streakEnv;

  // compact impact burst with fine radial spikes
  float ang = atan(d.y, d.x);
  float burstEnv = smoothstep(2.0, 5.0, tc) * exp(-max(tc - 6.0, 0.0) / 6.0);
  float spikes = pow(angNoise(ang, 72, 1.0), 5.0) + 0.6 * pow(angNoise(ang, 24, 2.0), 6.0);
  float burst = exp(-dl / 0.012) * 0.9 + exp(-dl / 0.05) * 0.10 + spikes * exp(-dl / 0.10) * 0.15;
  col += uFlare * burst * burstEnv;

  // faint radial light shafts around the lit core
  float rayEnv = smoothstep(4.0, 10.0, tc) * (1.0 - smoothstep(14.0, 34.0, tc));
  float rays = pow(angNoise(ang, 44, 5.0), 4.0) * 0.8 + pow(angNoise(ang, 14, 9.0), 4.0) * 0.6;
  col += uCrackM * rays * exp(-dl / 0.22) * smoothstep(0.02, 0.10, dl) * rayEnv * 0.035;
  // soft coloured haze hanging over the freshly lit region
  col += mix(uCrackA, uCrackM, 0.5) * 0.006 * exp(-dl / 0.28) * smoothstep(4.0, 10.0, tc) * (1.0 - smoothstep(16.0, 40.0, tc));

  // ---- Grade --------------------------------------------------------------
  float vig = smoothstep(1.25, 0.25, length(uv * vec2(0.85, 1.1)));
  col *= mix(0.45, 1.0, vig);
  col = 1.0 - exp(-col * 1.15);                  // soft filmic shoulder
  col = pow(col, vec3(1.0 / 2.2));
  // fine per-frame grain (also prevents banding)
  float g = h1(ivec2(frag) + ivec2(int(uFrame) * 7919, int(uFrame) * 104729)) + h1(ivec2(frag) * 3 + ivec2(int(uFrame) * 31, 17));
  col += (g - 1.0) * (2.0 / 255.0);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
