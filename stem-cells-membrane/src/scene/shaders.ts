import { BUMP, NOISE } from "../engine/glsl";

// ---------- Nucleus: lumpy "blackberry" core with fine wrinkles ----------
// Geometry is displaced on the CPU at start-up (see bakeNucleus in stemCells.ts)
export const NUCLEUS_VERT = /* glsl */ `
in vec3 aObj; in vec2 aExtra;
out vec3 vObj; out vec3 vView; out vec3 vNrm; out float vCrease; out float vLump;
void main(){
  vObj = aObj; vLump = aExtra.x; vCrease = aExtra.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vView = mv.xyz;
  vNrm = normalize(normalMatrix * normal);
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
  float lod = smoothstep(70., 16., dist / uScale);
  // fine honeycomb micro-texture: dark pits separated by raised walls
  vec2 w = worley(q * 27. + uSeed);
  float cellEdge = w.y - w.x;
  float wall = 1. - smoothstep(.0, .34, cellEdge);
  float pit = smoothstep(.05, .5, cellEdge);
  vec3 G = normalize(vNrm);
  vec3 N = bumpNormal(vView, G, wall, .022 * uScale * lod);
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N, V), 0., 1.);
  float gndv = clamp(dot(G, V), 0., 1.);
  float gfres = pow(1. - gndv, 1.6);
  float crease = smoothstep(0., .16, vCrease);
  float ao = mix(.3, 1., crease) * mix(.55, 1., smoothstep(.0, .12, vLump));
  // key light from below / the side, as in the reference
  vec3 L = normalize(vec3(.35, -.75, .45));
  float lit = clamp(dot(N, L) * .5 + .5, 0., 1.);
  lit *= lit;
  float glit = clamp(dot(G, L) * .5 + .5, 0., 1.);
  float wallLight = clamp(.1 + .5 * gfres + .55 * lit + .45 * glit * glit, 0., 1.) * ao;
  vec3 wallCol = mix(uMid, uRim, wallLight);
  vec3 col = mix(uDeep, uMid, clamp((1. - pit) * .3 * ao + gfres * .3 + glit * glit * .25 * ao, 0., 1.));
  col = mix(col, wallCol, wall * mix(.5, .9, lod) * (.25 + .75 * wallLight));
  col += uRim * pow(1. - gndv, 2.5) * (.12 + 1.0 * glit * glit);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, fog * .6);
  o = vec4(col, 1.);
}
`;

// ---------- Membrane: glassy rippled shell (shape baked on the CPU) ----------
export const MEMBRANE_VERT = /* glsl */ `
in vec3 aObj;
out vec3 vObj; out vec3 vView; out vec3 vNrm;
void main(){
  vObj = aObj;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vView = mv.xyz;
  vNrm = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const MEMBRANE_FRAG = /* glsl */ `
precision highp float;
in vec3 vObj; in vec3 vView; in vec3 vNrm;
out vec4 o;
uniform float uSeed, uTime, uFogNear, uFogFar, uScale, uDepthOnly, uBack;
uniform vec3 uTint, uRim, uFog;
${NOISE}
${BUMP}
void main(){
  vec3 q = normalize(vObj);
  float dist = -vView.z;
  vec3 V = normalize(-vView);
  vec3 G = normalize(vNrm);
  if (dot(G, V) < 0.) G = -G;
  float gndv = dot(G, V);
  float edge = smoothstep(.5, .96, 1. - gndv);
  if (uDepthOnly > .5){
    if (edge < .55) discard;
    o = vec4(0.); return;
  }
  // slow ripples over the whole shell
  float h = vnoise(q * 3.6 + uSeed + uTime * .10) * .6
          + vnoise(q * 8.5 + uSeed * 2. - uTime * .08) * .4;
  vec3 N = bumpNormal(vView, G, h, .26 * uScale);
  float ndv = abs(dot(N, V));
  float fres = pow(1. - ndv, 2.2);
  float gfres = pow(1. - gndv, 2.6);
  float alpha = clamp(.03 + fres * .48 + gfres * .3 + edge * .22, 0., .88);
  vec3 L = normalize(vec3(.35, -.75, .45));
  vec3 R = reflect(-V, N);
  float spec = pow(max(dot(R, L), 0.), 22.) + .6 * pow(max(dot(R, normalize(vec3(-.5, .6, .6))), 0.), 30.);
  vec3 col = mix(uTint, uRim, clamp(fres * .9 + edge * .45, 0., 1.));
  col += uRim * spec * .5;
  alpha = clamp(alpha + spec * .35, 0., .92);
  if (uBack > .5) alpha *= .5;
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, fog * .5);
  alpha *= 1. - fog * .4;
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
  float g = smoothstep(1.5, -.1, length(p - vec2(.3, .2)));
  float n = fbm3(vec3(p * 1.3, uTime * .05));
  vec3 c = mix(uBgA, uBgB, clamp(g + (n - .5) * .4, 0., 1.));
  // light sources: upper right, and a softer one lower left
  float hot = smoothstep(.95, 0., length(p - vec2(.55, .42)));
  float hot2 = smoothstep(.8, 0., length(p - vec2(-.62, -.3)));
  c = mix(c, uBgC, clamp(hot * hot * .6 + hot2 * hot2 * .4, 0., 1.));
  o = vec4(c, 1.);
}
`;
