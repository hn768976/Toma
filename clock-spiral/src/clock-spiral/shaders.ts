// GLSL ES 3.00 shaders for the clock spiral (WebGL 2).
//
// Pass 1 maps every pixel into log-polar space. In that space a logarithmic
// spiral is a straight line, so the clock-dial strip can be laid along it as
// an ordinary repeating texture. Zooming in is just a shift of log(r), which
// makes the "infinite fall into the clock" seamless.
//
// Pass 2 adds lens effects (depth-of-field blur that grows toward the frame
// edge, chromatic fringe, glow), the clock hands, vignette and film grain.

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const COMMON = /* glsl */ `
precision highp float;
#define TAU 6.28318530718
#define BEND 0.22
uniform vec2 uRes;
uniform vec2 uCenter;   // spiral centre, in units of frame height
uniform vec2 uTilt;     // perspective tilt of the tunnel axis
uniform float uTime;
`;

export const SCENE_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uDial;
uniform sampler2D uNoise;
uniform float uZoom;     // log-space zoom offset
uniform float uRot;      // spiral rotation (radians)
uniform float uScroll;   // numerals sliding along the strip (cells)
uniform vec3 cPaper;
uniform vec3 cPaperHot;
uniform vec3 cInk;
uniform vec3 cRim;
uniform vec3 cGap;
uniform vec3 cGapDeep;
out vec4 outColor;

const float G = 1.16;          // log growth per spiral turn
const float BAND = 0.55;       // share of each turn covered by the dial strip
const float CELLS_PER_TURN = 16.0;

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y - uCenter;
  p = p / (1.0 + dot(p, uTilt));
  // Tunnel bend: inner turns sit further along the tilt than outer ones,
  // so the spiral reads as a funnel seen off-axis rather than flat rings.
  p -= uTilt * BEND * (1.0 - smoothstep(0.0, 0.7, length(p)));
  float r = max(length(p), 1e-5);
  float a = atan(p.y, p.x) + uRot;
  float L = log(r) - uZoom;

  float v = L / G + a / TAU;
  float n = floor(v);
  float f = v - n;
  float along = -a + TAU * n;  // continuous angle along the strip

  // Analytic screen-space derivatives (atan has a seam, so no dFdx on it).
  vec2 dpx = dFdx(p), dpy = dFdy(p);
  float r2 = r * r;
  float dax = (p.x * dpx.y - p.y * dpx.x) / r2;
  float day = (p.x * dpy.y - p.y * dpy.x) / r2;
  float dLx = dot(p, dpx) / r2;
  float dLy = dot(p, dpy) / r2;
  float uScale = CELLS_PER_TURN / (TAU * 12.0);

  float u = along * uScale + uScroll;
  vec2 gx = vec2(-dax * uScale, -(dLx / G + dax / TAU) / BAND);
  vec2 gy = vec2(-day * uScale, -(dLy / G + day / TAU) / BAND);

  // Smoke/grime that travels with the spiral.
  vec2 nUV = vec2(along * 0.45, L * 2.2 - uTime * 0.03);
  float smoke = texture(uNoise, nUV).r;
  smoke = smoothstep(0.25, 0.8, smoke);
  float smoke2 = texture(uNoise, nUV * 2.3 + vec2(0.31, uTime * 0.02)).g;

  // Overall light: hot around the inner turns, falling off outward.
  float glow = smoothstep(0.0, 0.05, r) * (1.0 - 0.7 * smoothstep(0.3, 1.0, r));
  float hot = smoothstep(0.5, 0.06, r) * smoothstep(0.0, 0.05, r);

  vec3 col;
  float dialStart = 1.0 - BAND;
  if (f >= dialStart) {
    float ty = (1.0 - f) / BAND;  // 0 = outer rim, 1 = inner edge
    vec4 t = textureGrad(uDial, vec2(u, ty), gx, gy);
    vec3 paper = mix(cPaper, cPaperHot, hot) * t.r;
    paper *= 0.82 + 0.3 * smoke2;
    col = mix(paper, cInk, t.g * 0.92);
    col = mix(col, cRim * (0.55 + 0.6 * smoke), t.b);
    col *= glow;
  } else {
    // Gap between turns: a darker, burnt dial seen in shadow with faint numerals.
    float gyN = f / dialStart;
    // Ghost numerals of a burnt dial, smaller and out of focus.
    vec4 t = textureGrad(uDial, vec2(u * 1.7 + 0.37, fract(gyN * 1.8)), gx * 6.0, gy * 6.0);
    float grime = texture(uNoise, vec2(along * 2.4, L * 0.35) + 0.5).r;
    float fibre = texture(uNoise, vec2(along * 6.0, f * 0.15 + 0.2)).g;
    float depth = sin(gyN * 3.14159);          // deeper in the middle of the trough
    vec3 base = mix(cGap, cGapDeep, depth * 0.8);
    base *= (0.5 + 0.9 * grime * fibre) * (0.75 + 0.5 * smoke);
    base = mix(base, base * 0.45, t.g * 0.6);
    // Rim-light where the trough meets the dial edges.
    float lip = smoothstep(0.12, 0.0, gyN) * 0.7 + smoothstep(0.85, 1.0, gyN) * 0.45;
    base += cPaper * lip * 0.25 * (0.6 + 0.4 * smoke2);
    col = base * glow;
  }

  // Fall-off keeps its warmth: dim areas sink toward the trough hue, not grey.
  vec3 warm = cGap / max(cGap.r, max(cGap.g, cGap.b));
  col *= mix(warm, vec3(1.0), smoothstep(0.25, 0.85, glow));

  // Dark hub swallowing the infinitely dense centre.
  col *= smoothstep(0.006, 0.03, r);
  outColor = vec4(col, 1.0);
}
`;

export const POST_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uScene;
uniform sampler2D uNoise;
uniform float uMinute;   // hand angles, radians clockwise from 12
uniform float uHour;
uniform float uFrame;
uniform vec3 cInk;
uniform vec3 cPaperHot;
uniform vec3 cBg;
uniform vec3 cGrade;
uniform float uExposure;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Clock hand along +y in local space; returns signed distance.
float hand(vec2 q, float len, float w, float tipW, float tipPos, float tail) {
  float width = mix(w, w * 0.45, clamp(q.y / len, 0.0, 1.0));
  float blade = sdSeg(q, vec2(0.0, -tail), vec2(0.0, len)) - width;
  // Spade / diamond ornament.
  vec2 d = q - vec2(0.0, len * tipPos);
  float diamond = (abs(d.x) / tipW + abs(d.y) / (len * 0.12)) - 1.0;
  diamond *= min(tipW, len * 0.12);
  // Counterweight disc on the tail.
  float cw = length(q - vec2(0.0, -tail * 0.8)) - w * 2.2;
  return min(min(blade, diamond), cw);
}

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 c = q - uCenter;
  float d = length(c);

  // Depth-of-field: sharp centre, increasingly soft toward the edges.
  float edge = smoothstep(0.16, 0.75, d);
  float radius = (0.0012 + 0.016 * edge) * uRes.y;
  vec2 dir = d > 1e-4 ? c / d : vec2(0.0);
  float ca = 0.0035 * edge * uRes.y;   // chromatic fringe in pixels

  // Lens blur: a few rotated taps into a pre-filtered mip level (cheap even
  // in software GL), with red/blue pulled apart for the chromatic fringe.
  float lod = max(0.0, log2(radius / 2.5));
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float th = jit + float(i) * 1.5708;
    vec2 o = vec2(cos(th), sin(th)) * radius * 0.55;
    col += textureLod(uScene, (gl_FragCoord.xy + o) / uRes, lod).rgb;
  }
  col *= 0.25;
  float rS = textureLod(uScene, (gl_FragCoord.xy + dir * ca) / uRes, lod).r;
  float bS = textureLod(uScene, (gl_FragCoord.xy - dir * ca) / uRes, lod).b;
  col.r = mix(col.r, rS, 0.6);
  col.b = mix(col.b, bS, 0.6);

  // Soft glow from a low mip of the scene.
  vec3 bloom = textureLod(uScene, uv, 5.0).rgb * 0.55 + textureLod(uScene, uv, 7.0).rgb * 0.45;
  col += bloom * bloom * 0.9;

  // Drifting smoke that swallows the outer turns.
  float sm = texture(uNoise, q * 0.9 + vec2(uTime * 0.012, -uTime * 0.008)).r;
  float sm2 = texture(uNoise, q * 2.1 + vec2(-uTime * 0.02, uTime * 0.01) + 0.4).g;
  float smokeV = smoothstep(0.25, 0.75, sm * 0.7 + sm2 * 0.3);
  float outer = smoothstep(0.26, 0.62, d);
  col *= mix(1.0, 0.18 + 0.8 * smokeV, outer);

  // Clock hands (with a soft drop shadow onto the dial).
  float px = 1.0 / uRes.y;
  vec2 hc = c / (1.0 + dot(c, uTilt)) - uTilt * BEND;  // hub sits at the spiral eye
  vec2 lm = rot(hc, uMinute);
  vec2 lh = rot(hc, uHour);
  float dm = hand(lm, 0.31, 0.0058, 0.018, 0.74, 0.05);
  float dh = hand(lh, 0.18, 0.0085, 0.026, 0.72, 0.035);
  float dHands = min(dm, dh);
  float dHub = length(hc) - 0.016;
  vec2 hs = hc - vec2(0.004, -0.005);  // shadow cast down-right
  float dShadow = min(min(hand(rot(hs, uMinute), 0.31, 0.0058, 0.018, 0.74, 0.05),
                          hand(rot(hs, uHour), 0.18, 0.0085, 0.026, 0.72, 0.035)),
                      length(hs) - 0.016);
  col *= 1.0 - 0.5 * smoothstep(0.01, -0.002, dShadow);
  float handA = smoothstep(px * 1.5, -px * 1.5, dHands);
  vec3 handCol = cInk * 0.6 + cPaperHot * 0.05 * smoothstep(0.004, 0.0, abs(dHands + 0.002));
  col = mix(col, handCol, handA);
  float hubA = smoothstep(px * 1.5, -px * 1.5, dHub);
  float hubRing = smoothstep(px * 2.0, 0.0, abs(dHub + 0.003)) * 0.6;
  col = mix(col, cInk * 0.35 + cPaperHot * hubRing * 0.5, hubA);

  // Vignette toward smoky darkness, colour grade and grain.
  vec2 vq = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float vig = smoothstep(1.35, 0.4, length(vq * vec2(0.78, 1.0)));
  col = mix(cBg, col, vig);
  col = pow(max(col * uExposure, 0.0), vec3(0.95)) * cGrade;
  float g = hash(gl_FragCoord.xy + uFrame * 17.0) - 0.5;
  col += g * 0.035;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
