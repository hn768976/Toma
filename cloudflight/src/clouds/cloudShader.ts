import { GLSL_HEADER } from "../lib/glsl";

/**
 * Volumetric cumulus raymarcher. World units are metres, y up, the camera
 * flies toward -z. Ground at y = 0.
 */
export const CLOUD_FRAG = `${GLSL_HEADER}
uniform vec2 uResolution;
uniform sampler2D uBlue;
uniform sampler3D uBase;
uniform sampler3D uDetail;
uniform sampler3D uCurl;

uniform vec3 uCamPos;
uniform mat3 uCamRot;       // camera -> world
uniform float uTanHalfFovY;
uniform int uSteps;

uniform vec3 uSunDir;
uniform vec3 uSunColor;     // linear, includes intensity
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyMid;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform vec3 uShadowTint;
uniform vec3 uHaze;
uniform vec3 uGroundDark;
uniform vec3 uGroundLight;
uniform float uExposure;
uniform float uVeil;        // milky in-cloud haze over the whole frame (opening section)

uniform float uStory;       // 0 = flight, 1 = sea
uniform vec3 uWind;         // metres of drift applied to the base shape
uniform vec3 uEvolve;       // detail-noise offset (texture units)
uniform float uLoopZ;
uniform float uLB;
uniform vec4 uTerrainScale;  // ground noise scales (m); the sea's z periods divide its loop travel
uniform float uMaxTop;      // highest cloud top anywhere (m): bounds the slab
uniform sampler3D uMassTex; // flight: baked cumulus masses (R = inside-ness, G = density)         // flight: explicit cloud mass the camera pushes through (centre xyz, radius)
    // its ellipsoid radii, relative          // base noise tile (m); the sea loop travels exactly one tile       // sea: camera z, used for the camera-relative far field

out vec4 fragColor;

const float CB = 1400.0;           // cloud base
const float CT = 3400.0;           // max cloud top
const float LD = 60.0;             // detail noise tile (m)
const float LC = 600.0;            // curl noise tile (m)
const float SIGMA = 0.12;         // extinction per metre at density 1
const float PI = 3.14159265;

float remap(float v, float l0, float h0, float l1, float h1) {
  return l1 + (v - l0) * (h1 - l1) / (h0 - l0);
}
float sat(float x) { return clamp(x, 0.0, 1.0); }
// smoothstep that also accepts a > b (GLSL leaves that undefined).
float ss(float a, float b, float x) {
  float t = sat((x - a) / (b - a));
  return t * t * (3.0 - 2.0 * t);
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

// ---------------------------------------------------------------- weather
// x = coverage, y = top (fraction of the layer)
uniform sampler2D uWeatherA;  // flight map, or the sea's tiling near map
uniform sampler2D uWeatherB;  // sea: camera-relative far map
uniform vec4 uWeatherXf;      // flight map: x0, z0, size;  sea: near tile size
uniform float uSeaFarHalf;

// x = coverage, y = top, z = highest top within 1 km (for skipping)
vec3 weather3(vec2 xz) {
  if (uStory < 0.5) {
    return texture(uWeatherA, (xz - uWeatherXf.xy) / uWeatherXf.z).rgb;
  }
  vec3 nearW = texture(uWeatherA, xz / uWeatherXf.z).rgb;
  vec2 rel = xz - vec2(0.0, uLoopZ);
  float far = ss(4500.0, 9000.0, length(rel));
  if (far <= 0.0) return nearW;
  vec3 farW = texture(uWeatherB, rel / (2.0 * uSeaFarHalf) + 0.5).rgb;
  vec3 w = mix(nearW, farW, far);
  w.z = max(nearW.z, farW.z);
  return w;
}
vec2 weather(vec2 xz) { return weather3(xz).xy; }

// ---------------------------------------------------------------- density
// Cumulus vertical profile, 0..1, h = height / cloud top: flat base,
// widest low down, narrowing into a rounded dome.
float profile(float h) {
  return ss(0.0, 0.25, h) * sqrt(sat(1.0 - h * h));
}

float densitySoft;
float pixAngleG;

// Explicit masses (flight only): ellipsoids eroded by the base noise at a
// scale that suits their size, then by the detail noise like the field.
uniform vec3 uMassMin;      // union bounding box of all masses
uniform vec3 uMassMax;
float massShape(vec3 p) {
  if (any(lessThan(p, uMassMin)) || any(greaterThan(p, uMassMax))) return 0.0;
  vec2 md = texture(uMassTex, (p - uMassMin) / (uMassMax - uMassMin)).rg;
  if (md.x <= 0.0) return 0.0;
  vec4 n = texture(uBase, (p + uWind) / 320.0 + 0.137);
  float lowFbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  float b = sat((sat(remap(n.r, lowFbm - 1.0, 1.0, 0.0, 1.0)) - 0.66) / 0.3);
  float mt = 1.0 - min(2.2 * md.x, 1.0);
  return sat((b * 0.7 + 0.3 - mt) / max(1.0 - mt, 1e-3)) * md.y;
}

float densityAt(vec3 p, vec2 wt, bool full, float lod, float hf) {
  densitySoft = 0.0;
  if (hf <= 0.0 || hf >= 1.0) return 0.0;
  float shape = 0.0;
  float cov = wt.x;
  float h = hf / max(wt.y, 0.01);
  if (h < 1.0 && cov > 0.01) {
    float prof = profile(h);
    // Far clouds sample a broader version of the base shape: wide, rounded
    // distant cumulus instead of thin spires.
    float farS = 1.0 + 1.2 * ss(1500.0, 7000.0, length(p.xz - uCamPos.xz));
    vec4 n = texture(uBase, (p + uWind) / (uLB * farS));
    float lowFbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
    float base = sat(remap(n.r, lowFbm - 1.0, 1.0, 0.0, 1.0));
    // Measured range of the base shape is ~0.69..0.95: normalise to 0..1.
    base = sat((base - 0.66) / 0.3);
    float thr = 1.0 - cov * prof;
    shape = sat((base - thr) / max(1.0 - thr, 1e-3));
  }
  if (uStory < 0.5) {
    float ms = massShape(p);
    if (ms > shape) { shape = ms; h = 0.6; }
  }
  if (shape <= 0.0) return 0.0;
  h = min(h, 1.0);
  if (full && lod > 0.0) {
    vec3 q = p + uWind;
    vec3 c = texture(uCurl, q / LC).xyz * 2.0 - 1.0;
    vec3 qd = q + c * 9.0 * (1.0 - h * 0.6);
    vec3 d = texture(uDetail, qd / LD + uEvolve).rgb;
    float dfbm = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;
    // Wispy at the base, billowy higher up.
    float dmod = mix(dfbm, 1.0 - dfbm, ss(0.0, 0.12, h));
    // Medium billows (~40-150 m) from the base volume at a finer scale.
    vec4 mb = texture(uBase, qd / 600.0 + 0.31);
    float med = mb.g * 0.6 + mb.b * 0.4;
    float lodM = 1.0 - ss(3.0, 12.0, length(p - uCamPos) * pixAngleG);
    shape = sat(remap(shape, (1.0 - med) * 0.58 * lodM, 1.0, 0.0, 1.0));
    shape = sat(remap(shape, dmod * 0.2 * lod, 1.0, 0.0, 1.0));
  }
  densitySoft = shape;
  // Crisp boundary, but with a soft toe so eroded edges read as wisps.
  return ss(0.06, 0.7, shape);
}

vec2 lastWeather;
float density(vec3 p, bool full, float lod, out float hfOut) {
  float hf = (p.y - CB) / (CT - CB);
  hfOut = hf;
  if (hf <= 0.0 || hf >= 1.0) { densitySoft = 0.0; return 0.0; }
  lastWeather = weather(p.xz);
  return densityAt(p, lastWeather, full, lod, hf);
}

float lightJit;
float lightMarch(vec3 p, vec2 wt) {
  float od = 0.0;
  float len = 8.0;
  float tt = 0.0;
  for (int i = 0; i < 6; i++) {
    float seg = len;
    vec3 s = p + uSunDir * (tt + seg * 0.5);
    float hf = (s.y - CB) / (CT - CB);
    float dl = densityAt(s, wt, i < 1, 1.0, hf);
    od += (i < 2 ? dl : sat(densitySoft * 2.0)) * seg;
    tt += seg;
    len *= 2.0;
  }
  return od * SIGMA;
}

// ---------------------------------------------------------------- sky & ground
vec3 skyColor(vec3 rd) {
  float h = max(rd.y, 0.0);
  // Three stops: horizon -> ~15 deg -> zenith.
  vec3 col = mix(uSkyHorizon, uSkyMid, ss(0.0, 0.26, h));
  col = mix(col, uSkyZenith, ss(0.2, 0.85, h));
  // Rayleigh-ish brightening opposite the zenith and a soft mie glow.
  float mu = dot(rd, uSunDir);
  col += uSunColor * hg(mu, 0.76) * 0.02;
  // Warm glow around a low sun, spreading along the horizon.
  float low = 1.0 - ss(0.05, 0.35, uSunDir.y);
  col += uSunColor * low * 0.05 * pow(sat(mu * 0.5 + 0.5), 6.0) * (1.0 - ss(0.0, 0.5, h));
  // Milky haze band just above the horizon.
  col = mix(col, mix(uSkyHorizon, vec3(dot(uSkyHorizon, vec3(0.33))), 0.35) * 1.08, (1.0 - ss(0.0, 0.07, h)) * 0.6);
  // Below the horizon, the sky fades into the haze.
  col = mix(col, uHaze, ss(0.0, -0.08, rd.y));
  return col;
}

float terrainH(vec2 xz) {
  // Mountains and valleys: ridged noise from the base volume.
  float a = texture(uBase, vec3(xz / uTerrainScale.xy, 0.11)).g;
  float b = 1.0 - abs(texture(uBase, vec3(xz / (uTerrainScale.zw * 0.5), 0.47)).r * 2.0 - 1.4);
  float h = a * 0.55 + b * 0.45;
  return h;
}

vec3 groundColor(vec3 ro, vec3 rd, float tG) {
  vec3 gp = ro + rd * tG;
  float e = 250.0;
  float h0 = terrainH(gp.xz);
  float hx = terrainH(gp.xz + vec2(e, 0.0));
  float hz = terrainH(gp.xz + vec2(0.0, e));
  vec3 n = normalize(vec3((h0 - hx) * 3200.0 / e, 1.0, (h0 - hz) * 3200.0 / e));
  float lit = sat(dot(n, uSunDir)) * 0.85 + 0.15;
  float ridge = ss(0.42, 0.72, h0);
  vec3 col = mix(uGroundDark * 0.6, uGroundLight * 1.3, ridge) * lit;
  // Cloud shadow on the ground: one cheap density probe along the sun ray.
  float ts = (CB + 250.0 - gp.y) / max(uSunDir.y, 0.05);
  float hf;
  float sd = density(gp + uSunDir * ts, false, 0.0, hf);
  col *= mix(1.0, 0.35, sat(sd * 2.0));
  // Heavy blue aerial haze.
  float fog = 1.0 - exp(-tG * 1.0e-4);
  vec3 haze = mix(uHaze, skyColor(vec3(rd.x, 0.0, rd.z)), ss(-0.14, 0.0, rd.y));
  return mix(col, haze, fog);
}

uniform float uDebug;
void main() {
  if (uDebug > 2.5 && uDebug < 3.5) {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 q = vec3(mix(-3000.0, 3000.0, uv.x), 1600.0, mix(1000.0, -5000.0, uv.y));
    vec4 n = texture(uBase, q / uLB);
    float lowFbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
    float base = sat(remap(n.r, lowFbm - 1.0, 1.0, 0.0, 1.0));
    base = sat((base - 0.66) / 0.3);
    fragColor = vec4(uv.x < 0.5 ? n.rgb : vec3(base), 1.0);
    return;
  }
  if (uDebug > 1.5 && uDebug < 2.5) {
    // Density slices: left at 1600 m, right at 1800 m; 6 km square each.
    vec2 uv = gl_FragCoord.xy / uResolution;
    float side = step(0.5, uv.x);
    vec2 xz = vec2(mix(-3000.0, 3000.0, fract(uv.x * 2.0)), mix(1000.0, -5000.0, uv.y));
    float hf;
    float d = density(vec3(xz.x, mix(1600.0, 1800.0, side), xz.y), true, 1.0, hf);
    vec2 w = weather(xz);
    fragColor = vec4(d, d, d * 0.5 + 0.5 * w.x, 1.0);
    return;
  }
  if (uDebug > 0.5 && uDebug < 1.5) {
    // Top-down: x in [-600, 600], z in [-1100, 100]; R = coverage, G = top
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 xz = vec2(mix(-1067.0, 1067.0, uv.x), mix(100.0, -1100.0, uv.y));
    vec2 w = weather(xz);
    float path = 1.0 - ss(0.0, 3.0, abs(xz.x - 6.0 * sin(xz.y * (-0.4 / 12.0))));
    path *= step(-180.0, xz.y) * step(xz.y, 0.0);
    fragColor = vec4(w.x * w.x, pow(w.y, 1.0), path, 1.0);
    return;
  }
  vec2 ndc = (gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * uResolution.y);
  vec3 rdCam = normalize(vec3(ndc * uTanHalfFovY, -1.0));
  vec3 rd = uCamRot * rdCam;
  vec3 ro = uCamPos;

  // Fixed per-pixel blue-noise jitter (no temporal accumulation).
  float jit = texelFetch(uBlue, ivec2(mod(gl_FragCoord.xy, 64.0)), 0).r;
  lightJit = texelFetch(uBlue, ivec2(mod(gl_FragCoord.xy + vec2(23.0, 41.0), 64.0)), 0).r;

  // Background.
  vec3 bg;
  float tG = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  bg = rd.y < 0.0 ? groundColor(ro, rd, tG) : skyColor(rd);

  // Slab intersection.
  float t0 = 0.0;
  float t1 = 60000.0;
  if (abs(rd.y) > 1e-5) {
    float ta = (CB - ro.y) / rd.y;
    float tb = (uMaxTop - ro.y) / rd.y;
    t0 = max(min(ta, tb), 0.0);
    t1 = min(max(ta, tb), 60000.0);
  } else if (ro.y < CB || ro.y > uMaxTop) {
    t1 = -1.0;
  }
  // Beyond ~25 km everything is haze.
  t1 = min(min(t1, tG), 25000.0);

  // Size of a pixel at unit distance, for level of detail.
  float pixAngle = 2.0 * uTanHalfFovY / uResolution.y;
  pixAngleG = pixAngle;
  vec3 acc = vec3(0.0);
  float T = 1.0;
  float mu = dot(rd, uSunDir);
  // Dual-lobe phase: strong forward silver lining, a little back-scatter.
  float phase0 = mix(hg(mu, -0.2), hg(mu, 0.8), 0.6);

  if (t1 > t0) {
    // uSteps = budget of lit samples inside cloud (quality setting).
    float stepScale = 96.0 / float(uSteps);
    float t = t0 + min(6.0 + t0 * 0.035, 700.0) * jit;
    float lastDt = 0.0;
    bool inside = false;
    int empty = 0;
    int lit = 0;
    int iters = 0;
    int bis = 0;
    float hf;
    for (int i = 0; i < 360; i++) {
      if (lit >= uSteps || t > t1 || T < 0.006) break;
      iters++;
      float coarse = min(6.0 + t * 0.035, 700.0);
      float fine = min(0.5 + t * 0.011, 45.0) * stepScale;
      if (!inside) {
        vec3 pc = ro + rd * t;
        // Empty-space skip: above every top within 1 km and clear of the masses.
        float topY = CB + weather3(pc.xz).z * (CT - CB) + 12.0;
        bool inBox = uStory < 0.5 && all(greaterThan(pc, uMassMin)) && all(lessThan(pc, uMassMax));
        if (pc.y > topY && !inBox) {
          float jump = 900.0 / max(length(rd.xz), 0.05);
          if (rd.y < 0.0) jump = min(jump, (pc.y - topY) / -rd.y);
          // Land with a fresh per-pixel offset so the following coarse steps
          // don't line up across pixels (that shows as horizontal banding).
          lastDt = max(jump, coarse) + coarse * jit;
          t += lastDt;
          continue;
        }
        // Cheap test with the un-eroded shape (a superset of the cloud).
        if (density(ro + rd * t, false, 0.0, hf) <= 0.0) {
          lastDt = coarse;
          t += coarse;
          continue;
        }
        // Bisect back to the surface so neighbouring pixels start their
        // fine steps at the same depth (no per-pixel speckle).
        bis++;
        float a = max(t0, t - lastDt);
        float b = t;
        for (int k = 0; k < 6; k++) {
          float m = 0.5 * (a + b);
          if (density(ro + rd * m, false, 0.0, hf) > 0.0) b = m; else a = m;
        }
        // Small fixed per-pixel offset breaks up step contours on flat tops.
        t = b + fine * 0.9 * fract(jit + 0.618);
        inside = true;
        empty = 0;
      }
      vec3 p = ro + rd * t;
      float lod = 1.0 - ss(0.7, 3.0, t * pixAngle);
      float d = density(p, true, lod, hf);
      // Gentle near-plane fade so wisps touching the lens don't pop.
      d *= ss(0.5, 6.0, t);
      if (d > 0.001) {
        empty = 0;
        lit++;
        float od = lightMarch(p, lastWeather);
        vec3 S = vec3(0.0);
        float a = 1.0, b = 1.0, c = 1.0;
        for (int k = 0; k < 4; k++) {
          float ph = mix(hg(mu, -0.2 * c), hg(mu, 0.8 * c), 0.45);
          S += b * exp(-od * a) * ph;
          a *= 0.2; b *= 0.55; c *= 0.5;
        }
        // Deep diffusion: light soaking through the cloud keeps the
        // interior (and whiteouts) bright.
        S += 0.14 * exp(-od * 0.025) * (0.25 / PI);
        float powder = 1.0 - exp(-d * SIGMA * 2.0 * 40.0);
        float pw = mix(1.0, powder, 0.7 * sat(0.6 - mu));
        vec3 sun = uSunColor * S * pw;
        vec3 ambient = mix(uAmbBottom, uAmbTop, sat(hf / 0.45));
        // Light diffusing through deep cloud: shadowed parts stay soft grey.
        vec3 L = sun + 0.62 * ambient * mix(uShadowTint, vec3(1.0), sat(exp(-od * 0.5)));
        float sigma = d * SIGMA;
        // Step ~0.7 optical depths inside dense cloud, fine steps in thin parts.
        float dtIn = clamp(0.7 / max(sigma, 1e-4), fine, fine * 3.0);
        float Tr = exp(-sigma * dtIn);
        vec3 Sint = L * (1.0 - Tr);
        float fog = 1.0 - exp(-t * (uStory < 0.5 ? 1.0e-4 : 0.9e-4));
        vec3 hz = mix(uSkyHorizon, uHaze, 0.35);
        acc += T * mix(Sint, hz * (1.0 - Tr), fog);
        T *= Tr;
        lastDt = dtIn;
        t += dtIn;
        continue;
      } else if (++empty > 4) {
        inside = false;
      }
      lastDt = fine;
      t += fine;
    }
    if (uDebug > 3.5) {
      fragColor = vec4(float(iters) / 360.0, float(lit) / 96.0, float(bis) / 10.0, 1.0);
      return;
    }
  }
  if (uDebug > 3.5) { fragColor = vec4(0.0); return; }

  vec3 col = (acc + T * bg) * uExposure;
  col = mix(col, uSkyHorizon * 1.15 * uExposure, uVeil);
  fragColor = vec4(col, 1.0);
}
`;
