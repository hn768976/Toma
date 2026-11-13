// GLSL shared by the point cloud and the wire mesh so both deform identically.

// Ashima Arts / Stefan Gustavson 3D simplex noise (MIT).
const simplex = /* glsl */ `
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
}`;

const common = /* glsl */ `
uniform float uTime;
uniform float uChaos;
uniform float uWave;
uniform float uWaveAmt;
uniform vec3 uColAnterior;
uniform vec3 uColTop;
uniform vec3 uColLow;
uniform vec3 uWaveCol1;
uniform vec3 uWaveCol2;
uniform vec3 uLightDir;
${simplex}

// Crumpled-sheet deformation: a smooth, slowly evolving vector field, so the
// surface stays one continuous (folded) sheet while it is scrambled.
vec3 chaosDisplace(vec3 p){
  if(uChaos<=0.0001) return p;
  vec3 q=p*0.8+vec3(0.0,uTime*0.21,uTime*0.27);
  vec3 d1=vec3(snoise(q),snoise(q+vec3(19.1,3.3,7.7)),snoise(q+vec3(-5.2,11.4,23.9)));
  vec3 q2=p*2.8+vec3(uTime*0.4,-uTime*0.3,0.0);
  vec3 d2=vec3(snoise(q2+vec3(4.0,1.0,9.0)),snoise(q2+vec3(13.0,-7.0,2.0)),snoise(q2+vec3(-3.0,8.0,-11.0)));
  float c=uChaos;
  return p*(vec3(1.0)+c*vec3(-0.3,0.38,0.05))+c*(d1*vec3(0.3,0.36,0.34)+d2*0.15);
}

float bump(float x,float a,float b){
  float m=(a+b)*0.5; float w=(b-a)*0.5;
  return 1.0-smoothstep(0.0,w,abs(x-m));
}

vec3 brainColor(vec3 p){
  float ant=smoothstep(0.1,-1.0,p.x);
  float low=smoothstep(-0.05,-0.55,p.y)*smoothstep(-0.25,0.55,p.x);
  vec3 col=mix(uColTop,uColAnterior,ant*0.8);
  col=mix(col,uColLow,low*0.9);
  float d=p.x-uWave;
  col=mix(col,uWaveCol1,bump(d,-0.05,0.75)*uWaveAmt);
  col=mix(col,uWaveCol2,bump(d,0.55,1.7)*uWaveAmt);
  return col;
}
`;

export const pointsVertex = /* glsl */ `
${common}
uniform float uSize;
uniform float uPixelScale;
uniform float uFocal;
attribute vec3 aNormal;
attribute vec3 aRand;
attribute float aGroove;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 p=chaosDisplace(position);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;

  vec3 n=normalize(normalMatrix*aNormal);
  vec3 v=normalize(-mv.xyz);
  float facing=dot(n,v);
  float front=smoothstep(-0.15,0.25,facing);
  float lambert=0.28+0.72*max(dot(n,normalize(uLightDir)),0.0);
  float rim=pow(1.0-clamp(abs(facing),0.0,1.0),2.0);
  float settled=1.0-uChaos;
  float shade=mix(0.85,lambert*(1.0-0.62*aGroove)+0.3*rim*(1.0-aGroove),settled);
  // Grazing-angle points pile up on the silhouette; thin them so the edge
  // doesn't glow brighter than the lit surface.
  float graze=0.3+0.7*smoothstep(0.0,0.55,facing);
  float vis=mix(1.0,front*graze,settled);
  // Brainstem / underside sits in shadow.
  shade*=mix(1.0,0.14,smoothstep(-0.42,-0.75,position.y)*settled);

  vColor=brainColor(position)*shade;
  float size=uSize*uPixelScale*(0.55+0.9*aRand.y)*uFocal/(-mv.z);
  float a=(0.45+0.55*aRand.x)*vis;
  if(size<1.0){a*=size*size;size=1.0;}
  gl_PointSize=size;
  vAlpha=a;
}`;

export const pointsFragment = /* glsl */ `
uniform float uBrightness;
uniform float uWeight;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c=gl_PointCoord-0.5;
  float r=length(c);
  float a=smoothstep(0.5,0.15,r)*vAlpha*uBrightness*uWeight;
  if(a<0.002) discard;
  gl_FragColor=vec4(vColor*a,a);
}`;

export const linesVertex = /* glsl */ `
${common}
attribute vec3 aNormal;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 p=chaosDisplace(position);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  vec3 n=normalize(normalMatrix*aNormal);
  vec3 v=normalize(-mv.xyz);
  float front=smoothstep(-0.1,0.3,dot(n,v));
  vColor=brainColor(position);
  vAlpha=mix(1.0,front,1.0-uChaos);
}`;

export const linesFragment = /* glsl */ `
uniform float uLineAlpha;
uniform float uWeight;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float a=uLineAlpha*vAlpha*uWeight;
  gl_FragColor=vec4(vColor*a,a);
}`;

export const occluderVertex = /* glsl */ `
${common}
attribute vec3 aNormal;
attribute float aGroove;
varying vec3 vColor;
void main(){
  vec3 p=chaosDisplace(position-aNormal*0.012);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  vec3 n=normalize(normalMatrix*aNormal);
  float lambert=0.2+0.8*max(dot(n,normalize(uLightDir)),0.0);
  float under=smoothstep(-0.42,-0.75,position.y);
  vColor=brainColor(position)*lambert*(1.0-0.55*aGroove)*mix(1.0,0.12,under);
}`;

// Solid, dimly shaded body under the particles: writes depth (occludes the far
// side) and gives the formed brain a continuous surface like the reference.
export const occluderFragment = /* glsl */ `
uniform float uBody;
varying vec3 vColor;
void main(){ gl_FragColor=vec4(vColor*uBody,1.0); }`;
