import * as THREE from "three";

// HDR post pipeline shared by looks 1–3:
//   scene → HalfFloat MSAA target → dual-filter bloom mip chain →
//   composite (exposure, tone map, sRGB, vignette, dither ±1/255, grain).
// Everything is a pure function of the inputs; grain/dither come from an
// integer hash of pixel position and the (loop-wrapped) frame number.

export type PostParams = {
  exposure: number;
  bloomStrength: number;
  bloomRadius: number; // 0..1, weight of the wider mips
  bloomThreshold: number;
  toneMap: "aces" | "exp" | "linear";
  vignette: number; // 0..1
  grain: number; // amplitude, e.g. 0.02
  dither: boolean;
  saturation: number;
};

export const defaultPost: PostParams = {
  exposure: 1,
  bloomStrength: 0.6,
  bloomRadius: 0.6,
  bloomThreshold: 0.6,
  toneMap: "aces",
  vignette: 0.2,
  grain: 0.02,
  dither: true,
  saturation: 1,
};

const FS_TRI_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.,1.); }`;

const PREFILTER = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
in vec2 vUv; out vec4 o;
vec3 pf(vec3 c){ float br = max(c.r,max(c.g,c.b)); float k = max(br-uThreshold,0.)/max(br,1e-4); return c*k; }
void main(){
  vec2 d = uTexel*0.5;
  vec3 a = texture(tSrc, vUv+vec2(-d.x,-d.y)).rgb;
  vec3 b = texture(tSrc, vUv+vec2( d.x,-d.y)).rgb;
  vec3 c = texture(tSrc, vUv+vec2(-d.x, d.y)).rgb;
  vec3 e = texture(tSrc, vUv+vec2( d.x, d.y)).rgb;
  o = vec4(pf((a+b+c+e)*0.25), 1.);
}`;

const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
void main(){
  vec2 h = uTexel;
  vec3 s = texture(tSrc, vUv).rgb*4.;
  s += texture(tSrc, vUv+vec2(-h.x,-h.y)).rgb;
  s += texture(tSrc, vUv+vec2( h.x,-h.y)).rgb;
  s += texture(tSrc, vUv+vec2(-h.x, h.y)).rgb;
  s += texture(tSrc, vUv+vec2( h.x, h.y)).rgb;
  o = vec4(s/8., 1.);
}`;

const UP = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uMix;
in vec2 vUv; out vec4 o;
void main(){
  vec2 h = uTexel*1.5;
  vec3 s = texture(tSrc, vUv+vec2(-h.x*2.,0.)).rgb;
  s += texture(tSrc, vUv+vec2(-h.x,h.y)).rgb*2.;
  s += texture(tSrc, vUv+vec2(0.,h.y*2.)).rgb;
  s += texture(tSrc, vUv+vec2(h.x,h.y)).rgb*2.;
  s += texture(tSrc, vUv+vec2(h.x*2.,0.)).rgb;
  s += texture(tSrc, vUv+vec2(h.x,-h.y)).rgb*2.;
  s += texture(tSrc, vUv+vec2(0.,-h.y*2.)).rgb;
  s += texture(tSrc, vUv+vec2(-h.x,-h.y)).rgb*2.;
  o = vec4(texture(tBase, vUv).rgb + s/12.*uMix, 1.);
}`;

const COMPOSITE = /* glsl */ `
precision highp float;
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uExposure, uBloom, uVignette, uGrain, uDither, uSat;
uniform int uTone; uniform uint uFrame; uniform vec2 uRes;
in vec2 vUv; out vec4 o;
uint pcg(uint v){ uint s = v*747796405u+2891336453u; uint w = ((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float h01(uvec3 p){ return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967295.; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
vec3 toSRGB(vec3 c){ c = clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
void main(){
  vec3 c = texture(tScene, vUv).rgb + texture(tBloom, vUv).rgb*uBloom;
  c *= uExposure;
  if(uTone==0) c = aces(c); else if(uTone==1) c = 1.-exp(-c);
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(l), c, uSat);
  vec2 q = vUv-0.5; q.x *= uRes.x/uRes.y;
  c *= 1. - uVignette*smoothstep(0.35, 1.05, length(q));
  c = toSRGB(c);
  uvec2 px = uvec2(gl_FragCoord.xy);
  // grain: fixed formula of pixel + frame, scaled down in the deep blacks
  float g = h01(uvec3(px, uFrame)) - 0.5;
  c += g * uGrain * smoothstep(0.0, 0.08, l + 0.02);
  // TPDF dither ±1/255
  float d = h01(uvec3(px, uFrame + 7919u)) + h01(uvec3(px + 1013u, uFrame)) - 1.;
  c += d * uDither / 255.;
  o = vec4(c, 1.);
}`;

const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    vertexShader: FS_TRI_VERT,
    fragmentShader: frag,
    uniforms,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
  });

export class PostFX {
  private gl: THREE.WebGLRenderer;
  private sceneRT: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pre = mk(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 } });
  private down = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  private up = mk(UP, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
  private comp = mk(COMPOSITE, {
    tScene: { value: null },
    tBloom: { value: null },
    uExposure: { value: 1 },
    uBloom: { value: 1 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uDither: { value: 1 },
    uSat: { value: 1 },
    uTone: { value: 0 },
    uFrame: { value: 0 },
    uRes: { value: new THREE.Vector2() },
  });
  private w = 0;
  private h = 0;
  private levels: number;

  constructor(gl: THREE.WebGLRenderer, levels = 6) {
    this.gl = gl;
    this.levels = levels;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, this.comp);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  }

  private ensure(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sceneRT.setSize(w, h);
    [...this.mips, ...this.ups].forEach((t) => t.dispose());
    this.mips = [];
    this.ups = [];
    let mw = w,
      mh = h;
    for (let i = 0; i < this.levels; i++) {
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
      const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opts));
      this.ups.push(new THREE.WebGLRenderTarget(mw, mh, opts));
    }
  }

  get target() {
    return this.sceneRT;
  }

  private pass(mat: THREE.Material, out: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(out);
    this.gl.render(this.qScene, this.qCam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, frame: number, p: PostParams, clear: THREE.Color) {
    const gl = this.gl;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.ensure(size.x, size.y);
    gl.autoClear = true;
    gl.setClearColor(clear, 1);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    // bloom chain
    this.pre.uniforms.tSrc.value = this.sceneRT.texture;
    this.pre.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.pre.uniforms.uThreshold.value = p.bloomThreshold;
    this.pass(this.pre, this.mips[0]);
    for (let i = 1; i < this.levels; i++) {
      const src = this.mips[i - 1];
      this.down.uniforms.tSrc.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.down, this.mips[i]);
    }
    let cur = this.mips[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      this.up.uniforms.tSrc.value = cur.texture;
      this.up.uniforms.tBase.value = this.mips[i].texture;
      this.up.uniforms.uTexel.value.set(1 / cur.width, 1 / cur.height);
      this.up.uniforms.uMix.value = 0.35 + p.bloomRadius * 1.0;
      this.pass(this.up, this.ups[i]);
      cur = this.ups[i];
    }

    const u = this.comp.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom.value = cur.texture;
    u.uExposure.value = p.exposure;
    u.uBloom.value = p.bloomStrength;
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uDither.value = p.dither ? 1 : 0;
    u.uSat.value = p.saturation;
    u.uTone.value = p.toneMap === "aces" ? 0 : p.toneMap === "exp" ? 1 : 2;
    u.uFrame.value = frame >>> 0;
    u.uRes.value.set(this.w, this.h);
    this.pass(this.comp, null);
  }
}
