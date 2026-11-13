import { GLSL_HEADER } from "../gl/renderer";

/**
 * Scene: a creamy serum drop lands on dry, cracked skin, melts into a dome
 * and is absorbed. Ripples run through the surface, the cracks fill with
 * light in an expanding ring and close behind it until the skin is smooth.
 *
 *   - skin:  ray-marched height field driven by the baked crack map
 *   - drop:  sphere-traced signed distance field (teardrop -> cone -> dome ->
 *            lens), milky translucent shading with a refracted view of the
 *            skin underneath
 */
export const SCENE_FRAG = `${GLSL_HEADER}
in vec2 vUv; out vec4 o;

uniform vec2 uRes;
uniform vec3 uCamPos;
uniform mat3 uCamMat;
uniform float uTanHalfFov;
uniform sampler2D uMacro;
uniform sampler2D uMicro;

uniform vec4 uDropA;      // teardrop: body radius, body centre y, tip y, tip radius
uniform vec4 uGum;        // melted gumdrop: base radius, height, profile exponent, morph 0..1
uniform vec4 uDropB;      // opacity, unused, visible, footprint radius on the skin
uniform vec4 uGround;     // contact shadow, contact glow, ring, unused
uniform vec4 uRipple;     // amplitude, phase, outer radius, unused
uniform float uGlowR;     // radius reached by the light front
uniform float uHealR;     // radius inside which the cracks have closed
uniform float uGlowI;     // glow intensity
uniform float uGlobalHeal;
uniform float uUnderHeal; // cracks under the melting drop close first
uniform float uFrontBias;
uniform float uFarEdge;    // z of the far edge of the skin
uniform float uToneGlobal; // overall warm-up of the skin tone / lighting // how far the light front leads on the right side
uniform float uTime;
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
uniform vec3 uBgLeft;
uniform vec3 uBgRight;
uniform vec3 uStripCol;
uniform vec3 uDropCol;
uniform vec3 uDropSss;
uniform vec3 uGlowCol;
uniform vec3 uHazeCol;
uniform vec3 uBgCenter;

float gMicroScale = 1.0;

const float TILE = 12.0;    // world size of one macro (crack) tile, 12 plates across
const float MTILE = 2.4;    // world size of one micro-relief tile
const float H_TOP = 0.046;
const float H_BOT = -0.066;

vec3 backdrop(vec3 rd) {
  // soft taupe studio wall, a little darker towards the right and the top
  vec3 right = uCamMat[0];
  float sx = dot(rd, right);
  vec3 c = mix(uBgLeft, uBgRight, smoothstep(-0.45, 0.45, sx));
  c = mix(c, uBgCenter, exp(-pow(sx / 0.24, 2.0)));
  c *= 1.0 - 0.10 * smoothstep(0.0, 0.3, rd.y);
  return c;
}

vec3 env(vec3 rd) {
  vec3 c = backdrop(rd);
  float sun = max(dot(rd, uLightDir), 0.0);
  c += uLightCol * (pow(sun, 24.0) * 1.6 + pow(sun, 4.0) * 0.35);
  c += uStripCol * 0.6 * smoothstep(0.25, 0.9, rd.y);
  return c;
}

// ---------------------------------------------------------------- skin

float ripple(vec2 xz) {
  float r = length(xz);
  // swells start at the rim of the drop (nothing underneath it)
  float env = smoothstep(uRipple.z, uRipple.z - 1.3, r) * smoothstep(uRipple.w * 0.95, uRipple.w * 1.3 + 0.1, r);
  return uRipple.x * sin(9.5 * r - uRipple.y) * env / (1.0 + 0.30 * r);
}

float crackW(vec4 m, float dry) {
  return (0.008 + 0.017 * m.a) * dry + 1e-4;
}

float mapH(vec2 xz, float lod, float dry, out vec4 m) {
  float rp = ripple(xz);
  // the swell drags the surface with it: cracks visibly bend as it passes
  vec2 uv = (xz + normalize(xz + 1e-4) * rp * 2.2) / TILE;
  m = textureLod(uMacro, uv, lod);
  float w = crackW(m, dry);
  float g = 1.0 - smoothstep(0.0, w, m.r);
  // plates bulge slightly and have a light raised lip along every crack
  float dome = smoothstep(0.0, 0.20, m.r) + 0.55 * smoothstep(w, w * 1.7, m.r) * (1.0 - smoothstep(w * 1.7, w * 4.0, m.r));
  float g2 = (1.0 - smoothstep(0.0, 0.007 * dry + 1e-4, m.b)) * smoothstep(0.45, 0.65, m.a);
  return (-0.042 * g * (0.55 + 0.45 * g) + 0.011 * dome - 0.006 * g2) * dry + rp;
}

vec3 shadeSkin(vec3 ro, vec3 rd, out float dist) {
  float pix = uTanHalfFov * 2.0 / uRes.y;
  float tMid = -ro.y / rd.y;
  float foot = tMid * pix;
  float grazing = clamp(1.0 / max(-rd.y, 0.05), 1.0, 8.0);
  float fp = foot * sqrt(grazing);
  float lod = log2(max(fp / (TILE / 2048.0), 1.0));
  float mLod = log2(max(fp / (MTILE / 2048.0), 1.0));
  vec3 Pm = ro + rd * tMid;
  vec4 mi = textureLod(uMicro, Pm.xz / MTILE, mLod);

  // --- radial light / healing fronts (irregular, slightly ahead on the right)
  float r0 = length(Pm.xz);
  vec2 dir = Pm.xz / max(r0, 1e-3);
  vec4 lo = textureLod(uMacro, Pm.xz / TILE * 0.5 + 0.37, 4.0);
  float rr = r0 + (lo.a - 0.5) * 1.3 + (mi.a - 0.5) * 0.5 - uFrontBias * dot(dir, vec2(0.85, 0.35));
  // the side facing the camera (+z) closes last, as in the reference
  float rh = rr + 0.9 * max(Pm.z, 0.0) + 0.2 * max(-Pm.z, 0.0);
  float heal = max(uGlobalHeal, 1.0 - smoothstep(uHealR - 1.5, uHealR, rh));
  // the skin directly under the melting drop is repaired first
  heal = max(heal, uUnderHeal * (1.0 - smoothstep(uGround.w * 0.45, uGround.w * 1.35, r0 + (mi.a - 0.5) * 0.5)));
  float dry = 1.0 - heal;
  // tone and lighting change gradually over the whole surface, so no patch
  // boundary is visible where the cracks have just closed
  float tone = clamp(max(0.62 * smoothstep(uGlowR, uGlowR - 2.4, r0) * uGlowI, mix(heal, uToneGlobal, 0.8)), 0.0, 1.0);
  float lit = smoothstep(uGlowR, uGlowR - 0.6, rr) * uGlowI;
  // the far field never lights up: those cracks simply close at the end
  lit *= smoothstep(-3.1, -1.7, Pm.z);
  // no light directly underneath the drop while it is still there
  lit *= mix(1.0, smoothstep(uDropB.w * 0.9, uDropB.w * 1.15, r0), uDropB.z);

  // --- height-field intersection
  float t = tMid;
  vec4 m;
  float h0 = mapH(Pm.xz, lod, dry, m);
  bool nearCrack = dry > 0.003 && (m.r < 0.20 || m.b < 0.02);
  if (nearCrack) {
    float tA = max((H_TOP - ro.y) / rd.y, 0.0);
    float tB = (H_BOT - ro.y) / rd.y;
    float span = tB - tA;
    float horiz = span * sqrt(max(1.0 - rd.y * rd.y, 0.0));
    int steps = int(clamp(ceil(horiz / max(0.012, foot * 1.5)), 3.0, 14.0));
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
        float ta = tp, tb = tc, da = dp, db = dc;
        for (int k = 0; k < 2; k++) {
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

  // --- normal
  float e = max(0.0035, foot * 1.2);
  vec4 mm;
  if (nearCrack) {
    h0 = mapH(P.xz, lod, dry, m);
    mi = textureLod(uMicro, P.xz / MTILE, mLod);
  }
  float hx = mapH(P.xz + vec2(e, 0.0), lod, dry, mm) - mapH(P.xz - vec2(e, 0.0), lod, dry, mm);
  float hz = mapH(P.xz + vec2(0.0, e), lod, dry, mm) - mapH(P.xz - vec2(0.0, e), lod, dry, mm);
  vec2 grad = vec2(hx, hz) / (2.0 * e);
  float microAmp = mix(0.0080, 0.0042, tone) * gMicroScale;
  grad += mi.gb * (microAmp / MTILE);
  grad += (vec2(lo.a, lo.g) - 0.5) * 0.06 * heal;
  vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
  vec3 V = -rd;

  // --- crack masks
  float w = crackW(m, dry);
  float groove = (1.0 - smoothstep(0.0, w * 1.2, m.r)) * dry;
  float depthK = clamp(-(h0 - ripple(P.xz)) / 0.034, 0.0, 1.0);
  float hair = (1.0 - smoothstep(0.0, 0.008 * dry + 1e-4, m.b)) * smoothstep(0.45, 0.65, m.a) * dry;

  // --- albedo
  vec3 alb = mix(uSkinDry, uSkinWet, tone);
  alb *= 0.94 + 0.12 * mi.a;
  alb *= 0.94 + 0.08 * mi.r;
  alb *= 1.0 + 0.16 * (lo.g - 0.5);
  alb = mix(alb, alb * (0.92 + 0.16 * m.g), dry);
  alb = mix(alb, uCrackCol, clamp(groove * 0.60 + depthK * 0.75, 0.0, 1.0));
  alb = mix(alb, uCrackCol, hair * 0.40);

  // --- self shadowing in the grooves
  vec3 L = uLightDir;
  float sh = 1.0;
  if (nearCrack && dry > 0.02 && lod < 3.5 && m.r < 0.10) {
    for (int i = 1; i <= 4; i++) {
      vec3 q = P + L * (0.018 * float(i)) + vec3(0.0, 0.002, 0.0);
      float occ = mapH(q.xz, lod, dry, mm) - q.y;
      sh = min(sh, 1.0 - smoothstep(0.0, 0.012, occ));
    }
    sh = mix(1.0, sh, 0.7);
  }

  // --- drop contact shadow / glow / absorbed ring
  float rD = length(P.xz + L.xz * 0.25);
  float cs = 1.0 - uGround.x * exp(-pow(rD / (1.25 * max(uDropB.w, 0.35)), 2.0));
  float contact = uGround.y * exp(-pow(r0 / (0.95 * max(uDropB.w, 0.3)), 2.0));
  float ring = uGround.z * exp(-pow((r0 - uDropB.w) / 0.024, 2.0));

  // --- lighting
  float ndl = dot(N, L);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  vec3 amb = mix(uBounceCol, uSkyCol, N.y * 0.5 + 0.5);
  float ao = 1.0 - 0.50 * depthK;
  vec3 col = alb * (uLightCol * wrap * sh * cs + amb * ao * mix(1.0, cs, 0.6));
  col += alb * uSssCol * (1.0 - sh) * 0.25;
  col += alb * uSssCol * depthK * 0.22;

  vec3 H = normalize(L + V);
  float ndh = max(dot(N, H), 0.0);
  float ndv = max(dot(N, V), 0.0);
  float spec = pow(ndh, 10.0) * (0.10 + 0.22 * tone) + pow(ndh, 70.0) * 0.12 * tone;
  float fres = pow(1.0 - ndv, 3.0);
  col += uLightCol * spec * sh * (1.0 - depthK);
  col += uSkyCol * fres * (0.30 + 0.45 * tone);
  col += uGlowCol * (0.15 * contact + 0.42 * ring);
  // crests of the ripples catch the light
  col *= 1.0 + 5.0 * ripple(P.xz);

  // --- light filling the cracks
  if (lit > 0.001) {
    float fn = textureLod(uMicro, P.xz / MTILE * 0.23 + vec2(uTime * 0.05, -uTime * 0.035), 2.0).a;
    float fk = smoothstep(0.30, 0.68, fn);
    // intensity varies along every crack, with hot sparkling spots
    float flick = 0.75 + 2.4 * fk * fk;
    // while the crack closes the line of light breaks up into dashes and points
    float dash = smoothstep(heal * 1.15 - 0.22, heal * 1.15 + 0.03, fk + 0.2 * (1.0 - heal));
    dash *= smoothstep(0.0, 0.12, dry);
    // thin, hot core (clips to white and blooms) with a faint cool halo
    float coreG = 1.0 - smoothstep(0.0, w * 0.55 + 0.0026, m.r);
    float halo = exp(-m.r / 0.016);
    float gl = (coreG * 2.3 + halo * 0.03) * lit * dash * flick;
    gl *= 0.85 + 0.45 * smoothstep(uGlowR - 2.4, uGlowR - 0.5, rr);
    col = mix(col, uGlowCol * 0.5, clamp(coreG * lit * dash, 0.0, 1.0) * 0.9);
    col += uGlowCol * gl;
  }

  // studio shaping of the repaired skin: bright towards the horizon and the
  // left, falling off towards the bottom of the frame
  float shape = (mix(0.66, 0.79, smoothstep(0.0, 0.62, vUv.y)) + 0.27 * smoothstep(0.55, 0.92, vUv.y)) * (1.0 + 0.16 * (0.5 - vUv.x));
  col *= mix(1.0, shape, tone);
  // bright atmospheric haze in the distance
  col = mix(col, uHazeCol, (1.0 - exp(-max(t - 4.0, 0.0) * 0.055)) * mix(0.22, 0.85, tone));

  // soft highlight on the far edge of the skin
  float rim = exp(-max(P.z - uFarEdge, 0.0) / 0.25);
  col = mix(col, uStripCol, rim * 0.6);
  return col;
}

vec3 shadeScene(vec3 ro, vec3 rd, out float dist) {
  dist = 60.0;
  if (rd.y > -1e-4) return backdrop(rd);
  float tTop = -ro.y / rd.y;
  vec3 P = ro + rd * tTop;
  if (P.z < uFarEdge) return backdrop(rd);
  return shadeSkin(ro, rd, dist);
}

// ---------------------------------------------------------------- drop

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdRoundCone(vec3 p, float r1, float r2, float h) {
  vec2 q = vec2(length(p.xz), p.y);
  float b = (r1 - r2) / h;
  float a = sqrt(max(1.0 - b * b, 0.0));
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}

// Teardrop in the air: a round cone from the body sphere up to the sharp tip.
float sdTear(vec3 p) {
  vec3 q = p - vec3(0.0, uDropA.y, 0.0);
  return sdRoundCone(q, uDropA.x, uDropA.w, uDropA.z - uDropA.y);
}

// Melted drop on the skin: one smooth convex "gumdrop" of revolution,
//   (r / a)^2 + (y / h)^n = 1
// n < 2 gives the narrow rounded top of the freshly landed drop, n = 2 the
// dome / lens it relaxes into. First-order distance estimate (value / |grad|).
float sdGum(vec3 p) {
  float a = uGum.x, h = uGum.y, n = uGum.z;
  float r = length(p.xz);
  float y = max(p.y, 0.0) / h;
  float yy = pow(y, n * 0.5);
  float F = sqrt(r * r / (a * a) + yy * yy);
  float iF = 1.0 / max(F, 1e-3);
  float dFr = r / (a * a) * iF;
  float dFy = yy * iF * (n * 0.5) * pow(max(y, 2e-3), n * 0.5 - 1.0) / h;
  float g = max(length(vec2(dFr, dFy)), 0.5 / max(a, h));
  return (F - 1.0) / g;
}

float sdDrop(vec3 p) {
  float k = uGum.w;
  if (k <= 0.0) return sdTear(p);
  if (k >= 1.0) return sdGum(p);
  return mix(sdTear(p), sdGum(p), k);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamMat * vec3(ndc.x * aspect * uTanHalfFov, ndc.y * uTanHalfFov, -1.0));
  vec3 ro = uCamPos;

  vec3 col;
  float dist;
  bool hit = false;
  float tHit = 0.0;

  if (uDropB.z > 0.002) {
    // bounding sphere around the drop
    vec3 bc = vec3(0.0, uDropA.y + 0.35, 0.0);
    float br = 1.6;
    vec3 oc = ro - bc;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - br * br;
    float hh = b * b - c;
    if (hh > 0.0) {
      hh = sqrt(hh);
      float t = max(-b - hh, 0.0);
      float tEnd = -b + hh;
      if (rd.y < 0.0) tEnd = min(tEnd, -ro.y / rd.y);
      for (int i = 0; i < 72; i++) {
        vec3 p = ro + rd * t;
        float d = sdDrop(p);
        if (d < 0.0012) { hit = true; break; }
        t += d * 0.72;
        if (t > tEnd) break;
      }
      tHit = t;
    }
  }

  if (!hit) {
    col = shadeScene(ro, rd, dist);
  } else {
    vec3 P = ro + rd * tHit;
    vec2 e = vec2(0.0025, -0.0025);
    vec3 N = normalize(e.xyy * sdDrop(P + e.xyy) + e.yyx * sdDrop(P + e.yyx) +
                       e.yxy * sdDrop(P + e.yxy) + e.xxx * sdDrop(P + e.xxx));
    vec3 V = -rd;
    vec3 L = uLightDir;
    float op = uDropB.x;
    float vis = uDropB.z;
    float cosi = max(dot(N, V), 0.0);
    float F = 0.03 + 0.97 * pow(1.0 - cosi, 5.0);
    vec3 R = reflect(rd, N);
    vec3 refl = R.y > 0.0 ? env(R) : uSkinDry * (uLightCol * 0.55 + uSkyCol * 0.5);

    // view of the skin through the serum (single refraction at the surface)
    vec3 rdi = refract(rd, N, 1.0 / mix(1.0, 1.28, vis));
    if (rdi.y > -0.04) rdi = normalize(vec3(rdi.x, -0.04, rdi.z));
    float d2;
    gMicroScale = 0.15;
    vec3 through = shadeScene(P, rdi, d2);
    // soften what is seen through the gel (no hard refracted lines)
    through = mix(through, uDropSss * 0.86, 0.45 * vis);

    // translucent gel: milky near the base, see-through and skin-tinted above
    float wrap = clamp((dot(N, L) + 0.75) / 1.75, 0.0, 1.0);
    vec3 amb = mix(uBounceCol * 1.5, uSkyCol * 1.25, N.y * 0.5 + 0.5);
    vec3 milk = uDropCol * (0.84 + 0.20 * wrap) + amb * 0.04;
    float melt = 1.0 - op;
    milk = mix(milk, uDropSss, clamp(0.10 + pow(1.0 - cosi, 2.0) * 0.25 + melt * 0.7, 0.0, 1.0));
    float baseK = 1.0 - smoothstep(0.05, 0.75, P.y);         // bright, denser lower third
    float density = clamp(op * (0.66 + 0.36 * baseK + 0.20 * pow(1.0 - cosi, 2.0)), 0.0, 1.0);
    col = mix(through * mix(vec3(1.0), uDropSss * 1.08, 0.5 * vis), milk, density * vis);
    col += uDropCol * 0.10 * baseK * op * vis;
    col = mix(col, refl, F * (0.35 + 0.35 * melt) * vis);
    // glints and a thin bright rim line
    vec3 H = normalize(L + V);
    float ndh = max(dot(N, H), 0.0);
    col += uLightCol * (pow(ndh, 90.0) * 0.7 + pow(ndh, 16.0) * 0.16) * vis;
    col += uStripCol * pow(1.0 - cosi, 3.0) * 0.85 * vis;
    dist = tHit;
  }

  float coc = clamp(uAperture * abs(1.0 / uFocus - 1.0 / max(dist, 0.05)), 0.0, 1.0);
  o = vec4(max(col, 0.0), coc);
}`;
