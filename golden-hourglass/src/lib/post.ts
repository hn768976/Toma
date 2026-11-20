import * as THREE from "three";

/**
 * Hand-rolled, fully deterministic post chain (no clocks, no temporal passes):
 *   HDR scene (half-float, MSAA) -> bloom mip chain -> depth-of-field blur ->
 *   composite: exposure, tone map, grade, vignette, chromatic aberration,
 *   fixed film grain (hash of pixel + frame) and a +-1/255 dither.
 */
export type PostLook = {
  exposure: number;
  toneMapping: "aces" | "none";
  bloomThreshold: number;
  bloomKnee: number;
  bloomStrength: number;
  /** weights of the bloom mips, tight core first, wide halo last */
  bloomWeights: number[];
  bloomTint: [number, number, number];
  /** depth of field: focus distance (world units from camera), in-focus range, max mix */
  dofRange: number;
  dofDeadZone: number;
  dofStrength: number;
  /** grade, applied after the sRGB encode */
  lift: [number, number, number];
  gain: [number, number, number];
  gamma: number;
  saturation: number;
  vignette: number; // 0 = none, 1 = corners to black
  vignetteStart: number;
  vignetteEnd: number;
  chromaticAberration: number; // fraction of the frame at the corners
  grain: number;
  softness: number; // 0..1 mix of a slight blur over the whole frame (lens softness)
};

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pre(vec3 c){
  c = min(c, vec3(64.0));
  float l = luma(c);
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, l - uThreshold) / max(l, 1e-5);
  return c * w;
}
void main(){
  // 4 bilinear taps with Karis weights so tiny HDR lines do not sparkle
  vec3 a = pre(texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  vec3 b = pre(texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb);
  vec3 c = pre(texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb);
  vec3 d = pre(texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb);
  float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));
  gl_FragColor = vec4((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel; uniform float uWeight; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + uTexel * vec2( 1.0, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(0.0,  1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(s / 16.0 + texture2D(tAdd, vUv).rgb * uWeight, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tBloom;
uniform sampler2D tBlurA; uniform sampler2D tBlurB;
uniform vec2 uRes; uniform float uFrame; uniform float uNear; uniform float uFar; uniform float uFocus;
uniform float uDofRange; uniform float uDofDead; uniform float uDofStrength;
uniform float uExposure; uniform float uBloom; uniform vec3 uBloomTint; uniform float uAces;
uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma; uniform float uSat;
uniform float uVig; uniform float uVigA; uniform float uVigB; uniform float uCA; uniform float uGrain; uniform float uSoft;
uniform float uDepthOn;
varying vec2 vUv;
float hash(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
float viewZ(vec2 uv){
  float d = texture2D(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
vec3 sceneAt(vec2 uv){
  vec3 c = texture2D(tScene, uv).rgb;
  vec3 a = texture2D(tBlurA, uv).rgb;
  vec3 b = texture2D(tBlurB, uv).rgb;
  float coc = 0.0;
  if (uDepthOn > 0.5) {
    float z = viewZ(uv);
    coc = clamp((abs(z - uFocus) / uDofRange) - uDofDead, 0.0, 1.0) * uDofStrength;
  }
  c = mix(c, a, clamp(max(coc * 2.0, uSoft), 0.0, 1.0));
  c = mix(c, b, clamp(coc * 2.0 - 1.0, 0.0, 1.0));
  return c;
}
void main(){
  vec2 p = vUv - 0.5;
  float aspect = uRes.x / uRes.y;
  float r = length(p * vec2(aspect, 1.0)) / length(vec2(aspect, 1.0) * 0.5);
  vec3 c;
  if (uCA > 0.0) {
    vec2 off = p * uCA * r * r;
    c = vec3(sceneAt(vUv + off).r, sceneAt(vUv).g, sceneAt(vUv - off).b);
  } else {
    c = sceneAt(vUv);
  }
  c += texture2D(tBloom, vUv).rgb * uBloom * uBloomTint;
  c *= uExposure;
  c *= 1.0 - uVig * smoothstep(uVigA, uVigB, r);
  c = uAces > 0.5 ? aces(c) : clamp(c, 0.0, 1.0);
  c = toSRGB(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = pow(max(c, vec3(0.0)), vec3(uGamma));
  c = uLift + c * (uGain - uLift);
  // fixed film grain: hash of (1080p-sized pixel cell, frame), faded out in pure black
  vec2 cell = floor(gl_FragCoord.xy * (1080.0 / uRes.y));
  float g = hash(vec3(cell, uFrame)) + hash(vec3(cell + 17.0, uFrame + 31.0)) - 1.0;
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += g * uGrain * smoothstep(0.0, 0.03, l2);
  // +-1/255 dither against banding, never on pure black or pure white
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
  float d = hash(vec3(gl_FragCoord.xy, uFrame + 7.0)) + hash(vec3(gl_FragCoord.xy + 5.0, uFrame + 13.0)) - 1.0;
  if (mx > 0.5 / 255.0 && mn < 1.0 - 0.5 / 255.0) c += d / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const BLOOM_LEVELS = 7;

export class PostChain {
  sceneRT: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private blur: THREE.WebGLRenderTarget[] = [];
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private mPre: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mUp: THREE.ShaderMaterial;
  private mComp: THREE.ShaderMaterial;
  private black: THREE.DataTexture;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private width: number,
    private height: number,
    useDepth = true,
  ) {
    const rt = (w: number, h: number, samples = 0, depth = false) => {
      const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        colorSpace: THREE.LinearSRGBColorSpace,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: depth,
        stencilBuffer: false,
        samples,
        generateMipmaps: false,
      });
      t.texture.wrapS = t.texture.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };
    this.sceneRT = rt(width, height, 4, true);
    if (useDepth) {
      const dt = new THREE.DepthTexture(width, height);
      dt.type = THREE.UnsignedIntType;
      dt.minFilter = dt.magFilter = THREE.NearestFilter;
      this.sceneRT.depthTexture = dt;
    }
    let w = width;
    let h = height;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      w = Math.round(w / 2);
      h = Math.round(h / 2);
      this.down.push(rt(w, h));
      this.up.push(rt(w, h));
    }
    // depth-of-field / softness blurs: 1/2 -> 1/4 (A) -> 1/8 -> 1/4.. (B)
    this.blur = [
      rt(Math.round(width / 2), Math.round(height / 2)),
      rt(Math.round(width / 4), Math.round(height / 4)),
      rt(Math.round(width / 8), Math.round(height / 8)),
      rt(Math.round(width / 4), Math.round(height / 4)),
      rt(Math.round(width / 2), Math.round(height / 2)),
    ];
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
    const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: FS_VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    this.mPre = mat(PREFILTER, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 1 },
      uKnee: { value: 0.5 },
    });
    this.mDown = mat(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mat(UP, {
      tSrc: { value: null },
      tAdd: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uWeight: { value: 1 },
    });
    this.mComp = mat(COMPOSITE, {
      tScene: { value: null },
      tDepth: { value: null },
      tBloom: { value: null },
      tBlurA: { value: null },
      tBlurB: { value: null },
      uRes: { value: new THREE.Vector2(width, height) },
      uFrame: { value: 0 },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 5 },
      uDofRange: { value: 5 },
      uDofDead: { value: 0.2 },
      uDofStrength: { value: 0 },
      uExposure: { value: 1 },
      uBloom: { value: 1 },
      uBloomTint: { value: new THREE.Vector3(1, 1, 1) },
      uAces: { value: 1 },
      uLift: { value: new THREE.Vector3() },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uGamma: { value: 1 },
      uSat: { value: 1 },
      uVig: { value: 0 },
      uVigA: { value: 0.3 },
      uVigB: { value: 1.1 },
      uCA: { value: 0 },
      uGrain: { value: 0 },
      uSoft: { value: 0 },
      uDepthOn: { value: useDepth ? 1 : 0 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mPre);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  /** Call after rendering the scene into `sceneRT`. Draws the final image to the canvas. */
  render(look: PostLook, frame: number, camera: THREE.PerspectiveCamera, focusDistance: number) {
    const r = this.renderer;
    const src = this.sceneRT.texture;
    // ---- bloom
    this.mPre.uniforms.tSrc.value = src;
    this.mPre.uniforms.uTexel.value.set(0.5 / this.width, 0.5 / this.height);
    this.mPre.uniforms.uThreshold.value = look.bloomThreshold;
    this.mPre.uniforms.uKnee.value = look.bloomKnee;
    this.pass(this.mPre, this.down[0]);
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      this.mDown.uniforms.tSrc.value = this.down[i - 1].texture;
      this.mDown.uniforms.uTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
      this.pass(this.mDown, this.down[i]);
    }
    const wts = look.bloomWeights;
    let prev: THREE.Texture = this.black;
    for (let i = BLOOM_LEVELS - 1; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = prev;
      this.mUp.uniforms.tAdd.value = this.down[i].texture;
      this.mUp.uniforms.uWeight.value = wts[i] ?? 0;
      const pw = i === BLOOM_LEVELS - 1 ? 1 : this.up[i + 1].width;
      const ph = i === BLOOM_LEVELS - 1 ? 1 : this.up[i + 1].height;
      this.mUp.uniforms.uTexel.value.set(1 / pw, 1 / ph);
      this.pass(this.mUp, this.up[i]);
      prev = this.up[i].texture;
    }
    // ---- blur pyramid for depth of field / softness
    const b = this.blur;
    const downTo = (from: THREE.Texture, fw: number, fh: number, to: THREE.WebGLRenderTarget) => {
      this.mDown.uniforms.tSrc.value = from;
      this.mDown.uniforms.uTexel.value.set(1 / fw, 1 / fh);
      this.pass(this.mDown, to);
    };
    const upTo = (from: THREE.WebGLRenderTarget, to: THREE.WebGLRenderTarget) => {
      this.mUp.uniforms.tSrc.value = from.texture;
      this.mUp.uniforms.tAdd.value = this.black;
      this.mUp.uniforms.uWeight.value = 0;
      this.mUp.uniforms.uTexel.value.set(1 / from.width, 1 / from.height);
      this.pass(this.mUp, to);
    };
    downTo(src, this.width, this.height, b[0]);
    downTo(b[0].texture, b[0].width, b[0].height, b[1]);
    downTo(b[1].texture, b[1].width, b[1].height, b[2]);
    upTo(b[2], b[3]); // wide blur at 1/4 res
    upTo(b[1], b[4]); // mild blur at 1/2 res
    // ---- composite
    const u = this.mComp.uniforms;
    u.tScene.value = src;
    u.tDepth.value = this.sceneRT.depthTexture ?? this.black;
    u.tBloom.value = this.up[0].texture;
    u.tBlurA.value = b[4].texture;
    u.tBlurB.value = b[3].texture;
    u.uFrame.value = frame;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = focusDistance;
    u.uDofRange.value = look.dofRange;
    u.uDofDead.value = look.dofDeadZone;
    u.uDofStrength.value = look.dofStrength;
    u.uExposure.value = look.exposure;
    u.uBloom.value = look.bloomStrength;
    u.uBloomTint.value.set(...look.bloomTint);
    u.uAces.value = look.toneMapping === "aces" ? 1 : 0;
    u.uLift.value.set(...look.lift);
    u.uGain.value.set(...look.gain);
    u.uGamma.value = look.gamma;
    u.uSat.value = look.saturation;
    u.uVig.value = look.vignette;
    u.uVigA.value = look.vignetteStart;
    u.uVigB.value = look.vignetteEnd;
    u.uCA.value = look.chromaticAberration;
    u.uGrain.value = look.grain;
    u.uSoft.value = look.softness;
    this.pass(this.mComp, null);
    r.setRenderTarget(null);
  }

  dispose() {
    [this.sceneRT, ...this.down, ...this.up, ...this.blur].forEach((t) => t.dispose());
    this.sceneRT.depthTexture?.dispose();
    [this.mPre, this.mDown, this.mUp, this.mComp].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
    this.black.dispose();
  }
}
