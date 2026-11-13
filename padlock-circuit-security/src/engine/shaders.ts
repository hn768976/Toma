/** GLSL shared by the hand-written materials. */
export const COMMON = /* glsl */ `
uniform vec3 uFog;
uniform float uFogDensity;
float fogAmount(float d){ return 1.0 - exp(-d * d * uFogDensity * uFogDensity); }
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

export const BOARD_VERT = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const BOARD_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uBase; uniform vec3 uDetail; uniform vec3 uSheen; uniform vec3 uChipGlow;
uniform float uGlow;
varying vec3 vWorld;
float rectAA(vec2 q, vec2 hs, float fw){
  vec2 d = abs(q) - hs;
  return clamp(0.5 - max(d.x, d.y) / max(fw, 1e-4), 0.0, 1.0);
}
void main(){
  vec2 p = vWorld.xz;
  float fw = max(fwidth(p.x), fwidth(p.y));
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  vec3 alb = uBase * (0.3 + 0.45 * vnoise(p * 0.35));
  float detail = 0.0;
  { // silk-screen zones
    vec2 g = p * 0.8; vec2 id = floor(g); vec2 f = fract(g) - 0.5; float r = h21(id);
    float m = step(0.5, r) * rectAA(f, vec2(0.3 + 0.18 * h21(id + 3.1), 0.25 + 0.2 * h21(id + 8.7)), fw * 0.8);
    alb += uDetail * 0.07 * m;
  }
  vec2 padId;
  { // solder pads
    float s = 7.0; vec2 g = p * s; vec2 id = floor(g); vec2 f = fract(g) - 0.5; float r = h21(id); padId = id;
    vec2 hs = vec2(0.14 + 0.26 * h21(id + 1.7), 0.1 + 0.22 * h21(id + 5.3));
    float fade = clamp(1.4 - fw * s * 1.6, 0.0, 1.0);
    float m = step(0.8, r) * rectAA(f, hs, fw * s) * fade;
    detail += (0.25 + 0.9 * h21(id + 9.0)) * m * 0.55;
  }
  { // fine routing, two orthogonal families
    float s = 11.0; float fade = clamp(1.3 - fw * s * 2.2, 0.0, 1.0);
    float row = floor(p.y * s); float on = step(0.5, h21(vec2(row, floor(p.x * 0.55 + h21(vec2(row, 3.0)) * 5.0))));
    detail += 0.3 * on * clamp(0.5 - (abs(fract(p.y * s) - 0.5) - 0.13) / max(fw * s, 1e-4), 0.0, 1.0) * fade;
    float colm = floor(p.x * s); float on2 = step(0.62, h21(vec2(floor(p.y * 0.5 + h21(vec2(colm, 7.0)) * 5.0), colm)));
    detail += 0.3 * on2 * clamp(0.5 - (abs(fract(p.x * s) - 0.5) - 0.13) / max(fw * s, 1e-4), 0.0, 1.0) * fade;
  }
  alb += uDetail * detail * 0.26;
  // lighting: ambient + the glowing chip + grazing sheen + a broad back-light highlight
  float r2 = dot(p, p);
  vec3 col = alb * 1.0;
  col += (alb * 3.0 + uChipGlow * 0.04) * uChipGlow * uGlow * (1.3 / (1.0 + r2 * 0.2));
  vec3 N = normalize(vec3((h21(padId) - 0.5) * 0.3, 1.0, (h21(padId + 2.0) - 0.5) * 0.3));
  float graze = pow(1.0 - max(V.y, 0.0), 5.0);
  col += uSheen * graze * (0.14 + 0.5 * detail);
  vec3 L = normalize(vec3(-0.25, 0.42, -0.85));
  float spec = pow(max(dot(reflect(-V, N), L), 0.0), 18.0);
  col += uSheen * spec * (0.25 + 1.4 * detail);
  col = mix(col, uFog, fogAmount(dist));
  gl_FragColor = vec4(col, 1.0);
}`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const SKY_FRAG = /* glsl */ `
uniform vec3 uFog; uniform vec3 uTop; uniform vec3 uHorizon;
varying vec3 vDir;
void main(){
  float y = normalize(vDir).y;
  vec3 c = mix(uFog, uHorizon * 0.55, smoothstep(0.0, 0.07, y));
  c = mix(c, uTop, smoothstep(0.05, 0.42, y));
  if (y < 0.0) c = uFog;
  gl_FragColor = vec4(c, 1.0);
}`;

export const TRACE_VERT = /* glsl */ `
attribute vec4 aInfo;
varying vec4 vInfo; varying vec2 vUv; varying float vDist;
void main(){
  vInfo = aInfo; vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

export const TRACE_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uNear; uniform vec3 uFar; uniform vec3 uIdle;
uniform float uFront; uniform float uLead; uniform float uTime; uniform float uGlow;
varying vec4 vInfo; varying vec2 vUv; varying float vDist;
void main(){
  float d = vInfo.x; float seed = vInfo.y; float kind = vInfo.z;
  float a;
  if (vInfo.w > 0.5) {
    float r = length(vUv); float fw = fwidth(r);
    a = clamp((1.0 - r) / fw, 0.0, 1.0) * (0.35 + 0.65 * clamp((r - 0.42) / fw, 0.0, 1.0));
  } else {
    float fw = fwidth(vUv.x);
    a = clamp((1.0 - abs(vUv.x)) / fw, 0.0, 1.0);
  }
  float reveal = smoothstep(uFront, uFront - 1.6, d);
  float lead = exp(-abs(d - uFront) * 0.9) * uLead;
  float ph = d * 0.085 - uTime * (0.32 + 0.3 * seed) + seed * 7.0;
  float pulse = pow(max(0.0, 1.0 - abs(fract(ph) - 0.5) * 2.0), 7.0);
  float near = exp(-d * 0.075);
  vec3 col;
  if (kind > 0.5) {
    vec3 lit = mix(uFar, uNear, clamp(near * 1.15 + pulse * 0.6, 0.0, 1.0)) * (0.32 + 1.25 * near + 1.5 * pulse) * uGlow;
    vec3 idle = uIdle * (0.28 + 0.9 * pulse * step(0.6, seed));
    col = mix(idle, lit, reveal) + uNear * lead * 2.5;
  } else {
    vec3 lit = mix(uFar, uNear, 0.25 + 0.5 * pulse) * (0.16 + 0.75 * pulse);
    col = mix(uIdle * 0.2, lit, reveal) + uNear * lead * 0.5;
  }
  col *= a * (1.0 - fogAmount(vDist));
  gl_FragColor = vec4(col, 1.0);
}`;

export const HOLO_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vDist;
void main(){
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

/** Translucent "hologram glass": soft body, bright fresnel rim, optional fill-up reveal. */
export const HOLO_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uColor; uniform vec3 uRim;
uniform float uBody; uniform float uRimI; uniform float uAlpha; uniform float uRimPow;
uniform float uFill; uniform float uGhost; uniform float uSparkle; uniform float uTime; uniform float uIntensity;
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vDist;
void main(){
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float fres = pow(1.0 - ndv, uRimPow);
  float filled = smoothstep(uFill + 0.02, uFill - 0.02, vObj.y);
  float surf = exp(-abs(vObj.y - uFill) * 30.0) * step(-50.0, uFill) * step(uFill, 50.0);
  float k = mix(uGhost, 1.0, filled);
  vec3 col = uColor * uBody * (0.85 + 0.3 * vObj.y) + uRim * uRimI * fres;
  float sp = step(0.993, h21(floor(vObj.xy * 60.0) + floor(uTime * 3.0 + h21(floor(vObj.xy * 60.0)) * 9.0)));
  col += uRim * sp * uSparkle * 2.5;
  col += uRim * surf * 2.0;
  float alpha = clamp((uAlpha + fres * 0.6 + sp * uSparkle) * k + surf, 0.0, 1.0);
  col *= uIntensity * mix(0.55, 1.0, filled);
  float f = fogAmount(vDist);
  gl_FragColor = vec4(mix(col, uFog, f), alpha);
}`;

export const LID_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uGlowCol; uniform vec3 uCore; uniform float uI; uniform float uAlpha; uniform float uHalf;
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vDist;
float ln(float v, float w, float fw){ return clamp(0.5 - (abs(v) - w) / max(fw, 1e-4), 0.0, 1.0); }
void main(){
  vec2 q = vObj.xz / uHalf;
  float top = step(0.5, abs(normalize((vec4(vN, 0.0) * viewMatrix).xyz).y));
  float m = max(abs(q.x), abs(q.y));
  float fw = fwidth(m);
  float lines = ln(m - 0.62, 0.012, fw) + ln(m - 0.36, 0.012, fw) * 0.9 + ln(m - 0.2, 0.01, fw) * 0.6;
  // die-map: little blocks between the frames
  vec2 g = q * 7.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float blk = step(0.45, h21(id)) * clamp(0.5 - (max(abs(f.x), abs(f.y)) - 0.36) / max(fwidth(g.x), 1e-4), 0.0, 1.0);
  float ring = smoothstep(0.36, 0.38, m) * smoothstep(0.62, 0.6, m);
  lines += blk * ring * 0.35;
  lines += (ln(q.x, 0.01, fw) + ln(q.y, 0.01, fw)) * step(0.62, m) * step(m, 0.84) * 0.5;
  float border = smoothstep(0.84, 0.9, m);
  vec3 topCol = mix(uGlowCol * 0.75, uCore, 0.28 + 0.6 * clamp(lines, 0.0, 1.0)) * (1.0 - 0.45 * border);
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  vec3 sideCol = uGlowCol * (0.25 + 0.9 * pow(1.0 - ndv, 2.0));
  vec3 col = mix(sideCol, topCol, top) * uI;
  gl_FragColor = vec4(mix(col, uFog, fogAmount(vDist)), uAlpha);
}`;

export const BEAM_VERT = /* glsl */ `
varying vec2 vUv; varying float vY; varying float vDist;
void main(){
  vUv = uv; vY = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
export const BEAM_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uColor; uniform float uBeam; uniform float uEdge; uniform float uTime; uniform float uBottom;
varying vec2 vUv; varying float vY; varying float vDist;
void main(){
  float x = vUv.x;
  float streak = pow(vnoise(vec2(x * 46.0, vY * 0.06 - uTime * 0.5)), 3.0);
  float e = abs(x * 2.0 - 1.0);
  float fw = fwidth(e);
  float edge = clamp((e - (1.0 - 0.018)) / max(fw, 1e-4), 0.0, 1.0);
  float dash = step(0.35, fract(vY * 2.6 + uTime * 2.2));
  float fall = exp(-max(vY, 0.0) * 0.05) * smoothstep(uBottom, uBottom + 0.8, vY);
  float a = uBeam * (0.035 + 0.22 * streak) * fall + uEdge * edge * (0.25 + 0.75 * dash) * exp(-max(vY, 0.0) * 0.03) * smoothstep(uBottom, uBottom + 0.3, vY);
  gl_FragColor = vec4(uColor * a * (1.0 - 0.7 * fogAmount(vDist)), 1.0);
}`;

export const RAIN_VERT = /* glsl */ `
attribute vec4 aRain; attribute vec2 aSize;
uniform float uTime;
varying vec2 vUv; varying float vFade; varying float vSeed;
void main(){
  float H = 30.0;
  float y = H - mod(aRain.z * H + uTime * aRain.w, H) - 1.0;
  vec3 c = vec3(aRain.x, y, aRain.y);
  vec3 toCam = normalize(vec3(cameraPosition.x - c.x, 0.0, cameraPosition.z - c.z));
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  vec3 p = c + right * position.x * aSize.x + vec3(0.0, 1.0, 0.0) * position.y * aSize.y;
  vUv = position.xy * 2.0;
  vSeed = aRain.z;
  vFade = smoothstep(-1.0, 1.5, y) * smoothstep(H - 1.0, H - 6.0, y);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
export const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uI;
varying vec2 vUv; varying float vFade; varying float vSeed;
void main(){
  float across = pow(max(0.0, 1.0 - vUv.x * vUv.x), 2.0);
  float t = vUv.y * 0.5 + 0.5; // 0 bottom (head) .. 1 top (tail)
  float along = smoothstep(0.0, 0.08, t) * pow(1.0 - t, 1.4);
  gl_FragColor = vec4(uColor * across * along * vFade * uI * (0.5 + vSeed), 1.0);
}`;

export const DUST_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uHeightPx; uniform float uFocus; uniform float uAperture; uniform float uTanHalfFov;
varying float vA; varying float vSeed;
void main(){
  vec3 p = position + vec3(sin(uTime * 0.21 + aSeed.x * 40.0), cos(uTime * 0.17 + aSeed.y * 40.0) * 0.6, sin(uTime * 0.19 + aSeed.z * 40.0)) * 0.35;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float z = max(-mv.z, 0.05);
  float coc = min(uAperture * 0.02 * abs(z - uFocus) / z, 0.03);
  float base = (0.012 + 0.02 * aSeed.w) / (2.0 * z * uTanHalfFov);
  float size = base + coc * 2.0;
  vA = (0.35 + 0.65 * aSeed.w) * (base * base) / (size * size) * smoothstep(0.25, 1.2, z);
  vSeed = aSeed.x;
  gl_PointSize = max(size * uHeightPx, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
export const DUST_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uI;
varying float vA; varying float vSeed;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float d = smoothstep(1.0, 0.82, r) * (0.75 + 0.25 * smoothstep(0.5, 0.95, r));
  gl_FragColor = vec4(uColor * d * vA * uI, 1.0);
}`;
