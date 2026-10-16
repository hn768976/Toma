// Full-screen fragment shader for the Hazard Glitch look.
// Coordinates: p is in frame-height units, origin at frame centre, +y up.

export const HAZARD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`;

export const HAZARD_FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform float uFrame;   // wrapped frame index 0..len-1
uniform float uLen;
uniform float uAspect;
uniform float uPx;      // one output pixel in frame-height units
uniform int uSymbol;    // 0 radiation, 1 biohazard
uniform vec3 uSymCol, uSymEdge, uGlowCol, uBgCol, uBgHot, uStreakA, uStreakB, uHaze;
uniform vec4 uGlA[6];   // start frame, duration, y centre, half height
uniform vec4 uGlB[6];   // shift (cells), colour split (cells), block seed, unused
uniform vec4 uStreak[4]; // y, thickness, cycles per loop, phase
uniform vec4 uStreakC[4]; // rgb, length
varying vec2 vUv;

const float TAU = 6.28318530718;
const float ROWS = 56.0;          // LED rows per frame height
const float CELL_ASPECT = 0.6;   // cell width / height (character cell)
const vec2 SYM_C = vec2(0.0, 0.0);
const float SYM_R = 0.46;         // ring outer radius, frame-height units

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h3(ivec3 p) {
  return float(pcg(uint(p.x) ^ pcg(uint(p.y) ^ pcg(uint(p.z))))) / 4294967295.0;
}
float h2(ivec2 p) { return h3(ivec3(p, 913)); }

// 5x7 dot-matrix glyphs: 0-9, A-E, Z. Row-major, 5 bits per row (bit 4 = left).
const int FONT[112] = int[112](
  14,17,19,21,25,17,14,  4,12,4,4,4,4,14,  14,17,1,2,4,8,31,  31,2,4,2,1,17,14,
  2,6,10,18,31,2,2,  31,16,30,1,1,17,14,  6,8,16,30,17,17,14,  31,1,2,4,8,8,8,
  14,17,17,14,17,17,14,  14,17,17,15,1,2,12,  14,17,17,31,17,17,17,  30,17,17,30,17,17,30,
  14,17,16,16,16,17,14,  28,18,17,17,17,18,28,  31,16,16,30,16,16,31,  31,1,2,4,8,16,31);

float glyphDot(int g, vec2 l, vec2 fw) {
  // l: cell-local [0,1]^2 (y up). glyph occupies x .14-.86, y .16-.84
  vec2 gp = (l - vec2(0.14, 0.16)) / vec2(0.72, 0.68);
  vec2 d = gp * vec2(5.0, 7.0);
  vec2 dfw = fw * vec2(5.0 / 0.72, 7.0 / 0.68);
  if (gp.x < 0.0 || gp.x >= 1.0 || gp.y < 0.0 || gp.y >= 1.0) return 0.0;
  int col = int(floor(d.x));
  int row = 6 - int(floor(d.y));
  int bits = FONT[g * 7 + row];
  float on = float((bits >> (4 - col)) & 1);
  vec2 f = fract(d);
  vec2 e = max(dfw, vec2(0.08));
  vec2 b = smoothstep(vec2(0.08) - e * 0.5, vec2(0.08) + e * 0.5, f) * (1.0 - smoothstep(vec2(0.92) - e * 0.5, vec2(0.92) + e * 0.5, f));
  float dotv = on * b.x * b.y;
  // when a dot shrinks below ~a pixel, fade to the glyph's mean to avoid moire
  float lod = smoothstep(0.6, 1.2, max(dfw.x, dfw.y));
  return mix(dotv, 0.42, lod);
}

// ---------- hazard symbols, unit = ring outer radius ----------
float sdCircle(vec2 p, float r) { return length(p) - r; }

// 1 inside dark blades / centre dot of the radiation trefoil (standard proportions:
// centre dot R, blades from 1.5R to 5R, three 60 degree sectors)
float trefoilDark(vec2 p) {
  float R = 0.148;
  float r = length(p);
  if (r < R) return 1.0;
  if (r < 1.5 * R || r > 5.0 * R) return 0.0;
  float a = atan(p.y, p.x);
  // blades centred at 30, 150, 270 degrees
  float k = mod(a - radians(30.0) + radians(60.0), radians(120.0)) - radians(60.0);
  return abs(k) < radians(30.0) ? 1.0 : 0.0;
}

// 1 inside the biohazard symbol. Construction in units of A (Baldwin 1967):
// horn outer circle dia 30 at 11 from centre, inner cut dia 21 at 15, centre hole dia 6,
// ring radii 11..14.5 (width 3.5) with gaps of 1 where it crosses the horns,
// 1-wide slits joining the hole to each horn, a 2-wide opening at each horn tip.
float biohazard(vec2 p) {
  float U = 0.0318; // one construction unit in ring-radius units (horn tips at 26U = 0.83)
  vec2 q = p / U;
  float horns = 0.0;
  float cuts = 0.0;
  float slits = 0.0;
  for (int i = 0; i < 3; i++) {
    float ang = radians(90.0) + float(i) * radians(120.0);
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 nrm = vec2(-dir.y, dir.x);
    float along = dot(q, dir);
    float across = abs(dot(q, nrm));
    if (length(q - dir * 11.0) < 15.0) horns = 1.0;
    if (length(q - dir * 15.0) < 10.5) cuts = 1.0;
    // centre slit (towards this horn's cut) and tip opening
    if (across < 0.5 && along > 0.0 && along < 6.0) slits = 1.0;
    if (across < 1.0 && along > 20.0) slits = 1.0;
  }
  float r = length(q);
  float body = horns * (1.0 - cuts) * (1.0 - slits) * step(3.0, r);
  float ring = step(11.0, r) * step(r, 14.5);
  float ringGap = step(10.0, r) * step(r, 15.5);
  // where the ring crosses a horn the horn is cut back by one unit each side
  float shape = max(body * (1.0 - ringGap), ring);
  return shape;
}

// symbol brightness (0..1) at a point in symbol space (unit = ring outer radius)
float symbolField(vec2 s) {
  float r = length(s);
  float ring = step(0.885, r) * step(r, 1.0);
  if (uSymbol == 0) {
    float disc = step(r, 0.83);
    return max(ring, disc * (1.0 - trefoilDark(s)));
  }
  return max(ring, step(r, 0.88) * biohazard(s));
}

// coverage-filtered symbol: average of 6 samples over the cell footprint
float symbolCell(vec2 cellC, vec2 cellSize) {
  float acc = 0.0;
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 o = (vec2(float(i) + 0.5, float(j) + 0.5) / vec2(2.0, 3.0) - 0.5) * cellSize * 0.9;
      acc += symbolField((cellC + o - SYM_C) / SYM_R);
    }
  }
  return acc / 6.0;
}

// rough continuous distance-ish falloff for the glow (blurred version of the field)
float symbolGlow(vec2 p) {
  vec2 s = (p - SYM_C) / SYM_R;
  float r = length(s);
  float base = uSymbol == 0 ? smoothstep(1.25, 0.6, r) * 0.8 + exp(-abs(r - 0.96) * 18.0) * 0.4
                             : exp(-abs(r - 0.96) * 18.0) * 0.45 + smoothstep(1.0, 0.2, r) * 0.1;
  return base;
}

vec3 screenAt(vec2 p, float t, int frameI, float zoom) {
  vec2 cell = vec2(CELL_ASPECT / ROWS, 1.0 / ROWS);
  vec2 cp = p / cell;
  ivec2 id = ivec2(floor(cp));
  vec2 l = fract(cp);
  vec2 fw = vec2(uPx / zoom) / cell; // analytic footprint (fwidth is unsafe in the glitch branch)
  vec2 cc = (vec2(id) + 0.5) * cell;

  // ---- background "text" activity
  float rowSeed = h2(ivec2(id.y, 7));
  // words: runs of cells along a row, broken by gaps
  int seg = int(floor(float(id.x) / (3.0 + floor(rowSeed * 5.0))));
  float wordOn = step(0.3, h2(ivec2(seg, id.y))) * step(0.06, h3(ivec3(id, 3)));
  // slow large-scale patches so the screen has darker and busier areas
  float patchv = 0.5 + 0.5 * sin(cc.x * 3.1 + cc.y * 1.7 + TAU * t) * cos(cc.y * 4.3 - cc.x * 1.3 - TAU * t);
  float region = smoothstep(-0.8, 0.8, cc.x) * 0.5 + 0.5; // busier towards the right, as in the ref
  int rate = 4 + int(h2(ivec2(id.y, 31)) * 9.0);
  int step_ = ((frameI + int(rowSeed * 600.0)) % int(uLen)) / rate;
  int g = int(h3(ivec3(id, step_)) * 16.0);
  float flick = h3(ivec3(id, step_ + 17));
  float bgB = wordOn * (0.12 + 0.45 * patchv * patchv) * region * (0.55 + 0.45 * flick);
  vec3 bgc = mix(uBgCol, uBgHot, step(0.93, h3(ivec3(id.x, id.y, step_ / 3))));

  // ---- symbol
  float sym = symbolCell(cc, cell);
  float breathe = 0.86 + 0.14 * cos(TAU * 4.0 * t);
  float drop = step(0.1, h3(ivec3(id, step_ / 2 + 5)));          // some cells missing
  float edgeDim = 0.55 + 0.45 * smoothstep(0.0, 1.0, sym);        // partial coverage = darker edge cells
  float rr = length((cc - SYM_C) / SYM_R);
  float core = mix(1.0, 0.62, smoothstep(0.2, 1.0, rr));           // brighter core, darker rim
  float symB = (uSymbol == 0 ? 1.7 : 2.2) * sym * drop * edgeDim * core * breathe;
  bgB *= mix(1.0, uSymbol == 0 ? 0.6 : 0.3, step(rr, 1.02));
  vec3 symc = mix(uSymEdge, uSymCol, smoothstep(0.4, 1.0, sym) * (0.6 + 0.4 * h3(ivec3(id, 99))));
  // a few cells inside the symbol show the hotter background colour, as in the ref

  // ---- horizontal data bars leaving the ring (jagged, slowly changing length)
  float bars = 0.0;
  for (int k = 0; k < 3; k++) {
    float by = (k == 0 ? 0.12 : (k == 1 ? 0.07 : -0.2));
    int rowK = int(floor(by * ROWS));
    int thick = k == 2 ? 1 : 3;
    if (id.y >= rowK && id.y < rowK + thick) {
      float side = cc.x > SYM_C.x ? 1.0 : -1.0;
      float len = (k == 0 ? 0.62 : (k == 1 ? 0.35 : 0.22)) + 0.12 * sin(TAU * (t * 2.0 + float(k) * 0.37));
      len *= side > 0.0 ? (k == 1 ? 0.8 : 1.0) : (k == 0 ? 0.6 : 0.0);
      float dx = abs(cc.x - SYM_C.x) - SYM_R * 1.0;
      float jag = h3(ivec3(id.x / 2, id.y, step_ / 3)) * 0.06;
      if (dx > -0.02 && dx < len - jag) bars = max(bars, 0.85 * step(0.12, h3(ivec3(id, step_ / 2))));
    }
  }

  // ---- flickering pixel blocks
  float blocks = 0.0;
  ivec2 bid = ivec2(floor(cp / vec2(6.0, 2.0)));
  float bh = h3(ivec3(bid, frameI / 3));
  if (bh > 0.9965) blocks = 0.9;

  float cellB = max(symB, max(bars, blocks));
  vec3 cellCol = cellB > bgB ? (symB >= max(bars, blocks) ? symc : uSymCol) : bgc;
  float b = max(cellB, bgB);
  float gl = glyphDot(g, l, fw);
  // lit cells read as text; the brightest also glow as a whole cell (LED bleed)
  float lit = gl * 1.1 + 0.42 * smoothstep(0.35, 1.2, b);
  // dark scanline gap between rows
  float scan = smoothstep(0.08, 0.2, l.y) * smoothstep(0.92, 0.8, l.y);
  vec3 col = cellCol * b * lit * mix(0.4, 1.0, scan);
  // faint unlit LED cell grid
  col += uBgCol * 0.012 * scan;
  return col;
}

void main() {
  float t = uFrame / uLen;
  int frameI = int(uFrame + 0.5);
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

  // slow push in and back (cosine), slight drift; one cycle per loop
  float push = 0.5 - 0.5 * cos(TAU * t);
  float zoom = 1.0 + 0.09 * push;
  vec2 drift = vec2(0.03 * sin(TAU * t), 0.012 * sin(TAU * 2.0 * t));
  // the LED screen is a plane seen at a slight angle: its right side recedes
  float den = 1.0 - 0.24 * p.x - 0.05 * p.y;
  vec2 sp = (p / den) / zoom + drift;
  zoom *= den;

  // ---- glitch bands: shift rows sideways, split colour
  float shift = 0.0;
  float split = 0.0;
  float glitchOn = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 a = uGlA[i];
    float rel = uFrame - a.x;
    if (rel >= 0.0 && rel < a.y) {
      float inBand = step(abs(sp.y - a.z), a.w);
      // sub-bands with their own offsets
      float sub = floor(sp.y * ROWS / 3.0);
      float jitter = h3(ivec3(int(sub), i, int(rel))) - 0.5;
      shift += inBand * (uGlB[i].x + jitter * 6.0) * (CELL_ASPECT / ROWS);
      split += inBand * uGlB[i].y * (CELL_ASPECT / ROWS);
      glitchOn = max(glitchOn, inBand);
    }
  }
  vec2 gp = sp + vec2(shift, 0.0);
  vec3 col;
  if (split != 0.0) {
    vec3 a = screenAt(gp + vec2(split, 0.0), t, frameI, zoom);
    vec3 b = screenAt(gp - vec2(split, 0.0), t, frameI, zoom);
    vec3 m = screenAt(gp, t, frameI, zoom);
    col = vec3(a.r, m.g, b.b) * 1.15;
  } else {
    col = screenAt(gp, t, frameI, zoom);
  }

  // ---- soft glow around the symbol (pre-bloom, keeps the core luminous)
  float breathe = 0.86 + 0.14 * cos(TAU * 4.0 * t);
  col += uGlowCol * symbolGlow(sp) * 0.035 * breathe;

  // ---- haze (purple at the top left, warm at the bottom)
  col += uHaze * 0.02 * smoothstep(0.7, 0.0, length(p - vec2(-0.8, 0.5)));

  // ---- light streaks sliding horizontally, whole cycles per loop
  for (int i = 0; i < 4; i++) {
    vec4 s = uStreak[i];
    vec4 c = uStreakC[i];
    float span = uAspect + c.w;
    float x = mod(s.w + s.z * t, 1.0) * span - span * 0.5;
    float dx = (p.x - x) / (c.w * 0.5);
    float yy = s.x + 0.015 * sin(TAU * (t * s.z + float(i) * 0.3) + p.x * 2.0);
    float dy = (p.y - yy) / s.y;
    float along = exp(-dx * dx * 1.2);
    float core = exp(-dy * dy);
    float beads = 0.75 + 0.25 * sin(p.x * 38.0 + float(i) * 2.0) * sin(p.x * 11.0 - TAU * t * 3.0);
    col += c.rgb * along * (core * 0.9 * beads + exp(-dy * dy * 0.1) * 0.05);
  }

  gl_FragColor = vec4(col, 1.0);
}`;
