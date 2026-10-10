import { NOISE_GLSL } from "../common/glsl";

// Injected into MeshStandardMaterial (metalness 1): analytic fin bend + normals,
// leading-edge highlight band, and view depth written to alpha for the DoF pass.
export const FIN_VERTEX_PARS = /* glsl */ `
uniform float uAmp;
uniform float uAmp2;
uniform float uK;
uniform float uPhi;
uniform float uPhi2;
uniform float uDelta;
uniform float uCurve;
varying vec2 vFinUv;
varying float vFinId;
`;

export const FIN_BEGINNORMAL = /* glsl */ `
float finId = float(gl_InstanceID);
float fy = position.y;
float fu = position.x;
float a1 = fy * uK + uPhi + finId * uDelta;
float a2 = 2.0 * fy * uK + uPhi2 + finId * uDelta * 1.37;
float fw = uAmp * sin(a1) + uAmp2 * sin(a2);
float fdw = uAmp * uK * cos(a1) + uAmp2 * 2.0 * uK * cos(a2);
// P(u, y) = (u, y, w(y) + c u^2)  ->  N = (-2cu, -w'(y), 1)
vec3 objectNormal = normalize(vec3(-2.0 * uCurve * fu, -fdw, 1.0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(1.0, 0.0, 0.0);
#endif
vFinUv = uv;
vFinId = finId;
`;

export const FIN_BEGIN_VERTEX = /* glsl */ `
vec3 transformed = vec3(fu, fy, fw + uCurve * fu * fu);
`;

export const FIN_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uHighlight;
uniform float uEdgeStrength;
uniform float uFinWidth;
uniform float uPhase;
varying vec2 vFinUv;
varying float vFinId;
`;

export const FIN_EMISSIVE = /* glsl */ `
{
  vec3 vdir = normalize(vViewPosition);
  float fres = pow(1.0 - abs(dot(normal, vdir)), 3.0);
  // uv.x = 0 is the fin's near (leading) edge; uv.x = 1 tucks in behind the next fin
  float dLead = vFinUv.x * uFinWidth;
  float dTrail = (1.0 - vFinUv.x) * uFinWidth;
  float band = 1.0 - smoothstep(0.0, 0.028, dLead);
  float bandT = (1.0 - smoothstep(0.0, 0.02, dTrail)) * 0.18;
  // bright stretches drift along each edge (whole cycles per loop)
  float y = vFinUv.y;
  float tp = uPhase * 6.28318530718;
  float travel = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(y * 5.0 - tp + vFinId * 0.45), 2.0);
  totalEmissiveRadiance += uHighlight * uEdgeStrength * (band + bandT) * travel * (0.35 + 1.4 * fres);
}
`;

export const FIN_DEPTH_OUT = /* glsl */ `
#include <dithering_fragment>
// cheap contact shadow: the part of each fin tucked behind its neighbour falls to black
gl_FragColor.rgb *= 1.0 - 0.97 * smoothstep(0.3, 0.92, vFinUv.x);
gl_FragColor.a = clamp(vViewPosition.z / 40.0, 0.0, 1.0);
`;

// Gather depth of field. Alpha of the source holds view depth / 40.
export const DOF_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uRes;
uniform float uFocus;      // focus distance (world units)
uniform float uCocScale;   // CoC (fraction of frame height) per unit of |1/f - 1/d|
uniform float uMaxCoc;     // max CoC radius, fraction of frame height
const int N = 64;
float cocPx(float depth01) {
  float d = max(depth01 * 40.0, 0.01);
  return min(abs(1.0 / uFocus - 1.0 / d) * uCocScale, uMaxCoc) * uRes.y;
}
void main() {
  vec4 c0 = texture(uSrc, vUv);
  float coc0 = cocPx(c0.a);
  float maxPx = uMaxCoc * uRes.y;
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  // fixed golden-angle spiral: identical pattern every frame
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float r = sqrt(fi / float(N)) * maxPx;
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = texture(uSrc, vUv + off / uRes);
    float cs = cocPx(s.a);
    float w = clamp(cs - r + 1.0, 0.0, 1.0);
    // a sample behind the centre may only spread as far as the centre's own CoC
    if (s.a > c0.a) w = min(w, clamp(coc0 - r + 1.0, 0.0, 1.0));
    acc += s.rgb * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, c0.a);
}
`;

export const FINS_FINAL_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uGrain;
uniform vec2 uRes;
uniform int uFrameMod;
${NOISE_GLSL}
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  c += texture(uBloom, vUv).rgb * uBloomStrength;
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  c *= 1.0 - 0.45 * smoothstep(0.35, 1.05, length(q));
  vec3 over = max(c - 0.75, 0.0);
  c = min(c, 0.75) + over / (1.0 + over * 2.0);
  vec3 s = linearToSrgb(c);
  s = grainAndDither(s, uGrain, 0.03, uFrameMod);
  outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;
