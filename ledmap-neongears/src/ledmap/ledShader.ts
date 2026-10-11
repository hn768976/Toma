import { HASH_GLSL, HEADER } from "../lib/gl";

// LED panel material. Shared by the flat (orthographic) and glide (perspective) versions.
// Panel coordinates: vUv in [0,1]^2 over the plane; uMapRect maps the world map into it
// (the glide plane extends past the map with ocean LEDs).

export const LED_VERT = /* glsl */ `${HEADER}
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vUv;
out float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const LED_FRAG = /* glsl */ `${HEADER}
${HASH_GLSL}
uniform sampler2D uMask;   // equirectangular land mask, lon -180..180, lat uMaskLat.x..y
uniform vec2 uMaskLat;
uniform vec2 uGrid;        // LED columns, rows across the whole plane
uniform vec4 uMapRect;     // map rectangle in plane uv: x0, y0 (top), w, h
uniform vec2 uLon;         // longitude at the map rect's left edge, longitude span
uniform vec2 uLat;         // latitude at the map rect's top edge, at its bottom edge
uniform float uT;          // loop phase [0,1)
uniform vec4 uLand[4];
uniform vec4 uOcean[4];
uniform vec4 uLine[4];
uniform vec4 uBg[4];
uniform vec3 uLandHi;
uniform float uLandLevel;
uniform float uOceanLevel;
uniform float uLineLevel;
uniform float uMod;
uniform float uPanelEvery;
uniform float uHalo;
uniform float uHaloStrength;
uniform float uSoft;        // extra edge softness, in LED cells
uniform float uMottle;      // static per-LED brightness spread
uniform float uGapFill;     // how much land LED light fills the gaps between land LEDs
uniform float uLineW;       // panel-line half width, in LED cells
uniform float uHiAmt;       // colour-drift pull toward the highlight colour
uniform float uCoastGlow;   // land light spilling onto the ocean near the coast
uniform float uWriteDepth;  // 1: alpha = view depth (for DoF)
in vec2 vUv;
in float vDepth;
out vec4 outColor;

const float TAU = 6.28318530718;

vec3 grad(vec4 s[4], float y) {
  vec3 c = s[0].rgb;
  for (int i = 1; i < 4; i++) {
    float a = s[i - 1].w, b = s[i].w;
    if (b > 1.5) break;
    c = mix(c, s[i].rgb, smoothstep(a, b, y));
  }
  return c;
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  uvec2 ii = uvec2(ivec2(i) + 4096);
  float a = hash1(ii), b = hash1(ii + uvec2(1u, 0u));
  float c = hash1(ii + uvec2(0u, 1u)), d = hash1(ii + uvec2(1u, 1u));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float landAt(vec2 mp) {
  float lon = uLon.x + mp.x * uLon.y;
  float lat = mix(uLat.x, uLat.y, mp.y);
  float v = (uMaskLat.x - lat) / (uMaskLat.x - uMaskLat.y);
  if (v < 0.0 || v > 1.0) return 0.0;
  return texture(uMask, vec2((lon + 180.0) / 360.0, v)).r;
}

void main() {
  // Panel position with y running top -> bottom.
  vec2 p = vec2(vUv.x, 1.0 - vUv.y);
  vec2 q = p * uGrid;                 // LED units
  vec2 cell = floor(q);
  vec2 f = q - cell - 0.5;

  // Pixel footprint in LED units: drives anti-aliasing and the far-field fade to the mean.
  vec2 dx = dFdx(q), dy = dFdy(q);
  float fw = max(length(dx), length(dy));

  vec2 pc = (cell + 0.5) / uGrid;
  vec2 mp = (pc - uMapRect.xy) / uMapRect.zw;    // LED centre in map space
  vec2 pPix = (p - uMapRect.xy) / uMapRect.zw;   // pixel in map space (smooth gradients)
  float ymap = clamp(mp.y, 0.0, 1.0);
  float yPix = clamp(pPix.y, 0.0, 1.0);

  uvec2 ic = uvec2(ivec2(cell) + 8192);
  float h1 = hash1(uvec3(ic, 11u));
  float h2 = hash1(uvec3(ic, 23u));
  float h3 = hash1(uvec3(ic, 37u));
  float h4 = hash1(uvec3(ic, 51u));
  float h5 = hash1(uvec3(ic, 67u));
  float h6 = hash1(uvec3(ic, 79u));

  // Land-ness of this LED. Coastline LEDs get a hashed jitter so edges are ragged and
  // speckled like a real low-resolution panel; a few lit LEDs scatter just off the coast.
  float m0 = landAt(mp);
  float coastBand = smoothstep(0.0, 0.3, m0) * (1.0 - smoothstep(0.6, 0.95, m0));
  float mj = clamp(m0 + (h5 - 0.5) * 0.7 * coastBand, 0.0, 1.0);
  float m = mix(mj, smoothstep(0.3, 0.7, mj), 0.6);
  if (m0 > 0.004 && m0 < 0.2 && h6 < 0.22) m = max(m, 0.55);

  // ---- per-LED animation (all whole cycles per 600-frame loop) ----
  // Sweep: broad diagonal band, +15%, crosses the panel twice per loop.
  float diag = dot(mp, normalize(vec2(1.0, 0.45))) * 0.92;
  float band = pow(0.5 + 0.5 * cos(TAU * (diag - 2.0 * uT)), 6.0);
  // Twinkle: +-10%, 3..8 whole cycles per loop, hashed phase.
  float tw = 0.10 * sin(TAU * (floor(3.0 + h1 * 6.0) * uT + h2));
  // Sparkle: ~2% of land LEDs flash briefly, 2..4 times per loop.
  float sp = 0.0;
  if (h3 < 0.06) {
    float s = 0.5 + 0.5 * sin(TAU * (floor(2.0 + h4 * 3.0) * uT + h1));
    sp = pow(s, 60.0) * 0.9 * m;
  }
  // Coastline flicker.
  float coast = smoothstep(0.08, 0.35, m) * (1.0 - smoothstep(0.65, 0.92, m));
  float cf = coast * 0.12 * sin(TAU * (floor(9.0 + h4 * 8.0) * uT + h3));
  float mod1 = 1.0 + uMod * (0.15 * band + tw + sp + cf);

  // Colour drift on land: noise sampled on a circle in time (loops).
  vec2 dc = vec2(cos(TAU * uT), sin(TAU * uT)) * 0.9;
  float dn = smoothstep(0.2, 0.8, vnoise(mp * vec2(5.0, 3.0) + dc));

  // Drift moves the colour along the palette's own gradient (stays saturated) and a little
  // toward the highlight colour.
  vec3 landC = mix(grad(uLand, clamp(ymap + 0.12 * (dn - 0.5), 0.0, 1.0)), uLandHi, uHiAmt * dn);
  // static per-LED spread (a real panel's LEDs are never perfectly matched)
  float landL = uLandLevel * (0.95 + 0.08 * dn) * (1.0 - uMottle * 0.5 + uMottle * h2);
  vec3 oceanC = grad(uOcean, ymap) * uOceanLevel * (0.9 + 0.2 * h1);
  vec3 lineC = grad(uLine, yPix) * uLineLevel;
  vec3 bgC = grad(uBg, yPix);

  vec3 led = mix(oceanC, landC * landL, m) * mod1;

  // ---- LED shape: rounded square, 72% of the cell, soft halo; box-filtered ----
  float aa = max(fw * 0.75, max(uSoft, 1e-3));
  float d = sdRoundBox(f, vec2(0.36), 0.09);
  float cov = 1.0 - smoothstep(-aa, aa, d);
  float halo = exp(-max(d, 0.0) / uHalo) * uHaloStrength * (1.0 - cov);
  // LED face: brighter centre, slightly darker bevelled edge.
  float bevel = 1.08 - 0.3 * smoothstep(0.08, 0.38, max(abs(f.x), abs(f.y)));

  // Coastal glow: a wider sample ring of the mask (about 2 LEDs out).
  float mWide = 0.0;
  if (uCoastGlow > 0.0) {
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398 + 0.39;
      mWide += landAt(pPix + vec2(cos(a), sin(a)) * 2.2 / (uGrid * uMapRect.zw));
    }
    mWide = smoothstep(0.0, 0.6, mWide / 8.0);
  }

  // ---- panel lines: continuous soft strokes every uPanelEvery LEDs (through LED centres),
  // over the ocean only ----
  vec2 lq = q / uPanelEvery;
  vec2 ld = abs(fract(lq - 0.5 / uPanelEvery) - 0.5) * uPanelEvery;   // distance in LED cells
  float lw = uLineW;
  float laa = max(aa, 0.04);
  float lineCore = 1.0 - smoothstep(lw - laa, lw + laa, min(ld.x, ld.y));
  float lineGlow = exp(-min(ld.x, ld.y) / 0.22) * 0.45;
  float lineAmt = clamp(lineCore + lineGlow, 0.0, 1.0) * (1.0 - smoothstep(0.15, 0.6, m));

  // Far field: when an LED is smaller than ~2 pixels, fade to the pattern's mean so the
  // grid never aliases into moire.
  float far = smoothstep(0.3, 0.65, fw);
  cov = mix(cov, 0.51, far);
  halo = mix(halo, 0.06, far);
  lineAmt = mix(lineAmt, 0.12 * (1.0 - m), far);

  // On land, the gaps between LEDs catch some of their light.
  vec3 c = mix(bgC, led * 0.55, uGapFill * smoothstep(0.3, 0.8, m));
  c = mix(c, led * mix(1.0, bevel, 1.0 - far), clamp(cov + halo, 0.0, 1.0));
  c = mix(c, lineC, lineAmt);
  c = mix(c, landC * landL, uCoastGlow * mWide * (1.0 - smoothstep(0.2, 0.7, m)) * (1.0 - 0.5 * cov));
  outColor = vec4(c, mix(1.0, vDepth, uWriteDepth));
}`;
