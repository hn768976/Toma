// GLSL shape library for the market-crash composition (billboard kinds).

export const MKIND = {
  dot: 0, // soft glowing dot / bokeh
  flare: 1, // lens flare with anamorphic streak + star rays
  square: 2, // LED pixel / flying rectangle
  candle: 3, // candlestick (hollow body + wick)
  burst: 4, // spark star-burst
} as const;

export const MARKET_SHAPES = /* glsl */ `
uniform float uFlareGain;
const float PI = 3.14159265;

float fadeOut() {
  if (vTiming.w <= 0.0) return 1.0;
  return 1.0 - clamp((uTime - vTiming.z) / vTiming.w, 0.0, 1.0);
}

float boxM(vec2 p, vec2 hs, vec2 soft) {
  vec2 d = abs(p) - hs;
  vec2 m = smoothstep(soft, -soft, d);
  return m.x * m.y;
}

vec3 shadeDot(vec2 p, vec2 q) {
  float b = blurRel();
  float t = smoothstep(0.0, 1.4, b);
  float r2 = dot(p, p);
  float sharp = exp(-r2 * 3.0) * 1.15 + exp(-r2 * 0.8) * 0.12;
  float sc = max(vScale.x, 1.0);
  float soft = bokeh(q) * 0.42 / (sc * sc);
  return vColor.rgb * vColor.a * mix(sharp, soft, t);
}

// Flare quads are wide (aspect = size.x/size.y); radial parts use y units.
vec3 shadeFlare(vec2 p, vec2 q) {
  float aspect = vSizePx.x / max(vSizePx.y, 1.0);
  vec2 c = vec2(p.x * aspect, p.y);
  float r = length(c);
  float b = blurRel();
  float t = smoothstep(0.0, 1.0, b);
  float flick = 0.88 + 0.12 * sin(uTime * vParams.x + vParams.y) * sin(uTime * vParams.x * 0.37 + 1.7);
  float core = exp(-r * r * 90.0) * 2.6;
  float glow = exp(-r * r * 10.0) * 0.8;
  float halo = exp(-r * 3.0) * 0.45;
  float a = atan(c.y, c.x) + vParams.z;
  float rays = pow(abs(cos(a * 3.0)), 260.0) + 0.6 * pow(abs(cos(a * 5.0 + 0.7)), 500.0)
             + 0.5 * pow(abs(cos(a * 9.0 + 2.1)), 900.0);
  rays *= exp(-r * 2.6) * max(1.0 - r, 0.0) * 1.1;
  float streak = exp(-p.y * p.y * 900.0) * exp(-abs(p.x) * 2.2) * 0.55 * vParams.w;
  vec3 hot = mix(vColor.rgb, vec3(1.0, 0.92, 0.8), 0.75);
  // window so the halo/streak never get clipped by the quad edges
  float win = smoothstep(1.0, 0.72, abs(p.y)) * smoothstep(1.0, 0.6, abs(p.x));
  vec3 sharpCol = (hot * core + vColor.rgb * (glow + halo + rays + streak)) * win;
  float sc = max(vScale.y, 1.0);
  vec3 softCol = (hot * 0.5 + vColor.rgb) * bokeh(q) * 0.35 / (sc * sc);
  return mix(sharpCol, softCol, t) * vColor.a * flick * uFlareGain;
}

vec3 shadeSquare(vec2 p, vec2 q) {
  vec2 pxu = 2.0 / max(vSizePx, vec2(1.0));
  vec2 soft = pxu * 0.6 + vec2(vCoc) / max(vSizePx, vec2(1.0)) * 0.9;
  float m = boxM(p, vec2(1.0), soft);
  float inner = boxM(p, vec2(0.55), soft);
  float v = m * (0.75 + 0.25 * inner);
  float sc = max(vScale.x * vScale.y, 1.0);
  return vColor.rgb * vColor.a * v * min(1.0, 1.6 / sc) ;
}

vec3 shadeCandle(vec2 p, vec2 q) {
  vec2 pxu = 2.0 / max(vSizePx, vec2(1.0));
  vec2 soft = pxu * 0.6 + vec2(vCoc) / max(vSizePx, vec2(1.0)) * 0.9;
  // params: bodyTop, bodyBottom, wickTop, wickBottom (in -1..1)
  float bt = vParams.x, bb = vParams.y, wt = vParams.z, wb = vParams.w;
  float bodyC = (bt + bb) * 0.5, bodyH = max((bt - bb) * 0.5, 0.02);
  vec2 bp = p - vec2(0.0, bodyC);
  float outer = boxM(bp, vec2(0.75, bodyH), soft);
  float th = 0.22;
  float inner = boxM(bp, vec2(0.75 - th, max(bodyH - th * 0.35, 0.0)), soft);
  float body = max(outer - inner * 0.82, 0.0);
  float wickTop = boxM(p - vec2(0.0, (wt + bt) * 0.5), vec2(0.09, max((wt - bt) * 0.5, 0.0)), soft);
  float wickBot = boxM(p - vec2(0.0, (bb + wb) * 0.5), vec2(0.09, max((bb - wb) * 0.5, 0.0)), soft);
  float v = body + (wickTop + wickBot) * 0.9;
  float sc = max(vScale.x, 1.0);
  return vColor.rgb * vColor.a * v / pow(sc, 0.8);
}

vec3 shadeBurst(vec2 p, vec2 q, float appear) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float b = blurRel();
  float n = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float k = 11.0 + fi * 6.0;
    n += pow(abs(cos(a * k + vParams.y + fi * 1.3)), 120.0 + fi * 80.0);
  }
  float expand = smoothstep(0.0, 1.0, appear);
  float len = 0.25 + 0.75 * expand;
  float rays = n * smoothstep(len, len * 0.3, r) * smoothstep(0.02, 0.1, r);
  float core = exp(-r * r * 60.0) * 1.5;
  float v = (rays * 0.9 + core) * (1.0 - smoothstep(0.0, 1.0, b));
  return vColor.rgb * vColor.a * v * uFlareGain;
}

vec3 shade(vec2 p, vec2 q, float appear) {
  int k = int(vKind + 0.5);
  float fo = fadeOut();
  if (fo <= 0.0) return vec3(0.0);
  if (k == 0) return shadeDot(p, q) * appear * fo;
  if (k == 1) return shadeFlare(p, q) * appear * fo;
  if (k == 2) return shadeSquare(p, q) * appear * fo;
  if (k == 3) return shadeCandle(p, q) * appear * fo;
  return shadeBurst(p, q, appear) * fo;
}
`;
