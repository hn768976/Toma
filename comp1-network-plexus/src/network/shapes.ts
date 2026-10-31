// GLSL shape library for the network composition (billboard kinds).
// kind 0: dot / bokeh, 1: hub flare, 2: HUD ring, 3: data panel,
// 4: mini bar chart, 5: twinkling sparkle.

export const KIND = {
  dot: 0,
  flare: 1,
  ring: 2,
  panel: 3,
  bars: 4,
  sparkle: 5,
} as const;

export const networkShapes = (halo: [number, number, number]) => /* glsl */ `
const vec3 HALO_COLOR = vec3(${halo.map((v) => v.toFixed(4)).join(", ")});
const float PI = 3.14159265;

vec3 shadeDot(vec2 p, vec2 q, float twinkle) {
  float b = blurRel();
  float t = smoothstep(0.0, 1.4, b);
  float r2 = dot(p, p);
  float sharp = exp(-r2 * 3.0) * 1.15 + exp(-r2 * 0.8) * 0.12;
  float sc = max(vScale.x, 1.0);
  float soft = smoothstep(1.0, 0.55, length(q)) * 0.2 / (sc * sc);
  return vColor.rgb * vColor.a * mix(sharp, soft, t) * twinkle;
}

vec3 shadeFlare(vec2 p, vec2 q, float appear) {
  float b = blurRel();
  float t = smoothstep(0.0, 0.9, b);
  float r = length(p);
  float pulse = 0.85 + 0.15 * sin(uTime * vParams.x + vParams.y);
  float core = exp(-r * r * 260.0) * 2.6;
  float glow = exp(-r * r * 22.0) * 0.75;
  float halo = exp(-r * 4.5) * 0.3;
  float a = atan(p.y, p.x) + vParams.z + uTime * 0.05;
  float rays = pow(abs(cos(a * 2.0)), 500.0) + 0.7 * pow(abs(cos(a * 3.0 + 0.5)), 900.0)
             + 0.4 * pow(abs(cos(a * 5.0 + 1.3)), 1400.0);
  rays *= exp(-r * 3.2) * max(1.0 - r, 0.0) * 0.9;
  float streak = exp(-p.y * p.y * 2500.0) * exp(-abs(p.x) * 3.5) * 0.35;
  vec3 coreCol = vColor.rgb;
  vec3 sharpCol = coreCol * core + (glow + halo + rays + streak) * HALO_COLOR;
  float sc = max(vScale.x, 1.0);
  vec3 softCol = (coreCol * 0.6 + HALO_COLOR * 0.5) * bokeh(q) * 0.16 / (sc * sc) * 3.0;
  return mix(sharpCol, softCol, t) * vColor.a * pulse * appear;
}

float arcMask(float r, float ang, float radius, float thick, float start, float span, float soft) {
  float sigma = 0.5 * thick + soft;
  float dr = r - radius;
  float radial = (0.5 * thick / sigma) * exp(-(dr * dr) / (sigma * sigma) * 1.6);
  if (span >= 0.999) return radial;
  float angSoft = soft / max(radius, 0.01) / (2.0 * PI) + 0.002;
  float x = fract(ang - start);
  float m = smoothstep(0.0, angSoft, x) * smoothstep(span, span - angSoft, x);
  return radial * m;
}

vec3 shadeRing(vec2 p, vec2 q, float appear) {
  float b = blurRel();
  float px = 2.0 / max(vSizePx.x, 1.0);
  float soft = px * 0.75 + b * 0.42;
  float r = length(p);
  float ang = atan(p.y, p.x) / (2.0 * PI);
  float e = smoothstep(0.0, 1.0, appear);
  float rot1 = uTime * vParams.x + vParams.y;
  float rot2 = -uTime * vParams.x * 0.6 + vParams.z;
  float v = 0.0;
  v += arcMask(r, ang, 0.56, 0.11, rot1, 0.74 * e, soft) * 1.25;
  v += arcMask(r, ang, 0.76, 0.055, rot2, 0.46 * e, soft) * 1.1;
  v += arcMask(r, ang, 0.9, 0.014, 0.0, 1.0, soft) * 0.35 * e;
  // small tick dots on the outer circle
  for (int i = 0; i < 3; i++) {
    float ta = vParams.w + float(i) * 0.31 + uTime * 0.03;
    vec2 c = 0.9 * vec2(cos(ta * 2.0 * PI), sin(ta * 2.0 * PI));
    float s = 0.035 + soft;
    v += exp(-dot(p - c, p - c) / (s * s)) * (0.035 / s) * e;
  }
  float glow = exp(-abs(r - 0.6) * 9.0) * 0.06 * e;
  return vColor.rgb * vColor.a * (v + glow);
}

float boxMask(vec2 p, vec2 hsz, vec2 soft) {
  vec2 d = abs(p) - hsz;
  vec2 m = smoothstep(soft, -soft, d);
  return m.x * m.y;
}

vec3 shadePanel(vec2 p, vec2 q, float appear) {
  vec2 pxu = 2.0 / max(vSizePx, vec2(1.0));
  vec2 soft = pxu * 0.6 + vec2(vCoc) / max(vSizePx, vec2(1.0)) * 0.9;
  float b = blurRel();
  float t = smoothstep(0.0, 0.5, b);
  float wipe = smoothstep(-1.0 + 2.2 * appear, -1.0 + 2.2 * appear - 0.15, p.x);
  float box = boxMask(p, vec2(1.0), soft);
  float seed = vParams.y;
  float rows = vParams.x;
  // text-like bars
  float lines = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= rows) break;
    float fy = 0.7 - 1.4 * (float(i) + 0.5) / rows;
    float th = (i == 0 ? 0.16 : 0.09) * 4.0 / max(rows, 1.0);
    float len = 0.35 + 0.6 * hash11(seed * 13.1 + float(i) * 7.7);
    len *= 0.75 + 0.25 * sin(uTime * 1.3 + seed + float(i));
    float x0 = -0.82;
    float lx = smoothstep(x0 - soft.x, x0 + soft.x, p.x) * smoothstep(x0 + 1.64 * len + soft.x, x0 + 1.64 * len - soft.x, p.x);
    float ly = smoothstep(th + soft.y, th - soft.y, abs(p.y - fy));
    lines += lx * ly * (i == 0 ? 1.0 : 0.75);
  }
  float avgLines = 0.22;
  float fill = 0.28 + 0.12 * (p.x * 0.5 + 0.5);
  float border = boxMask(p, vec2(1.0), soft) - boxMask(p, vec2(1.0) - pxu * 3.0, soft);
  float v = box * (fill + mix(lines * 0.9, avgLines, t)) + max(border, 0.0) * 0.35 * (1.0 - t);
  float sc = max(vScale.x * vScale.y, 1.0);
  return vColor.rgb * vColor.a * v * wipe * (1.0 / pow(sc, 0.35));
}

vec3 shadeBars(vec2 p, vec2 q, float appear) {
  vec2 pxu = 2.0 / max(vSizePx, vec2(1.0));
  vec2 soft = pxu * 0.6 + vec2(vCoc) / max(vSizePx, vec2(1.0)) * 0.9;
  float v = 0.0;
  for (int i = 0; i < 7; i++) {
    float cx = -0.85 + float(i) * 0.283;
    float h = 0.25 + 0.75 * hash11(vParams.y * 3.3 + float(i) * 1.7);
    h *= (0.7 + 0.3 * sin(uTime * 2.2 + float(i) * 1.1 + vParams.y)) * appear;
    float top = -1.0 + 2.0 * h;
    float bx = smoothstep(0.075 + soft.x, 0.075 - soft.x, abs(p.x - cx));
    float by = smoothstep(-1.0 - soft.y, -1.0 + soft.y, p.y) * smoothstep(top + soft.y, top - soft.y, p.y);
    v += bx * by;
  }
  float base = smoothstep(0.03 + soft.y, 0.03 - soft.y, abs(p.y + 1.0)) * boxMask(p, vec2(1.0, 1.2), soft);
  float sc = max(vScale.x * vScale.y, 1.0);
  return vColor.rgb * vColor.a * (v * 0.9 + base * 0.6) / pow(sc, 0.4);
}

vec3 shade(vec2 p, vec2 q, float appear) {
  int k = int(vKind + 0.5);
  if (k == 0) return shadeDot(p, q, 1.0) * appear;
  if (k == 1) return shadeFlare(p, q, appear);
  if (k == 2) return shadeRing(p, q, appear);
  if (k == 3) return shadePanel(p, q, appear);
  if (k == 4) return shadeBars(p, q, appear);
  float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * vParams.x + vParams.y), 2.0);
  return shadeDot(p, q, tw) * appear;
}
`;
