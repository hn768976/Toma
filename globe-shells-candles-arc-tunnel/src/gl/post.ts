import * as THREE from "three";

// Single-frame post chain: HDR scene target -> deterministic bloom mip chain
// (13-tap downsample, tent upsample, additive) -> composite with background
// glow, vignette, soft shoulder, grain and +-1/255 dither. No history buffers.

export type PostSettings = {
  background: [number, number, number];
  // Up to two soft elliptical glows added behind the scene (screen space).
  glows: {
    center: [number, number]; // uv, 0..1, y up
    radius: [number, number]; // in units of frame height
    color: [number, number, number];
    strength: number;
    falloff?: number; // 4 = flat-topped, 2 = gaussian, 1 = exponential
  }[];
  bloomStrength: number;
  bloomLevels?: number;
  exposure?: number;
  vignette: number; // 0..1 darkening at the corners
  vignetteColor?: [number, number, number];
  grain: number; // e.g. 0.015
  grainLumaCut?: number; // fade grain and dither to zero below this luminance
};

const fullscreenTriangle = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  return g;
};

const VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2., 2.)), b = s(vec2(0., 2.)), c = s(vec2(2., 2.));
  vec3 d = s(vec2(-2., 0.)), e = s(vec2(0., 0.)), f = s(vec2(2., 0.));
  vec3 g = s(vec2(-2., -2.)), h = s(vec2(0., -2.)), i = s(vec2(2., -2.));
  vec3 j = s(vec2(-1., 1.)), k = s(vec2(1., 1.)), l = s(vec2(-1., -1.)), m = s(vec2(1., -1.));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(col, 1.0);
}`;

const UP = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uRadius;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel * uRadius).rgb; }
void main() {
  vec3 col = s(vec2(0.)) * 4.0
    + (s(vec2(-1., 0.)) + s(vec2(1., 0.)) + s(vec2(0., -1.)) + s(vec2(0., 1.))) * 2.0
    + (s(vec2(-1., -1.)) + s(vec2(1., -1.)) + s(vec2(-1., 1.)) + s(vec2(1., 1.)));
  outColor = vec4(col / 16.0, 1.0);
}`;

const COMPOSITE = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform vec3 uBg;
uniform vec2 uGlowC[2];
uniform vec2 uGlowR[2];
uniform vec3 uGlowCol[2];
uniform float uGlowS[2];
uniform float uGlowF[2];
uniform float uBloom;
uniform float uExposure;
uniform float uVig;
uniform vec3 uVigCol;
uniform float uGrain;
uniform float uLumaCut;
uniform uint uFrame;
in vec2 vUv;
out vec4 outColor;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967295.0;
}
vec3 shoulder(vec3 c) {
  const float k = 0.78;
  vec3 over = max(c - k, 0.0);
  return min(c, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec3 col = uBg;
  for (int i = 0; i < 2; i++) {
    vec2 d = (vUv - uGlowC[i]) * vec2(aspect, 1.0) / uGlowR[i];
    float r2 = dot(d, d);
    float g = uGlowF[i] > 3.5 ? exp(-r2 * r2) : (uGlowF[i] > 1.5 ? exp(-r2) : exp(-sqrt(r2)));
    col += uGlowCol[i] * uGlowS[i] * g;
  }
  col += texture(tScene, vUv).rgb * uExposure;
  col += texture(tBloom, vUv).rgb * uBloom;

  // Vignette: darken toward a corner colour, strongest in the corners.
  vec2 q = (vUv - 0.5) * vec2(aspect / 1.7778, 1.0) * 2.0;
  float v = clamp(dot(q, q) * 0.5, 0.0, 1.0);
  v = smoothstep(0.15, 1.0, v) * uVig;
  col = mix(col, uVigCol, v);

  col = shoulder(max(col, 0.0));

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float mask = uLumaCut > 0.0 ? smoothstep(uLumaCut * 0.35, uLumaCut, lum) : 1.0;
  uvec2 p = uvec2(gl_FragCoord.xy);
  // Grain: triangular noise from pixel position and loop frame, monochrome.
  float n = rnd(uvec3(p, uFrame)) + rnd(uvec3(p.yx + 7919u, uFrame + 613u)) - 1.0;
  col += n * uGrain * mask;
  // Dither +-1/255 (independent per channel), applied last before quantising.
  vec3 dz = vec3(rnd(uvec3(p, uFrame * 3u + 1u)), rnd(uvec3(p, uFrame * 3u + 2u)), rnd(uvec3(p, uFrame * 3u + 3u)));
  col += (dz - 0.5) * (2.0 / 255.0) * mask;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const makeRT = (w: number, h: number, type: THREE.TextureDataType) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

export class PostChain {
  private scene: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private quadScene = new THREE.Scene();
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private down: THREE.RawShaderMaterial;
  private up: THREE.RawShaderMaterial;
  private comp: THREE.RawShaderMaterial;

  constructor(
    private gl: THREE.WebGLRenderer,
    public width: number,
    public height: number,
    levels: number,
  ) {
    const type = gl.extensions.has("EXT_color_buffer_float")
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;
    this.scene = makeRT(width, height, type);
    let w = width;
    let h = height;
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      this.mips.push(makeRT(w, h, type));
    }
    const base = { vertexShader: VERT, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false };
    this.down = new THREE.RawShaderMaterial({
      ...base,
      fragmentShader: DOWN,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    });
    this.up = new THREE.RawShaderMaterial({
      ...base,
      fragmentShader: UP,
      blending: THREE.AdditiveBlending,
      transparent: true,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
      },
    });
    this.comp = new THREE.RawShaderMaterial({
      ...base,
      fragmentShader: COMPOSITE,
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.mips[0].texture },
        uRes: { value: new THREE.Vector2(width, height) },
        uBg: { value: new THREE.Vector3() },
        uGlowC: { value: [new THREE.Vector2(), new THREE.Vector2()] },
        uGlowR: { value: [new THREE.Vector2(1, 1), new THREE.Vector2(1, 1)] },
        uGlowCol: { value: [new THREE.Vector3(), new THREE.Vector3()] },
        uGlowS: { value: [0, 0] },
        uGlowF: { value: [2, 2] },
        uBloom: { value: 0 },
        uExposure: { value: 1 },
        uVig: { value: 0 },
        uVigCol: { value: new THREE.Vector3() },
        uGrain: { value: 0 },
        uLumaCut: { value: 0 },
        uFrame: { value: 0 },
      },
    });
    this.quad = new THREE.Mesh(fullscreenTriangle(), this.down);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null, clear: boolean) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    if (clear) this.gl.clear();
    this.gl.render(this.quadScene, this.cam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, s: PostSettings, loopFrame: number) {
    const gl = this.gl;
    gl.autoClear = false;
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(this.scene);
    gl.clear();
    gl.render(scene, camera);

    // Bloom chain.
    let src = this.scene;
    for (const m of this.mips) {
      this.down.uniforms.tSrc.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.down, m, true);
      src = m;
    }
    for (let i = this.mips.length - 1; i > 0; i--) {
      const from = this.mips[i];
      this.up.uniforms.tSrc.value = from.texture;
      this.up.uniforms.uTexel.value.set(1 / from.width, 1 / from.height);
      this.pass(this.up, this.mips[i - 1], false);
    }

    const u = this.comp.uniforms;
    u.uBg.value.set(...s.background);
    for (let i = 0; i < 2; i++) {
      const g = s.glows[i];
      u.uGlowS.value[i] = g ? g.strength : 0;
      if (g) {
        u.uGlowC.value[i].set(...g.center);
        u.uGlowR.value[i].set(...g.radius);
        u.uGlowCol.value[i].set(...g.color);
        u.uGlowF.value[i] = g.falloff ?? 2;
      }
    }
    u.uBloom.value = s.bloomStrength / this.mips.length;
    u.uExposure.value = s.exposure ?? 1;
    u.uVig.value = s.vignette;
    u.uVigCol.value.set(...(s.vignetteColor ?? [0, 0, 0]));
    u.uGrain.value = s.grain;
    u.uLumaCut.value = s.grainLumaCut ?? 0;
    u.uFrame.value = loopFrame;
    this.pass(this.comp, null, true);
  }

  dispose() {
    this.scene.dispose();
    this.mips.forEach((m) => m.dispose());
    this.down.dispose();
    this.up.dispose();
    this.comp.dispose();
    this.quad.geometry.dispose();
  }
}
