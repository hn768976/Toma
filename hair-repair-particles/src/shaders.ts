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

// Cracked, weathered cuticle: irregular 3D Voronoi plates.
// Returns (plate lift, distance to the nearest crack, plate id).
vec3 cuticle(vec2 uv, vec3 p){
  vec3 q = p * 8.5;
  q += 1.1 * (vec3(vnoise(p * 4.1), vnoise(p * 4.1 + 5.1), vnoise(p * 4.1 + 9.7)) - 0.5);
  vec3 ip = floor(q); vec3 fp = fract(q);
  float f1 = 9.0; float f2 = 9.0; float id = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 c = ip + g;
    vec3 o = vec3(hash31(c), hash31(c + 17.3), hash31(c + 41.7));
    vec3 r = g + o - fp;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = hash31(c + 7.7); }
    else if (d < f2) { f2 = d; }
  }
  float edge = sqrt(f2) - sqrt(f1);
  float lift = (0.25 + 0.75 * id) * smoothstep(0.0, 0.22, edge);
  return vec3(lift, edge, id);
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
  float jag = 0.003 * (vnoise(vec3(uv.y * 40.0, 1.0, 2.0)) - 0.5);
  vMask = smoothstep(uFront - 0.0012, uFront + 0.0012, uv.x + jag);
  vec3 c = cuticle(uv, position);
  float rough = fbm(position * 6.0);
  float amp = 0.045 * aRadius + 0.014;
  float disp = vMask * amp * (0.2 + 1.1 * c.x + 1.3 * rough + 0.5 * fbm(position * 19.0)) * smoothstep(0.0, 0.25, aRadius);
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
uniform float uHaze;
uniform vec3 uHazeColor;
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
  float d = clamp(dot(N, L) * 0.62 + 0.38, 0.0, 1.0);
  float streak = vnoise(vec3(vUv.y * 90.0, vUv.x * 6.0, 4.0)) - 0.5;
  vec3 healthy = mix(uHealthyShadow, uHealthy, smoothstep(0.1, 0.9, d));
  healthy = mix(healthy, uHealthyHighlight, 0.3 * pow(d, 9.0));
  healthy *= 1.0 + 0.08 * streak;
  vec3 Hh = normalize(L + V);
  // narrow lengthwise specular streak of a sealed cuticle
  healthy += uHealthyHighlight * 0.5 * pow(d, 70.0);
  healthy += uHealthyHighlight * 0.45 * pow(max(dot(N, Hh), 0.0), 90.0);
  float ndv = max(dot(N, V), 0.0);
  healthy += uHealthyHighlight * 0.22 * pow(1.0 - ndv, 3.0) * max(dot(N, L2) + 0.4, 0.0);

  // ---- damaged strand: lifted, cracked, dusty cuticle ----
  vec3 Nf = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  vec3 Nd = normalize(mix(N, Nf, 0.6));
  vec3 c = cuticle(vUv, vObj);
  float n = fbm(vObj * 9.0);
  float grain = vnoise(vObj * 38.0);
  float dust = fbm(vObj * 1.7 + 3.0);
  vec3 damaged = mix(uDamagedDark, uDamagedMid, clamp(0.2 + 0.45 * c.z + 0.7 * (n - 0.5) + 0.5 * (dust - 0.4), 0.0, 1.0));
  damaged = mix(damaged, uDamagedLight, clamp(0.3 * pow(c.x, 2.0) + 0.4 * smoothstep(0.5, 0.85, dust) * (0.4 + 0.6 * grain), 0.0, 1.0));
  damaged *= 0.5 + 0.5 * smoothstep(0.0, 0.1, c.y);
  float dd = clamp(dot(Nd, L) * 0.75 + 0.25, 0.0, 1.0);
  damaged *= 0.1 + 0.95 * dd;
  damaged *= 0.85 + 0.3 * grain;
  damaged *= 0.55 + 0.9 * fbm(vObj * 26.0);
  damaged *= 0.8 + 0.4 * vnoise(vObj * 70.0);

  vec3 col = mix(healthy, damaged, vMask);
  // atmospheric haze as the camera pulls away
  col = mix(col, uHazeColor, uHaze);

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
  // glassy bead: deep body, glowing core, bright rim
  vec3 col = uColor * (0.3 + 0.5 * d);
  col += mix(uColor, uRim, 0.5) * 0.9 * pow(ndv, 4.0);
  col += uRim * 1.0 * pow(1.0 - ndv, 1.8);
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
  vec2 p = vUv - vec2(0.56, 0.7) - uShift;
  p.x *= uAspect * 0.62;
  float r = length(p);
  float g = smoothstep(0.92, 0.0, r);
  vec3 col = mix(uEdge, uCenter, g * g);
  // corner vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.3 * smoothstep(0.4, 1.0, length(q * vec2(1.15, 1.25)));
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0 * 1.5; // dither against banding
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
