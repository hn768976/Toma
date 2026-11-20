export const NOISE = /* glsl */ `
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y); }
float vnoise1(float p){ float i = floor(p); float f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
float fbm(vec2 p){ return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.13 + 7.1) + 0.2 * vnoise(p * 4.7 + 3.3); }
`;

// ---------- background: matte dark backdrop with a soft lighter area
export const BG_VERT = /* glsl */ `
varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`;
export const BG_FRAG = /* glsl */ `
uniform vec3 uGlow; uniform vec2 uCentre; uniform float uRadius; uniform float uAspect; uniform float uShift;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 p = vUv - uCentre - vec2(uShift, 0.0); p.x *= uAspect * 0.62;
  float d = length(p) / uRadius;
  float g = exp(-d * d * 1.4);
  // a second, wider and fainter wash plus slow mottling so it is not a perfect gradient
  vec2 q = vUv - vec2(0.05 + uShift, 0.2); q.x *= uAspect * 0.5;
  g += 0.45 * exp(-dot(q, q) / 0.16);
  g *= 0.82 + 0.36 * fbm(vUv * vec2(3.0, 2.0) + 11.0 + vec2(uShift * 2.0, 0.0));
  gl_FragColor = vec4(uGlow * g, 1.0);
}`;

// ---------- sand (upper bulb body, its top surface, and the falling stream)
export const SAND_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec3 vP;
void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
export const SAND_FRAG = /* glsl */ `
uniform vec3 uLight; uniform vec3 uDark; uniform vec3 uSpark; uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform float uKeyI;
uniform vec3 uFillCol; uniform float uFillI; uniform float uSheen; uniform float uSparkle; uniform float uGrain;
uniform vec3 uCam; uniform float uTime; uniform float uMode; // 0 packed sand behind glass, 1 top surface, 2 stream
uniform float uFlow; uniform float uAlpha; uniform float uTop;
varying vec3 vW; varying vec3 vN; varying vec3 vP;
${NOISE}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float phi = atan(vP.x, vP.z);
  float rad = length(vP.xz);
  // texture coordinates that move with the sand
  vec2 tc;
  if (uMode < 0.5) tc = vec2(phi * max(rad, 0.08) * 1.0, vP.y + uFlow);            // sinks slowly down the glass
  else if (uMode < 1.5) tc = vec2(phi * 0.6, rad + uFlow) ;                        // slides towards the crater
  else tc = vec2(phi * 0.07, vP.y + uFlow);                                         // falls
  vec2 gc = uMode < 1.5 && uMode > 0.5 ? vec2(tc.x * max(rad, 0.05) / 0.6, tc.y) : tc;
  // three scales: soft clumps, grains, single glitter flakes
  float clump = fbm(gc * 9.0);
  float grains = hash21(floor(gc * 520.0)) * 0.6 + vnoise(gc * 260.0) * 0.4;
  vec2 fc = floor(gc * (uMode > 1.5 ? 330.0 : uMode > 0.5 ? 150.0 : 210.0));
  float fl = hash21(fc);
  float tw = 0.5 + 0.5 * sin(uTime * (3.0 + 9.0 * hash21(fc + 9.0)) + fl * 60.0);
  float density = uMode < 0.5 ? 0.985 : uMode < 1.5 ? 0.9 : 0.97;
  float cellN = uMode > 1.5 ? 330.0 : uMode > 0.5 ? 150.0 : 210.0;
  float roundF = 1.0 - smoothstep(0.2, 0.48, length(fract(gc * cellN) - 0.5));
  float flake = smoothstep(density, 1.0, fl) * (0.35 + 0.65 * tw) * roundF * 1.6;
  // light
  float ndl = dot(N, normalize(uKeyDir));
  float wrap = clamp(ndl * 0.85 + 0.15, 0.0, 1.0); wrap *= wrap;
  wrap = max(wrap, min(uTop * clamp(dot(N, normalize(vec3(0.1, 1.0, 0.35))), 0.0, 1.0), 1.6));
  vec3 H = normalize(normalize(uKeyDir) + V);
  float sheen = pow(max(dot(N, H), 0.0), 9.0) * uSheen;
  float tone = wrap * (0.8 + 0.25 * clump) * (1.0 - uGrain + uGrain * 2.0 * grains);
  vec3 alb = mix(uDark, uLight, clamp(tone, 0.0, 1.0));
  vec3 c = alb * (uKeyCol * uKeyI * (0.25 + 0.95 * wrap) + uFillCol * uFillI) + uKeyCol * sheen * (0.5 + clump);
  if (uMode > 1.5) {
    // the stream is a round column: darker towards its right edge, soft at the sides
    float side = dot(N, normalize(vec3(-0.55, 0.0, 0.83)));
    c *= 0.34 + 0.5 * clamp(side, 0.0, 1.0);
    c *= 0.82 + 0.36 * vnoise(vec2(phi * 3.0, (vP.y + uFlow) * 7.0));
  }
  c += uSpark * flake * uSparkle * (0.3 + 0.9 * wrap);
  gl_FragColor = vec4(c, uAlpha);
}`;

// ---------- glass: strip-light highlights, fresnel rim and a film of gold dust (premultiplied alpha)
export const GLASS_VERT = SAND_VERT;
export const GLASS_FRAG = /* glsl */ `
#define NL 4
uniform vec3 uCam; uniform vec3 uLN[NL]; uniform vec3 uLC[NL]; uniform vec3 uLCol[NL]; uniform vec3 uLP[NL]; // plane normal, centre dir, colour, (width, length, intensity)
uniform vec3 uFilm; uniform float uFilmUp; uniform float uFilmLo; uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform float uFresnel; uniform vec3 uRim;
uniform float uBack; uniform float uTime; uniform float uRimY; uniform float uLSide[NL];
uniform vec3 uSP[2]; uniform vec3 uSN[2]; uniform vec3 uSW[2]; uniform vec3 uStreakCol; // highlight streaks laid along the lower glass: point, plane normal, (width, intensity, start y) // sand rim height: the film above it is what you see once the sand has gone
varying vec3 vW; varying vec3 vN; varying vec3 vP;
${NOISE}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float facing = dot(N, V);
  vec3 Nf = facing < 0.0 ? -N : N;
  vec3 R = reflect(-V, Nf);
  float phi = atan(vP.x, vP.z);
  // streaky imperfections running along the glass, plus fine dust
  float streaks = pow(vnoise(vec2(phi * 190.0, vP.y * 0.7)), 1.6) * 1.5 * (0.35 + vnoise(vec2(phi * 40.0 + 4.0, vP.y * 1.1))) + 0.12;
  streaks *= mix(1.0, 0.35, smoothstep(-0.2, -1.9, vP.y)) * (1.0 + 2.0 * exp(-pow((vP.y + 0.28) / 0.22, 2.0)));
  float dust = hash21(floor(vec2(phi * 300.0, vP.y * 300.0)));
  vec3 spec = vec3(0.0);
  for (int i = 0; i < NL; i++) {
    float off = dot(R, uLN[i]) / uLP[i].x;
    float along = dot(R, uLC[i]);
    float band = exp(-off * off) * smoothstep(uLP[i].y, min(uLP[i].y + 0.35, 0.999), along) * smoothstep(0.0, 0.06, vP.y * uLSide[i]);
    spec += uLCol[i] * uLP[i].z * band * streaks;
  }
  if (uBack < 0.5 && vP.y < 0.0) {
    for (int i = 0; i < 2; i++) {
      float d = dot(vW - uSP[i], uSN[i]) / (uSW[i].x * (0.55 + 0.9 * abs(vP.y)));
      float taper = smoothstep(uSW[i].z + 0.12, uSW[i].z - 0.1, vP.y) * mix(1.0, 0.45, smoothstep(-0.4, -2.2, vP.y));
      // a tight bright core plus hair-fine parallel lines either side of it
      float fibres = 0.15 + 1.7 * pow(vnoise(vec2(d * 11.0 + float(i) * 17.0, vP.y * 0.8)), 2.2);
      float band = exp(-d * d * 5.0) * 0.45 * (0.5 + fibres) + exp(-d * d * 0.7) * 0.6 * fibres;
      band *= 0.75 + 0.5 * vnoise(vec2(vP.y * 5.0, float(i) * 3.0));
      spec += uStreakCol * uSW[i].y * band * taper;
    }
  }
  float fr = pow(1.0 - abs(facing), 3.0);
  vec3 rim = uRim * fr * uFresnel * (0.5 + 0.8 * vnoise(vec2(phi * 9.0, vP.y * 3.0)));
  // dust film: gold on the upper glass, faint on the lower
  float upper = smoothstep(-0.05, 0.08, vP.y);
  float cover = mix(uFilmLo, uFilmUp, upper) * (0.55 + 0.6 * fbm(vec2(phi * 2.2, vP.y * 2.4) + 3.0));
  cover *= mix(0.1, 1.3, pow(fr, 0.7));
  cover += (1.0 - upper) * 0.95 * exp(vP.y / 0.3) * smoothstep(0.35, -0.9, phi) * smoothstep(-2.4, -1.2, phi);
  float ndl = clamp(dot(Nf, normalize(uKeyDir)) * 0.6 + 0.4, 0.0, 1.0);
  vec3 film = uFilm * uKeyCol * (0.25 + 1.1 * ndl) * (0.8 + 0.4 * dust);
  float a = clamp(cover, 0.0, 0.9) * (uBack > 0.5 ? upper : 0.55);
  vec3 c = film * a + spec * (uBack > 0.5 ? 0.0 : 1.0) + rim * (uBack > 0.5 ? 0.4 : 1.0);
  gl_FragColor = vec4(c, a);
}`;

// ---------- dark collar at the neck
export const COLLAR_FRAG = /* glsl */ `
uniform vec3 uBase; uniform vec3 uAccent; uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uCam;
varying vec3 vW; varying vec3 vN; varying vec3 vP;
${NOISE}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
  vec3 H = normalize(normalize(uKeyDir) + V);
  float sp = pow(max(dot(N, H), 0.0), 60.0);
  float sp2 = pow(max(dot(N, normalize(vec3(0.75, 0.25, 0.6))), 0.0), 26.0);
  float ndl = clamp(dot(N, normalize(uKeyDir)), 0.0, 1.0);
  float gold = pow(max(dot(N, normalize(vec3(-0.2, -0.75, 0.6))), 0.0), 3.0); // sand-coloured bounce from below
  vec3 c = uBase * (0.3 + ndl) + uKeyCol * sp * 0.25 + uAccent * sp2 * 0.35 + uKeyCol * vec3(0.55, 0.36, 0.16) * gold * 0.22;
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------- grains stuck to the glass
export const SPECK_VERT = /* glsl */ `
attribute vec4 aInfo; // seed, size, upper(1)/lower(0), brightness
uniform float uResY; uniform float uRimY; uniform float uTime; uniform vec3 uCam;
varying float vA; varying float vSeed;
void main(){
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aInfo.y * uResY / -mv.z, 1.0);
  // upper-bulb grains only show once the sand level has dropped past them
  float shown = aInfo.z > 0.5 ? smoothstep(uRimY + 0.02, uRimY + 0.14, position.y) : 1.0;
  float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (1.5 + 5.0 * aInfo.x) + aInfo.x * 90.0), 2.0);
  vec3 V = normalize(uCam - position);
  float glance = 0.6 + 0.4 * sin(dot(V, vec3(37.0, 11.0, 23.0)) * 40.0 + aInfo.x * 50.0); // changes as the camera moves
  vA = shown * aInfo.w * tw * glance; vSeed = aInfo.x;
  gl_Position = projectionMatrix * mv;
}`;
export const SPECK_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uE; varying float vA; varying float vSeed;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);
  float d = (1.0 - smoothstep(0.35, 1.0, r));
  gl_FragColor = vec4(uCol * uE * d * vA, 1.0);
}`;

// ---------- star glints
export const GLINT_VERT = /* glsl */ `
attribute vec3 aPos; attribute vec3 aInfo; // size, seed, rotation
uniform float uSize; uniform float uTime; uniform vec3 uCam;
varying vec2 vUv; varying float vI; varying float vRot;
${NOISE}
void main(){
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(aPos, 1.0);
  // twinkle: slow seeded flicker, plus a sensitivity to the viewing direction so glints flare as the camera moves
  float tw = 0.62 + 0.38 * vnoise1(uTime * (0.9 + aInfo.y * 1.6) + aInfo.y * 31.0);
  tw *= 0.9 + 0.1 * sin(uTime * (7.0 + aInfo.y * 9.0) + aInfo.y * 12.0);
  vec3 V = normalize(uCam - aPos);
  float glance = 0.72 + 0.28 * sin(dot(V, vec3(13.0, 7.0, 5.0)) * 9.0 + aInfo.y * 20.0);
  vI = tw * glance;
  float s = uSize * aInfo.x * (0.85 + 0.15 * tw);
  mv.xy += position.xy * s;
  vRot = aInfo.z;
  gl_Position = projectionMatrix * mv;
}`;
export const GLINT_FRAG = /* glsl */ `
uniform vec3 uCore; uniform vec3 uRays; uniform float uE;
varying vec2 vUv; varying float vI; varying float vRot;
void main(){
  float r = length(vUv);
  float th = atan(vUv.y, vUv.x) + vRot;
  float core = exp(-r * r * 260.0) * 2.4 + exp(-r * 16.0) * 0.5;
  // 8 long thin rays and 8 shorter ones between them
  float c8 = abs(cos(th * 4.0));
  float long8 = pow(c8, 90.0) * exp(-r * 6.5);
  float c8b = abs(sin(th * 4.0));
  float short8 = pow(c8b, 60.0) * exp(-r * 9.0) * 0.6;
  float c4 = pow(abs(cos(th * 3.0 + 0.4)), 160.0) * exp(-r * 5.0) * 0.7;
  float fade = 1.0 - smoothstep(0.75, 1.0, r);
  vec3 c = uCore * core + uRays * (long8 + short8 + c4) * 1.15;
  gl_FragColor = vec4(c * uE * vI * fade, 1.0);
}`;
