import { WAVES, WaveLayer } from "./config";

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
/** Simplex noise 3D (Ian McEwan / Stefan Gustavson, MIT). Stateless. */
const SNOISE = /* glsl */ `
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
}`;

/** Maps grid uv (0..1) to a point on the resting plane y = 0. */
const BASE_POINT = /* glsl */ `
uniform vec4 uNdc;      // left, right, bottom, top
uniform vec4 uRows;     // blendStart, blendWidth, slope below, slope inside the frame
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform vec2 uTanHalf;  // tan(fovX/2), tan(fovY/2)
// Uneven row spacing: sparse below the frame, dense inside it (C1-smooth).
float rowMap(float v){
  float t=clamp((v-uRows.x)/uRows.y,0.0,1.0);
  float ramp=uRows.y*(t*t*t-0.5*t*t*t*t)+max(v-uRows.x-uRows.y,0.0);
  return uRows.z*v+(uRows.w-uRows.z)*ramp;
}
vec2 basePoint(vec2 uv){
  vec2 ndc=vec2(mix(uNdc.x,uNdc.y,uv.x),mix(uNdc.z,uNdc.w,rowMap(uv.y)));
  vec3 dir=uCamFwd+uCamRight*(ndc.x*uTanHalf.x)+uCamUp*(ndc.y*uTanHalf.y);
  float t=-uCamPos.y/min(dir.y,-1e-4);
  return uCamPos.xz+dir.xz*t;
}`;

const v2 = (a: readonly number[]) => `vec2(${f(a[0])},${f(a[1])})`;

const layerGlsl = (l: WaveLayer, coord: string, fade: boolean) => {
  const a = (l.rotateDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // Rotate, then scale (x along the flow is stretched).
  const m = `mat2(${f(c * l.scale * l.stretch)},${f(-s * l.scale)},${f(s * l.scale * l.stretch)},${f(c * l.scale)})`;
  const n = `snoise(vec3(${m}*${coord}+${v2(l.offset)},uTime*${f(l.evolve * WAVES.tempo)}+${f(l.offset[2])}))`;
  // Fade layers whose wavelength approaches the texel footprint (no shimmer).
  return fade ? `h+=${f(l.amp)}*${n}*smoothstep(1.5,4.0,${f(1 / l.scale)}/fp);` : `h+=${f(l.amp)}*${n};`;
};

const warpGlsl = (w: { scale: number; amount: number; evolve: number; offsetA: number[]; offsetB: number[] }, coord: string) =>
  `vec2(snoise(vec3(${coord}*${f(w.scale)}+${v2(w.offsetA)},uTime*${f(w.evolve * WAVES.tempo)}+${f(w.offsetA[2])})),` +
  `snoise(vec3(${coord}*${f(w.scale)}+${v2(w.offsetB)},uTime*${f(w.evolve * WAVES.tempo)}+${f(w.offsetB[2])})))*${f(w.amount)}`;

const heightBody = () =>
  [
    `vec2 q=(p-uTime*${v2(WAVES.drift)})*${f(1 / WAVES.size)};`,
    `fp*=${f(1 / WAVES.size)};`,
    `q+=${warpGlsl(WAVES.warp, "q")};`,
    `float h=0.0;`,
    ...WAVES.swells.map((l) => layerGlsl(l, "q", false)),
    `vec2 r=q+${warpGlsl(WAVES.curl, "q")};`,
    `r+=${warpGlsl(WAVES.crinkle, "r")};`,
    ...WAVES.filaments.map((l) => layerGlsl(l, "r", true)),
    `return h*${f(WAVES.size)};`,
  ].join("\n  ");

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main(){
  vUv=position.xy*0.5+0.5;
  gl_Position=vec4(position.xy,0.0,1.0);
}`;

/** Pass 1: wave height for every grid texel. */
export const HEIGHT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform vec2 uTexel;
${BASE_POINT}
${SNOISE}
float heightAt(vec2 p,float fp){
  ${heightBody()}
}
void main(){
  vec2 p=basePoint(vUv);
  float fp=length(basePoint(vUv+vec2(0.0,uTexel.y))-p);
  outColor=vec4(heightAt(p,fp),0.0,0.0,1.0);
}`;

/**
 * Pass 2: shading, done per height-map texel (texture space). The surface is a
 * dark mirror lit edge-on: brightness is a fresnel rim term, dimmed in the near
 * field, plus far haze. Output: scene-linear light (one channel). Exposure,
 * tone mapping and the colour ramp are applied in the final pass, after depth
 * of field, so blurred light keeps the palette's saturation.
 */
export const RAMP_GLSL = /* glsl */ `
uniform vec3 uRampColor[RAMP_STOPS];
uniform float uRampAt[RAMP_STOPS];
vec3 ramp(float t){
  vec3 c=uRampColor[0];
  for(int i=1;i<RAMP_STOPS;i++){
    float k=clamp((t-uRampAt[i-1])/max(uRampAt[i]-uRampAt[i-1],1e-5),0.0,1.0);
    c=mix(c,uRampColor[i],k);
  }
  return c;
}`;

export const SHADE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tHeight;
uniform vec2 uTexel;
uniform float uFresnelPower;
uniform vec3 uLight;   // nearLevel, falloffStart, falloffEnd
uniform vec3 uFar;     // farLevel, farStart, farEnd
uniform vec3 uHaze;    // amount, start, end
uniform mat4 uViewProj;
uniform float uBufferHeight;
${BASE_POINT}
vec3 surf(vec2 uv){
  vec2 b=basePoint(uv);
  return vec3(b.x,texture(tHeight,uv).r,b.y);
}
// Mean of pow(1-x,p) for x between lo and hi (closed form).
float rimMean(float lo,float hi,float p){
  lo=clamp(lo,0.0,1.0);
  hi=clamp(hi,0.0,1.0);
  if(hi-lo<1e-4)return pow(1.0-lo,p);
  return (pow(1.0-lo,p+1.0)-pow(1.0-hi,p+1.0))/((p+1.0)*(hi-lo));
}
void main(){
  vec3 P=surf(vUv);
  vec3 dU=surf(vUv+vec2(uTexel.x,0.0))-surf(vUv-vec2(uTexel.x,0.0));
  vec3 Pup=surf(vUv+vec2(0.0,uTexel.y));
  vec3 Pdn=surf(vUv-vec2(0.0,uTexel.y));
  vec3 dV=Pup-Pdn;
  vec3 V=normalize(uCamPos-P);
  // Specular anti-aliasing: on a sharp crest the rim highlight is thinner than
  // a texel, so instead of one normal use the two half-texel normals (towards
  // and away from the camera) and average the rim term between them.
  vec3 nUp=normalize(cross(dU,Pup-P));
  vec3 nDn=normalize(cross(dU,P-Pdn));
  if(nUp.y<0.0)nUp=-nUp;
  if(nDn.y<0.0)nDn=-nDn;
  float a=dot(nUp,V);
  float b=dot(nDn,V);
  float lo=min(a,b);
  float hi=max(a,b);
  // Fraction of the texel that faces the camera (hidden back slopes excluded).
  float facing=hi<=0.0?0.0:clamp((hi-max(lo,0.0))/max(hi-lo,1e-5),0.0,1.0);
  if(hi-lo<1e-5)facing=step(0.0,hi);
  float rim=rimMean(max(lo,0.0),max(hi,0.0),uFresnelPower);
  float dist=length(uCamPos-P);
  float reach=mix(uLight.x,1.0,smoothstep(uLight.y,uLight.z,dist))
    *mix(1.0,uFar.x,smoothstep(uFar.y,uFar.z,dist));
  float light=rim*reach+uHaze.x*smoothstep(uHaze.y,uHaze.z,dist);
  // g = camera-facing fraction (hidden back slopes are skipped when the
  // surface pass averages a pixel's footprint); b = how many output pixels
  // one texel covers along v, which shrinks towards 0 on edge-on crests.
  vec4 c0=uViewProj*vec4(P-dV*0.5,1.0);
  vec4 c1=uViewProj*vec4(P+dV*0.5,1.0);
  float pixelsPerTexel=(c1.y/c1.w-c0.y/c0.w)*0.25*uBufferHeight;
  outColor=vec4(light,facing,pixelsPerTexel,1.0);
}`;

/** Pass 3: the displaced surface mesh. Outputs light (r) + view distance (a). */
export const SURFACE_VERT = /* glsl */ `
precision highp float;
in vec3 position;
uniform sampler2D tHeight;
uniform mat4 uViewProj;
${BASE_POINT}
out vec2 vUv;
out float vDist;
void main(){
  vec2 b=basePoint(position.xy);
  float h=texture(tHeight,position.xy).r;
  vUv=position.xy;
  vec4 clip=uViewProj*vec4(b.x,h,b.y,1.0);
  vDist=clip.w;
  gl_Position=clip;
}`;

/**
 * Crests seen edge-on squeeze many shaded texels into one pixel. Averaging the
 * shading along that pixel's footprint (instead of point-sampling it) keeps
 * hairline rim lines continuous and flicker-free.
 */
export const SURFACE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vDist;
out vec4 outColor;
uniform sampler2D tShade;
uniform vec2 uTexel;
const int MAXN=FOOTPRINT_TAPS;
void main(){
  // Texels squeezed into this pixel along v (the view direction).
  float ppt=texture(tShade,vUv).b;
  float n=clamp(ceil(1.0/max(ppt,1.0/float(MAXN))),1.0,float(MAXN));
  vec2 acc=vec2(0.0);
  float all=0.0;
  for(int i=0;i<MAXN;i++){
    if(float(i)>=n)break;
    vec2 t=texture(tShade,vUv+vec2(0.0,(float(i)+0.5-0.5*n)*uTexel.y)).rg;
    acc+=vec2(t.r*t.g,t.g);
    all+=t.r;
  }
  // Mean light over the camera-facing part of the footprint.
  float light=mix(all/n,acc.x/max(acc.y,1e-3),smoothstep(0.0,1.0,acc.y));
  outColor=vec4(light,0.0,0.0,vDist);
}`;

/** 2x2 box downsample (one bilinear tap at the shared corner). */
export const COPY_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
void main(){ outColor=texture(tColor,vUv); }`;

const COC_GLSL = /* glsl */ `
uniform vec4 uDof;          // focusDistance, nearBlur, farBlur, maxBlur
float coc(float d){
  float k=1.0-uDof.x/max(d,1e-3);
  return min(k<0.0?-k*uDof.y:k*uDof.z,uDof.w);
}`;

/**
 * Depth of field (half resolution): disc gather sized by each pixel's circle
 * of confusion. Run twice; the second, smaller gather fills the first's gaps.
 */
export const DOF_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;   // r = light, a = view distance
uniform vec2 uAspect;       // (height/width, 1): radius in frame heights -> uv
uniform float uRadiusScale; // 1 for the main pass, <1 for the fill pass
uniform float uRotate;
${COC_GLSL}
const int TAPS=TAP_COUNT;
const float GOLDEN=2.39996323;
void main(){
  vec4 c=texture(tColor,vUv);
  float r=coc(c.a)*uRadiusScale;
  vec4 acc=c;
  for(int i=0;i<TAPS;i++){
    float fi=float(i)+0.5;
    float rad=sqrt(fi/float(TAPS))*r;
    float a=fi*GOLDEN+uRotate;
    acc+=texture(tColor,vUv+vec2(cos(a),sin(a))*rad*uAspect);
  }
  outColor=acc/float(TAPS+1);
}`;

/**
 * Anti-aliasing of the in-focus picture: a small separable gaussian (sigma =
 * minBlur) at full resolution. Blurs light (r), passes distance (a) through.
 */
export const AA_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 uStep;     // one texel along the blur axis
uniform float uSigma;   // in texels
const int R=AA_RADIUS;
void main(){
  vec4 c=texture(tColor,vUv);
  float acc=c.r;
  float w=1.0;
  for(int i=1;i<=R;i++){
    float g=exp(-0.5*float(i*i)/(uSigma*uSigma));
    acc+=g*(texture(tColor,vUv+uStep*float(i)).r+texture(tColor,vUv-uStep*float(i)).r);
    w+=2.0*g;
  }
  outColor=vec4(acc/w,0.0,0.0,c.a);
}`;

/** Separable gaussian for the glow (run on a quarter-size target). */
export const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 uStep;   // uv step between taps along the blur axis
void main(){
  const float w[5]=float[5](0.2270270270,0.1945945946,0.1216216216,0.0540540541,0.0162162162);
  vec3 acc=texture(tColor,vUv).rgb*w[0];
  for(int i=1;i<5;i++){
    acc+=texture(tColor,vUv+uStep*float(i)).rgb*w[i];
    acc+=texture(tColor,vUv-uStep*float(i)).rgb*w[i];
  }
  outColor=vec4(acc,1.0);
}`;

/**
 * Final pass: in-focus picture (full resolution, anti-aliased) blended
 * into the half-resolution depth-of-field picture by circle of confusion, plus
 * glow; then exposure, filmic shoulder, the palette ramp, vignette, grain and
 * dither. The ramp is indexed by displayed brightness and holds sRGB colours.
 */
export const FINAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;   // full res, anti-aliased: r = light, a = view distance
uniform sampler2D tDof;     // half res, blurred
uniform sampler2D tGlow;
uniform vec2 uBlend;        // circle of confusion where the blurred picture starts / fully takes over
uniform float uGlow;
uniform float uExposure;
uniform float uBlackPoint;
uniform float uVignette;
uniform float uGrain;
uniform float uDither;
uniform float uFrame;
uniform vec2 uResolution;
${COC_GLSL}
${RAMP_GLSL}
float hash(vec3 p){
  p=fract(p*vec3(0.1031,0.1030,0.0973));
  p+=dot(p,p.yxz+33.33);
  return fract((p.x+p.y)*p.z);
}
void main(){
  vec4 s=texture(tScene,vUv);
  float sharp=s.r;
  vec4 soft=texture(tDof,vUv);
  // Use the blurred neighbourhood's distance too, so near blur spills over focus edges.
  float k=smoothstep(uBlend.x,uBlend.y,max(coc(s.a),coc(soft.a)));
  float light=mix(sharp,soft.r,k)+uGlow*texture(tGlow,vUv).r;
  vec2 q=vUv-0.5;
  light*=1.0-uVignette*dot(q,q)*2.0;
  float shown=1.0-exp(-uExposure*light);
  shown=max(shown-uBlackPoint,0.0)/(1.0-uBlackPoint);
  vec3 c=ramp(shown);
  // Grain and dither are keyed to the output pixel grid and frame number and
  // fade to nothing on pure black, so the black background stays exactly 0.
  vec2 px=floor(vUv*uResolution);
  float keep=smoothstep(0.0,3.0/255.0,shown);
  float g=hash(vec3(px,uFrame))-0.5;
  c+=g*uGrain*keep*(1.0-0.6*shown);
  float d=hash(vec3(px+17.0,uFrame+101.0))+hash(vec3(px+71.0,uFrame+53.0))-1.0;
  c+=d*uDither*keep;
  outColor=vec4(clamp(c,0.0,1.0),1.0);
}`;
