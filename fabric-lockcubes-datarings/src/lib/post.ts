import * as THREE from "three";
import { LOOP } from "./constants";

/**
 * Shared post pipeline, all non-temporal (each frame stands alone):
 *
 *   scene -> sceneRT (HDR, depth texture, mipmapped)
 *         -> DoF gather (fixed golden-angle pattern) -> dofRT
 *         -> [optional extra additive layer, e.g. points with their own DoF]
 *         -> bloom (threshold, down chain, up chain)
 *         -> final: exposure, ACES tonemap, vignette, chroma fringe, sRGB,
 *                   then dither and grain LAST.
 *
 * All sizes that matter visually (CoC, bloom, fringe) are expressed as a
 * fraction of the frame height, so a 720p preview and a 4K render match.
 */

export type DofSettings = {
  enabled: boolean;
  /** View-space distance that is perfectly sharp. */
  focus: number;
  /** CoC (fraction of frame height) = aperture * |d - focus| / d. */
  aperture: number;
  /** Clamp for the CoC, fraction of frame height. */
  maxCoc: number;
  /** Optional floor on the CoC (even the focus plane is a little soft). */
  minCoc?: number;
  /** Number of gather taps (fixed golden-angle pattern). */
  samples: number;
};

export type PostSettings = {
  exposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number; // 0..1 how much the wide levels contribute
  vignette: number; // 0 = none
  fringe: number; // chromatic fringe, fraction of height at the corners
  grain: number; // e.g. 0.01 = 1%
  dither: boolean;
  /** 1 = unchanged. Applied after tonemapping. */
  saturation: number;
  tonemap?: "aces" | "soft";
};

const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const makePass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `precision highp float;\nin vec3 position;\n${FULLSCREEN_VERT}`,
    fragmentShader: `precision highp float;\nprecision highp sampler2D;\n${frag}`,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const DOF_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 resolution;
uniform float near;
uniform float far;
uniform float focus;
uniform float aperture;
uniform float maxCoc;
uniform float minCoc;
uniform int samples;
uniform float isOrtho;

// Convention: every scene shader writes linear view depth into alpha, so
// one fetch per tap gives both colour and depth.
// CoC radius in pixels.
float cocPx(float z) {
  float c = aperture * abs(z - focus) / max(z, 1e-4);
  return clamp(c, minCoc, maxCoc) * resolution.y;
}
void main() {
  vec4 base = textureLod(tColor, vUv, 0.0);
  float z0 = base.a;
  float c0 = cocPx(z0);
  if (c0 < 0.5) {
    outColor = vec4(any(isnan(base.rgb)) || any(isinf(base.rgb)) ? vec3(0.0) : min(base.rgb, vec3(1000.0)), 1.0);
    return;
  }
  // Spacing between taps -> pick a mip so the taps overlap (no holes).
  float spacing = c0 * 1.7724539 / sqrt(float(samples));
  float lod = max(log2(spacing) - 0.5, 0.0);
  vec3 acc = textureLod(tColor, vUv, lod).rgb;
  float wsum = 1.0;
  const float GA = 2.39996323;
  for (int i = 0; i < 128; i++) {
    if (i >= samples) break;
    float fi = float(i);
    float r = sqrt((fi + 0.5) / float(samples)) * c0;
    float a = fi * GA;
    vec2 o = vec2(cos(a), sin(a)) * r;
    vec2 uv = vUv + o / resolution;
    vec4 sc = textureLod(tColor, uv, lod);
    float zs = sc.a;
    float cs = cocPx(zs);
    // A tap counts if it is itself blurred enough to reach this pixel, or
    // if it lies behind the centre (background seen through a blurred fg).
    float w = smoothstep(r - 1.5, r + 1.5, cs);
    w = max(w, step(z0, zs) * smoothstep(r - 1.5, r + 1.5, c0) * 0.5);
    acc += sc.rgb * w;
    wsum += w;
  }
  vec3 o = acc / wsum;
  outColor = vec4(any(isnan(o)) || any(isinf(o)) ? vec3(0.0) : min(o, vec3(1000.0)), 1.0);
}
`;

const FILL_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform vec3 color;
void main() { outColor = vec4(color, 10000.0); } // alpha = "far" view depth
`;

const COPY_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
void main() { outColor = texture(tSrc, vUv); }
`;

// 13-tap "dual filter" style downsample (Jimenez 2014), with soft threshold on the first level.
const DOWN_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float useThreshold;
vec3 s(vec2 o) {
  vec3 c = texture(tSrc, vUv + o * texel).rgb;
  return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : min(c, vec3(1000.0));
}
void main() {
  vec3 a = s(vec2(-2.0, -2.0)), b = s(vec2(0.0, -2.0)), c = s(vec2(2.0, -2.0));
  vec3 d = s(vec2(-1.0, -1.0)), e = s(vec2(1.0, -1.0));
  vec3 f = s(vec2(-2.0, 0.0)), g = s(vec2(0.0, 0.0)), h = s(vec2(2.0, 0.0));
  vec3 i = s(vec2(-1.0, 1.0)), j = s(vec2(1.0, 1.0));
  vec3 k = s(vec2(-2.0, 2.0)), l = s(vec2(0.0, 2.0)), m = s(vec2(2.0, 2.0));
  vec3 col = (d + e + i + j) * 0.125 + (a + b + g + f) * 0.03125 + (b + c + h + g) * 0.03125
           + (f + g + l + k) * 0.03125 + (g + h + m + l) * 0.03125;
  if (useThreshold > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float knee = threshold * 0.5;
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - threshold) / max(br, 1e-4);
    col *= contrib;
  }
  outColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;   // lower (smaller) level, upsampled with a tent
uniform sampler2D tBase;  // this level's downsampled content
uniform vec2 texel;       // texel of tSrc
uniform float weight;
void main() {
  vec3 t = vec3(0.0);
  t += texture(tSrc, vUv + vec2(-1.0, -1.0) * texel).rgb;
  t += texture(tSrc, vUv + vec2( 0.0, -1.0) * texel).rgb * 2.0;
  t += texture(tSrc, vUv + vec2( 1.0, -1.0) * texel).rgb;
  t += texture(tSrc, vUv + vec2(-1.0,  0.0) * texel).rgb * 2.0;
  t += texture(tSrc, vUv).rgb * 4.0;
  t += texture(tSrc, vUv + vec2( 1.0,  0.0) * texel).rgb * 2.0;
  t += texture(tSrc, vUv + vec2(-1.0,  1.0) * texel).rgb;
  t += texture(tSrc, vUv + vec2( 0.0,  1.0) * texel).rgb * 2.0;
  t += texture(tSrc, vUv + vec2( 1.0,  1.0) * texel).rgb;
  outColor = vec4(texture(tBase, vUv).rgb + t / 16.0 * weight, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 resolution;
uniform float exposure;
uniform float bloomStrength;
uniform float vignette;
uniform float fringe;
uniform float grain;
uniform float dither;
uniform float saturation;
uniform float tonemap; // 0 = ACES, 1 = soft shoulder (keeps pastels)
uniform float frame; // already frame % LOOP

// ACES fitted (Narkowicz)
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Integer hash: fixed function of pixel position and frame -> [0,1).
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967296.0;
}
void main() {
  vec2 c = vUv - 0.5;
  vec3 col;
  if (fringe > 0.0) {
    vec2 dir = c * vec2(resolution.x / resolution.y, 1.0);
    vec2 off = dir * fringe * vec2(resolution.y / resolution.x, 1.0) * length(dir);
    col.r = texture(tColor, vUv + off).r + texture(tBloom, vUv + off).r * bloomStrength;
    col.g = texture(tColor, vUv).g + texture(tBloom, vUv).g * bloomStrength;
    col.b = texture(tColor, vUv - off).b + texture(tBloom, vUv - off).b * bloomStrength;
  } else {
    col = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * bloomStrength;
  }
  col *= exposure;
  if (vignette > 0.0) {
    vec2 vc = c * vec2(resolution.x / resolution.y, 1.0);
    col *= mix(1.0, smoothstep(1.15, 0.25, length(vc)), vignette);
  }
  if (tonemap < 0.5) col = aces(col);
  else col = mix(col, 0.8 + 0.2 * (1.0 - exp(-(col - 0.8) / 0.2)), step(0.8, col));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, saturation), 0.0);
  col = toSRGB(col);
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(frame);
  if (grain > 0.0) {
    float g = hash3(uvec3(px, f + 1000u)) + hash3(uvec3(px, f + 7000u)) - 1.0; // triangular -1..1
    col += g * grain;
  }
  if (dither > 0.5) {
    float d = hash3(uvec3(px, f)) + hash3(uvec3(px.yx + 13u, f + 3001u)) - 1.0; // TPDF +-1 LSB
    col += d / 255.0;
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const BLOOM_LEVELS = 6;

export class PostPipeline {
  readonly sceneRT: THREE.WebGLRenderTarget;
  readonly dofRT: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private dofMat: THREE.RawShaderMaterial;
  private copyMat: THREE.RawShaderMaterial;
  private fillMat: THREE.RawShaderMaterial;
  private downMat: THREE.RawShaderMaterial;
  private upMat: THREE.RawShaderMaterial;
  private finalMat: THREE.RawShaderMaterial;
  width = 0;
  height = 0;

  constructor(opts: { msaa: number }) {
    const rtOpts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
      samples: opts.msaa,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.sceneRT.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
    this.dofRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const o = {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
        depthBuffer: false,
      };
      this.bloomDown.push(new THREE.WebGLRenderTarget(1, 1, o));
      this.bloomUp.push(new THREE.WebGLRenderTarget(1, 1, o));
    }
    this.dofMat = makePass(DOF_FRAG, {
      tColor: { value: null },
      resolution: { value: new THREE.Vector2() },
      near: { value: 0.1 },
      far: { value: 100 },
      focus: { value: 10 },
      aperture: { value: 0 },
      maxCoc: { value: 0.03 },
      minCoc: { value: 0 },
      samples: { value: 48 },
      isOrtho: { value: 0 },
    });
    this.copyMat = makePass(COPY_FRAG, { tSrc: { value: null } });
    this.fillMat = makePass(FILL_FRAG, { color: { value: new THREE.Color() } });
    this.downMat = makePass(DOWN_FRAG, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2() },
      threshold: { value: 1 },
      useThreshold: { value: 0 },
    });
    this.upMat = makePass(UP_FRAG, {
      tSrc: { value: null },
      tBase: { value: null },
      texel: { value: new THREE.Vector2() },
      weight: { value: 1 },
    });
    this.finalMat = makePass(FINAL_FRAG, {
      tColor: { value: null },
      tBloom: { value: null },
      resolution: { value: new THREE.Vector2() },
      exposure: { value: 1 },
      bloomStrength: { value: 0 },
      vignette: { value: 0 },
      fringe: { value: 0 },
      grain: { value: 0 },
      dither: { value: 1 },
      saturation: { value: 1 },
      tonemap: { value: 0 },
      frame: { value: 0 },
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.quad = new THREE.Mesh(geo, this.copyMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.sceneRT.setSize(w, h);
    this.dofRT.setSize(w, h);
    let bw = w;
    let bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
      this.bloomDown[i].setSize(bw, bh);
      this.bloomUp[i].setSize(bw, bh);
    }
  }

  private pass(gl: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  /** Begin: render target for the main scene. */
  beginScene(gl: THREE.WebGLRenderer, clear: THREE.Color) {
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(clear, 1);
    gl.clear(true, true, true);
    // Background with "far" depth in alpha (see the DoF convention).
    this.fillMat.uniforms.color.value.copy(clear);
    this.pass(gl, this.fillMat, this.sceneRT);
  }

  /** DoF from sceneRT into dofRT. Returns the texture holding the result. */
  dof(gl: THREE.WebGLRenderer, cam: THREE.PerspectiveCamera, s: DofSettings): THREE.WebGLRenderTarget {
    if (!s.enabled) {
      this.copyMat.uniforms.tSrc.value = this.sceneRT.texture;
      this.pass(gl, this.copyMat, this.dofRT);
      return this.dofRT;
    }
    const u = this.dofMat.uniforms;
    u.tColor.value = this.sceneRT.texture;
    u.resolution.value.set(this.width, this.height);
    u.near.value = cam.near;
    u.far.value = cam.far;
    u.focus.value = s.focus;
    u.aperture.value = s.aperture;
    u.maxCoc.value = s.maxCoc;
    u.minCoc.value = s.minCoc ?? 0;
    u.samples.value = s.samples;
    this.pass(gl, this.dofMat, this.dofRT);
    return this.dofRT;
  }

  /** Bloom + grade + dither + grain to the canvas. */
  finish(gl: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, frame: number, p: PostSettings) {
    // Down chain
    let prev: THREE.Texture = src.texture;
    let pw = this.width;
    let ph = this.height;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const u = this.downMat.uniforms;
      u.tSrc.value = prev;
      u.texel.value.set(1 / pw, 1 / ph);
      u.threshold.value = p.bloomThreshold;
      u.useThreshold.value = i === 0 ? 1 : 0;
      this.pass(gl, this.downMat, this.bloomDown[i]);
      prev = this.bloomDown[i].texture;
      pw = this.bloomDown[i].width;
      ph = this.bloomDown[i].height;
    }
    // Up chain
    let low: THREE.WebGLRenderTarget = this.bloomDown[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      const u = this.upMat.uniforms;
      u.tSrc.value = low.texture;
      u.tBase.value = this.bloomDown[i].texture;
      u.texel.value.set(1 / low.width, 1 / low.height);
      u.weight.value = 0.6 + 0.4 * p.bloomRadius;
      this.pass(gl, this.upMat, this.bloomUp[i]);
      low = this.bloomUp[i];
    }
    const f = this.finalMat.uniforms;
    f.tColor.value = src.texture;
    f.tBloom.value = this.bloomUp[0].texture;
    f.resolution.value.set(this.width, this.height);
    f.exposure.value = p.exposure;
    f.bloomStrength.value = p.bloomStrength / BLOOM_LEVELS;
    f.vignette.value = p.vignette;
    f.fringe.value = p.fringe;
    f.grain.value = p.grain;
    f.dither.value = p.dither ? 1 : 0;
    f.saturation.value = p.saturation;
    f.tonemap.value = p.tonemap === "soft" ? 1 : 0;
    f.frame.value = ((frame % LOOP) + LOOP) % LOOP;
    this.pass(gl, this.finalMat, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.dofRT.dispose();
    this.bloomDown.forEach((r) => r.dispose());
    this.bloomUp.forEach((r) => r.dispose());
  }
}
