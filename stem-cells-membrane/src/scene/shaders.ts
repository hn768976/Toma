import { BUMP, NOISE } from "../engine/glsl";

// ---------- Nucleus: lumpy "blackberry" core with fine wrinkles ----------
export const NUCLEUS_VERT = /* glsl */ `
uniform float uSeed;
out vec3 vObj; out vec3 vView; out vec3 vNrm; out float vCrease; out float vLump;
${NOISE}
vec2 lump(vec3 d){
  vec2 w = worley(d * 2.5 + uSeed);
  float h = 1. - w.x * w.x * 1.35;
  float big = vnoise(d * 1.3 + uSeed * 1.7);
  return vec2(h * .115 + big * .09, w.y - w.x);
}
void main(){
  vec3 d = normalize(position);
  vec3 t1 = normalize(cross(d, abs(d.y) < .9 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 t2 = cross(d, t1);
  const float e = .035;
  vec3 d1 = normalize(d + t1 * e), d2 = normalize(d + t2 * e);
  vec2 l0 = lump(d);
  vec3 p0 = d * (.85 + l0.x);
  vec3 p1 = d1 * (.85 + lump(d1).x);
  vec3 p2 = d2 * (.85 + lump(d2).x);
  vec3 n = normalize(cross(p1 - p0, p2 - p0));
  vObj = d; vCrease = l0.y; vLump = l0.x;
  vec4 mv = modelViewMatrix * vec4(p0, 1.);
  vView = mv.xyz;
  vNrm = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * mv;
}
`;

export const NUCLEUS_FRAG = /* glsl */ `
precision highp float;
in vec3 vObj; in vec3 vView; in vec3 vNrm; in float vCrease; in float vLump;
out vec4 o;
uniform float uSeed, uFogNear, uFogFar, uScale;
uniform vec3 uDeep, uMid, uRim, uFog;
${NOISE}
${BUMP}
void main(){
  vec3 q = normalize(vObj);
  float dist = -vView.z;
  // fine reticulated wrinkles, faded with distance to avoid shimmer
  float lod = smoothstep(46., 12., dist / uScale);
  float n1 = 1. - abs(2. * vnoise(q * 17. + uSeed) - 1.);
  float n2 = 1. - abs(2. * vnoise(q * 36. + uSeed * 2.) - 1.);
  float fine = mix(n1, n1 * .55 + n2 * .45, lod);
  float ridge = smoothstep(.62, .98, fine);
  vec3 N = bumpNormal(vView, normalize(vNrm), fine, .05 * uScale * (.4 + .6 * lod));
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N, V), 0., 1.);
  float gndv = clamp(dot(normalize(vNrm), V), 0., 1.);
  float fres = pow(1. - ndv, 2.0);
  float gfres = pow(1. - gndv, 1.5);
  float crease = smoothstep(0., .2, vCrease);
  float ao = crease * smoothstep(.0, .14, vLump);
  vec3 L = normalize(vec3(-.3, .8, .5));
  float lit = clamp(dot(N, L) * .5 + .5, 0., 1.);
  vec3 col = mix(uDeep, uMid, clamp(ao * (.12 + .5 * gfres + .35 * lit * lit), 0., 1.));
  col = mix(col, uRim, clamp(ridge * ao * (.22 + .8 * gfres + .35 * lit * lit), 0., 1.));
  col += uRim * (fres * (.3 + .5 * gfres) + pow(1. - gndv, 2.6) * .95);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, fog * .78);
  o = vec4(col, 1.);
}
`;

// ---------- Membrane: thin glassy bubble with a wavy rim ----------
export const MEMBRANE_VERT = /* glsl */ `
uniform float uSeed, uTime;
out vec3 vObj; out vec3 vView; out vec3 vNrm;
${NOISE}
float wob(vec3 d){
  return vnoise(d * 1.9 + uSeed + uTime * .10) * .085
       + vnoise(d * 5.5 + uSeed * 3. - uTime * .07) * .026
       + vnoise(d * 12. + uSeed * 5. + uTime * .09) * .011;
}
void main(){
  vec3 d = normalize(position);
  vec3 t1 = normalize(cross(d, abs(d.y) < .9 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 t2 = cross(d, t1);
  const float e = .06;
  vec3 d1 = normalize(d + t1 * e), d2 = normalize(d + t2 * e);
  vec3 p0 = d * (.95 + wob(d));
  vec3 p1 = d1 * (.95 + wob(d1));
  vec3 p2 = d2 * (.95 + wob(d2));
  vObj = d;
  vec4 mv = modelViewMatrix * vec4(p0, 1.);
  vView = mv.xyz;
  vNrm = normalize(normalMatrix * normalize(cross(p1 - p0, p2 - p0)));
  gl_Position = projectionMatrix * mv;
}
`;

export const MEMBRANE_FRAG = /* glsl */ `
precision highp float;
in vec3 vObj; in vec3 vView; in vec3 vNrm;
out vec4 o;
uniform float uSeed, uTime, uFogNear, uFogFar, uScale, uDepthOnly;
uniform vec3 uTint, uRim, uFog;
${NOISE}
${BUMP}
void main(){
  vec3 q = normalize(vObj);
  float dist = -vView.z;
  float h = vnoise(q * 5. + uSeed + uTime * .12) * .7
          + vnoise(q * 12. + uSeed * 2. - uTime * .09) * .3;
  vec3 G = normalize(vNrm);
  vec3 N = bumpNormal(vView, G, h, .10 * uScale);
  vec3 V = normalize(-vView);
  float ndv = abs(dot(N, V));
  float gndv = abs(dot(G, V));
  float fres = pow(1. - gndv, 2.6);
  // thin bright contour right at the silhouette + faint inner fold lines
  float edge = smoothstep(.74, .97, 1. - gndv);
  float folds = smoothstep(.66, .93, 1. - ndv) * (1. - edge) * smoothstep(.35, .75, 1. - gndv) * .6;
  float alpha = clamp(.05 + fres * .5 + edge * .6 + folds, 0., .95);
  if (uDepthOnly > .5){
    if (alpha < .34) discard;
    o = vec4(0.); return;
  }
  vec3 L = normalize(vec3(-.35, .75, .55));
  float spec = pow(max(dot(reflect(-V, N), L), 0.), 60.) * smoothstep(.3, .8, 1. - gndv);
  vec3 col = mix(uTint, uRim, clamp(fres + edge * .8 + folds, 0., 1.));
  col += vec3(1.) * spec * .4;
  alpha = clamp(alpha + spec * .35, 0., .97);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, fog * .6);
  alpha *= 1. - fog * .45;
  o = vec4(col, alpha);
}
`;

// ---------- Backdrop: luminous liquid gradient ----------
export const BG_VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }
`;
export const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec3 uBgA, uBgB, uBgC;
uniform float uTime, uAspect;
uniform vec2 uShift;
${NOISE}
void main(){
  vec2 p = (vUv - .5) * vec2(uAspect, 1.) + uShift;
  float g = smoothstep(1.35, -.1, length(p - vec2(.2, .25)));
  float n = fbm3(vec3(p * 1.3, uTime * .05));
  vec3 c = mix(uBgA, uBgB, clamp(g * .9 + (n - .5) * .5, 0., 1.));
  float hot = smoothstep(.75, 0., length(p - vec2(.45, .48)));
  c = mix(c, uBgC, hot * hot * .55);
  o = vec4(c, 1.);
}
`;
