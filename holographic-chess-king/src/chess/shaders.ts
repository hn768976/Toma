// Holographic dashed ring drawn on a flat RingGeometry (XZ plane).
export const holoRingVertex = /* glsl */ `
varying vec3 vLocal;
void main(){
  vLocal=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

export const holoRingFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uInner;
uniform float uOuter;
uniform float uDashes;
uniform float uDuty;
uniform float uRotation;
varying vec3 vLocal;
void main(){
  float r=length(vLocal.xz);
  float w=uOuter-uInner;
  float edge=smoothstep(uInner,uInner+w*0.35,r)*smoothstep(uOuter,uOuter-w*0.35,r);
  float a=atan(vLocal.z,vLocal.x)/6.28318530718+0.5+uRotation;
  float dash=1.0;
  if(uDashes>0.5){
    float f=fract(a*uDashes);
    dash=smoothstep(0.0,0.08,f)*smoothstep(uDuty,uDuty-0.08,f);
  }
  float v=edge*dash*uIntensity;
  if(v<0.002) discard;
  gl_FragColor=vec4(uColor*v,v);
}`;

// Soft volumetric light shaft (additive quad).
export const rayVertex = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

export const rayFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPhase;
varying vec2 vUv;
void main(){
  float x=(vUv.x-0.5)*2.0;
  float across=exp(-x*x*4.0);
  float along=smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.55,vUv.y);
  float flicker=0.85+0.15*sin(vUv.y*9.0+uPhase);
  float v=across*along*flicker*uIntensity;
  gl_FragColor=vec4(uColor*v,v);
}`;

// Round glowing sprite for constellation nodes.
export const nodeVertex = /* glsl */ `
uniform float uSize;
uniform float uPixelScale;
uniform float uTime;
attribute float aSeed;
varying float vTwinkle;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  vTwinkle=0.6+0.4*sin(uTime*(1.2+aSeed*2.0)+aSeed*40.0);
  gl_PointSize=uSize*uPixelScale*(0.7+0.6*aSeed)*(8.0/-mv.z);
}`;

export const nodeFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vTwinkle;
void main(){
  float r=length(gl_PointCoord-0.5)*2.0;
  float core=exp(-r*r*4.5)+0.35*exp(-r*r*14.0);
  float v=core*uIntensity*vTwinkle;
  if(v<0.003) discard;
  gl_FragColor=vec4(uColor*v,v);
}`;

export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.55 },
    uAspect: { value: 16 / 9 },
    uLift: { value: [0.0075, 0.0072, 0.0065] },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform float uAspect; uniform vec3 uLift; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec2 d=(vUv-0.5)*vec2(uAspect,1.0);
      float v=1.0-uVignette*smoothstep(0.3,1.1,length(d));
      gl_FragColor=vec4(c.rgb*v+uLift,1.0);
    }`,
};
