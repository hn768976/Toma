import { GLSL_HEADER } from "../gl/renderer";

export const MAX_DROPS = 6;

/**
 * Scene: a slab of dry, cracked skin. Glassy water spheres fall in slow
 * motion, sink into the surface and are absorbed; the cracks close around
 * each drop until the whole surface is smooth. The camera then pulls back to
 * reveal the edge of the slab and the cell layer underneath.
 *
 * All geometry is analytic / height-field based (no meshes):
 *   - skin:    ray-marched height field driven by the baked crack map
 *   - drops:   analytic ellipsoids with real refraction (the refracted ray is
 *              shaded by the same full-quality skin shader)
 *   - cells:   procedural rounded "pillow" cells on a lower plane
 */
export const SCENE_FRAG = `${GLSL_HEADER}
in vec2 vUv; out vec4 o;

uniform vec2 uRes;
uniform vec3 uCamPos;
uniform mat3 uCamMat;
uniform float uTanHalfFov;
uniform sampler2D uMacro;
uniform sampler2D uMicro;

// drops: A = centre.xyz, horizontal radius | B = vertical radius, strength, heal radius, shadow
//        C = contact glow, ring, residual sheen, unused
uniform vec4 uSphA[${MAX_DROPS}];
uniform vec4 uSphB[${MAX_DROPS}];
uniform vec4 uSphC[${MAX_DROPS}];
uniform float uGlobalHeal;
uniform float uFocus;
uniform float uAperture;

uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform vec3 uSkyCol;
uniform vec3 uBounceCol;
uniform vec3 uSkinDry;
uniform vec3 uSkinWet;
uniform vec3 uCrackCol;
uniform vec3 uSssCol;
uniform vec3 uBgTop;
uniform vec3 uBgHorizon;
uniform vec3 uBgLow;
uniform vec3 uDropTint;
uniform vec3 uDropBody;
uniform vec3 uDropCore;
uniform vec3 uDropRim;
uniform vec3 uDropShadow;
uniform vec3 uCellCol;
uniform vec3 uCellDeep;
uniform vec3 uStripCol;
uniform vec3 uFrontCol;
uniform vec3 uFilmCol;
uniform float uWetTone;

float gMicroScale = 1.0;

const int NS = ${MAX_DROPS};
const float TILE = 10.0;    // world size of one macro (crack) tile
const float MTILE = 1.9;    // world size of one micro-relief tile
const float ZF = 3.9;       // front edge of the skin slab
const float ZB = -3.85;      // far edge of the skin slab
const float SLAB_H = 0.17;  // thickness of the top skin sheet
const float H_TOP = 0.066;
const float H_BOT = -0.042;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 env(vec3 rd) {
  float y = rd.y;
  vec3 c = mix(uBgHorizon, uBgTop, smoothstep(0.0, 0.5, y));
  c = mix(c, uBgLow, smoothstep(0.0, -0.35, y));
  float sun = max(dot(rd, uLightDir), 0.0);
  c += uLightCol * (pow(sun, 32.0) * 1.3 + pow(sun, 5.0) * 0.22);
  // bright studio strip along the horizon
  c += uStripCol * 0.75 * exp(-pow(y / 0.022, 2.0));
  return c;
}

// ---------------------------------------------------------------- skin

float healField(vec2 xz, float n) {
  // the final sweep closes the remaining cracks from the near side to the
  // far right corner; drops only thin the cracks around them
  float sweep = clamp((3.9 - xz.y + 0.45 * xz.x) / 9.0, 0.0, 1.0);
  float keep = 1.0 - smoothstep(sweep * 0.62, sweep * 0.62 + 0.38, uGlobalHeal);
  for (int i = 0; i < NS; i++) {
    float R = uSphB[i].z;
    if (R > 0.001) {
      float d = length(xz - uSphA[i].xz) + (n - 0.5) * 0.5;
      keep *= mix(1.0, smoothstep(R * 0.3, R, d), 0.8);
    }
  }
  return 1.0 - keep;
}

// crack half-width (cell units) and presence for a macro sample
float crackW(vec4 m, float dry) {
  return (0.004 + 0.028 * smoothstep(0.34, 0.56, m.a) * m.a) * dry + 1e-4;
}

float mapH(vec2 xz, float lod, float dry, out vec4 m) {
  m = textureLod(uMacro, xz / TILE, lod);
  float pres = smoothstep(0.34, 0.56, m.a);
  float g = (1.0 - smoothstep(0.0, crackW(m, dry), m.r)) * pres;
  // flaking: plates curl up (or sink) towards their cracked border
  float lift = (m.g - 0.42) * exp(-m.r / 0.085) * pres;
  // hairline secondary cracks
  float g2 = (1.0 - smoothstep(0.0, 0.006 * dry + 1e-4, m.b)) * smoothstep(0.50, 0.70, m.a);
  return (-0.036 * g + 0.112 * lift - 0.006 * g2) * dry;
}

vec3 shadeSkin(vec3 ro, vec3 rd, out float dist) {
  float pix = uTanHalfFov * 2.0 / uRes.y;           // angular size of a pixel
  float tMid = -ro.y / rd.y;
  float foot = tMid * pix;                           // world footprint (minor axis)
  float grazing = clamp(1.0 / max(-rd.y, 0.05), 1.0, 8.0);
  float fp = foot * sqrt(grazing);
  float lod = log2(max(fp / (TILE / 2048.0), 1.0));
  float mLod = log2(max(fp / (MTILE / 2048.0), 1.0));
  vec3 Pm = ro + rd * tMid;
  vec4 mi = textureLod(uMicro, Pm.xz / MTILE, mLod);
  float heal = healField(Pm.xz, mi.a);
  float dry = 1.0 - heal;

  // --- height-field intersection between the planes y = H_TOP and y = H_BOT.
  // The crack map is a distance field, so plates far away from any crack are
  // known to be flat and skip the march entirely.
  float t = tMid;
  vec4 m;
  float h0 = mapH(Pm.xz, lod, dry, m);
  bool nearCrack = dry > 0.003 && (m.r < 0.30 || m.b < 0.02);
  if (nearCrack) {
    float tA = max((H_TOP - ro.y) / rd.y, 0.0);
    float tB = (H_BOT - ro.y) / rd.y;
    float span = tB - tA;
    float horiz = span * sqrt(max(1.0 - rd.y * rd.y, 0.0));
    int steps = int(clamp(ceil(horiz / max(0.012, foot * 1.5)), 3.0, 22.0));
    float dt = span / float(steps);
    float tp = tA;
    vec3 p = ro + rd * tp;
    float dp = p.y - mapH(p.xz, lod, dry, m);
    t = tB;
    for (int i = 0; i < steps; i++) {
      float tc = tp + dt;
      p = ro + rd * tc;
      float dc = p.y - mapH(p.xz, lod, dry, m);
      if (dc < 0.0) {
        // secant refinement
        float ta = tp, tb = tc, da = dp, db = dc;
        for (int k = 0; k < 4; k++) {
          float tm = ta + (tb - ta) * da / (da - db);
          p = ro + rd * tm;
          float dm = p.y - mapH(p.xz, lod, dry, m);
          if (dm < 0.0) { tb = tm; db = dm; } else { ta = tm; da = dm; }
        }
        t = ta + (tb - ta) * da / (da - db);
        break;
      }
      tp = tc;
      dp = dc;
    }
  } else {
    t = tMid + h0 / rd.y;
  }
  dist = t;
  vec3 P = ro + rd * t;

  // --- normal (macro by finite differences, micro from the baked gradient)
  float e = max(0.0035, foot * 1.2);
  vec4 mm;
  if (nearCrack) {
    h0 = mapH(P.xz, lod, dry, m);
    mi = textureLod(uMicro, P.xz / MTILE, mLod);
  }
  vec2 grad = vec2(0.0);
  if (dry > 0.003 && m.r < 0.36) {
    float hx = mapH(P.xz + vec2(e, 0.0), lod, dry, mm) - mapH(P.xz - vec2(e, 0.0), lod, dry, mm);
    float hz = mapH(P.xz + vec2(0.0, e), lod, dry, mm) - mapH(P.xz - vec2(0.0, e), lod, dry, mm);
    grad = vec2(hx, hz) / (2.0 * e);
  }
  float microAmp = mix(0.0050, 0.0030, heal) * gMicroScale;
  grad += mi.gb * (microAmp / MTILE);
  // large soft undulation so the smooth skin never looks like a flat plane
  vec4 lo = textureLod(uMacro, P.xz / TILE * 0.5 + 0.37, 5.0);
  grad += (vec2(lo.a, lo.g) - 0.5) * 0.10 * heal;
  vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
  vec3 V = -rd;

  // --- how deep inside a crack are we
  float pres = smoothstep(0.34, 0.56, m.a);
  float groove = (1.0 - smoothstep(0.0, crackW(m, dry) * 1.15, m.r)) * pres * dry;
  float depthK = clamp(-h0 / 0.03, 0.0, 1.0);
  float hair = (1.0 - smoothstep(0.0, 0.007 * dry + 1e-4, m.b)) * smoothstep(0.50, 0.70, m.a) * dry;

  // --- albedo
  // tone warms up gradually over the whole surface (no visible colour front)
  vec3 alb = mix(uSkinDry, uSkinWet, heal * uWetTone);
  alb *= 0.93 + 0.14 * mi.a;
  alb *= 1.0 + 0.08 * (lo.a - 0.5) * heal;
  alb *= 0.965 + 0.07 * mi.r * dry;
  // dry plates are slightly chalky, each plate a touch different
  alb = mix(alb, alb * (0.94 + 0.12 * m.g), dry * 0.8);
  alb = mix(alb, uCrackCol, clamp(groove * 0.45 + depthK * 0.60, 0.0, 1.0));
  alb = mix(alb, uCrackCol, hair * 0.45);
  // steep faces = exposed edge / underside of a lifted flake
  alb = mix(alb, uCrackCol * 0.96, smoothstep(0.75, 0.35, N.y) * dry * 0.6);

  // --- shadows from the height field (flakes) and from the drops
  vec3 L = uLightDir;
  float sh = 1.0;
  if (nearCrack && dry > 0.02 && lod < 3.5 && m.r < 0.12) {
    for (int i = 1; i <= 5; i++) {
      vec3 q = P + L * (0.016 * float(i)) + vec3(0.0, 0.002, 0.0);
      float occ = mapH(q.xz, lod, dry, mm) - q.y;
      sh = min(sh, 1.0 - smoothstep(0.0, 0.012, occ));
    }
    sh = mix(1.0, sh, 0.5);
  }
  float dropSh = 1.0;
  vec3 dropTint = vec3(1.0);
  float caustic = 0.0;
  vec3 glow = vec3(0.0);
  float sheen = 0.0;
  for (int i = 0; i < NS; i++) {
    vec3 c = uSphA[i].xyz;
    float r = uSphA[i].w;
    if (r < 0.001) continue;
    float ss = uSphB[i].w;
    vec3 v = c - P;
    float tp2 = dot(v, L);
    float dl = length(v - L * tp2);
    float pen = 0.14 + 0.30 * clamp(c.y / 2.2, 0.0, 1.0);
    float s = (1.0 - smoothstep(r * (1.0 - pen), r * (1.0 + pen * 1.6), dl)) * ss * step(0.0, tp2);
    dropSh *= 1.0 - 0.085 * s * (1.0 - 0.6 * clamp(c.y / 2.5, 0.0, 1.0));
    dropTint = mix(dropTint, uDropShadow, s * 0.75);
    caustic += ss * exp(-pow(dl / (0.45 * r), 2.0)) * (0.40 - 0.35 * clamp(c.y / 2.0, 0.0, 1.0)) * step(0.0, tp2);
    float dh = length(P.xz - c.xz);
    glow += mix(uDropCore, uDropBody, 0.35) * uSphC[i].x * exp(-pow(dh / (1.75 * r), 2.0));
    glow += uDropCore * uSphC[i].y * exp(-pow((dh - r) / 0.055, 2.0));
    sheen += uSphC[i].z * exp(-pow(dh / 2.4, 2.0));
  }

  // --- lighting
  float ndl = dot(N, L);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  float lit = wrap * sh * dropSh;
  vec3 amb = mix(uBounceCol, uSkyCol, N.y * 0.5 + 0.5);
  float ao = 1.0 - 0.22 * depthK;
  vec3 col = alb * (uLightCol * lit * dropTint + amb * ao);
  // cheap subsurface: warm bleed where light is blocked
  col += alb * uSssCol * (1.0 - sh) * 0.10;
  col += alb * uSssCol * depthK * 0.05;

  // speculars: broad moist sheen + tighter highlight on hydrated skin
  vec3 H = normalize(L + V);
  float ndh = max(dot(N, H), 0.0);
  float ndv = max(dot(N, V), 0.0);
  float wet = heal;
  float spec = pow(ndh, 10.0) * (0.04 + 0.34 * wet) + pow(ndh, 60.0) * 0.10 * wet;
  float fres = pow(1.0 - ndv, 4.0);
  col += uLightCol * spec * sh * dropSh * (1.0 - depthK);
  col += uSkyCol * fres * (0.10 + 0.12 * wet);
  col += alb * uLightCol * sheen * 0.07;
  // broad soft band of studio light across the hydrated skin
  // studio shaping of the hydrated skin: a broad pale highlight band running
  // from the upper left to the lower right, falling off to the left / bottom
  float streak = exp(-pow(dot(vUv - 0.5, vec2(0.41, 0.91)) / 0.24, 2.0));
  float fall = (1.0 - 0.16 * smoothstep(0.55, 0.0, vUv.x)) * (1.0 - 0.10 * smoothstep(0.5, 0.0, vUv.y));
  float shaping = mix(1.0, (0.74 + 0.30 * streak) * fall, heal * uWetTone);
  col *= shaping;
  col += uLightCol * 0.09 * streak * heal * uWetTone;
  // pale glow where the moisture front is advancing
  col += uFrontCol * heal * (1.0 - heal) * 4.0 * (1.0 - uGlobalHeal);
  col += uLightCol * caustic * 0.30 * alb;
  col += glow;

  // rim light on the far edge of the slab, soft bevel on the near edge
  float rim = exp(-max(P.z - ZB, 0.0) / 0.9);
  col = mix(col, uStripCol * 1.2, rim * 0.85);
  col += uStripCol * 0.5 * exp(-max(P.z - ZB, 0.0) / 0.12);
  col += uSkyCol * 0.25 * smoothstep(ZF - 0.07, ZF, P.z);
  return col;
}

// ---------------------------------------------------------------- cross-section

float cellHeight(vec2 q, out float id) {
  // staggered rows of rounded "pillow" cells, rows run parallel to the edge
  vec2 cs = vec2(0.74, 0.40);
  float row = floor(q.y / cs.y);
  float xo = q.x / cs.x + 0.5 * mod(row, 2.0) + 0.23 * hash11(row + 3.0);
  id = hash11(floor(xo) * 7.13 + row * 3.77);
  vec2 f = vec2(fract(xo) - 0.5, fract(q.y / cs.y) - 0.5) * cs;
  float rad = 0.16;
  vec2 hb = cs * 0.5 - 0.004 - 0.004 * id;
  vec2 dd = abs(f) - (hb - rad);
  float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - rad;
  float k = clamp(-sd / 0.16, 0.0, 1.0);
  return sqrt(1.0 - (1.0 - k) * (1.0 - k));
}

vec3 shadeCells(vec3 P, vec3 rd) {
  vec2 q = vec2(P.x, P.z - ZF);
  float id, id2;
  float h = cellHeight(q, id);
  float e = 0.006;
  float hx = cellHeight(q + vec2(e, 0.0), id2) - cellHeight(q - vec2(e, 0.0), id2);
  float hz = cellHeight(q + vec2(0.0, e), id2) - cellHeight(q - vec2(0.0, e), id2);
  vec3 N = normalize(vec3(-hx / (2.0 * e) * 0.13, 1.0, -hz / (2.0 * e) * 0.13));
  vec3 V = -rd;
  vec3 L = uLightDir;
  vec3 alb = mix(uCellDeep, uCellCol, smoothstep(0.0, 0.85, h));
  alb *= 0.92 + 0.16 * id;
  float wrap = clamp((dot(N, L) + 0.5) / 1.5, 0.0, 1.0);
  vec3 amb = mix(uBounceCol, uSkyCol, N.y * 0.5 + 0.5);
  float ao = mix(0.55, 1.0, smoothstep(0.0, 0.5, h));
  // the skin sheet above shades the first rows
  float under = mix(0.66, 1.0, smoothstep(0.0, 0.8, q.y));
  vec3 col = alb * (uLightCol * wrap + amb * 0.9) * ao * under;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 55.0) * 1.5 + pow(max(dot(N, H), 0.0), 10.0) * 0.22;
  // second, frontal light: white streaks on the camera-facing edge of each cell
  vec3 H2 = normalize(normalize(vec3(0.15, 0.45, 0.88)) + V);
  spec += pow(max(dot(N, H2), 0.0), 90.0) * 2.2;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uLightCol * spec * smoothstep(0.15, 0.6, h) * under;
  col += uSkyCol * fres * 0.45 * h;
  // pearly sheen on the crown of every cell
  col += uSkyCol * 0.22 * smoothstep(0.55, 1.0, h);
  return col;
}

vec3 shadeLip(vec3 P, vec3 rd) {
  float v = clamp(-P.y / SLAB_H, 0.0, 1.0);
  vec3 N = normalize(vec3(0.0, 1.0 - smoothstep(0.0, 0.35, v), 0.35 + v));
  vec3 L = uLightDir;
  float wrap = clamp((dot(N, L) + 0.6) / 1.6, 0.0, 1.0);
  vec3 alb = mix(uSkinWet * 1.04, uCellCol, smoothstep(0.35, 1.0, v));
  vec3 amb = mix(uBounceCol, uSkyCol, N.y * 0.5 + 0.5);
  vec3 col = alb * (uLightCol * wrap + amb);
  // bright bevel at the top, thin layer line, contact shadow at the bottom
  col += uSkyCol * 0.30 * (1.0 - smoothstep(0.0, 0.22, v));
  col *= 1.0 - 0.16 * exp(-pow((v - 0.46) / 0.05, 2.0));
  col *= mix(1.0, 0.72, smoothstep(0.7, 1.0, v));
  return col;
}

vec3 shadeScene(vec3 ro, vec3 rd, out float dist) {
  dist = 60.0;
  if (rd.y > -1e-4) return env(rd);
  float tTop = -ro.y / rd.y;
  vec3 P = ro + rd * tTop;
  if (P.z < ZB) return env(rd) + uStripCol * 1.5 * exp(-(ZB - P.z) / 0.45);
  if (P.z <= ZF) return shadeSkin(ro, rd, dist);
  if (rd.z < 0.0) {
    float tF = (ZF - ro.z) / rd.z;
    float yF = ro.y + rd.y * tF;
    if (yF > -SLAB_H) {
      dist = tF;
      return shadeLip(ro + rd * tF, rd);
    }
  }
  float tC = (-SLAB_H - ro.y) / rd.y;
  dist = tC;
  return shadeCells(ro + rd * tC, rd);
}

// ---------------------------------------------------------------- drops

vec2 iEllipsoid(vec3 ro, vec3 rd, vec3 c, vec3 rad) {
  vec3 oc = (ro - c) / rad;
  vec3 d = rd / rad;
  float a = dot(d, d), b = dot(oc, d), cc = dot(oc, oc) - 1.0;
  float h = b * b - a * cc;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2((-b - h) / a, (-b + h) / a);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamMat * vec3(ndc.x * aspect * uTanHalfFov, ndc.y * uTanHalfFov, -1.0));
  vec3 ro = uCamPos;

  // nearest drop
  float tS = 1e9;
  int hit = -1;
  for (int i = 0; i < NS; i++) {
    float r = uSphA[i].w;
    if (r < 0.001 || uSphB[i].y < 0.002) continue;
    vec2 tt = iEllipsoid(ro, rd, uSphA[i].xyz, vec3(r, uSphB[i].x, r));
    if (tt.x > 0.0 && tt.x < tS) { tS = tt.x; hit = i; }
  }
  // is that point above the skin (or in front of the slab)?
  if (hit >= 0) {
    vec3 Ph = ro + rd * tS;
    if (Ph.y < 0.0) hit = -1;
  }

  vec3 col;
  float dist;
  if (hit < 0) {
    col = shadeScene(ro, rd, dist);
  } else {
    vec3 c = uSphA[hit].xyz;
    vec3 rad = vec3(uSphA[hit].w, uSphB[hit].x, uSphA[hit].w);
    float s = uSphB[hit].y;
    vec3 P1 = ro + rd * tS;
    vec3 N1 = normalize((P1 - c) / (rad * rad));
    float ior = mix(1.0, 1.33, s);
    float cosi = max(dot(-rd, N1), 0.0);
    float F = (0.02 + 0.98 * pow(1.0 - cosi, 5.0)) * s;
    vec3 ocn = (ro - c) / rad;
    vec3 dn = normalize(rd / rad);
    float bn = length(cross(ocn, dn));
    vec3 R = reflect(rd, N1);
    vec3 reflCol = R.y > 0.0 ? env(R) : mix(uSkinDry, uSkinWet, 0.5) * (uLightCol * 0.6 + uSkyCol * 0.5);
    vec3 rdi = refract(rd, N1, 1.0 / ior);
    vec2 ti = iEllipsoid(P1 + rdi * 1e-4, rdi, c, rad);
    float tOut = max(ti.y, 0.0);
    float tGr = rdi.y < 0.0 ? -P1.y / rdi.y : 1e9;
    vec3 ro2, rd2;
    float pathLen;
    if (tGr < tOut) {
      ro2 = P1; rd2 = rdi; pathLen = tGr;
    } else {
      vec3 P2 = P1 + rdi * tOut;
      vec3 N2 = normalize((P2 - c) / (rad * rad));
      vec3 rdo = refract(rdi, -N2, ior);
      if (dot(rdo, rdo) < 1e-6) rdo = reflect(rdi, -N2);
      ro2 = P2; rd2 = rdo; pathLen = tOut;
    }
    float d2;
    gMicroScale = 0.12;   // keep the refracted view clean (no magnified grain)
    vec3 through = shadeScene(ro2, rd2, d2);
    // absorption tint, milky scattering and bright refractive core
    through *= exp(-(1.0 - uDropTint) * pathLen * 1.5 * s);
    // "roundness": 1 for a sphere, -> 0 as the drop flattens into a lens
    float round_ = smoothstep(0.08, 0.75, rad.y / rad.x);
    float core = exp(-pow(bn / 0.52, 2.0)) * round_;
    float body = mix(0.10, 0.26, round_) + 0.66 * core;
    vec3 inner = mix(uDropBody, uDropCore * 1.35, core);
    // a thin lens has a soft, translucent edge instead of a hard silhouette
    s *= mix(smoothstep(0.0, 0.10, 1.0 - bn), 1.0, round_);
    F *= mix(0.3, 1.0, round_);
    col = mix(through, inner, s * body);
    col += uDropCore * 0.45 * core * core * s;
    // absorbed film: a grey-teal translucent lens over the wet skin
    col = mix(col, col * uFilmCol, (1.0 - round_) * s);
    // lower half catches more light
    col += uDropCore * 0.16 * smoothstep(0.25, -0.7, N1.y) * round_ * s;
    col *= mix(vec3(1.0), uDropRim, pow(1.0 - cosi, 2.0) * s * 0.9 * round_);
    col = mix(col, reflCol, F * 0.75);
    // highlights: key light + small secondary "bubble" glint
    vec3 Hh = normalize(uLightDir - rd);
    col += uLightCol * pow(max(dot(N1, Hh), 0.0), 260.0) * 1.6 * s;
    vec3 L2 = normalize(vec3(-0.55, -0.25, 0.80));
    col += vec3(1.0) * pow(max(dot(R, L2), 0.0), 420.0) * 0.9 * s;
    dist = tS;
  }

  float coc = clamp(uAperture * abs(1.0 / uFocus - 1.0 / max(dist, 0.05)), 0.0, 1.0);
  o = vec4(max(col, 0.0), coc);
}`;
