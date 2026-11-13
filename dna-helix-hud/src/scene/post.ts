import * as THREE from "three";

// Custom WebGL 2 post-processing chain:
//   depth pre-pass -> HDR scene (MSAA) -> CoC prefilter (1/2 res)
//   -> golden-angle bokeh gather (1/2 res) -> DOF composite (full res)
//   -> bloom (1/4 + 1/8 res, separable gaussian) -> grade / tonemap /
//   vignette / chromatic aberration / film grain -> screen.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREFILTER = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;  // max blur radius for infinitely far objects (half-res px @540p)
uniform float uMaxCoc;
uniform float uResScale;
uniform vec2 uTexel;      // full-res texel
varying vec2 vUv;
float viewDist(float d) {
  return -(uNear * uFar) / ((uFar - uNear) * d - uFar);
}
void main() {
  vec3 c = vec3(0.0);
  float sumCoc = 0.0;
  float signedCoc = 0.0;
  // 2x2 box downsample of colour, use the nearest depth for CoC.
  float minZ = 1e9;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i - (i / 2) * 2), float(i / 2)) - 0.5;
    vec2 uv = vUv + o * uTexel;
    c += texture2D(tColor, uv).rgb;
    float z = viewDist(texture2D(tDepth, uv).x);
    minZ = min(minZ, z);
  }
  c *= 0.25;
  float z = minZ;
  float coc = uAperture * (z - uFocus) / z;           // signed: <0 near, >0 far
  coc = clamp(coc, -uMaxCoc, uMaxCoc) * uResScale;
  gl_FragColor = vec4(c, coc);
}`;

const BOKEH = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 uTexel;     // half-res texel
uniform float uRadScale;
uniform float uMaxRadius;
varying vec2 vUv;
const float GOLDEN_ANGLE = 2.39996323;
void main() {
  vec4 center = texture2D(tHalf, vUv);
  float centerSize = abs(center.a);
  vec3 col = center.rgb;
  float tot = 1.0;
  float radius = uRadScale;
  float ang = 0.0;
  for (int i = 0; i < 200; i++) {
    if (radius >= uMaxRadius) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec4 s = texture2D(tHalf, tc);
    float sSize = abs(s.a);
    // samples behind the centre pixel may not bleed beyond its own blur
    if (s.a > center.a) sSize = min(sSize, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sSize);
    col += mix(col / tot, s.rgb, m);
    tot += 1.0;
    radius += uRadScale / radius;
    ang += GOLDEN_ANGLE;
  }
  gl_FragColor = vec4(col / tot, center.a);
}`;

const DOF_COMPOSITE = /* glsl */ `
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform float uResScale;
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tSharp, vUv).rgb;
  vec4 b = texture2D(tBlur, vUv);
  float t = smoothstep(0.5 * uResScale, 1.6 * uResScale, abs(b.a));
  gl_FragColor = vec4(mix(sharp, b.rgb, t), 1.0);
}`;

const BRIGHT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      c += texture2D(tInput, vUv + vec2(float(x), float(y)) * uTexel).rgb;
  c /= 9.0;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDir;  // texel * direction
varying vec2 vUv;
void main() {
  float w[7];
  w[0] = 0.1964825501511404; w[1] = 0.2969069646728344; w[2] = 0.09447039785044732;
  w[3] = 0.010381362401148057; w[4] = 0.0; w[5] = 0.0; w[6] = 0.0;
  vec3 c = texture2D(tInput, vUv).rgb * w[0];
  c += texture2D(tInput, vUv + uDir * 1.411764705882353).rgb * w[1];
  c += texture2D(tInput, vUv - uDir * 1.411764705882353).rgb * w[1];
  c += texture2D(tInput, vUv + uDir * 3.2941176470588234).rgb * w[2];
  c += texture2D(tInput, vUv - uDir * 3.2941176470588234).rgb * w[2];
  c += texture2D(tInput, vUv + uDir * 5.176470588235294).rgb * w[3];
  c += texture2D(tInput, vUv - uDir * 5.176470588235294).rgb * w[3];
  gl_FragColor = vec4(c, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform float uBloom;
uniform float uExposure;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uCA;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uFade;
varying vec2 vUv;

vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43;
  const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 d = vUv - 0.5;
  // slight lateral chromatic aberration towards the frame edges
  vec2 ca = d * uCA * dot(d, d);
  vec3 col;
  col.r = texture2D(tInput, vUv - ca).r;
  col.g = texture2D(tInput, vUv).g;
  col.b = texture2D(tInput, vUv + ca).b;
  col += (texture2D(tBloom1, vUv).rgb * 0.6 + texture2D(tBloom2, vUv).rgb * 0.8) * uBloom;
  col *= uExposure;
  col = aces(col);
  // split-tone grade
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(uShadowTint, uHighlightTint, smoothstep(0.05, 0.7, l));
  // vignette
  float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.85)) * uVignette);
  col *= mix(0.25, 1.0, v);
  col = toSRGB(clamp(col, 0.0, 1.0));
  // film grain (deterministic per frame)
  float g = hash(vUv * 1000.0 + fract(uTime * 7.31) * 100.0) - 0.5;
  col += g * uGrain;
  col *= uFade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export type PostParams = {
  focus: number;
  aperture: number;
  bloom: number;
  exposure: number;
  time: number;
  fade: number;
  shadowTint: THREE.Color;
  highlightTint: THREE.Color;
};

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class PostChain {
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private sceneRT: THREE.WebGLRenderTarget;
  private depthRT: THREE.WebGLRenderTarget;
  private halfA: THREE.WebGLRenderTarget;
  private halfB: THREE.WebGLRenderTarget;
  private full: THREE.WebGLRenderTarget;
  private q1a: THREE.WebGLRenderTarget;
  private q1b: THREE.WebGLRenderTarget;
  private q2a: THREE.WebGLRenderTarget;
  private q2b: THREE.WebGLRenderTarget;
  private prefilter: THREE.ShaderMaterial;
  private bokeh: THREE.ShaderMaterial;
  private dof: THREE.ShaderMaterial;
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private final: THREE.ShaderMaterial;
  private resScale: number;

  constructor(
    private renderer: THREE.WebGLRenderer,
    W: number,
    H: number,
  ) {
    const hdr = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { ...hdr, depthBuffer: true, samples: 4 });
    this.depthRT = new THREE.WebGLRenderTarget(W, H, {
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType),
    });
    const hw = Math.round(W / 2);
    const hh = Math.round(H / 2);
    this.halfA = new THREE.WebGLRenderTarget(hw, hh, hdr);
    this.halfB = new THREE.WebGLRenderTarget(hw, hh, hdr);
    this.full = new THREE.WebGLRenderTarget(W, H, hdr);
    this.q1a = new THREE.WebGLRenderTarget(Math.round(W / 4), Math.round(H / 4), hdr);
    this.q1b = new THREE.WebGLRenderTarget(Math.round(W / 4), Math.round(H / 4), hdr);
    this.q2a = new THREE.WebGLRenderTarget(Math.round(W / 8), Math.round(H / 8), hdr);
    this.q2b = new THREE.WebGLRenderTarget(Math.round(W / 8), Math.round(H / 8), hdr);
    // CoC is authored in 540p half-res pixels; scale for the real buffer.
    this.resScale = hh / 540;

    this.prefilter = mat(PREFILTER, {
      tColor: { value: null },
      tDepth: { value: null },
      uNear: { value: 0.1 },
      uFar: { value: 300 },
      uFocus: { value: 5 },
      uAperture: { value: 8 },
      uMaxCoc: { value: 14 },
      uResScale: { value: this.resScale },
      uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
    });
    this.bokeh = mat(BOKEH, {
      tHalf: { value: null },
      uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      uRadScale: { value: 1.0 * this.resScale * this.resScale },
      uMaxRadius: { value: 14.5 * this.resScale },
    });
    this.dof = mat(DOF_COMPOSITE, {
      tSharp: { value: null },
      tBlur: { value: null },
      uResScale: { value: this.resScale },
    });
    this.bright = mat(BRIGHT, {
      tInput: { value: null },
      uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
      uThreshold: { value: 0.55 },
    });
    this.blur = mat(BLUR, { tInput: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.final = mat(FINAL, {
      tInput: { value: null },
      tBloom1: { value: null },
      tBloom2: { value: null },
      uBloom: { value: 0.8 },
      uExposure: { value: 1.0 },
      uTime: { value: 0 },
      uGrain: { value: 0.026 },
      uVignette: { value: 1.0 },
      uCA: { value: 0.012 },
      uShadowTint: { value: new THREE.Color(1, 1, 1) },
      uHighlightTint: { value: new THREE.Color(1, 1, 1) },
      uFade: { value: 1 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.final);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderDepth: (target: THREE.WebGLRenderTarget) => void,
    p: PostParams,
  ) {
    const r = this.renderer;
    // 1. depth pre-pass (HUD layers only write depth where they have content)
    renderDepth(this.depthRT);
    // 2. HDR colour
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(scene, camera);

    // 3. CoC prefilter
    const pu = this.prefilter.uniforms;
    pu.tColor.value = this.sceneRT.texture;
    pu.tDepth.value = this.depthRT.depthTexture;
    pu.uNear.value = camera.near;
    pu.uFar.value = camera.far;
    pu.uFocus.value = p.focus;
    pu.uAperture.value = p.aperture;
    this.pass(this.prefilter, this.halfA);
    // 4. bokeh gather
    this.bokeh.uniforms.tHalf.value = this.halfA.texture;
    this.pass(this.bokeh, this.halfB);
    // 5. composite DOF
    this.dof.uniforms.tSharp.value = this.sceneRT.texture;
    this.dof.uniforms.tBlur.value = this.halfB.texture;
    this.pass(this.dof, this.full);
    // 6. bloom
    this.bright.uniforms.tInput.value = this.full.texture;
    this.pass(this.bright, this.q1a);
    const blurPass = (src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, dx: number, dy: number) => {
      this.blur.uniforms.tInput.value = src.texture;
      (this.blur.uniforms.uDir.value as THREE.Vector2).set(dx / src.width, dy / src.height);
      this.pass(this.blur, dst);
    };
    blurPass(this.q1a, this.q1b, 1, 0);
    blurPass(this.q1b, this.q1a, 0, 1);
    blurPass(this.q1a, this.q2a, 1, 0);
    blurPass(this.q2a, this.q2b, 0, 1);
    blurPass(this.q2b, this.q2a, 1.5, 0);
    blurPass(this.q2a, this.q2b, 0, 1.5);
    // 7. final grade to screen
    const fu = this.final.uniforms;
    fu.tInput.value = this.full.texture;
    fu.tBloom1.value = this.q1a.texture;
    fu.tBloom2.value = this.q2b.texture;
    fu.uBloom.value = p.bloom;
    fu.uExposure.value = p.exposure;
    fu.uTime.value = p.time;
    fu.uFade.value = p.fade;
    (fu.uShadowTint.value as THREE.Color).copy(p.shadowTint);
    (fu.uHighlightTint.value as THREE.Color).copy(p.highlightTint);
    this.pass(this.final, null);
  }

  dispose() {
    [this.sceneRT, this.depthRT, this.halfA, this.halfB, this.full, this.q1a, this.q1b, this.q2a, this.q2b].forEach(
      (t) => t.dispose(),
    );
    [this.prefilter, this.bokeh, this.dof, this.bright, this.blur, this.final].forEach((m) => m.dispose());
  }
}
