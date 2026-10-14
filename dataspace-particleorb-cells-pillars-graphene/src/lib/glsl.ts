// Shared GLSL snippets (GLSL ES 3.00).

// Final-pass grain + dither. Fixed formula of pixel position and loop frame.
export const GRAIN_GLSL = /* glsl */ `
float pcgHash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return float(v.x & 0x00ffffffu) / 16777216.0;
}
// rgb in display (sRGB) space, 0..1. frame = frame % 600.
vec3 grainDither(vec3 rgb, vec2 fragCoord, float frame, float grainAmt, float blackFade) {
  uvec3 p = uvec3(uvec2(fragCoord), uint(frame));
  float g = pcgHash(p) + pcgHash(p + uvec3(0u, 0u, 1000u)) - 1.0;      // triangular, -1..1
  float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float fade = blackFade > 0.5 ? smoothstep(0.015, 0.045, lum) : 1.0;
  rgb += g * grainAmt * fade;
  // +-1/255 triangular dither for the 8-bit output
  float d = pcgHash(p + uvec3(7u, 13u, 2000u)) + pcgHash(p + uvec3(31u, 3u, 3000u)) - 1.0;
  rgb += d / 255.0 * (blackFade > 0.5 ? smoothstep(0.0, 0.03, lum) : 1.0);
  return rgb;
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`;

// Ashima simplex noise 3D (MIT) + analytic gradient.
export const SIMPLEX3_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
// returns noise in .w, gradient in .xyz
vec4 snoiseGrad(vec3 v){
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
  vec4 m2=m*m;
  vec4 m4=m2*m2;
  vec4 pdotx=vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3));
  vec4 temp=m2*m*pdotx;
  vec3 grad=-8.0*(temp.x*x0+temp.y*x1+temp.z*x2+temp.w*x3);
  grad+=m4.x*p0+m4.y*p1+m4.z*p2+m4.w*p3;
  grad*=105.0;
  return vec4(grad,105.0*dot(m4,pdotx));
}
float snoise(vec3 v){return snoiseGrad(v).w;}
`;
