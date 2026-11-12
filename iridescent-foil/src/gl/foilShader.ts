import { NOISE_GLSL } from "./noise.glsl";

/**
 * Iridescent liquid foil.
 *
 * A domain-warped fBm heightfield (stretched along a diagonal "streak"
 * direction at the start, relaxing into crumpled folds by the end) is lit by a
 * small set of coloured studio lights. Highlights are tinted by a thin-film
 * style iridescence ramp built from the three palette colours, and a layer of
 * surface-locked glitter flakes catches the light.
 */
export const FOIL_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uProgress;

// Palette (display-space colours)
uniform vec3 uBase;     // deep shadow tone
uniform vec3 uKey;      // primary highlight hue
uniform vec3 uRim;      // secondary highlight hue
uniform vec3 uAccent;   // tertiary hue (film ramp + flakes)
uniform vec3 uGlow;     // broad soft glow hue
uniform vec3 uCore;     // hottest highlight core (near white)

${NOISE_GLSL}

const float STREAK_ANGLE = 0.74;  // streaks run bottom-left -> top-right

float surface(vec2 p, float t, float P) {
  // Long, parallel streaks at the start relax into crumpled bulges.
  float relax = smoothstep(0.08, 0.95, P);
  vec2 q = rot2(STREAK_ANGLE) * p;           // q.y runs along the streaks
  float stretch = mix(5.0, 1.6, relax);
  vec2 a = vec2(q.x, q.y / stretch);
  a.y -= t * 0.07;                            // material flows along the streaks
  // smooth, low-frequency domain warp
  vec2 w = vec2(snoise(a * 0.55 + vec2(0.0, t * 0.07)),
                snoise(a * 0.55 + vec2(4.1, 7.3) + t * 0.05));
  vec2 b = a + w * mix(0.28, 0.70, relax);
  float h = 0.64 * snoise(b * 0.76 + vec2(1.7, -t * 0.05))
          + 0.17 * snoise(b * 1.45 + vec2(8.1, 2.3) + t * 0.08);
  // bundles of fine parallel creases running along the streaks
  float band = smoothstep(-0.35, 0.45, snoise(vec2(b.x * 0.65, b.y * 0.25) + 11.0));
  // narrow but smooth-crested ridges (smooth |sin| avoids slope seams)
  float sn = sin(b.x * 6.0 + 1.6 * h);
  float cr = 1.0 - sqrt(sn * sn + 0.06);
  h += mix(0.15, 0.05, relax) * band * cr * cr;
  return h;
}

// Cyclic three-colour ramp used for the thin-film iridescence.
vec3 film(float x) {
  // smooth cosine-weighted blend (no segment seams / contour banding)
  vec3 w = 0.5 + 0.5 * cos(6.2831853 * (fract(x) - vec3(0.0, 1.0 / 3.0, 2.0 / 3.0)));
  w = w * w;
  return (uKey * w.x + uRim * w.y + uAccent * w.z) / (w.x + w.y + w.z);
}

float lobe(vec3 r, vec3 l, float k) { return pow(max(dot(r, normalize(l)), 0.0), k); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;           // y in [-0.5, 0.5]
  float t = uTime * 1.35;  // material motion speed
  float P = uProgress;

  // --- camera: slow push-in with a gentle roll and drift --------------------
  float ease = P * P * (3.0 - 2.0 * P);
  float zoom = mix(1.50, 0.85, ease);
  float roll = mix(-0.10, 0.12, ease);
  vec2 pan = vec2(0.22 * ease, -0.18 * ease);
  vec2 p = rot2(roll) * uv * zoom + pan;

  // --- surface + normal -------------------------------------------------------
  const float EPS = 0.0022;
  float h  = surface(p, t, P);
  float hx = surface(p + vec2(EPS, 0.0), t, P);
  float hy = surface(p + vec2(0.0, EPS), t, P);
  vec2 grad = vec2(hx - h, hy - h) / EPS;
  float bump = 0.55;
  vec3 N = normalize(vec3(-grad * bump, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-V, N);
  float facing = N.z;

  // --- studio lights (reflection lobes) ---------------------------------------
  float kKey  = lobe(R, vec3( 0.55,  0.50, 0.68), 3.2);
  float kRim  = lobe(R, vec3(-0.78, -0.05, 0.62), 12.0);
  float kTop  = lobe(R, vec3(-0.35,  0.65, 0.68), 20.0);
  float kLow  = lobe(R, vec3( 0.20, -0.80, 0.56), 14.0);
  float kHot  = lobe(R, vec3( 0.10,  0.15, 0.98), 40.0);
  float broad = lobe(R, vec3( 0.45,  0.35, 0.82), 2.0);

  // iridescent film phase: depends on view angle + height + position
  float phase = 1.35 * (1.0 - facing) + 0.42 * h + 0.06 * p.x + 0.04 * t;
  vec3 iri = film(phase);
  vec3 iri2 = film(phase + 0.38);

  // large-scale illumination falloff: the studio lights do not reach
  // everywhere, leaving broad dark regions like the reference.
  vec2 s = frag / uRes;
  float illum = smoothstep(-0.55, 0.45, snoise(p * 0.32 + vec2(3.0, -1.0) + vec2(0.05, 0.03) * t));
  // brightness arc: bright opening, dip around frame ~110, recovery at the end
  float dip = exp(-pow((P - 0.52) / 0.15, 2.0));
  illum *= mix(1.0, smoothstep(1.05, 0.35, s.x), 0.30 + 0.35 * dip);
  illum = (0.16 + 1.0 * illum) * (1.0 - 0.28 * dip);
  kKey *= illum; kRim *= illum; kTop *= illum; kLow *= illum; broad *= illum;

  vec3 col = uBase * (0.20 + 0.60 * facing);
  col += uGlow * broad * 0.55;
  col += uKey    * kKey * 1.65;
  col += uRim    * kRim * 1.25;
  float kThin = lobe(R, vec3(-0.70, 0.10, 0.70), 60.0) * illum;
  col += mix(uRim, uCore, 0.6) * kThin * 2.2;
  col += mix(uKey, uCore, 0.5) * lobe(R, vec3(0.62, 0.40, 0.67), 70.0) * illum * 1.6;
  col += iri     * kTop * 1.30;
  col += uAccent * kLow * 0.75;
  col += iri2 * (kKey * 0.35 + kRim) * 0.40;
  col += uCore * (kHot * 1.3 + pow(kKey, 4.0) * 0.8 + pow(kRim, 4.0) * 0.6);

  // crease rims: steep slopes catch a thin bright edge
  float slope = 1.0 - facing;
  col += iri * smoothstep(0.30, 0.75, slope) * 0.35 * (0.4 + kKey + kRim);

  // cavity darkening in the valleys
  col *= mix(0.35, 1.0, smoothstep(-0.70, 0.30, h));

  // --- glitter flakes ---------------------------------------------------------
  // Two jittered layers (no visible lattice), locked to the material and
  // gathered in the shadowed areas.
  float env = clamp(broad + kKey + kRim + kTop, 0.0, 1.5);
  float shade = dot(col, vec3(0.3, 0.5, 0.2));
  float shadowW = 0.35 + 0.65 * smoothstep(0.55, 0.08, shade);
  float patchy = smoothstep(-0.45, 0.5, snoise(p * 1.8 + vec2(7.0, -t * 0.05)));
  // Flakes live in the material's own (pre-warp) flow coordinates, so they
  // travel with the foil instead of sliding over it.
  float gRelax = smoothstep(0.08, 0.95, P);
  float gStretch = mix(5.0, 1.6, gRelax);
  vec2 gq = rot2(STREAK_ANGLE) * p;
  const float GA = 1.6;                            // cell aspect along the streaks
  vec2 mat = vec2(gq.x, (gq.y / gStretch - t * 0.07) * GA);
  float aspect = gStretch / GA;                    // cell-space -> screen-space (y)
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    mat2 lr = rot2(fl * 0.9);                      // layers use different lattice angles
    vec2 g = lr * mat * (150.0 + fl * 70.0) + fl * 31.7;
    vec2 gid = floor(g);
    vec2 gf = fract(g);
    vec3 rnd = hash32(gid + fl * 91.0);
    vec2 c = 0.18 + 0.64 * rnd.xy;                 // centre anywhere in the cell
    vec2 d = rot2(-fl * 0.9) * (gf - c);           // back to material axes
    d.y *= aspect;                                 // keep flakes round on screen
    float flake = smoothstep(0.17, 0.0, length(d));
    float present = step(1.0 - (0.22 + 0.5 * patchy), rnd.z);
    // gentle twinkle: wide glint lobe so flakes shimmer rather than pop
    vec3 fn = normalize(N + (hash32(gid + 17.0 + fl) - 0.5) * 1.2);
    float glint = pow(max(dot(reflect(-V, fn), normalize(vec3(0.3, 0.3, 0.9))), 0.0), 4.0);
    vec3 flakeCol = hash12(gid + 3.1 + fl) > 0.25 ? uAccent : uKey;
    col += flakeCol * flake * present * shadowW * (1.0 + 1.0 * glint) * (0.55 + 0.7 * env);
  }

  // --- big soft screen-space glows (lens bloom feel) --------------------------
  float glowA = exp(-6.0 * length((s - vec2(1.0 - 0.25 * ease, 0.92)) * vec2(1.6, 1.0)));
  float glowB = exp(-7.0 * length((s - vec2(0.02, 0.62 - 0.3 * ease)) * vec2(1.4, 1.0)));
  col += uKey * glowA * 0.75 * (1.0 - 0.75 * ease);
  col += mix(uRim, uCore, 0.65) * glowB * 1.2 * (1.0 - smoothstep(0.30, 0.55, P) * 0.75);
  // blown-out white/cyan hotspot on the left edge over the opening ~4 s
  float hotFade = 1.0 - smoothstep(0.55, 0.78, P);
  float hotCore = exp(-9.0 * length((s - vec2(-0.03, 0.50 - 0.1 * ease)) * vec2(2.0, 0.7)));
  float hotBand = exp(-4.0 * length((s - vec2(-0.02, 0.50 - 0.1 * ease)) * vec2(2.2, 0.55)));
  col += uRim * hotBand * 2.6 * hotFade;
  col += uCore * hotCore * 3.2 * hotFade;

  // --- tone map + vignette -----------------------------------------------------
  col = 1.0 - exp(-col * 1.55);
  // keep the foil saturated (avoid milky mixes of complementary hues)
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(luma), col, 1.22), 0.0);
  float vig = smoothstep(1.25, 0.35, length((s - 0.5) * vec2(1.25, 1.0)));
  col *= mix(0.72, 1.0, vig);
  col = pow(col, vec3(0.95));
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
