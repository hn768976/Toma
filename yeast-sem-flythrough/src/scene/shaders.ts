import { BUMP, NOISE } from "../engine/glsl";

// ---------- Yeast cell: egg-shaped body, bud scars, SEM-style shading ----------
export const CELL_VERT = /* glsl */ `
in float aSeed; in vec3 aShape; in vec4 aScar1; in vec4 aScar2;
out vec3 vObj; out vec3 vView; out vec3 vNrm; out float vSeed; out float vSize;
out vec4 vScar1; out vec4 vScar2;
${NOISE}
float scarCoarse(vec3 d, vec4 sc){
  if (sc.w <= 0.) return 0.;
  float x = acos(clamp(dot(d, sc.xyz), -1., 1.)) / sc.w;
  float t = (x - 1.) / .3;
  return .028 * exp(-t * t) - .022 * (1. - smoothstep(.7, 1.05, x));
}
vec3 shape(vec3 d){
  float r = .88 + vnoise(d * 1.5 + aSeed) * .17 + vnoise(d * 3.3 + aSeed * 2.1) * .05;
  r += scarCoarse(d, aScar1) + scarCoarse(d, aScar2);
  vec3 p = d * r * aShape;
  p.xz *= 1. + .13 * d.y; // slightly egg-shaped
  return p;
}
void main(){
  vec3 d = normalize(position);
  vec3 t1 = normalize(cross(d, abs(d.y) < .9 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 t2 = cross(d, t1);
  const float e = .05;
  vec3 p0 = shape(d);
  vec3 p1 = shape(normalize(d + t1 * e));
  vec3 p2 = shape(normalize(d + t2 * e));
  vec3 n = normalize(cross(p1 - p0, p2 - p0));
  mat4 mv = modelViewMatrix * instanceMatrix;
  vec4 v = mv * vec4(p0, 1.);
  vObj = d; vView = v.xyz; vSeed = aSeed;
  vSize = length(instanceMatrix[0].xyz);
  vNrm = normalize(mat3(mv) * n); // instance matrices are rotation + uniform scale
  vScar1 = aScar1; vScar2 = aScar2;
  gl_Position = projectionMatrix * v;
}
`;

export const CELL_FRAG = /* glsl */ `
precision highp float;
in vec3 vObj; in vec3 vView; in vec3 vNrm; in float vSeed; in float vSize;
in vec4 vScar1; in vec4 vScar2;
out vec4 o;
uniform vec3 uDark, uMid, uRim, uFog;
uniform float uFogNear, uFogFar;
${NOISE}
${BUMP}
float scar(vec3 q, vec4 sc, float seed){
  if (sc.w <= 0.) return 0.;
  float x = acos(clamp(dot(q, sc.xyz), -1., 1.)) / sc.w;
  if (x > 1.7) return 0.;
  x += (vnoise(q * 6. + seed) - .5) * .22;
  float t = (x - 1.) / .12;
  float rim = exp(-t * t);
  float inside = 1. - smoothstep(.85, 1.05, x);
  float rings = .5 + .5 * cos(x * 3.14159 * 5.);
  float dimple = exp(-(x * x) / .05);
  return rim + inside * (rings * .55 - .45) + dimple * .35;
}
void main(){
  vec3 q = normalize(vObj);
  float dist = -vView.z;
  float lod = smoothstep(60., 14., dist / vSize);
  // meandering contour-like wrinkles: thin ridges along noise iso-lines
  float f = fbm3(q * 2.6 + vSeed);
  float lines = pow(1. - abs(2. * fract(f * 3.) - 1.), 5.);
  float f2 = fbm3(q * 6.5 + vSeed * 1.7);
  float lines2 = pow(1. - abs(2. * f2 - 1.), 6.);
  float grain = vnoise(q * 38. + vSeed) * .6 + vnoise(q * 80. + vSeed) * .4;
  float sc = scar(q, vScar1, vSeed) + scar(q, vScar2, vSeed + 9.);
  float h = sc * .036 + (lines * .010 + lines2 * .007 + grain * .006) * lod;
  vec3 G = normalize(vNrm);
  vec3 N = bumpNormal(vView, G, h, vSize);
  vec3 V = normalize(-vView);
  float e = 1. - clamp(dot(N, V), 0., 1.);
  float ge = 1. - clamp(dot(G, V), 0., 1.);
  // secondary-electron look: brightness follows surface tilt away from the viewer
  float I = pow(e, 1.55);
  vec3 col = mix(uDark, uMid, smoothstep(0., .55, I));
  col = mix(col, uRim, smoothstep(.3, 1., I) * .95);
  col += uRim * pow(ge, 4.) * .55;
  col += uRim * (lines * .10 + lines2 * .07) * lod * (.35 + ge);
  col *= .88 + .24 * grain;
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, fog * .55);
  o = vec4(col, 1.);
}
`;

export const BG_VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }
`;
export const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 uBgA, uBgB;
void main(){
  vec2 p = vUv - .5;
  o = vec4(mix(uBgB, uBgA, smoothstep(0., .9, length(p * vec2(1.5, 1.)))), 1.);
}
`;
