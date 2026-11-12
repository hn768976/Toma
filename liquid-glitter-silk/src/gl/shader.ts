// Fragment shader: flowing iridescent "liquid silk" height field with
// glitter flakes, fake depth-of-field and filmic tone mapping.
//
// The surface is a domain-warped sum of low-frequency waves. Its gradient
// gives a normal which drives two-tone (base / ribbon) iridescent shading,
// specular sheen and a per-cell glitter layer that flows with the surface.

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;        // canvas size in pixels
uniform float uTime;       // seconds
uniform float uProgress;   // 0..1 over the composition
uniform vec3  uCam;        // x: rotation (rad), y: zoom, z: unused
uniform vec2  uCamOffset;  // pan in field units
uniform float uExposure;   // animated exposure (brightness arc of the reference)
uniform float uSheetBias;  // >0 grows the glowing sheet area at the expense of ribbons

uniform vec3 uBase;        // broad glowing sheet colour (lime)
uniform vec3 uBaseHi;      // sheet highlight tint
uniform vec3 uRibbon;      // fold / ribbon colour (magenta)
uniform vec3 uRibbonAlt;   // late ribbon colour (violet) blended over time
uniform vec3 uShadow;      // crease shadow colour
uniform vec3 uSpec;        // specular tint
uniform vec3 uGlitterA;    // glitter on ribbons
uniform vec3 uGlitterB;    // glitter on sheet / shadows

out vec4 outColor;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

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

// Two-stage smooth domain warp: bends straight waves into curling folds.
vec2 warp(vec2 p, float t) {
  vec2 q = p;
  q += 0.62 * vec2(sin(p.y * 1.05 + t * 0.33 + 1.3), sin(p.x * 0.85 - t * 0.29 + 0.4));
  q += 0.38 * vec2(sin(q.y * 1.65 - t * 0.27 + 2.1), sin(q.x * 1.45 + t * 0.31 + 3.7));
  q += 0.12 * vec2(sin(q.y * 3.10 + t * 0.41 + 0.7), sin(q.x * 2.90 - t * 0.37 + 5.1));
  return q;
}

// Anisotropic satin folds: parallel crests along a stripe coordinate that the
// low-frequency warp bends into sweeping hooks and curls.
float field(vec2 p, float t) {
  vec2 q = warp(p, t);
  // frequency grows towards +x, so the pleats converge into one sweeping fold
  float s = dot(q, vec2(0.42, 1.0)) * 1.55 * exp(0.16 * q.x) + t * 0.12;
  // asymmetric crest profile (soft back, steeper front) like draped fabric
  float folds = sin(s) + 0.38 * sin(2.0 * s + 1.1) + 0.12 * sin(3.0 * s + 2.3);
  // fold amplitude breathes across the surface so some folds die out
  float amp = 0.65 + 0.35 * sin(q.x * 0.7 - q.y * 0.4 + t * 0.21);
  float broad = 0.45 * sin(q.x * 0.55 + q.y * 0.35 - t * 0.16 + 0.8);
  // fine secondary pleats -> layered striations inside the big folds
  float pleats = 0.10 * sin(s * 3.6 + q.x * 0.9 - t * 0.3) * (0.5 + 0.5 * sin(q.y * 0.8 + t * 0.17));
  return folds * amp + broad + pleats;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;          // -0.89..0.89 x, -0.5..0.5 y
  float t = uTime;

  // ---- camera ---------------------------------------------------------------
  vec2 p = rot(uCam.x) * (uv * uCam.y) + uCamOffset;

  // ---- fake depth of field: focus band across the frame ----------------------
  // Upper-left and lower-right corners drift out of focus.
  float focusDist = abs(dot(uv - vec2(0.05, 0.02), normalize(vec2(0.55, -1.0))));
  float defocus = smoothstep(0.2, 0.6, focusDist);
  defocus = max(defocus, smoothstep(0.55, 0.95, length(uv * vec2(0.8, 1.2))));

  // ---- surface ---------------------------------------------------------------
  float px = uCam.y / uRes.y;                        // one pixel in field units
  float e = px * mix(2.0, 70.0, defocus);            // wide stencil = blurred shading
  float h   = field(p, t);
  float hxp = field(p + vec2(e, 0.0), t);
  float hxm = field(p - vec2(e, 0.0), t);
  float hyp = field(p + vec2(0.0, e), t);
  float hym = field(p - vec2(0.0, e), t);
  vec2 grad = vec2(hxp - hxm, hyp - hym) / (2.0 * e);
  // curvature (Laplacian) in units of the fold scale: < 0 on crests.
  // Uses a wider stencil than the normal: a 2 px second difference is
  // dominated by float rounding noise and shows up as hairline scratches.
  float e2 = px * mix(10.0, 70.0, defocus);
  float lap = (field(p + vec2(e2, 0.0), t) + field(p - vec2(e2, 0.0), t)
             + field(p + vec2(0.0, e2), t) + field(p - vec2(0.0, e2), t) - 4.0 * h) / (e2 * e2) * 0.06;
  float hscale = 0.55;
  vec3 N = normalize(vec3(-grad * hscale, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);

  float hn = clamp(h * 0.3 + 0.5, 0.0, 1.0);        // normalised height 0..1

  // ---- iridescent, orientation-dependent material ------------------------------
  // Like flake-pigment satin: the hue flips with the direction the surface
  // tilts. Tilted one way -> ribbon colour (magenta/violet), the other way and
  // facing the viewer -> glowing sheet colour (lime).
  vec2 tilt = N.xy;
  float slope = 1.0 - N.z;
  float m = dot(tilt, normalize(vec2(0.55, 0.85))) + 0.10 * sin(h * 2.3 + t * 0.15);
  float ribbonMask = smoothstep(-0.02 + uSheetBias, 0.22 + uSheetBias, m);

  vec3 L1 = normalize(vec3(-0.35, 0.65, 0.68));   // key, upper-left
  vec3 L2 = normalize(vec3(0.70, -0.30, 0.65));   // fill / back glow, lower-right
  float dif1 = max(dot(N, L1), 0.0);
  float dif2 = max(dot(N, L2), 0.0);

  // sheet glows from within (back-lit), dims where it turns away
  float sheetLum = 0.18 + 1.0 * smoothstep(0.25, 0.95, dif1 * 0.55 + dif2 * 0.75);
  vec3 sheet = mix(uBase, uBaseHi, smoothstep(0.75, 1.2, sheetLum) * 0.75) * sheetLum * 1.2;

  vec3 rib = mix(uRibbon, uRibbonAlt, clamp(uProgress * 1.3 - 0.25 + 0.3 * sin(h * 1.3 + t * 0.2), 0.0, 1.0));
  float ribLum = 0.05 + 1.5 * pow(clamp(dif1 * 0.9 + dif2 * 0.35, 0.0, 1.0), 2.4);
  // metallic: faces pointing at the camera stay dark plum, flanks light up
  ribLum *= mix(0.35, 1.0, smoothstep(0.02, 0.3, slope));
  vec3 ribbon = rib * ribLum;
  // thin-film rim: steep fold flanks go hot pink -> white
  ribbon += mix(rib, vec3(1.0, 0.85, 1.0), 0.4) * smoothstep(0.25, 0.8, slope) * 0.85;

  vec3 col = mix(sheet, ribbon, ribbonMask);

  // surfaces turned far away from both lights fall into deep shadow
  float away = smoothstep(-0.05, -0.65, dot(tilt, normalize(vec2(-0.2, 0.6))) * 0.9 + (N.z - 0.5));
  col = mix(col, uShadow, away * 0.8);

  // ---- specular sheen ----------------------------------------------------------
  vec3 R = reflect(-V, N);
  float sp1 = pow(max(dot(R, L1), 0.0), 140.0);
  float sp2 = pow(max(dot(R, L2), 0.0), 40.0);
  float specAmt = mix(0.8, 1.4, ribbonMask) * (1.0 - 0.6 * defocus);
  col += uSpec * (sp1 * 3.0 + sp2 * 0.9) * specAmt;
  // crisp white highlight lines riding every pleat crest
  float crest = smoothstep(0.35, 1.2, -lap) * smoothstep(0.05, 0.35, dif1 + dif2 * 0.6);
  col += mix(uSpec, vec3(1.0), 0.5) * crest * 1.3 * (1.0 - 0.8 * defocus);
  // broad satin sheen sweeping along the ribbon flanks
  float sheen = pow(max(dot(R, normalize(vec3(-0.2, 0.75, 0.62))), 0.0), 9.0);
  col += mix(uSpec, uRibbon + 0.4, 0.5) * sheen * 0.55 * ribbonMask * (1.0 - 0.5 * defocus);

  // ---- glitter flakes flowing with the surface -------------------------------------
  // isotropic cells in camera space (no warp stretch -> round sparkles)
  vec2 gq = p * (uRes.y / uCam.y) * 0.17;           // ~6 px cells at 2160p
  vec2 cell = floor(gq);
  vec2 f = fract(gq) - 0.5;
  float r1 = hash12(cell);
  vec2 off = hash22(cell + 17.0) - 0.5;
  float d = length(f - off * 0.5);
  float flakeR = mix(0.09, 0.36, pow(hash12(cell + 5.3), 1.6)) * mix(1.0, 2.6, defocus);
  float shape = exp(-d * d / (flakeR * flakeR) * 2.2);
  // each flake catches the light at its own phase as the surface moves
  float tw = 0.5 + 0.5 * sin(r1 * 40.0 + t * (1.5 + r1 * 3.0) + dot(N.xy, vec2(23.0, 17.0)));
  float sparkle = pow(tw, 5.0) * step(0.22, r1) * shape * mix(0.6, 1.9, hash12(cell + 9.1));
  vec3 gcol = mix(uGlitterB, uGlitterA, ribbonMask);
  float glitAmt = mix(2.0, 0.5, defocus) * (0.45 + 1.1 * away + 0.7 * ribbonMask);
  col += gcol * sparkle * glitAmt;

  // ---- grade --------------------------------------------------------------------
  col *= uExposure;
  float lumaC = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lumaC), col, 0.8);                  // tame saturation slightly
  float vig = smoothstep(1.25, 0.35, length(uv * vec2(0.9, 1.15)));
  col *= mix(0.55, 1.0, vig);
  col = col / (1.0 + col * 0.22);                    // soft shoulder
  col = pow(max(col, 0.0), vec3(0.95));
  // tiny dither to avoid banding after 8-bit encode
  col += (hash12(frag + fract(t) * 91.0) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
