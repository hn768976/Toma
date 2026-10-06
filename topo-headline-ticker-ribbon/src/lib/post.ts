import * as THREE from "three";
import { GLSL_HASH } from "./glsl";

/**
 * Post pipeline (no temporal effects):
 *   scene -> HDR target (MSAA 4x, depth texture)
 *   -> 7-level downsample pyramid (13-tap filter)
 *   -> bloom = progressive tent upsample of the pyramid
 *   -> composite: depth-of-field (CoC from depth, lerp between pyramid
 *      levels), bloom, tonemap, vignette, sRGB, grain + dither (last).
 * All parameters come from the Look each frame, nothing is carried over.
 */
export type PostParams = {
  // Depth of field: distances (view space, scene units)
  focusNear: number; // start of sharp band
  focusFar: number; // end of sharp band
  nearBlurAt: number; // distance where near blur reaches max (smaller than focusNear)
  farBlurAt: number; // distance where far blur reaches max
  nearCoc: number; // max blur radius in front, fraction of frame height
  farCoc: number; // max blur radius behind, fraction of frame height
  bloom: number; // bloom strength
  bloomTint?: THREE.Color;
  bloomRadius?: number; // 0..1 how wide the bloom is weighted
  exposure: number;
  vignette: number;
  grain: number; // amplitude in display space (0.015 = 1.5%)
  saturation?: number;
};

const LEVELS = 7;

const fsQuadVert = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function makePass(frag: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: fsQuadVert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

const downFrag = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; // texel of source
in vec2 vUv; out vec4 o;
void main(){
  vec2 t = uTexel;
  vec3 a = texture(tSrc, vUv + t*vec2(-2.,-2.)).rgb;
  vec3 b = texture(tSrc, vUv + t*vec2( 0.,-2.)).rgb;
  vec3 c = texture(tSrc, vUv + t*vec2( 2.,-2.)).rgb;
  vec3 d = texture(tSrc, vUv + t*vec2(-2., 0.)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + t*vec2( 2., 0.)).rgb;
  vec3 g = texture(tSrc, vUv + t*vec2(-2., 2.)).rgb;
  vec3 h = texture(tSrc, vUv + t*vec2( 0., 2.)).rgb;
  vec3 i = texture(tSrc, vUv + t*vec2( 2., 2.)).rgb;
  vec3 j = texture(tSrc, vUv + t*vec2(-1.,-1.)).rgb;
  vec3 k = texture(tSrc, vUv + t*vec2( 1.,-1.)).rgb;
  vec3 l = texture(tSrc, vUv + t*vec2(-1., 1.)).rgb;
  vec3 m = texture(tSrc, vUv + t*vec2( 1., 1.)).rgb;
  vec3 r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  o = vec4(max(r, 0.0), 1.0);
}`;

const upFrag = /* glsl */ `
precision highp float;
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 uTexel; uniform float uLowW; uniform float uHighW;
in vec2 vUv; out vec4 o;
void main(){
  vec2 t = uTexel;
  vec3 s = texture(tLow, vUv).rgb*4.0;
  s += (texture(tLow, vUv+t*vec2(-1,0)).rgb + texture(tLow, vUv+t*vec2(1,0)).rgb + texture(tLow, vUv+t*vec2(0,-1)).rgb + texture(tLow, vUv+t*vec2(0,1)).rgb)*2.0;
  s += texture(tLow, vUv+t*vec2(-1,-1)).rgb + texture(tLow, vUv+t*vec2(1,-1)).rgb + texture(tLow, vUv+t*vec2(-1,1)).rgb + texture(tLow, vUv+t*vec2(1,1)).rgb;
  s /= 16.0;
  o = vec4(s*uLowW + texture(tHigh, vUv).rgb*uHighW, 1.0);
}`;

const compositeFrag = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tScene; uniform sampler2D tDepth;
uniform sampler2D tL1; uniform sampler2D tL2; uniform sampler2D tL3; uniform sampler2D tL4; uniform sampler2D tL5;
uniform sampler2D tBloom;
uniform vec2 uRes; uniform float uNear; uniform float uFar;
uniform float uFocusNear; uniform float uFocusFar; uniform float uNearBlurAt; uniform float uFarBlurAt;
uniform float uNearCoc; uniform float uFarCoc;
uniform float uBloom; uniform vec3 uBloomTint; uniform float uExposure; uniform float uVignette; uniform float uGrain; uniform float uSat;
uniform uint uFrame;
in vec2 vUv; out vec4 o;
${GLSL_HASH}
float linearDepth(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }
vec3 tent(sampler2D s, vec2 uv, vec2 texel){
  vec3 r = texture(s, uv + texel*vec2(-0.5,-0.5)).rgb;
  r += texture(s, uv + texel*vec2(0.5,-0.5)).rgb;
  r += texture(s, uv + texel*vec2(-0.5,0.5)).rgb;
  r += texture(s, uv + texel*vec2(0.5,0.5)).rgb;
  return r*0.25;
}
vec3 level(int k){
  if(k<=0) return texture(tScene, vUv).rgb;
  if(k==1) return tent(tL1, vUv, 2.0/uRes);
  if(k==2) return tent(tL2, vUv, 4.0/uRes);
  if(k==3) return tent(tL3, vUv, 8.0/uRes);
  if(k==4) return tent(tL4, vUv, 16.0/uRes);
  return tent(tL5, vUv, 32.0/uRes);
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
void main(){
  float zl = linearDepth(texture(tDepth, vUv).r);
  float nearT = clamp((uFocusNear - zl)/max(uFocusNear-uNearBlurAt,1e-3), 0.0, 1.0);
  float farT  = clamp((zl - uFocusFar)/max(uFarBlurAt-uFocusFar,1e-3), 0.0, 1.0);
  float coc = max(nearT*nearT*(3.0-2.0*nearT)*uNearCoc, farT*farT*(3.0-2.0*farT)*uFarCoc) * uRes.y; // px radius
  float lv = clamp(log2(max(coc, 1.0)) * 1.0 + (coc > 1.0 ? 0.0 : coc - 1.0), 0.0, 4.999);
  lv = max(lv, 0.0);
  int k0 = int(floor(lv));
  float f = lv - float(k0);
  vec3 col = mix(level(k0), level(k0+1), f);
  vec3 bloom = texture(tBloom, vUv).rgb;
  col += bloom * uBloom * uBloomTint;
  col *= uExposure;
  float lum = dot(col, vec3(0.2126,0.7152,0.0722));
  col = max(mix(vec3(lum), col, uSat), 0.0);
  col = aces(col);
  vec2 q = vUv - 0.5; q.x *= uRes.x/uRes.y;
  col *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
  col = toSRGB(col);
  ivec2 p = ivec2(gl_FragCoord.xy);
  // film grain: fixed formula of pixel position and frame
  float g = hash13u(uvec3(uint(p.x), uint(p.y), uFrame)) - 0.5;
  col += g * uGrain * 2.0;
  // final dither +-1/255 (triangular)
  float d1 = hash13u(uvec3(uint(p.x)+7919u, uint(p.y)+104729u, uFrame*3u+1u));
  float d2 = hash13u(uvec3(uint(p.x)+15485863u, uint(p.y)+32452843u, uFrame*3u+2u));
  col += (d1 + d2 - 1.0) / 255.0;
  o = vec4(col, 1.0);
}`;

export class Post {
  private rtScene: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private downMat = makePass(downFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  private upMat = makePass(upFrag, {
    tLow: { value: null },
    tHigh: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uLowW: { value: 1 },
    uHighW: { value: 1 },
  });
  private compMat: THREE.ShaderMaterial;
  constructor(
    private w: number,
    private h: number,
  ) {
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.rtScene = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    let lw = w,
      lh = h;
    for (let i = 0; i < LEVELS; i++) {
      lw = Math.max(1, Math.ceil(lw / 2));
      lh = Math.max(1, Math.ceil(lh / 2));
      const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.down.push(new THREE.WebGLRenderTarget(lw, lh, opts));
      this.up.push(new THREE.WebGLRenderTarget(lw, lh, opts));
    }
    this.compMat = makePass(compositeFrag, {
      tScene: { value: this.rtScene.texture },
      tDepth: { value: depthTexture },
      tL1: { value: this.down[0].texture },
      tL2: { value: this.down[1].texture },
      tL3: { value: this.down[2].texture },
      tL4: { value: this.down[3].texture },
      tL5: { value: this.down[4].texture },
      tBloom: { value: this.up[0].texture },
      uRes: { value: new THREE.Vector2(w, h) },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
      uFocusNear: { value: 0 },
      uFocusFar: { value: 0 },
      uNearBlurAt: { value: 0 },
      uFarBlurAt: { value: 0 },
      uNearCoc: { value: 0 },
      uFarCoc: { value: 0 },
      uBloom: { value: 0 },
      uBloomTint: { value: new THREE.Color(1, 1, 1) },
      uExposure: { value: 1 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uSat: { value: 1 },
      uFrame: { value: 0 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.downMat);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  private pass(r: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    r.setRenderTarget(target);
    r.render(this.qScene, this.qCam);
  }

  /** grainFrame: frame index used for grain/dither; pass frame % loop for loops. */
  render(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: PostParams, grainFrame: number) {
    r.setRenderTarget(this.rtScene);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(scene, camera);

    // Downsample pyramid
    let src: THREE.Texture = this.rtScene.texture;
    let sw = this.w,
      sh = this.h;
    for (let i = 0; i < LEVELS; i++) {
      this.downMat.uniforms.tSrc.value = src;
      (this.downMat.uniforms.uTexel.value as THREE.Vector2).set(1 / sw, 1 / sh);
      this.pass(r, this.downMat, this.down[i]);
      src = this.down[i].texture;
      sw = this.down[i].width;
      sh = this.down[i].height;
    }
    // Progressive upsample (bloom). Wider levels get more weight with bloomRadius.
    const rad = p.bloomRadius ?? 0.6;
    let low: THREE.Texture = this.down[LEVELS - 1].texture;
    let lowW = this.down[LEVELS - 1].width,
      lowH = this.down[LEVELS - 1].height;
    for (let i = LEVELS - 2; i >= 0; i--) {
      this.upMat.uniforms.tLow.value = low;
      this.upMat.uniforms.tHigh.value = this.down[i].texture;
      (this.upMat.uniforms.uTexel.value as THREE.Vector2).set(1 / lowW, 1 / lowH);
      this.upMat.uniforms.uLowW.value = 1.0;
      this.upMat.uniforms.uHighW.value = 1.0 - rad * 0.8;
      this.pass(r, this.upMat, this.up[i]);
      low = this.up[i].texture;
      lowW = this.up[i].width;
      lowH = this.up[i].height;
    }

    const u = this.compMat.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocusNear.value = p.focusNear;
    u.uFocusFar.value = p.focusFar;
    u.uNearBlurAt.value = p.nearBlurAt;
    u.uFarBlurAt.value = p.farBlurAt;
    u.uNearCoc.value = p.nearCoc;
    u.uFarCoc.value = p.farCoc;
    u.uBloom.value = p.bloom / LEVELS;
    (u.uBloomTint.value as THREE.Color).copy(p.bloomTint ?? new THREE.Color(1, 1, 1));
    u.uExposure.value = p.exposure;
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uSat.value = p.saturation ?? 1;
    u.uFrame.value = grainFrame >>> 0;
    this.pass(r, this.compMat, null);
  }

  dispose() {
    this.rtScene.dispose();
    this.down.forEach((d) => d.dispose());
    this.up.forEach((d) => d.dispose());
  }
}
