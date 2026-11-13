const NOISE = /* glsl */ `
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                 mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                 mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 3.1) + 0.15 * vnoise(p * 4.3 + 7.7); }

const float ALONG = 92.0;   // cuticle scales along the strand
const float AROUND = 27.0;  // cuticle scales around the strand

// Lifted, broken cuticle scales. Returns (lift, distance to scale edge, id).
vec3 cuticle(vec2 uv, vec3 p){
  vec2 q = vec2(uv.x * ALONG, uv.y * AROUND);
  q.x += 1.5 * (vnoise(p * 1.1) - 0.5) + 0.5 * (vnoise(p * 4.0 + 5.0) - 0.5);
  float row = floor(q.x);
  q.y += hash11(row + 3.0) * AROUND + 1.4 * (vnoise(p * 1.4 + 11.0) - 0.5) + 0.4 * (vnoise(p * 5.0 + 2.0) - 0.5);
  vec2 f = fract(q);
  vec2 id = vec2(row, mod(floor(q.y), AROUND));
  float h = hash21(id + 0.5);
  float lift = (0.2 + 0.8 * h) * smoothstep(0.0, 1.0, f.x);
  float edge = min(min(f.x, 1.0 - f.x) * 1.3, min(f.y, 1.0 - f.y));
  return vec3(lift, edge, h);
}
`;

export const hairVertex = /* glsl */ `
attribute float aRadius;
uniform float uFront;
varying vec2 vUv;
varying vec3 vObj;
varying vec3 vViewPos;
varying vec3 vNormal;
varying float vMask;
${NOISE}
void main(){
  vUv = uv;
  vObj = position;
  float jag = 0.006 * (vnoise(vec3(uv.y * 40.0, 1.0, 2.0)) - 0.5);
  vMask = smoothstep(uFront - 0.0012, uFront + 0.0012, uv.x + jag);
  vec3 c = cuticle(uv, position);
  float rough = fbm(position * 6.0);
  float amp = 0.065 * aRadius + 0.018;
  float disp = vMask * amp * (0.2 + 1.2 * c.x + 1.5 * rough) * smoothstep(0.0, 0.25, aRadius);
  vec3 p = position + normal * disp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const hairFragment = /* glsl */ `
precision highp float;
uniform float uFront;
uniform vec3 uDamagedDark, uDamagedMid, uDamagedLight;
uniform vec3 uHealthy, uHealthyHighlight, uHealthyShadow, uFrontGlow;
uniform float uGlow;
varying vec2 vUv;
varying vec3 vObj;
varying vec3 vViewPos;
varying vec3 vNormal;
varying float vMask;
${NOISE}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(vec3(-0.75, 0.4, 0.52));
  vec3 L2 = normalize(vec3(0.8, 0.2, 0.3));

  // ---- healthy, sealed strand: glossy with a broad lengthwise highlight ----
  float d = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);
  float streak = vnoise(vec3(vUv.y * 90.0, vUv.x * 6.0, 4.0)) - 0.5;
  vec3 healthy = mix(uHealthyShadow, uHealthy, smoothstep(0.15, 0.95, d));
  healthy = mix(healthy, uHealthyHighlight, 0.6 * pow(d, 10.0));
  healthy *= 1.0 + 0.08 * streak;
  vec3 Hh = normalize(L + V);
  healthy += uHealthyHighlight * 0.75 * pow(max(dot(N, Hh), 0.0), 90.0);
  float ndv = max(dot(N, V), 0.0);
  healthy += uHealthyHighlight * 0.22 * pow(1.0 - ndv, 3.0) * max(dot(N, L2) + 0.4, 0.0);

  // ---- damaged strand: lifted, cracked, dusty cuticle ----
  vec3 Nf = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  vec3 Nd = normalize(mix(N, Nf, 0.6));
  vec3 c = cuticle(vUv, vObj);
  float n = fbm(vObj * 9.0);
  float grain = vnoise(vObj * 38.0);
  vec3 damaged = mix(uDamagedDark, uDamagedMid, clamp(0.25 + 0.5 * c.z + 0.6 * (n - 0.5), 0.0, 1.0));
  damaged = mix(damaged, uDamagedLight, 0.5 * pow(c.x, 2.0) + 0.1 * smoothstep(0.55, 0.9, grain));
  damaged *= 0.45 + 0.55 * smoothstep(0.0, 0.16, c.y);
  float dd = clamp(dot(Nd, L) * 0.75 + 0.25, 0.0, 1.0);
  damaged *= 0.2 + 1.05 * dd;
  damaged *= 0.85 + 0.3 * grain;
  damaged *= 0.65 + 0.7 * fbm(vObj * 23.0);

  vec3 col = mix(healthy, damaged, vMask);

  // hot seam where the molecules are sealing the cuticle
  float seam = exp(-abs(vUv.x - uFront) * 420.0);
  col += uFrontGlow * uGlow * (0.05 * seam);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const beadVertex = /* glsl */ `
attribute vec3 aOffset;
attribute float aScale;
varying vec3 vNormal;
varying vec3 vViewPos;
void main(){
  vec4 mv = modelViewMatrix * vec4(position * aScale + aOffset, 1.0);
  vViewPos = mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const beadFragment = /* glsl */ `
precision highp float;
uniform vec3 uColor, uRim;
varying vec3 vNormal;
varying vec3 vViewPos;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
  float ndv = max(dot(N, V), 0.0);
  float d = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  // translucent amber bead: glowing core gradient, bright rim, sharp glint
  vec3 col = uColor * (0.55 + 0.6 * d);
  col += uRim * 0.3 * pow(ndv, 3.0);
  col += uRim * 0.9 * pow(1.0 - ndv, 2.0);
  col += uRim * 0.25 * pow(max(dot(N, -L), 0.0), 2.0);
  col += vec3(1.0) * pow(max(dot(N, normalize(L + V)), 0.0), 70.0);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

export const backgroundFragment = /* glsl */ `
precision highp float;
uniform vec3 uCenter, uEdge;
uniform float uAspect;
uniform vec2 uShift;
varying vec2 vUv;
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 p = vUv - vec2(0.56, 0.62) - uShift;
  p.x *= uAspect * 0.62;
  float r = length(p);
  float g = smoothstep(0.85, 0.0, r);
  vec3 col = mix(uEdge, uCenter, g * g);
  // corner vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.42 * smoothstep(0.35, 0.95, length(q * vec2(1.15, 1.25)));
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0 * 1.5; // dither against banding
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
