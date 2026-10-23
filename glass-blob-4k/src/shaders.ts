// Ashima / Stefan Gustavson 3D simplex noise (MIT).
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
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
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

export const blobVertex = /* glsl */ `
${SIMPLEX}
uniform float uPhase; // 0..2pi over the clip, so every term loops seamlessly
uniform float uRidge;
uniform vec3 uAxis;
uniform vec3 uSweep;
uniform vec3 uFlow;
varying vec3 vNw;
varying vec3 vPw;
varying float vLayer;

// Radial displacement of the unit sphere at direction p.
// Returns x = displacement, y = layer coordinate (for the film shader).
vec2 disp(vec3 p){
  // Soft "liquid" bulging that is always present.
  float bulge = 0.065*snoise(p*0.8 + uFlow);

  // Stacked glass sheets: slices along uAxis, each slice pushed out by a
  // different amount around the axis, giving the folded shingle ridges.
  float h = dot(p, uAxis);
  vec3 q = p - h*uAxis;
  float ql = length(q);
  vec3 e1 = normalize(cross(uAxis, vec3(0.0, 0.0, 1.0)));
  vec3 e2 = cross(uAxis, e1);
  float ang = h*2.4 + uPhase*2.0;
  vec3 dir = e1*cos(ang) + e2*sin(ang);
  float shear = 0.5 + 0.5*dot(q, dir)/max(ql, 1e-4);
  float layer = h*3.6 + 0.5*snoise(q*1.1 + 0.6*vec3(cos(uPhase), sin(uPhase), 0.0));
  float s = fract(layer);
  // Sharp lip on one side of each sheet, long smooth slope on the other.
  float ledge = smoothstep(0.0, 0.34, s)*(1.0 - smoothstep(0.55, 1.0, s));
  ledge = ledge*ledge*(3.0 - 2.0*ledge);
  float region = smoothstep(-0.5, 0.5, dot(p, uSweep))*smoothstep(0.0, 0.35, ql);
  float r = uRidge*region;
  float d = bulge + r*(0.24*ledge*(0.25 + 0.75*shear) + 0.06*shear - 0.12);
  return vec2(d, layer*region);
}

vec3 dispPos(vec3 n){ return n*(1.0 + disp(n).x); }

void main(){
  vec3 p = normalize(position);
  vec3 up = abs(p.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(up, p));
  vec3 t2 = cross(p, t1);
  float e = 0.006;
  vec2 dd = disp(p);
  vec3 P = p*(1.0 + dd.x);
  vec3 A = dispPos(normalize(p + t1*e));
  vec3 B = dispPos(normalize(p + t2*e));
  vec3 n = normalize(cross(A - P, B - P));
  if (dot(n, p) < 0.0) n = -n;
  vLayer = dd.y;
  vec4 wp = modelMatrix*vec4(P, 1.0);
  vPw = wp.xyz;
  vNw = normalize(mat3(modelMatrix)*n);
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;

export const blobFragment = /* glsl */ `
precision highp float;
uniform vec3 uTint;
uniform vec3 uKey;
uniform vec3 uFilmPhase;
uniform vec3 uFilmBias;
uniform vec3 uFilmGain;
uniform float uFilmSpan;
uniform float uIrid;
uniform float uPass; // 0 = back faces (inner wall), 1 = front faces
varying vec3 vNw;
varying vec3 vPw;
varying float vLayer;

// Procedural photo studio: hard-edged softboxes on black, so the glass
// reads as dark and clear with crisp bright streaks along every fold.
float box(float x, float lo, float hi, float soft){
  return smoothstep(lo - soft, lo + soft, x)*(1.0 - smoothstep(hi - soft, hi + soft, x));
}
vec3 env(vec3 d){
  float top = smoothstep(0.68, 0.76, d.y)*box(d.x, -0.5, 0.5, 0.06)*4.0;
  float stripR = smoothstep(0.8, 0.86, d.x)*box(d.y, -0.35, 0.55, 0.05)*4.0;
  float stripL = smoothstep(-0.82, -0.88, d.x)*box(d.y, -0.5, 0.3, 0.05)*2.2;
  float key = pow(max(dot(d, normalize(vec3(-0.5, 0.6, 0.62))), 0.0), 60.0)*6.0;
  float floorB = smoothstep(-0.62, -0.85, d.y)*2.2;
  float back = pow(max(dot(d, vec3(0.0, 0.0, -1.0)), 0.0), 3.0)*0.08;
  float dome = 0.05*smoothstep(-0.3, 1.0, d.y);
  return uKey*(top + stripR + stripL + key + floorB + back + dome);
}

vec3 film(float x){
  return uFilmBias + uFilmGain*cos(6.2831853*(x*uFilmSpan + uFilmPhase));
}

void main(){
  vec3 N = normalize(vNw);
  vec3 V = normalize(cameraPosition - vPw);
  if (uPass < 0.5) N = -N; // inner wall faces inward
  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.04 + 0.96*pow(1.0 - cosT, 5.0);

  vec3 R = reflect(-V, N);
  // Ball-lens transmission: a thick glass body bends rays strongly and
  // flips the scene behind it (bright floor/top lights swap sides).
  vec3 lat = N - V*dot(N, V);
  vec3 T = normalize(-V - 1.35*lat);
  vec3 eR = env(R);
  vec3 eT = env(T);

  // Thin-film interference: phase follows viewing angle, slice layering
  // and surface orientation, so colour bands trace every ridge.
  float phase = cosT*1.5 + vLayer*0.2 + dot(N, vec3(0.35, 0.55, 0.2))*1.3;
  vec3 fc = film(phase);
  // Push chroma: remove part of the grey component of the film colour.
  vec3 sat = max(fc - 0.7*dot(fc, vec3(0.333)), 0.0)*3.2;
  // Film thickness varies across the surface: vivid patches, clear gaps.
  float patchy = 0.1 + 1.4*smoothstep(0.15, 0.85, 0.5 + 0.5*sin(vLayer*0.9 + phase*1.7));
  float eLum = dot(eR, vec3(0.3, 0.5, 0.2));
  float tLum = dot(eT, vec3(0.3, 0.5, 0.2));

  vec3 col = eT*uTint*0.45 + eR*mix(vec3(1.0), uTint, 0.45)*(F*1.5 + 0.05);
  float graze = smoothstep(0.1, 0.75, 1.0 - cosT);
  col += sat*uIrid*patchy*(1.25*tLum*(0.25 + graze) + 1.0*eLum*graze + 0.05*graze);
  col += uKey*pow(1.0 - cosT, 6.0)*0.1;  // thin fresnel rim
  col += uTint*0.03;                     // faint body density
  if (uPass < 0.5) col *= 0.35;

  // Filmic tone map + gamma.
  col = 1.0 - exp(-col*1.1);
  col = pow(col, vec3(1.0/2.2));
  gl_FragColor = vec4(col, uPass < 0.5 ? 1.0 : 0.85);
}
`;

export const bgVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const bgFragment = /* glsl */ `
precision highp float;
uniform vec3 uInner;
uniform vec3 uOuter;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
void main(){
  vec2 p = (vUv - 0.5)*vec2(uRes.x/uRes.y, 1.0);
  float r = length(p);
  vec3 c = mix(uInner, uOuter, smoothstep(0.0, 0.95, r));
  c += (hash(gl_FragCoord.xy) - 0.5)/255.0; // dither against banding
  gl_FragColor = vec4(c, 1.0);
}
`;
