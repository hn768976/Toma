// WebGL 2 shaders for the neon arc light-streak loop.
//
// Everything is expressed in "reference units": a 768 x 432 grid matching the
// reference clip, so the same shader renders natively at 3840 x 2160 (or any
// size) — only uScale changes.

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uResolution;   // output size in device pixels
uniform float uTime;         // seconds
uniform float uLoop;         // loop length in seconds (2.0)
uniform int   uCamera;       // 0 = reference framing, 1 = low-angle rolling dolly
uniform float uProgress;     // 0..1 over the whole clip (for camera moves)

out vec4 outColor;

const float PI = 3.14159265359;
const vec2  REF = vec2(768.0, 432.0);
// Centre of the concentric arcs, traced from the reference frame.
const vec2  ARC_CENTER = vec2(451.0, -708.0);

float hash11(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453123); }
float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

// Palette of the reference: cyan -> electric blue -> magenta -> pink/violet.
vec3 streakColor(float k) {
  vec3 cyan    = vec3(0.04, 0.66, 0.88);
  vec3 blue    = vec3(0.14, 0.32, 0.82);
  vec3 magenta = vec3(0.90, 0.06, 0.58);
  vec3 pink    = vec3(1.00, 0.06, 0.30);
  vec3 violet  = vec3(0.70, 0.05, 0.95);
  k = clamp(k, 0.0, 1.0) * 4.0;
  if (k < 1.0) return mix(cyan, blue, k);
  if (k < 2.0) return mix(blue, magenta, k - 1.0);
  if (k < 3.0) return mix(magenta, pink, k - 2.0);
  return mix(pink, violet, k - 3.0);
}

// Brightness along an arc for one band: long, continuous light trails whose
// intensity swells and fades along their length. Periodic in time with period
// uLoop — the pattern travels exactly one pattern-length per loop, so frame 60
// is identical to frame 0 (seamless 2 s loop, like the reference).
float alongArc(float s, float id, float speedMin, float speedMax, float contrast) {
  float speed = mix(speedMin, speedMax, hash11(id * 3.17));
  float period = speed * uLoop;               // pattern length (ref px)
  float q = (s + speed * uTime) / period;     // + => flows right-to-left
  float p1 = hash11(id * 9.71), p2 = hash11(id * 4.33), p3 = hash11(id * 6.19);
  float w1 = 0.5 + 0.5 * cos(2.0 * PI * (q + p1));
  float w2 = 0.5 + 0.5 * cos(2.0 * PI * (2.0 * q + p2));
  float w3 = 0.5 + 0.5 * cos(2.0 * PI * (3.0 * q + p3));
  float v = w1 * 0.55 + w2 * 0.3 + w3 * 0.15;
  return pow(clamp(v, 0.0, 1.0), contrast);
}

// One layer of concentric streaks.
vec3 streakLayer(float r, float ang, float s, float spacing, float wMin, float wMax,
                 float density, float contrast,
                 float spMin, float spMax, float gain, float salt, float pxRef) {
  vec3 acc = vec3(0.0);
  float base = floor(r / spacing);
  for (int k = -2; k <= 2; k++) {
    float id = base + float(k) + salt;
    float h0 = hash11(id);
    if (h0 > density) continue;
    float centreR = (base + float(k) + 0.5 + (hash11(id * 1.37) - 0.5) * 0.8) * spacing;
    float w = mix(wMin, wMax, hash11(id * 5.31));
    // anti-aliasing: never thinner than ~0.8 output pixels, energy preserved
    float wEff = max(w, pxRef * 0.8);
    float prof = exp(-pow((r - centreR) / wEff, 2.0)) * (w / wEff);
    if (prof < 0.002) continue;
    float a = alongArc(s, id, spMin, spMax, contrast);
    // colour: cyan/blue on the left, magenta/pink/violet to the right
    float side = smoothstep(-0.42, 0.42, ang);
    float k2 = clamp(side * 0.95 + (hash11(id * 2.13) - 0.5) * 0.85, 0.0, 1.0);
    vec3 c = streakColor(k2);
    acc += c * prof * a * gain * mix(0.55, 1.0, hash11(id * 7.7));
  }
  return acc;
}

vec3 scene(vec2 p, float pxRef) {
  // The reference arc is lopsided: steeper on the left, flatter on the right.
  vec2 q = p;
  q.x = ARC_CENTER.x + (p.x - ARC_CENTER.x) * (1.0 + 0.32 * (1.0 - smoothstep(0.0, ARC_CENTER.x, p.x)));
  vec2 d = q - ARC_CENTER;
  float r = length(d);
  float ang = atan(d.x, d.y);              // 0 straight below the centre, <0 left
  float s = ang * 900.0;                   // arc length on a nominal radius
  // streaks gather in bundles with darker gaps between them
  float bundle = 0.5 + 0.3 * sin(r * 0.033 + 1.3) + 0.2 * sin(r * 0.081 + 0.4);
  bundle = 0.3 + 0.95 * smoothstep(0.15, 0.85, bundle);

  // where streaks live: a wide band below the dark void at the top
  float band = smoothstep(835.0, 905.0, r) * (1.0 - smoothstep(1200.0, 1320.0, r));
  // the bottom-left corner of the reference is darker
  float cornerDark = 1.0 - 0.93 * (1.0 - smoothstep(60.0, 420.0, length((p - vec2(0.0, 432.0)) * vec2(0.65, 1.0))));

  // background: deep navy with cyan top-left and violet bottom-right glows
  vec3 col = vec3(0.0, 0.002, 0.112);
  col += vec3(0.01, 0.0, 0.04) * smoothstep(950.0, 1150.0, r);
  col += vec3(0.0, 0.42, 0.72) * exp(-pow(length(p - vec2(-20.0, -10.0)) / 125.0, 2.0)) * 1.0;
  col += vec3(0.42, 0.0, 0.72) * exp(-pow(length(p - vec2(790.0, 440.0)) / 170.0, 2.0)) * 0.72;
  col += vec3(0.09, 0.0, 0.12) * band * 0.6;

  // soft, out-of-focus wide streaks
  vec3 soft = streakLayer(r, ang, s, 16.0, 5.0, 13.0, 0.9, 2.4,
                          150.0, 260.0, 1.15, 0.0, pxRef);
  // the reference's left side is dominated by broad, soft teal trails
  float leftSide = 1.0 - smoothstep(-0.5, 0.05, ang);
  soft *= mix(vec3(1.0), vec3(1.15, 2.6, 1.9), leftSide);
  // sharper light trails
  vec3 sharp = streakLayer(r, ang, s, 7.0, 1.1, 3.0, 0.6, 4.0,
                           170.0, 320.0, 1.6, 1000.0, pxRef);
  // hairline highlights
  vec3 hair = streakLayer(r, ang, s, 13.0, 0.3, 0.6, 0.4, 5.0,
                          200.0, 320.0, 0.8, 5000.0, pxRef);

  col *= mix(0.4, 1.0, cornerDark);
  // slight 2 s "breathing" of the light, as in the reference (loop-safe)
  float breathe = 1.0 + 0.05 * sin(2.0 * PI * uTime / uLoop);
  col += (soft + sharp + hair) * band * bundle * cornerDark * breathe;
  return col;
}

void main() {
  // pixel -> reference units, origin top-left, y down
  float scale = uResolution.y / REF.y;
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 p = frag / scale;
  float pxRef = 1.0 / scale;               // one output pixel in ref units

  float fog = 1.0;
  if (uCamera == 1) {
    // Version 2 camera: low, tilted viewpoint over the streak field with a slow
    // rolling dolly-in. A projective (pitch) transform foreshortens the arcs
    // toward a soft horizon at the top of frame.
    float e = uProgress * uProgress * (3.0 - 2.0 * uProgress);
    vec2 c = p - REF * 0.5;
    float roll = radians(mix(-9.0, 5.0, e));
    c = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * c;
    float tilt = 0.62;
    float w = 1.0 + tilt * (c.y / (REF.y * 0.5));
    w = max(w, 0.06);
    float zoom = mix(1.18, 0.86, e);
    vec2 world = c / w * zoom;
    p = world + vec2(mix(70.0, 10.0, e), mix(150.0, 120.0, e)) + REF * 0.5;
    pxRef = pxRef * zoom / (w * w);
    fog = smoothstep(0.08, 0.55, w);
  }

  vec3 col = scene(p, pxRef);
  if (uCamera == 1) {
    vec3 sky = vec3(0.0, 0.002, 0.112);
    col = mix(sky, col, fog);
  }

  // filmic-ish tone map keeps highlights soft like the reference
  col = 1.0 - exp(-col * 1.35);
  // gentle vignette
  vec2 uv = frag / uResolution;
  col *= 0.86 + 0.14 * (1.0 - smoothstep(0.35, 1.25, length(uv - 0.5) * 1.6));
  outColor = vec4(col, 1.0);
}
`;
