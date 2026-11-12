/**
 * Procedural city-map ground shader (WebGL 2 / GLSL ES 3.0 via three.js).
 *
 * The whole map – neighbourhood street grids, arterial roads, highways,
 * river + lakes, parks with footpaths and building lots – is evaluated
 * analytically per pixel in world space. Every feature is a signed distance
 * that is anti-aliased with screen-space derivatives, so the map stays
 * razor sharp at 4K and doesn't shimmer as the camera moves.
 */

export const mapVertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const mapFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uLand;
uniform vec3 uBlock;
uniform vec3 uSand;
uniform vec3 uMinor;
uniform vec3 uMajorEdge;
uniform vec3 uMajorCore;
uniform vec3 uHighway;
uniform vec3 uWater;
uniform vec3 uWaterEdge;
uniform vec3 uPark;
uniform vec3 uParkDark;
uniform vec3 uParkPath;
uniform vec3 uFog;
uniform float uGlow;
uniform vec3 uCamPos;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vWorld;

// ---------------------------------------------------------------- hashing
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// ------------------------------------------------- voronoi neighbourhoods
// Returns (distance to nearest cell border, cell id hash, unused).
// Border distance is exact (Inigo Quilez' two-pass method).
vec2 voronoiBorder(vec2 x, out vec2 cellId) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.15 + 0.7 * hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = 0.15 + 0.7 * hash22(n + g);
    vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001)
      md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  cellId = n + mg;
  return vec2(md, hash12(n + mg));
}

// Coverage of a stroke of half width w at distance d, with pixel footprint aa.
// Thin strokes fade out (instead of aliasing) once they become sub-pixel.
float stroke(float d, float w, float aa) {
  float cov = smoothstep(w + aa, w - aa, d);
  return cov * clamp(w * 1.6 / aa, 0.0, 1.0);
}
float fillShape(float sd, float aa) {
  // sd < 0 inside
  return smoothstep(aa, -aa, sd);
}

// distance from p to curve y = f(x) given value and slope
float curveDist(float dy, float slope) {
  return abs(dy) / sqrt(1.0 + slope * slope);
}

// ------------------------------------------------------------- features
float riverCenter(float x) {
  return 2.6 * sin(x * 0.09 + 0.6) + 1.2 * sin(x * 0.21 + 2.1) + 0.7 * sin(x * 0.53 + 0.3);
}
float riverSlope(float x) {
  return 2.6 * 0.09 * cos(x * 0.09 + 0.6) + 1.2 * 0.21 * cos(x * 0.21 + 2.1) + 0.7 * 0.53 * cos(x * 0.53 + 0.3);
}
// signed distance to river water (negative inside)
float riverSD(vec2 p) {
  vec2 r = rot(-0.2) * (p - vec2(0.0, 13.0));
  float c = riverCenter(r.x);
  float d = curveDist(r.y - c, riverSlope(r.x));
  float width = 0.26 + 0.42 * smoothstep(0.35, 0.75, fbm(vec2(r.x * 0.08, 4.0)));
  // ragged banks
  width += 0.12 * (vnoise(p * 2.2) - 0.5);
  float sd = d - width;
  // lakes / wide basins along the river
  vec2 lw = p + vec2(fbm(p * 0.35), fbm(p * 0.35 + 9.0)) * 2.4;
  float lake = length((lw - vec2(14.2, 17.4)) * vec2(0.55, 0.95)) - 1.0 + 0.9 * (fbm(p * 0.8) - 0.5);
  float lake2 = length((lw - vec2(-4.8, 13.2)) * vec2(0.7, 1.0)) - 0.8 + 0.9 * (fbm(p * 0.9 + 3.0) - 0.5);
  sd = min(sd, min(lake, lake2));
  // a narrow tributary / canal
  vec2 t = rot(-1.35) * (p - vec2(-2.0, 12.0));
  float tc = 1.4 * sin(t.x * 0.21 + 1.0) + 0.6 * sin(t.x * 0.55);
  float ts = 1.4 * 0.21 * cos(t.x * 0.21 + 1.0) + 0.6 * 0.55 * cos(t.x * 0.55);
  float trib = curveDist(t.y - tc, ts) - (0.1 + 0.04 * sin(t.x * 0.3));
  trib = max(trib, -t.x - 2.0); // only on one side of the river
  sd = min(sd, trib);
  return sd;
}

// highway centreline distance
float highwayDist(vec2 p, float ang, vec2 off, float amp, float freq, float ph) {
  vec2 h = rot(ang) * (p - off);
  float c = amp * sin(h.x * freq + ph) + 0.35 * amp * sin(h.x * freq * 2.7 + ph * 1.3);
  float s = amp * freq * cos(h.x * freq + ph) + 0.35 * amp * freq * 2.7 * cos(h.x * freq * 2.7 + ph * 1.3);
  return curveDist(h.y - c, s);
}

void main() {
  vec2 p = vWorld.xz;
  // pixel footprint in world units (for analytic anti-aliasing)
  float aa = max(length(fwidth(p)) * 0.75, 1e-4);

  vec3 col = uLand;

  // ------------------------------------------------ neighbourhood cells
  vec2 cellId;
  vec2 vb = voronoiBorder(p / 6.0, cellId);
  float borderDist = vb.x * 6.0;
  float h0 = vb.y;
  float h1 = hash12(cellId + 11.3);
  float h2 = hash12(cellId + 27.9);
  float h3 = hash12(cellId + 41.7);

  float angle = 0.35 + (h0 - 0.5) * 1.3;
  float sx = mix(0.26, 0.46, h1);
  float sy = sx * mix(1.0, 2.1, h2);
  vec2 q = rot(angle) * p;
  bool curvy = h3 > 0.8;
  if (curvy) {
    q += vec2(fbm(p * 0.22), fbm(p * 0.22 + 7.7)) * 1.6;
  }
  vec2 gi = floor(q / vec2(sx, sy));
  vec2 gf = fract(q / vec2(sx, sy));
  vec2 gd = (0.5 - abs(gf - 0.5)) * vec2(sx, sy); // distance to nearest grid line
  // nearest line indices
  float lineX = floor(q.x / sx + 0.5);
  float lineY = floor(q.y / sy + 0.5);

  // building lots / special areas inside blocks
  float lotH = hash12(gi + cellId * 3.1);
  if (lotH > 0.985 && !curvy) {
    vec2 inset = gd - 0.035;
    float sdLot = -min(inset.x, inset.y);
    col = mix(col, uBlock, fillShape(sdLot, aa) * 0.7);
  }

  // ------------------------------------------------ parks
  float pn = fbm(p * 0.085 + vec2(3.0, 8.5));
  float rsd = riverSD(p);
  float bank = smoothstep(0.8, 0.0, rsd) * smoothstep(0.58, 0.75, fbm(p * 0.12 + 5.0));
  float parkField = max(pn, 0.42 + 0.3 * bank) + 0.04 * (vnoise(p * 2.0) - 0.5);
  float parkSD = 0.565 - parkField;
  float paa = max(fwidth(parkField) * 0.8, 1e-5);
  float parkA = smoothstep(paa, -paa, parkSD);
  float darkF = fbm(p * 0.21 + 3.0);
  float daa = max(fwidth(darkF) * 0.8, 1e-5);
  float darkA = smoothstep(0.57 - daa, 0.57 + daa, darkF);
  vec3 parkCol = mix(uPark, uParkDark, darkA);
  col = mix(col, parkCol, parkA);

  // footpaths inside parks
  vec2 pq = rot(0.7) * p + vec2(fbm(p * 0.6), fbm(p * 0.6 + 2.0)) * 1.4;
  vec2 pf = abs(fract(pq / 0.9) - 0.5) * 0.9;
  float pathD = min(pf.x, pf.y);
  float pathKeep = step(0.45, hash12(floor(pq / 0.9) + 5.0));
  col = mix(col, uParkPath, stroke(pathD, 0.01, aa) * parkA * pathKeep * smoothstep(0.58, 0.66, parkField));

  // ------------------------------------------------ minor streets
  float keepX = step(0.2, hash12(vec2(lineX, floor(q.y / (sy * 2.0))) + cellId * 7.0));
  float keepY = step(0.2, hash12(vec2(floor(q.x / (sx * 3.0)), lineY) + cellId * 13.0));
  float minorW = 0.0115;
  float streets = max(stroke(gd.x, minorW, aa) * keepX, stroke(gd.y, minorW, aa) * keepY);
  float notPark = 1.0 - parkA;
  col = mix(col, uMinor, streets * notPark);

  // ------------------------------------------------ water
  float waterA = fillShape(rsd, aa);
  float edgeBand = stroke(abs(rsd), 0.025, aa) * uGlow;
  vec3 waterCol = mix(uWater, uWaterEdge, smoothstep(-0.12, 0.0, rsd) * (1.0 - uGlow));
  col = mix(col, waterCol, waterA);
  col = mix(col, uWaterEdge * 1.6, edgeBand * 0.8);

  // ------------------------------------------------ arterial roads
  // neighbourhood borders + every 5th grid line are arterials
  float art = min(borderDist, 1e3);
  float artX = mod(lineX, 5.0) == 0.0 ? gd.x : 1e3;
  float artY = mod(lineY, 4.0) == 0.0 ? gd.y : 1e3;
  float artD = min(art, curvy ? 1e3 : min(artX, artY));
  float artEdgeA = stroke(artD, 0.034, aa);
  float artCoreA = stroke(artD, 0.012, aa);
  // arterials stop at the water (only highways bridge it)
  float dry = 1.0 - waterA;
  col = mix(col, uMajorEdge, artEdgeA * dry);
  col = mix(col, uMajorCore, artCoreA * dry);

  // ------------------------------------------------ highways
  float hw1 = abs(highwayDist(p, 0.32, vec2(-16.0, 9.0), 2.0, 0.07, 0.4) - 0.045); // double carriageway
  float hw2 = highwayDist(p, -1.25, vec2(2.0, 12.0), 1.4, 0.09, 2.2);
  float hw = hw1;
  float hwA = stroke(hw, 0.016, aa);
  // main motorway: one thick, saturated band curving through the frame
  float mw = hw2;
  float mwA = stroke(mw, 0.05, aa);
  // soft neon halo for the night palette
  float halo = exp(-hw * hw / 0.02) * 0.45 * uGlow;
  col += uHighway * halo;
  col = mix(col, uHighway, hwA);
  col += uHighway * exp(-mw * mw / 0.03) * 0.5 * uGlow;
  col = mix(col, uHighway * mix(0.82, 1.0, uGlow), mwA);
  // night palette: arterials glow faintly too
  col += uMajorCore * exp(-artD * artD / 0.01) * 0.18 * uGlow * dry;

  // ------------------------------------------------ atmospheric haze
  float dist = length(vWorld - uCamPos);
  float fogA = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, fogA * 0.85);

  gl_FragColor = vec4(col, 1.0);
}
`;
