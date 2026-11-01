// GLSL for the "Tube Bloom" composition.
//
// Every tube is a single instanced cylinder whose centre-line is evaluated on
// the GPU: a poloidal loop around a torus with a toroidal twist. Morphing the
// torus parameters (major/minor radius, height, twist) turns a compact,
// grooved "pincushion" into a wide, flat spirograph flower whose petals weave
// over and under the petals of neighbouring flowers.

export const TUBE_VERT = /* glsl */ `
uniform float uRt;      // torus major radius
uniform float uRr;      // torus minor radius (radial)
uniform float uRz;      // torus minor radius (height)
uniform float uTwist;   // toroidal advance along one tube
uniform float uRot;     // global spin of all flowers
uniform float uPhi0;    // poloidal start angle (the open tube mouth)
uniform float uSpan;    // poloidal sweep along the tube
uniform float uTubeR;   // tube thickness
uniform float uCount;   // tubes per flower

attribute vec3 aFlower; // xy = centre, z = height bias
attribute float aTube;  // tube index inside its flower

varying vec3 vNormal;
varying vec3 vWorld;
varying float vS;
varying float vViewZ;

vec3 curve(float s) {
  float th = aTube / uCount * 6.28318530718;
  float phi = uPhi0 - s * uSpan;
  float psi = th + uTwist * s + uRot;
  float rho = uRt + uRr * cos(phi);
  return vec3(aFlower.xy + rho * vec2(cos(psi), sin(psi)), uRz * sin(phi) + aFlower.z);
}

void main() {
  float s = position.x;      // 0..1 along the tube
  float a = position.y;      // 0..2pi around the tube
  vec3 c = curve(s);
  vec3 c2 = curve(min(s + 0.002, 1.0));
  vec3 c1 = curve(max(s - 0.002, 0.0));
  vec3 T = normalize(c2 - c1);
  // reference direction: the toroidal direction is always roughly
  // perpendicular to a poloidal loop, so the frame never flips
  vec2 rel = c.xy - aFlower.xy;
  vec3 ref = normalize(vec3(-rel.y, rel.x, 0.0) + vec3(0.0, 0.0, 1e-3));
  vec3 N1 = normalize(ref - dot(ref, T) * T);
  vec3 N2 = cross(T, N1);
  vec3 n = cos(a) * N1 + sin(a) * N2;
  // slightly tapered mouth reads like a real extruded tube
  float r = uTubeR * mix(0.92, 1.0, smoothstep(0.0, 0.02, s));
  vec3 pos = c + n * r;
  vNormal = n;
  vWorld = pos;
  vS = s;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const TUBE_FRAG = /* glsl */ `
uniform vec3 uWhite;
uniform vec3 uPink;
uniform vec3 uPinkLight;
uniform vec3 uShade;     // tint of occluded (deep) tube sections
uniform float uPinkAmt;  // 0..1, how much of the tube is pink
uniform float uPinkS;    // pink extends from the mouth to this s
uniform float uRz;
uniform float uDepthScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;

varying vec3 vNormal;
varying vec3 vWorld;
varying float vS;
varying float vViewZ;

void main() {
  vec3 n = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  // looking into the open mouth of a tube: we see the inside wall
  bool back = dot(n, V) < -0.05;
  if (back) n = -n;

  // albedo: pink mouth section and pink return section, white elsewhere
  float pinkMouth = 1.0 - smoothstep(uPinkS - 0.015, uPinkS + 0.015, vS);
  float pinkTail = smoothstep(0.86, 0.9, vS);
  float stripe = smoothstep(uPinkS + 0.02, uPinkS + 0.04, vS) * (1.0 - smoothstep(uPinkS + 0.08, uPinkS + 0.1, vS));
  vec3 base = uWhite;
  base = mix(base, uPinkLight, stripe * 0.75 * uPinkAmt);
  base = mix(base, uPink, clamp(pinkMouth + pinkTail, 0.0, 1.0) * uPinkAmt);

  // soft studio lighting
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  float hemi = 0.5 + 0.5 * n.z;
  vec3 H = normalize(normalize(uLightDir) + V);
  float spec = pow(max(dot(n, H), 0.0), 40.0) * 0.18;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.12;

  // height-based occlusion: sections that dive under other tubes go grey
  float ao = mix(0.24, 1.0, smoothstep(-uRz - 0.02, uRz * 0.8, vWorld.z));
  vec3 col = base * (0.42 * hemi + 0.62 * diff) * ao;
  col = mix(col, col * uShade, (1.0 - ao) * 0.6);
  col += spec * ao + rim * ao;
  if (back) col *= 0.35;   // looking into the open mouth of a tube

  gl_FragColor = vec4(col, clamp(vViewZ * uDepthScale, 0.0, 1.0));
}
`;

export const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Depth-of-field gather (golden-angle disc) using linear depth stored in the
// colour target's alpha channel, then vignette + fine grain.
export const POST_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uRes;
uniform float uFocus;       // focus distance (normalised depth)
uniform float uAperture;    // CoC growth per unit of defocus
uniform float uMaxCoC;      // max CoC radius in fraction of image height
uniform float uSeed;
uniform vec3 uBg;
uniform float uEdgeBlur;
varying vec2 vUv;
float edgeK;

float coc(float d) {
  return clamp(abs(d - uFocus) * uAperture + edgeK, 0.0, 1.0) * uMaxCoC;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 qq = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  edgeK = uEdgeBlur * smoothstep(0.12, 0.9, length(qq));
  vec4 c0 = texture2D(tColor, vUv);
  float d0 = c0.a;
  float r0 = coc(d0);
  vec2 aspect = vec2(uRes.y / uRes.x, 1.0);
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  const int N = 56;
  float ga = 2.39996323;
  float rot = hash12(gl_FragCoord.xy) * 6.2831853;
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float rr = sqrt(fi / float(N)) * uMaxCoC;
    float th = fi * ga + rot;
    vec2 off = vec2(cos(th), sin(th)) * rr;
    vec4 cs = texture2D(tColor, vUv + off * aspect);
    float rs = coc(cs.a);
    // a sample in front may bleed over us; one behind only up to our own CoC
    float reach = cs.a < d0 ? rs : min(rs, r0);
    float w = smoothstep(rr - 0.0015, rr + 0.0015, reach);
    acc += cs.rgb * w;
    wsum += w;
  }
  vec3 col = acc / wsum;
  // vignette
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  col *= mix(1.0, 0.82, smoothstep(0.35, 1.05, length(q)));
  // grain
  col += (hash12(gl_FragCoord.xy + uSeed * 37.0) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Solid torus "body" the tubes are wrapped around at the start/end of the
// bloom. It deflates into the tube loops as the flower opens.
export const BODY_VERT = /* glsl */ `
uniform float uRt;
uniform float uRr;
uniform float uRz;
uniform float uK;       // body size factor (1 = full, 0 = gone)
uniform float uSink;
attribute vec3 aFlower;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  float phi = position.x;
  float psi = position.y;
  float rr = uRr * uK, rz = uRz * uK;
  float rho = uRt + rr * cos(phi);
  vec3 p = vec3(aFlower.xy + rho * vec2(cos(psi), sin(psi)), rz * sin(phi) + aFlower.z - uSink);
  vec3 n = normalize(vec3(cos(phi) * vec2(cos(psi), sin(psi)) * max(rz, 1e-4), sin(phi) * max(rr, 1e-4)));
  vNormal = n;
  vWorld = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const BODY_FRAG = /* glsl */ `
uniform vec3 uWhite;
uniform vec3 uPink;
uniform float uPinkAmt;
uniform float uRt;
uniform float uRz;
uniform float uDepthScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform float uTone;    // body reads slightly greyer than the tubes
varying vec3 vNormal;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vec3 n = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  float hemi = 0.5 + 0.5 * n.z;
  float ao = mix(0.45, 1.0, smoothstep(-uRz, uRz * 0.6, vWorld.z));
  vec3 col = uWhite * uTone * (0.45 * hemi + 0.55 * diff) * ao;
  gl_FragColor = vec4(col, clamp(vViewZ * uDepthScale, 0.0, 1.0));
}
`;
