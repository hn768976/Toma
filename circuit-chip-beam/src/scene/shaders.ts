export const NOISE = /* glsl */ `
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y); }
float vnoise1(float p){ float i = floor(p); float f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
`;

// ---------- board (ground plane + relief blocks share one lighting model)
export const BOARD_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec3 vCol;
void main(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(m) * normal);
  #ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
  #else
    vCol = vec3(1.0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const BOARD_FRAG = /* glsl */ `
uniform vec3 uBase; uniform vec3 uAmbient; uniform vec3 uKeyCol; uniform float uKeyI; uniform float uKeyR; uniform vec3 uKeyPos;
uniform vec3 uBeamCol; uniform float uBeamI; uniform float uBeamR; uniform vec3 uCam; uniform vec3 uFog; uniform float uFogD;
uniform float uPlane;
varying vec3 vW; varying vec3 vN; varying vec3 vCol;
${NOISE}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  // large / medium / fine variation so the surface is never uniformly smooth
  float n1 = vnoise(vW.xz * 0.9), n2 = vnoise(vW.xz * 7.0 + 3.1), n3 = hash21(floor(vW.xz * 160.0));
  vec3 alb = uBase * vCol * (0.6 + 0.5 * n1 + 0.25 * n2 + 0.12 * n3);
  if (uPlane > 0.5) {
    // panel seams on the bare board
    vec2 gq = abs(fract(vW.xz * 2.0) - 0.5);
    float seam = smoothstep(0.492, 0.5, max(gq.x, gq.y));
    alb *= 0.6 - 0.3 * seam;
  }
  float rough = 0.35 + 0.5 * n2;
  // key: the glowing frame, a soft blue point light just above the chip
  vec3 Lk = uKeyPos - vW; float dk = length(Lk); Lk /= dk;
  float ak = uKeyI / (1.0 + (dk * dk) / (uKeyR * uKeyR));
  float ndk = max(dot(N, Lk), 0.0) * 0.75 + 0.25; // wrapped: the glow is an area, not a point
  vec3 Hk = normalize(Lk + V);
  float sk = pow(max(dot(N, Hk), 0.0), mix(60.0, 12.0, rough)) * (1.0 - rough) * 1.6;
  // beam: a tall line light, tints upward faces teal
  vec3 Lb = vec3(0.0, 2.0 + vW.y, 0.0) - vW; float db = length(vW.xz); Lb = normalize(Lb);
  float ab = uBeamI / (1.0 + (db * db) / (uBeamR * uBeamR));
  float ndb = max(dot(N, Lb), 0.0) * 0.8 + 0.2;
  vec3 c = alb * (uAmbient * (0.45 + 0.55 * max(N.y, 0.0)) + uKeyCol * ak * ndk + uBeamCol * ab * ndb) + uKeyCol * ak * sk;
  float vd = length(uCam - vW);
  c = mix(uFog, c, exp(-uFogD * vd));
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------- traces: instanced flat quads with a minimum on-screen width
export const TRACE_VERT = /* glsl */ `
attribute vec4 aSeg; attribute vec2 aDist; attribute vec3 aInfo;
uniform float uResY; uniform vec3 uCam;
varying float vS; varying float vD; varying float vBright; varying float vSeed; varying float vAlpha; varying vec3 vW;
void main(){
  vec2 a = aSeg.xy, b = aSeg.zw;
  vec2 dir = normalize(b - a);
  vec2 perp = vec2(-dir.y, dir.x);
  float u = position.x, s = position.y;
  vec2 p = mix(a, b, u);
  vec4 cc = projectionMatrix * viewMatrix * vec4(p.x, 0.004, p.y, 1.0);
  float px = cc.w * 2.0 / (projectionMatrix[1][1] * uResY);
  float elev = clamp(abs(normalize(uCam - vec3(p.x, 0.0, p.y)).y), 0.2, 1.0);
  float hw = aInfo.z * 0.5;
  float hw2 = max(hw, 0.85 * px / elev);
  vAlpha = hw / hw2;
  p += dir * (u * 2.0 - 1.0) * hw + perp * s * hw2;
  vS = s; vD = mix(aDist.x, aDist.y, u); vBright = aInfo.x; vSeed = aInfo.y;
  vW = vec3(p.x, 0.004, p.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`;
export const TRACE_FRAG = /* glsl */ `
uniform vec3 uDim; uniform vec3 uLit; uniform float uDimE; uniform float uLitE; uniform float uTime; uniform float uWaveT; uniform float uWaveSpeed;
uniform vec3 uCam; uniform float uFogD; uniform float uSettle;
varying float vS; varying float vD; varying float vBright; varying float vSeed; varying float vAlpha; varying vec3 vW;
${NOISE}
void main(){
  float edge = 1.0 - smoothstep(0.45, 1.0, abs(vS));
  float front = uWaveT * uWaveSpeed;
  float behind = smoothstep(front, front - 0.8, vD);
  float flare = exp(-pow((front - vD) / 0.9, 2.0)) * step(0.0, uWaveT);
  float r = length(vW.xz);
  float near = exp(-r / 2.2);
  // short bright packets of data that keep running along the lit traces
  float pk = fract(vD * 0.11 - uTime * 0.42 + vSeed);
  float packet = smoothstep(0.93, 0.985, pk) * (1.0 - smoothstep(0.985, 1.0, pk)) * step(0.5, vBright) * behind;
  float steady = vBright * vBright * behind * mix(1.0, 0.55 + 1.6 * near, 1.0) * uSettle;
  vec3 c = uDim * uDimE * (0.55 + 0.45 * vBright) * (1.0 + 1.0 * near * behind)
         + uLit * uLitE * (steady * (0.9 + near * 0.5) + flare * (0.6 + 0.8 * vBright) * 1.6 + packet * 1.5);
  float vd = length(uCam - vW);
  c *= exp(-uFogD * vd);
  c *= 0.5 + 0.95 * vnoise1(vD * 1.7 + vSeed * 40.0); // uneven brightness along each trace
  gl_FragColor = vec4(c * edge * vAlpha, 1.0);
}`;

// ---------- small lit parts
export const PART_VERT = /* glsl */ `
attribute vec2 aPart;
varying vec3 vW; varying vec3 vN; varying vec2 vPart;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(m) * normal); vPart = aPart;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const PART_FRAG = /* glsl */ `
uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform vec3 uColD; uniform float uE; uniform float uTime; uniform vec3 uCam; uniform float uFogD; uniform float uOn;
varying vec3 vW; varying vec3 vN; varying vec2 vPart;
${NOISE}
void main(){
  float kind = vPart.x; float seed = vPart.y;
  vec3 col = kind < 0.5 ? uColA : kind < 1.5 ? uColB : kind < 2.5 ? uColC : uColD;
  float e = kind < 0.5 ? 1.0 : kind < 1.5 ? 1.0 : kind < 2.5 ? 0.9 : 0.5;
  // a slow seeded flicker, different for every part
  float fl = 0.72 + 0.28 * vnoise1(uTime * (0.6 + seed * 2.4) + seed * 91.0);
  float blink = seed > 0.9 ? step(0.35, fract(uTime * 0.9 + seed * 7.0)) : 1.0;
  float top = 0.35 + 0.65 * max(vN.y, 0.0);
  float bright = 0.25 + 0.75 * smoothstep(0.2, 0.9, hash11(seed * 51.7));
  vec3 c = col * uE * e * fl * blink * top * bright * uOn;
  c *= exp(-uFogD * length(uCam - vW));
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------- the die
export const DIE_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){ vP = position; vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export const DIE_FRAG = /* glsl */ `
uniform vec3 uGlow; uniform vec3 uBeam; uniform vec3 uKey; uniform float uReveal; uniform float uBeamOn; uniform float uE; uniform float uTime; uniform float uHeight;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){
  vec3 c;
  if (vN.y > 0.5) {
    vec2 uv = vP.xz + 0.5; // 0..1 across the top
    vec2 g = uv * 26.0; vec2 gi = floor(g); vec2 gf = fract(g) - 0.5;
    float dots = (1.0 - smoothstep(0.16, 0.28, length(gf))) * step(0.35, hash21(gi + 3.0));
    float rows = step(0.5, fract(uv.y * 13.0)) * (1.0 - smoothstep(0.02, 0.06, abs(fract(uv.x * 52.0) - 0.5) - 0.2)) * step(0.55, hash21(vec2(floor(uv.y * 13.0), 7.0)));
    float border = smoothstep(0.455, 0.47, max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
    float scan = 0.6 + 0.4 * vnoise1(uv.y * 9.0 - uTime * 1.3);
    float pat = max(dots, rows * 0.8) * scan + border * 0.9;
    c = vec3(0.012, 0.02, 0.035) + uGlow * uE * pat * uReveal * (1.0 - 0.88 * uBeamOn)
      + uBeam * uBeamOn * (0.02 + 0.025 * vnoise(uv * 30.0 + vec2(0.0, uTime * 3.0)));
  } else {
    // sides: fine vertical contacts catching the frame light
    float u = abs(vN.x) > 0.5 ? vP.z : vP.x;
    float stripe = step(0.45, fract(u * 34.0));
    float h = vP.y + 0.5;
    float lit = stripe * (0.25 + 0.75 * smoothstep(0.75, 0.0, h));
    c = vec3(0.006, 0.009, 0.014) + uKey * lit * 0.16 * uReveal + uBeam * uBeamOn * 0.02;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------- beam streaks: quads that turn around the vertical axis to face the camera
export const BEAM_VERT = /* glsl */ `
attribute vec2 aBase; attribute vec4 aInfo; // width, seed, brightness, delay
uniform vec3 uCam; uniform float uT; uniform float uRise; uniform float uH; uniform float uBaseY; uniform float uResY;
varying vec2 vUv; varying vec4 vInfo; varying float vLen; varying float vAlpha;
void main(){
  float grow = clamp((uT - aInfo.w) / uRise, 0.0, 1.0);
  grow = 1.0 - pow(1.0 - grow, 2.2);
  float len = uH * grow;
  vec3 base = vec3(aBase.x, uBaseY, aBase.y);
  vec3 toCam = uCam - base; vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
  vec3 mid = base + vec3(0.0, position.y * len, 0.0);
  vec4 cc = projectionMatrix * viewMatrix * vec4(mid, 1.0);
  float px = cc.w * 2.0 / (projectionMatrix[1][1] * uResY);
  float hw = aInfo.x * 0.5; float hw2 = max(hw, 0.8 * px);
  vAlpha = hw / hw2;
  vec3 w = mid + right * position.x * hw2;
  vUv = vec2(position.x, position.y); vInfo = aInfo; vLen = len;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
export const BEAM_FRAG = /* glsl */ `
uniform vec3 uCore; uniform vec3 uTop; uniform vec3 uHot; uniform float uE; uniform float uTime; uniform float uH; uniform float uBody;
varying vec2 vUv; varying vec4 vInfo; varying float vLen; varying float vAlpha;
${NOISE}
void main(){
  float seed = vInfo.y;
  float y = vUv.y * vLen; // world height along the streak
  float across = pow(max(1.0 - vUv.x * vUv.x, 0.0), uBody > 0.5 ? 1.5 : 1.0);
  // light running up the streak
  float run = vnoise1(y * (1.2 + seed * 2.5) - uTime * (2.5 + seed * 5.0) + seed * 40.0);
  float dash = mix(0.35, 1.0, smoothstep(0.25, 0.8, run));
  float tip = 1.0 - smoothstep(0.55, 1.0, vUv.y) * step(vLen, uH * 0.995); // soft leading end while it grows
  float root = 1.0 + 0.3 * exp(-y / 0.35);
  float fadeUp = mix(1.0, 0.4, smoothstep(0.0, 5.0, y));
  vec3 col = mix(uCore, uTop, smoothstep(0.0, 1.6, y));
  col = mix(col, uHot, smoothstep(0.82, 1.0, vInfo.z) * 0.8);
  float a = across * dash * tip * root * fadeUp * vInfo.z * vAlpha * step(0.001, vLen);
  gl_FragColor = vec4(col * uE * a, 1.0);
}`;

// ---------- dust catching the light
export const DUST_VERT = /* glsl */ `
attribute vec4 aInfo; // seed, size, speed, phase
uniform float uTime; uniform float uResY; uniform float uFocus; uniform vec3 uCam;
varying float vA; varying float vSeed; varying float vBlur;
void main(){
  vec3 p = position;
  p.y = 0.08 + mod(p.y + uTime * aInfo.z, 4.2);
  p.x += sin(uTime * 0.31 + aInfo.w * 6.283) * 0.12;
  p.z += cos(uTime * 0.27 + aInfo.w * 4.1) * 0.12;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float blur = abs(dist - uFocus) / max(uFocus, 0.5);
  float size = aInfo.y * (1.0 + blur * 5.0);
  gl_PointSize = max(size * uResY / dist, 1.0);
  float fadeY = smoothstep(0.08, 0.5, p.y) * (1.0 - smoothstep(3.4, 4.2, p.y));
  float lightFall = 1.0 / (1.0 + dot(p.xz, p.xz) / 9.0);
  vA = fadeY * lightFall / pow(1.0 + blur * 5.0, 1.6) * step(0.4, dist);
  vSeed = aInfo.x; vBlur = blur;
  gl_Position = projectionMatrix * mv;
}`;
export const DUST_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uE; uniform float uTime;
varying float vA; varying float vSeed; varying float vBlur;
${NOISE}
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);
  float disc = 1.0 - smoothstep(mix(0.3, 0.75, clamp(vBlur * 3.0, 0.0, 1.0)), 1.0, r);
  float tw = 0.55 + 0.45 * vnoise1(uTime * 1.4 + vSeed * 77.0);
  gl_FragColor = vec4(uCol * uE * disc * vA * tw, 1.0);
}`;

// ---------- haze: glow hanging in the air around the chip
export const HAZE_VERT = /* glsl */ `
uniform float uSize; varying vec2 vUv;
void main(){
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(0.0, 0.25, 0.0, 1.0);
  mv.xy += position.xy * uSize * 0.5;
  gl_Position = projectionMatrix * mv;
}`;
export const HAZE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uI; varying vec2 vUv;
void main(){
  float r = length(vUv);
  float g = exp(-r * 4.2) * 1.0 + exp(-r * r * 30.0) * 0.9;
  g *= 1.0 - smoothstep(0.7, 1.0, r);
  gl_FragColor = vec4(uCol * uI * g, 1.0);
}`;
