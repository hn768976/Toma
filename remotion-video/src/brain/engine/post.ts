import {
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type IUniform,
} from "three";

// Post pipeline shared by every look:
//   scene (linear, premultiplied, half-float, optional MSAA)
//   -> bloom (half-float mip chain: prefilter/downsample, tent upsample)
//   -> composite: background(uv) in display space, scene + bloom tone-mapped
//      and encoded to sRGB, then +-1/255 blue-noise dither.
// The dither is masked off wherever the output equals a protected key colour
// (pure black / #00FF00), and values within a hair of the key snap to it, so
// keyable backgrounds stay exact code values.

export type PostConfig = {
  msaa: number;
  bloom: null | { strength: number; threshold: number; knee: number; levels: number; radius: number };
  /** GLSL body of `vec3 background(vec2 uv)` returning display-space (sRGB) colour. */
  background: string;
  uniforms?: Record<string, IUniform>;
  key: null | [number, number, number];
  exposure: number;
  /** extra GLSL applied to the linear scene colour before tone mapping (optional). */
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
in vec2 vUv;
out vec4 outColor;
vec3 q(vec2 o) { return texture(tSrc, vUv + o * texel).rgb; }
void main() {
  // 4 bilinear taps = 16 texel box, then soft-knee threshold
  vec3 c = 0.25 * (q(vec2(-1.0, -1.0)) + q(vec2(1.0, -1.0)) + q(vec2(-1.0, 1.0)) + q(vec2(1.0, 1.0)));
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-5);
  float w = max(rq, br - threshold) / max(br, 1e-5);
  outColor = vec4(c * w, 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
in vec2 vUv;
out vec4 outColor;
vec3 q(vec2 o) { return texture(tSrc, vUv + o * texel).rgb; }
void main() {
  vec3 c = q(vec2(0.0)) * 0.5;
  c += (q(vec2(-1.0, -1.0)) + q(vec2(1.0, -1.0)) + q(vec2(-1.0, 1.0)) + q(vec2(1.0, 1.0))) * 0.125;
  outColor = vec4(c, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSmall;
uniform sampler2D tCur;
uniform vec2 texel;
uniform float radius;
in vec2 vUv;
out vec4 outColor;
vec3 q(vec2 o) { return texture(tSmall, vUv + o * texel).rgb; }
void main() {
  vec3 s = q(vec2(0.0)) * 4.0;
  s += (q(vec2(-1.0, 0.0)) + q(vec2(1.0, 0.0)) + q(vec2(0.0, -1.0)) + q(vec2(0.0, 1.0))) * 2.0;
  s += q(vec2(-1.0, -1.0)) + q(vec2(1.0, -1.0)) + q(vec2(-1.0, 1.0)) + q(vec2(1.0, 1.0));
  s /= 16.0;
  outColor = vec4(texture(tCur, vUv).rgb + s * radius, 1.0);
}`;

const compositeFrag = (background: string, decl: string) => /* glsl */ `
${decl}
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tNoise;
uniform float bloomStrength;
uniform float exposure;
uniform vec3 keyColor;
uniform float keyOn;
uniform vec2 resolution;
uniform float frame;
uniform float aspect;
in vec2 vUv;
out vec4 outColor;

vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Linear up to 0.75, then a smooth shoulder to 1.0 (keeps mid-tones exact).
vec3 shoulder(vec3 x) {
  vec3 k = vec3(0.75);
  vec3 over = max(x - k, 0.0);
  return min(x, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}

vec3 background(vec2 uv) {
${background}
}

void main() {
  vec4 s = texture(tScene, vUv);
  vec3 l = s.rgb;
  ${"#ifdef BLOOM"}
  l += texture(tBloom, vUv).rgb * bloomStrength;
  ${"#endif"}
  l *= exposure;
  vec3 c = toSRGB(shoulder(l));
  float a = clamp(s.a, 0.0, 1.0);
  vec3 bg = background(vUv);
  vec3 o = bg * (1.0 - a) + c;
  // Blue-noise dither, +-1/255.
  float n = texelFetch(tNoise, ivec2(mod(gl_FragCoord.xy, 64.0)), 0).r;
  float d = (n + 0.5 / 256.0 - 0.5) * (2.0 / 255.0);
  if (keyOn > 0.5) {
    vec3 diff = abs(o - keyColor);
    float m = max(diff.r, max(diff.g, diff.b));
    // snap near-key values to the key, never dither the key itself
    float keep = smoothstep(0.6 / 255.0, 2.5 / 255.0, m);
    o = mix(keyColor, o, keep);
    d *= keep;
  }
  outColor = vec4(clamp(o + d, 0.0, 1.0), 1.0);
}`;

// GLSL declarations for a look's extra background uniforms.
const declare = (u: Record<string, IUniform>) =>
  Object.entries(u)
    .map(([k, { value: v }]) => {
      const t =
        typeof v === "number" ? "float" : Array.isArray(v) ? `vec${v.length}` : v instanceof Vector2 ? "vec2" : "vec3";
      return `uniform ${t} ${k};`;
    })
    .join("\n");

export class Post {
  readonly gl: WebGLRenderer;
  readonly scene: WebGLRenderTarget;
  readonly size = new Vector2();
  private down: WebGLRenderTarget[] = [];
  private up: WebGLRenderTarget[] = [];
  private quadScene = new Scene();
  private quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private prefilter: ShaderMaterial | null = null;
  private downMat: ShaderMaterial | null = null;
  private upMat: ShaderMaterial | null = null;
  readonly composite: ShaderMaterial;
  private noise: DataTexture;
  private cfg: PostConfig;

  constructor(gl: WebGLRenderer, cfg: PostConfig, blueNoise: Uint8Array) {
    this.gl = gl;
    this.cfg = cfg;
    gl.getDrawingBufferSize(this.size);
    const w = this.size.x;
    const h = this.size.y;
    this.scene = new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      format: RGBAFormat,
      samples: cfg.msaa,
      depthBuffer: true,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    this.noise = new DataTexture(blueNoise, 64, 64, RedFormat, UnsignedByteType);
    this.noise.minFilter = NearestFilter;
    this.noise.magFilter = NearestFilter;
    this.noise.wrapS = this.noise.wrapT = RepeatWrapping;
    this.noise.needsUpdate = true;

    this.quad = new Mesh(new PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    if (cfg.bloom) {
      let bw = w;
      let bh = h;
      for (let i = 0; i < cfg.bloom.levels; i++) {
        bw = Math.max(1, Math.round(bw / 2));
        bh = Math.max(1, Math.round(bh / 2));
        const opts = { type: HalfFloatType, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter };
        this.down.push(new WebGLRenderTarget(bw, bh, opts));
        this.up.push(new WebGLRenderTarget(bw, bh, opts));
      }
      const mk = (frag: string, uniforms: Record<string, IUniform>) =>
        new ShaderMaterial({ glslVersion: "300 es" as never, vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending: NoBlending });
      this.prefilter = mk(PREFILTER, {
        tSrc: { value: null },
        texel: { value: new Vector2() },
        threshold: { value: cfg.bloom.threshold },
        knee: { value: cfg.bloom.knee },
      });
      this.downMat = mk(DOWN, { tSrc: { value: null }, texel: { value: new Vector2() } });
      this.upMat = mk(UP, { tSmall: { value: null }, tCur: { value: null }, texel: { value: new Vector2() }, radius: { value: cfg.bloom.radius } });
    }

    this.composite = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: VERT,
      fragmentShader: compositeFrag(cfg.background, declare(cfg.uniforms ?? {})),
      defines: cfg.bloom ? { BLOOM: 1 } : {},
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.up[0]?.texture ?? null },
        tNoise: { value: this.noise },
        bloomStrength: { value: cfg.bloom?.strength ?? 0 },
        exposure: { value: cfg.exposure },
        keyColor: { value: cfg.key ?? [0, 0, 0] },
        keyOn: { value: cfg.key ? 1 : 0 },
        resolution: { value: new Vector2(w, h) },
        frame: { value: 0 },
        aspect: { value: w / h },
        ...(cfg.uniforms ?? {}),
      },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
  }

  /** Bind the scene target and clear it to transparent black. */
  begin() {
    const gl = this.gl;
    gl.autoClear = false;
    gl.setRenderTarget(this.scene);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  /** Bloom + composite to the canvas. */
  end(frame: number) {
    const b = this.cfg.bloom;
    if (b && this.prefilter && this.downMat && this.upMat) {
      // down chain
      let src = this.scene.texture;
      let sw = this.size.x;
      let sh = this.size.y;
      for (let i = 0; i < this.down.length; i++) {
        const m = i === 0 ? this.prefilter : this.downMat;
        m.uniforms.tSrc.value = src;
        (m.uniforms.texel.value as Vector2).set(1 / sw, 1 / sh);
        this.pass(m, this.down[i]);
        src = this.down[i].texture;
        sw = this.down[i].width;
        sh = this.down[i].height;
      }
      // up chain: up[last] = down[last]; up[i] = down[i] + tent(up[i+1]) * radius
      const last = this.down.length - 1;
      for (let i = last - 1; i >= 0; i--) {
        const small = i + 1 === last ? this.down[last] : this.up[i + 1];
        this.upMat.uniforms.tSmall.value = small.texture;
        this.upMat.uniforms.tCur.value = this.down[i].texture;
        (this.upMat.uniforms.texel.value as Vector2).set(1 / small.width, 1 / small.height);
        this.pass(this.upMat, this.up[i]);
      }
    }
    this.composite.uniforms.frame.value = frame;
    this.pass(this.composite, null);
  }

  dispose() {
    this.scene.dispose();
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.noise.dispose();
    this.composite.dispose();
    this.prefilter?.dispose();
    this.downMat?.dispose();
    this.upMat?.dispose();
  }
}

/** Pixel scale relative to the 2160p design resolution. */
export const pxScale = (post: Post) => post.size.y / 2160;
