import * as THREE from "three";

// Shared post pipeline:
//   scene (HDR, 4x MSAA, depth texture)
//   -> DoF gather (CoC from depth)
//   -> bloom (threshold + dual-filter down/up chain)
//   -> composite: exposure, vignette, ACES, sRGB, grain, dither.
// Every input is a uniform derived from the frame number; nothing persists
// between frames, so any frame can be rendered alone.

export type PostSettings = {
  /** Distance (view space) that is in focus. */
  focus: number;
  /** CoC in px at 2160p per unit of |1 - focus/z|. */
  cocScale: number;
  /** Max CoC radius in px at 2160p. */
  maxCoc: number;
  /** Extra CoC for points closer than focus (multiplier). */
  nearScale?: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee?: number;
  exposure: number;
  vignette: number;
  /** Grain amplitude as fraction of full scale (0.015 = 1.5%). */
  grain: number;
  /** Fade grain and dither to zero below ~3% luminance (keeps black clean). */
  cleanBlack?: boolean;
  /** Saturation applied before tone mapping. */
  saturation?: number;
  /** 0 = hue-preserving tone curve, 1 = per-channel ACES. */
  acesMix?: number;
};

export const SHARED_GLSL = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967296.0); }
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DOF_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float focus;
uniform float cocScale;
uniform float maxCoc;
uniform float nearScale;
varying vec2 vUv;

float viewZ(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
float coc(float z) {
  float c = cocScale * (1.0 - focus / z);
  c = c < 0.0 ? -c * nearScale : c;
  return min(c, maxCoc);
}
const int N = 40;
const float GOLDEN = 2.39996323;
void main() {
  float zc = viewZ(texture2D(tDepth, vUv).r);
  float cc = coc(zc);
  vec3 sum = texture2D(tColor, vUv).rgb;
  float wsum = 1.0;
  if (maxCoc < 0.5) { gl_FragColor = vec4(sum, 1.0); return; }
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    float r = maxCoc * sqrt((fi + 0.5) / float(N));
    float a = fi * GOLDEN;
    vec2 off = vec2(cos(a), sin(a)) * r / resolution;
    vec2 uv = vUv + off;
    float zs = viewZ(texture2D(tDepth, uv).r);
    float cs = coc(zs);
    // Samples behind the centre cannot blur over it more than it is blurred.
    if (zs > zc) cs = min(cs, cc);
    float w = smoothstep(r - 1.0, r + 1.0, cs);
    sum += texture2D(tColor, uv).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}
`;

const THRESH_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb * 4.0;
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tBase;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + texel * vec2(-2.0, 0.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2( 2.0, 0.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.0, -2.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.0,  2.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb * 2.0;
  c += texture2D(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb * 2.0;
  c += texture2D(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb * 2.0;
  c += texture2D(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 + texture2D(tBase, vUv).rgb, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 resolution;
uniform float bloomStrength;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float cleanBlack;
uniform float saturation;
uniform float acesMix;
uniform float frame;
varying vec2 vUv;
${SHARED_GLSL}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  float v = 1.0 - vignette * smoothstep(0.25, 1.05, length(q));
  c *= v * exposure;
  float l0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l0), c, saturation), 0.0);
  // Mix of hue-preserving and per-channel ACES: keeps saturated colours
  // on hue while letting very hot cores roll toward white.
  float m = max(c.r, max(c.g, c.b));
  vec3 hp = c * (aces(vec3(m)).r / max(m, 1e-5));
  c = toSRGB(mix(hp, aces(c), acesMix));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Grain and dither from a fixed formula of pixel position and frame.
  uvec3 seed = uvec3(uvec2(gl_FragCoord.xy), uint(frame));
  vec3 h = hash3(seed);
  float g = (h.x + h.y - 1.0) * grain * 1.7;
  float d = (h.z - 0.5) * 2.0 / 255.0;
  float gFade = mix(1.0, smoothstep(0.03, 0.06, lum), cleanBlack);
  float dFade = mix(1.0, smoothstep(0.5 / 255.0, 2.5 / 255.0, lum), cleanBlack);
  c += vec3(g * gFade + d * dFade);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const makeMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, depth = false, samples = 0) => {
  const t = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
  });
  if (depth) {
    t.depthTexture = new THREE.DepthTexture(w, h);
    t.depthTexture.type = THREE.FloatType;
    t.depthTexture.minFilter = THREE.NearestFilter;
    t.depthTexture.magFilter = THREE.NearestFilter;
  }
  return t;
};

const BLACK = new THREE.Color(0, 0, 0);

export type LookInstance = {
  /** Linear clear colour (fog colour for hazy scenes). Defaults to black. */
  clearColor?: THREE.Color;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Set every animated value from `frame` alone. k = bufferHeight / 2160. */
  update: (frame: number, width: number, height: number, k: number) => void;
  post: PostSettings;
  /** Optional custom draw (multi-pass scenes). Defaults to renderer.render. */
  draw?: (gl: THREE.WebGLRenderer) => void;
  dispose: () => void;
};

export class PostFX {
  private gl: THREE.WebGLRenderer;
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private dofMat = makeMat(DOF_FRAG, {
    tColor: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    focus: { value: 5 },
    cocScale: { value: 0 },
    maxCoc: { value: 0 },
    nearScale: { value: 1 },
  });
  private threshMat = makeMat(THRESH_FRAG, {
    tColor: { value: null },
    texel: { value: new THREE.Vector2() },
    threshold: { value: 1 },
    knee: { value: 0.5 },
  });
  private downMat = makeMat(DOWN_FRAG, {
    tColor: { value: null },
    texel: { value: new THREE.Vector2() },
  });
  private upMat = makeMat(UP_FRAG, {
    tColor: { value: null },
    tBase: { value: null },
    texel: { value: new THREE.Vector2() },
  });
  private compMat = makeMat(COMPOSITE_FRAG, {
    tColor: { value: null },
    tBloom: { value: null },
    resolution: { value: new THREE.Vector2() },
    bloomStrength: { value: 0 },
    exposure: { value: 1 },
    vignette: { value: 0 },
    grain: { value: 0 },
    cleanBlack: { value: 0 },
    saturation: { value: 1 },
    acesMix: { value: 0.35 },
    frame: { value: 0 },
  });

  constructor(gl: THREE.WebGLRenderer) {
    this.gl = gl;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.quad = new THREE.Mesh(g, this.compMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    this.sceneRT = rt(w, h, true, 4);
    this.dofRT = rt(w, h);
    this.down = [];
    this.up = [];
    let dw = w;
    let dh = h;
    for (let i = 0; i < 6; i++) {
      dw = Math.max(1, Math.round(dw / 2));
      dh = Math.max(1, Math.round(dh / 2));
      this.down.push(rt(dw, dh));
      this.up.push(rt(dw, dh));
    }
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(look: LookInstance, frame: number) {
    const gl = this.gl;
    const w = gl.domElement.width;
    const h = gl.domElement.height;
    this.resize(w, h);
    const k = h / 2160;
    look.update(frame, w, h, k);
    const p = look.post;

    gl.autoClear = false;
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(look.clearColor ?? BLACK, 1);
    gl.clear(true, true, true);
    if (look.draw) look.draw(gl);
    else gl.render(look.scene, look.camera);

    // DoF
    const d = this.dofMat.uniforms;
    d.tColor.value = this.sceneRT.texture;
    d.tDepth.value = this.sceneRT.depthTexture;
    d.resolution.value.set(w, h);
    d.cameraNear.value = look.camera.near;
    d.cameraFar.value = look.camera.far;
    d.focus.value = p.focus;
    d.cocScale.value = p.cocScale * k;
    d.maxCoc.value = p.maxCoc * k;
    d.nearScale.value = p.nearScale ?? 1;
    this.pass(this.dofMat, this.dofRT);

    // Bloom
    const t = this.threshMat.uniforms;
    t.tColor.value = this.dofRT.texture;
    t.texel.value.set(1 / w, 1 / h);
    t.threshold.value = p.bloomThreshold;
    t.knee.value = p.bloomKnee ?? p.bloomThreshold * 0.5 + 1e-3;
    this.pass(this.threshMat, this.down[0]);
    for (let i = 1; i < this.down.length; i++) {
      const src = this.down[i - 1];
      this.downMat.uniforms.tColor.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.downMat, this.down[i]);
    }
    let prev = this.down[this.down.length - 1];
    for (let i = this.down.length - 2; i >= 0; i--) {
      this.upMat.uniforms.tColor.value = prev.texture;
      this.upMat.uniforms.tBase.value = this.down[i].texture;
      this.upMat.uniforms.texel.value.set(1 / prev.width, 1 / prev.height);
      this.pass(this.upMat, this.up[i]);
      prev = this.up[i];
    }

    const c = this.compMat.uniforms;
    c.tColor.value = this.dofRT.texture;
    c.tBloom.value = this.up[0].texture;
    c.resolution.value.set(w, h);
    c.bloomStrength.value = p.bloomStrength;
    c.exposure.value = p.exposure;
    c.vignette.value = p.vignette;
    c.grain.value = p.grain;
    c.cleanBlack.value = p.cleanBlack ? 1 : 0;
    c.saturation.value = p.saturation ?? 1;
    c.acesMix.value = p.acesMix ?? 0.35;
    c.frame.value = ((frame % 600) + 600) % 600;
    this.pass(this.compMat, null);
  }

  dispose() {
    if (!this.sceneRT) return;
    this.sceneRT.depthTexture?.dispose();
    this.sceneRT.dispose();
    this.dofRT.dispose();
    this.down.forEach((r) => r.dispose());
    this.up.forEach((r) => r.dispose());
  }
}
