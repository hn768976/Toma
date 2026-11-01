// WebGL2 fragment shader for the "Emboss Circles" composition.
//
// The image is built from signed-distance fields laid out on a diamond
// (centred-rectangular) lattice. Everything is white paper on a white ground;
// form is described only by soft chromatic drop shadows, a warm rim fringe and
// hair-line outlines, exactly like the reference.
//
// Coordinates are in "height units": p.y spans [-0.5, 0.5] top->bottom and
// p.x spans [-0.889, 0.889], so the look is resolution independent (1080p,
// 4K, ...).

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uFrame;     // absolute frame (for dither seed)

// ---- timeline (computed per frame in JS) ----
uniform float uLensO;     // half-offset of the two lens discs (intersection phase)
uniform float uLensA;     // lens visibility
uniform float uWalkO;     // walker travel along the NE/SW diagonal
uniform float uWalkR;     // walker radius
uniform float uWalkA;     // walker visibility
uniform float uChanA;     // channel (groove) visibility
uniform float uGamma;     // rotation progress of the settled walker pairs around their hub
uniform float uSpread;    // pair spreads apart so the centre bead fits between
uniform float uRingR;     // hub disc radius
uniform float uRingA;     // hub disc visibility
uniform float uTinyR;     // centre bead radius (grows into the big fused discs)
uniform float uBeadA;     // bead visibility
uniform vec2  uLight;     // global shadow offset (height units)
uniform float uGlobal;    // global fade (loop in/out)
uniform float uRingSh;    // hub shadow strength (rings are flat early on)
uniform float uEdgeA;     // hub outline strength (fades first at loop end)

// ---- palette ----
uniform vec3 uBg;
uniform vec3 uPaper;
uniform vec3 uShadow;
uniform vec3 uWarm;
uniform vec3 uLine;
uniform vec3 uChan;
uniform float uShadowGain;
uniform float uWarmGain;
uniform float uLineGain;

const vec2  CELL = vec2(0.95, 0.926);
const vec2  SITE1 = vec2(0.475, 0.463);
const vec2  SOFF = vec2(0.475, 0.0);    // lens owner inside a cell
const float LENS_E = 0.165;             // lens points = S +- (E, E)
const vec2  U = vec2(0.70710678, -0.70710678); // NE direction (y down)

float px;   // one pixel in height units

float sdCircle(vec2 p, vec2 c, float r) { return length(p - c) - r; }

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// spatially varying shadow density: some cells read darker than others,
// like the uneven ink of the reference
float density(vec2 c) {
  return 0.62 + 0.38 * sin(c.x * 3.3 + c.y * 1.7 + 0.8);
}

// Composite one raised paper shape.
//  dC: sdf at p, dS: sdf at p - lightOffset (shadow), dW: sdf at p + lightOffset (warm rim)
void raised(inout vec3 col, float dC, float dS, float dW, float blur, float a, float dens, float lineA) {
  if (a <= 0.0) return;
  float outside = smoothstep(-px, px, dC);
  // soft chromatic drop shadow (navy) falling away from the light
  float sh = (1.0 - smoothstep(-blur * 0.05, blur, dS)) * outside;
  sh = pow(sh, 1.35);
  col = mix(col, uShadow, clamp(sh * 0.86 * uShadowGain * dens * a, 0.0, 1.0));
  // warm fringe on the lit side
  float wm = (1.0 - smoothstep(0.0, blur * 0.75, dW)) * outside;
  col = mix(col, uWarm, clamp(wm * 0.42 * uWarmGain * a, 0.0, 1.0));
  // paper fill
  float inside = 1.0 - outside;
  col = mix(col, uPaper, inside * a);
  // hair-line edge
  float lw = max(0.0011, px * 0.9);
  float ln = 1.0 - smoothstep(lw * 0.5, lw * 0.5 + px * 1.2, abs(dC));
  col = mix(col, uLine, ln * 0.42 * uLineGain * a * lineA);
}

// recessed groove swept by a moving walker pair
void groove(inout vec3 col, float d, float dIn, float a) {
  if (a <= 0.0) return;
  float inside = 1.0 - smoothstep(-px, px, d);
  col = mix(col, uChan, inside * a);
  // inner shadow along the edge facing the light
  float ish = smoothstep(-0.012, 0.0, dIn) * inside;
  col = mix(col, uShadow, ish * 0.16 * uShadowGain * a);
  float lw = max(0.0010, px * 0.85);
  float ln = 1.0 - smoothstep(lw * 0.5, lw * 0.5 + px * 1.2, abs(d));
  col = mix(col, uLine, ln * 0.38 * uLineGain * a);
}

// One merged paper sheet made of a disc at every hub (union SDF): where
// neighbouring discs overlap they fuse, so late in the loop only the
// concave-square gaps between four hubs keep an edge — like the reference.
void hubSheet(inout vec3 col, vec2 p, vec2 cellId, float R, float a, float shGain,
              float edgeA, float aoAmt, float blur) {
  if (a <= 0.0 || R <= 0.0) return;
  float dC = 1e3, dS = 1e3, dW = 1e3;
  vec2 near = vec2(0.0);
  for (int s = 0; s < 2; s++) {
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 c = (cellId + vec2(i, j)) * CELL + (s == 1 ? SITE1 : vec2(0.0));
      float d = sdCircle(p, c, R);
      if (d < dC) { dC = d; near = c; }
      dS = min(dS, sdCircle(p - uLight, c, R));
      dW = min(dW, sdCircle(p + uLight * 0.6, c, R));
    }
  }
  if (aoAmt > 0.0) {
    // the concave-square holes fill with soft ink from every side
    float ao = (1.0 - smoothstep(0.0, 0.07, dC)) * smoothstep(-px, px, dC);
    col = mix(col, uShadow, ao * 0.35 * uShadowGain * density(p + 0.3) * aoAmt * a);
  }
  raised(col, dC, dS, dW, blur, a, density(near) * shGain, edgeA);
}

void main() {
  px = 1.0 / uRes.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  p.y = -p.y;

  vec3 col = uBg;
  vec2 cellId = floor(p / CELL);

  float blurW = 0.042;   // walker shadow softness
  float blurH = 0.040;   // hub shadow softness

  // ---------- pass 1: grooves ----------
  if (uChanA > 0.0 && uWalkO > 0.0) {
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 o = (cellId + vec2(i, j)) * CELL;
      vec2 S = o + SOFF;
      for (int k = -1; k <= 1; k += 2) {
        vec2 L = S + float(k) * vec2(LENS_E);
        vec2 a = L - U * uWalkO, b = L + U * uWalkO;
        float r = uWalkR * 1.04;
        float d = sdCapsule(p, a, b, r);
        if (d > 0.02) continue;
        float dIn = sdCapsule(p + uLight * 0.8, a, b, r);
        groove(col, d, dIn, uChanA * uGlobal);
      }
    }
  }

  // ---------- pass 2: hub rings ----------
  hubSheet(col, p, cellId, uRingR, uRingA * uGlobal, uRingSh, 1.0, 0.0, blurH);

  // ---------- pass 3: walkers ----------
  if (uWalkA > 0.0 && uWalkR > 0.0) {
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 o = (cellId + vec2(i, j)) * CELL;
      vec2 S = o + SOFF;
      for (int k = -1; k <= 1; k += 2) {
        vec2 L = S + float(k) * vec2(LENS_E);
        for (int m = -1; m <= 1; m += 2) {
          vec2 c = L + U * uWalkO * float(m);
          // hub this walker settles into
          bool hub0 = (k == m);   // hubs on the y=0 rows vs the offset rows
          vec2 hub = S + (k == 1 ? (m == 1 ? vec2(0.475, 0.0) : vec2(0.0, 0.463))
                                 : (m == 1 ? vec2(0.0, -0.463) : vec2(-0.475, 0.0)));
          // settled pairs swing upright (vertical on one hub row, horizontal
          // on the other) and part to make room for the centre bead
          float ang = uGamma * (hub0 ? 0.846 : -0.724);
          c = hub + rot(c - hub, ang) * uSpread;
          float dC = sdCircle(p, c, uWalkR);
          if (dC > 0.1) continue;
          // motion shadow: leading edge, rotated slightly counter-clockwise
          float jit = (hash12(floor(hub * 7.0) + 3.1) - 0.5) * 1.6;
          vec2 dir = rot(U * float(m), -0.45 + jit);
          vec2 lo = mix(dir * 0.034, uLight, smoothstep(0.0, 1.0, uGamma));
          float dS = sdCircle(p - lo, c, uWalkR);
          float dW = sdCircle(p + lo * 0.6, c, uWalkR);
          raised(col, dC, dS, dW, blurW, uWalkA * uGlobal, density(hub) * 0.6 + 0.2, 1.0);
        }
      }
    }
  }

  // ---------- pass 4: lenses (intersection of two converging discs) ----------
  if (uLensA > 0.0) {
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 o = (cellId + vec2(i, j)) * CELL;
      vec2 S = o + SOFF;
      for (int k = -1; k <= 1; k += 2) {
        vec2 L = S + float(k) * vec2(LENS_E);
        vec2 a = L - U * uLensO, b = L + U * uLensO;
        float r = uWalkR;
        float dC = max(sdCircle(p, a, r), sdCircle(p, b, r));
        if (dC > 0.1) continue;
        vec2 lo = vec2(0.7071, 0.7071) * float(k) * 0.028;
        float dS = max(sdCircle(p - lo, a, r), sdCircle(p - lo, b, r));
        float dW = max(sdCircle(p + lo * 0.6, a, r), sdCircle(p + lo * 0.6, b, r));
        raised(col, dC, dS, dW, blurW * 0.9, uLensA * uGlobal, 1.0, 1.0);
      }
    }
  }

  // ---------- pass 5: centre bead -> big fused discs ----------
  hubSheet(col, p, cellId, uTinyR, uBeadA * uGlobal, 1.0, uEdgeA,
           smoothstep(0.30, 0.36, uTinyR), mix(0.016, blurH, smoothstep(0.02, 0.09, uTinyR)));

  // ordered dither against banding in the soft gradients
  float n = hash12(gl_FragCoord.xy + mod(uFrame, 64.0) * 17.0) - 0.5;
  col += n / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
