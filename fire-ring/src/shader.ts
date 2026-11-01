/**
 * Fire-ring explosion, viewed from directly above.
 *
 * Pure WebGL 2 fragment shader. Each pixel raymarches (34 steps) through a
 * torus whose surface is displaced by pyroclastic simplex fBm in a frame
 * normalised by the ring radius, so billows grow as the blast expands.
 * Each step takes one self-shadow tap toward the key light and is coloured
 * by a temperature ramp that cools patchily over time (incandescent ->
 * orange -> smoke), then the smoke thins and dissipates to nothing.
 *
 * All animation curves are passed in as uniforms evaluated on the CPU
 * from keyframes traced off the reference (see timeline.ts).
 */
export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;     // seconds
uniform float uR;        // outer ring radius (in frame heights)
uniform float uRh;       // hole radius (in frame heights)
uniform float uHeat;     // 0..1 incandescence
uniform float uSmoke;    // 0..1 smoke presence
uniform float uThin;     // 0..1 how much the smoke breaks up
uniform float uSpin;     // ring rotation (radians)
uniform float uWarp;     // turbulence amount
uniform vec2  uCenter;   // ring centre (frame-height units, origin = centre)
uniform vec3  uBg;       // background colour
uniform vec3  uBgGlow;   // background colour near the ring
uniform vec3  uE0;       // emission ramp: coolest .. hottest
uniform vec3  uE1;
uniform vec3  uE2;
uniform vec3  uE3;
uniform vec3  uSmokeCol; // lit smoke albedo
uniform vec3  uSmokeAmb; // smoke ambient / shadow colour

// --- Ashima simplex noise 3D (MIT) ---------------------------------------
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// -------------------------------------------------------------------------

float fbm3(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<3;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; }
  return s;
}
// Pyroclastic fBm: sum of |noise| gives rounded billows split by creases.
float pyro(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<5;i++){ s+=a*abs(snoise(p)); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; }
  return s;
}

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// Ring (torus) geometry for this frame.
float gRm, gA, gAmp, gLobe;

// Signed, normalised distance to the billowing torus surface (<0 inside)
// and the billow value at that point.
vec2 volume(vec3 q){
  float rho = length(q.xy);
  float sd = (length(vec2(rho - gRm*(1.0 + gLobe), q.z * 1.25)) - gA*(1.0 + 0.8*gLobe)) / gA;
  vec3 n = q / max(uR, 0.05);
  n.xy = rot(uSpin + 0.6*n.z) * n.xy;
  float b = pyro(vec3(n.xy*2.3, n.z*2.3 + uTime*0.3));
  return vec2(sd - gAmp*(b - 0.28), b);
}

vec3 emissionRamp(float T){
  T = clamp(T, 0.0, 1.0);
  vec3 c = mix(vec3(0.0), uE0, smoothstep(0.0, 0.25, T));
  c = mix(c, uE1, smoothstep(0.2, 0.5, T));
  c = mix(c, uE2, smoothstep(0.45, 0.78, T));
  c = mix(c, uE3, smoothstep(0.72, 1.0, T));
  return c;
}

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5*uRes) / uRes.y;   // y up, frame height = 1
  vec2 q2 = p - uCenter;
  float r = length(q2);

  // Torus that spans hole radius .. outer radius.
  gRm = 0.5*(uR + uRh);
  gA = max(0.5*(uR - uRh), 0.01);
  gAmp = 0.75 + 1.1*uWarp*4.0;

  // Background with a faint cool vignette and warm bounce near the blast.
  vec3 bg = uBg * (1.0 - 0.35*smoothstep(0.35, 1.1, length(p*vec2(0.8,1.0))));
  float glowFall = exp(-max(r - uR*0.8, 0.0) * 3.2);
  bg += uBgGlow * uHeat * glowFall * smoothstep(0.0, 0.25, uR);

  vec3 col = vec3(0.0);
  float trans = 1.0;
  gLobe = 0.0;
  float reach = gA * (1.0 + 0.55*gAmp) + gRm*0.2 + 0.01;
  if (abs(r - gRm) < reach) {
    // Low-frequency patches that cool at different times.
    vec2 un = rot(uSpin) * (q2 / max(uR, 0.05));
    float patchN = clamp(0.5 + 0.9*fbm3(vec3(un*1.2 + 4.0, uTime*0.1 + 3.0)), 0.0, 1.0);
    float cool = 1.0 - smoothstep(0.0, 0.6, uHeat);
    float th = 1.1 - 1.5*uHeat;
    // Large irregular lobes so the ring is not a perfect circle.
    gLobe = 0.16*fbm3(vec3(un*0.9 + 7.0, uTime*0.12));

    const int STEPS = 34;
    float zTop = gA * (1.0 + 0.5*gAmp) / 1.25;
    float ds = 2.0*zTop / float(STEPS);
    // Interleaved gradient noise: low-discrepancy jitter, reads as fine grain.
    float jitter = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715))));
    float sigma = 11.0 / max(gA, 0.05);
    vec3 L = normalize(vec3(-0.55, 0.6, 0.75));
    for (int i = 0; i < STEPS; i++) {
      float z = zTop - (float(i) + jitter) * ds;
      vec3 q = vec3(q2, z);
      vec2 v = volume(q);
      float dens = smoothstep(0.07, -0.2, v.x);
      if (dens < 0.003) continue;
      // Thin out into wisps as it cools; dissipate with uSmoke.
      dens = max(0.0, dens - uThin*(1.15 - v.y)*1.2);
      float smokeA = mix(1.0, uSmoke, cool);
      dens *= smokeA;
      if (dens < 0.003) continue;
      // One shadow tap toward the light.
      float dl = smoothstep(0.07, -0.2, volume(q + L * gA * 0.25).x);
      float lit = clamp(1.0 - 0.75*dl + 0.35*(1.0 - dens), 0.0, 1.0);

      // Temperature: hottest deep in the core, patchy cooling.
      float depth = clamp(-v.x, 0.0, 1.0);
      float hot = smoothstep(th - 0.2, th + 0.2, 0.75*patchN + 0.8*(v.y - 0.4) + 0.12);
      float T = hot * (0.3 + 0.7*uHeat) * (0.74 + 0.35*depth + 0.3*v.y) * (0.8 + 0.25*lit);
      vec3 emit = emissionRamp(T) * (0.42 + 0.68*lit);
      float emitMix = smoothstep(0.1, 0.5, T);
      vec3 smoke = mix(uSmokeAmb, uSmokeCol, lit) * (0.7 + 0.5*v.y);
      vec3 c = mix(smoke, emit, emitMix);

      float a = 1.0 - exp(-dens * sigma * ds * mix(0.4, 1.0, smoothstep(0.0, 0.5, uHeat)));
      col += trans * a * c;
      trans *= 1.0 - a;
      if (trans < 0.02) break;
    }
    // Fine glowing dust in the fire.
    float grain = hash12(floor(frag / (uRes.y/1080.0)) + 17.0);
    col *= 0.96 + 0.08*grain;
  }
  col += trans * bg;
  // Lens vignette.
  col *= 1.0 - 0.25*smoothstep(0.45, 1.15, length(p*vec2(0.85, 1.0)));
  // Gentle filmic shoulder so incandescence rolls off to cream, not clip.
  col = col / (1.0 + 0.12*max(col - 0.8, 0.0));
  col = pow(max(col, 0.0), vec3(1.0/1.0));
  // Dither to avoid banding in the dark glow gradients.
  col += (hash12(frag + 41.0) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
