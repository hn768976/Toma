import * as THREE from "three";

// Post chain shared by every three.js look.
//   scene → half-float MSAA target → bloom mip chain (half-float)
//   → composite: bloom, optional DoF, tone curve, linear→sRGB, grain, dither.
// Grain and dither come from an integer hash of pixel position and loop frame,
// so a frame always renders the same bytes whatever order frames come in.

export type PostOptions = {
  bloomStrength: number;
  bloomRadius: number; // 0..1, how much the wide mips contribute
  bloomThreshold: number; // linear luminance where bloom starts
  bloomKnee: number;
  bloomTint: THREE.ColorRepresentation;
  exposure: number;
  grain: number; // 0.01 = 1 %
  dither: boolean;
  // Depth of field (glass only). Focus and range are in view-space units.
  dof?: { focus: number; range: number; maxRadiusPx: number };
  // Whiteness of the highlight roll-off: 0 keeps hue, 1 burns to white.
  whiteBurn: number;
  // Number of bloom mips; fewer keeps the halo tight to the source.
  levels?: number;
  // When true, the scene's alpha channel is a bloom mask (emitters write 1,
  // backgrounds write 0) and the bloom source is rgb * alpha.
  bloomMask?: boolean;
};

const vsFull = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const makeTri = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
};

const raw = (fs: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vsFull,
    fragmentShader: "precision highp float;\nprecision highp int;\n" + fs,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const prefilterFs = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
uniform float useMask;
in vec2 vUv;
out vec4 outColor;
vec3 pf(vec4 t) {
  vec3 c = t.rgb * mix(1.0, clamp(t.a, 0.0, 1.0), useMask);
  if (threshold <= 0.0) return c; // linear bloom: no rope artifacts on thin lines
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  return c * contrib;
}
void main() {
  // 4-tap box with Karis-style weighting against fireflies.
  vec4 a = texture(tSrc, vUv + texel * vec2(-1.0, -1.0));
  vec4 b = texture(tSrc, vUv + texel * vec2( 1.0, -1.0));
  vec4 c = texture(tSrc, vUv + texel * vec2(-1.0,  1.0));
  vec4 d = texture(tSrc, vUv + texel * vec2( 1.0,  1.0));
  vec3 s = pf(a) + pf(b) + pf(c) + pf(d);
  outColor = vec4(min(s * 0.25, vec3(64.0)), 1.0);
}`;

const downFs = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
in vec2 vUv;
out vec4 outColor;
void main() {
  // 13-tap downsample (Jimenez 2014).
  vec3 A = texture(tSrc, vUv + texel * vec2(-2.0, -2.0)).rgb;
  vec3 B = texture(tSrc, vUv + texel * vec2( 0.0, -2.0)).rgb;
  vec3 C = texture(tSrc, vUv + texel * vec2( 2.0, -2.0)).rgb;
  vec3 D = texture(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  vec3 E = texture(tSrc, vUv).rgb;
  vec3 F = texture(tSrc, vUv + texel * vec2( 1.0, -1.0)).rgb;
  vec3 G = texture(tSrc, vUv + texel * vec2(-2.0,  0.0)).rgb;
  vec3 H = texture(tSrc, vUv + texel * vec2( 2.0,  0.0)).rgb;
  vec3 I = texture(tSrc, vUv + texel * vec2(-1.0,  1.0)).rgb;
  vec3 J = texture(tSrc, vUv + texel * vec2( 1.0,  1.0)).rgb;
  vec3 K = texture(tSrc, vUv + texel * vec2(-2.0,  2.0)).rgb;
  vec3 L = texture(tSrc, vUv + texel * vec2( 0.0,  2.0)).rgb;
  vec3 M = texture(tSrc, vUv + texel * vec2( 2.0,  2.0)).rgb;
  vec3 r = (D + F + I + J) * 0.125;
  r += (A + B + G + E) * 0.03125;
  r += (B + C + E + H) * 0.03125;
  r += (G + E + K + L) * 0.03125;
  r += (E + H + L + M) * 0.03125;
  outColor = vec4(r, 1.0);
}`;

const upFs = /* glsl */ `
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 texel; // texel of the low-res source
uniform float radius;
in vec2 vUv;
out vec4 outColor;
void main() {
  // 3x3 tent upsample of the coarser level, added to the finer level.
  vec3 s = texture(tLow, vUv + texel * vec2(-1.0, -1.0)).rgb;
  s += texture(tLow, vUv + texel * vec2( 0.0, -1.0)).rgb * 2.0;
  s += texture(tLow, vUv + texel * vec2( 1.0, -1.0)).rgb;
  s += texture(tLow, vUv + texel * vec2(-1.0,  0.0)).rgb * 2.0;
  s += texture(tLow, vUv).rgb * 4.0;
  s += texture(tLow, vUv + texel * vec2( 1.0,  0.0)).rgb * 2.0;
  s += texture(tLow, vUv + texel * vec2(-1.0,  1.0)).rgb;
  s += texture(tLow, vUv + texel * vec2( 0.0,  1.0)).rgb * 2.0;
  s += texture(tLow, vUv + texel * vec2( 1.0,  1.0)).rgb;
  s *= 1.0 / 16.0;
  outColor = vec4(texture(tHigh, vUv).rgb + s * radius, 1.0);
}`;

const compositeFs = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float bloomStrength;
uniform vec3 bloomTint;
uniform float exposure;
uniform float grain;
uniform float ditherAmt;
uniform float whiteBurn;
uniform uint frameSeed;
uniform float useDof;
uniform float dofFocus;
uniform float dofRange;
uniform float dofMaxPx;
uniform float cameraNear;
uniform float cameraFar;
in vec2 vUv;
out vec4 outColor;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(uvec2 p, uint s) {
  return float(pcg(p.x + pcg(p.y + pcg(s)))) / 4294967295.0;
}
float viewZ(float d) {
  // perspective depth → positive view distance
  float z = d * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
vec3 toneCurve(vec3 c) {
  // Identity below the knee so the authored hex colours land exactly;
  // above it, a soft shoulder that bleeds energy into white (hot cores).
  float m = max(c.r, max(c.g, c.b));
  const float knee = 0.72;
  if (m <= knee) return c;
  float over = m - knee;
  float mapped = knee + (1.0 - knee) * (1.0 - exp(-over / (1.0 - knee)));
  vec3 col = c * (mapped / m);
  float burn = clamp(over / 2.5, 0.0, 1.0) * whiteBurn;
  return mix(col, vec3(mapped), burn);
}
float srgb(float x) {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}
void main() {
  vec3 col;
  if (useDof > 0.5) {
    float d0 = viewZ(texture(tDepth, vUv).r);
    float coc = clamp(abs(d0 - dofFocus) / dofRange, 0.0, 1.0) * dofMaxPx;
    vec3 acc = texture(tScene, vUv).rgb;
    float wsum = 1.0;
    if (coc > 0.4) {
      // golden-angle disk, 24 taps
      for (int i = 1; i < 24; i++) {
        float fi = float(i);
        float r = sqrt(fi / 24.0) * coc;
        float a = fi * 2.39996323;
        vec2 o = vec2(cos(a), sin(a)) * r / resolution;
        vec3 s = texture(tScene, vUv + o).rgb;
        acc += s;
        wsum += 1.0;
      }
    }
    col = acc / wsum;
  } else {
    col = texture(tScene, vUv).rgb;
  }
  vec3 bloom = texture(tBloom, vUv).rgb * bloomTint * bloomStrength;
  col = (col + bloom) * exposure;
  col = toneCurve(max(col, vec3(0.0)));
  col = clamp(col, 0.0, 1.0);
  vec3 s = vec3(srgb(col.r), srgb(col.g), srgb(col.b));

  uvec2 px = uvec2(gl_FragCoord.xy);
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  // ~1 % luminance grain, faded out in the near-blacks
  float gfade = smoothstep(0.03, 0.08, lum);
  float gn = (rnd(px, frameSeed * 3u + 1u) + rnd(px, frameSeed * 3u + 2u) - 1.0);
  s += gn * grain * gfade;
  // ±1/255 triangular dither ahead of 8-bit quantisation
  float dn = rnd(px, frameSeed * 7u + 11u) - rnd(px, frameSeed * 7u + 13u);
  s += dn * ditherAmt / 255.0;
  outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

export class PostFX {
  private renderer: THREE.WebGLRenderer;
  private opts: PostOptions;
  private sceneRT!: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private tri = makeTri();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private prefilter: THREE.RawShaderMaterial;
  private down: THREE.RawShaderMaterial;
  private up: THREE.RawShaderMaterial;
  private composite: THREE.RawShaderMaterial;
  private w = 0;
  private h = 0;
  private levels = 7;

  constructor(renderer: THREE.WebGLRenderer, opts: PostOptions) {
    this.renderer = renderer;
    this.opts = opts;
    this.levels = opts.levels ?? 7;
    this.prefilter = raw(prefilterFs, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2() },
      threshold: { value: opts.bloomThreshold },
      knee: { value: opts.bloomKnee },
      useMask: { value: opts.bloomMask ? 1 : 0 },
    });
    this.down = raw(downFs, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = raw(upFs, {
      tLow: { value: null },
      tHigh: { value: null },
      texel: { value: new THREE.Vector2() },
      radius: { value: opts.bloomRadius },
    });
    this.composite = raw(compositeFs, {
      tScene: { value: null },
      tBloom: { value: null },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2() },
      bloomStrength: { value: opts.bloomStrength },
      bloomTint: { value: new THREE.Color(opts.bloomTint) },
      exposure: { value: opts.exposure },
      grain: { value: opts.grain },
      ditherAmt: { value: opts.dither ? 1 : 0 },
      whiteBurn: { value: opts.whiteBurn },
      frameSeed: { value: 0 },
      useDof: { value: opts.dof ? 1 : 0 },
      dofFocus: { value: opts.dof?.focus ?? 0 },
      dofRange: { value: opts.dof?.range ?? 1 },
      dofMaxPx: { value: opts.dof?.maxRadiusPx ?? 0 },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
    });
    this.quad = new THREE.Mesh(this.tri, this.composite);
    this.quad.frustumCulled = false;
  }

  private ensureSize() {
    const v = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(v);
    const w = Math.max(1, Math.round(v.x));
    const h = Math.max(1, Math.round(v.y));
    if (w === this.w && h === this.h) return;
    this.dispose(false);
    this.w = w;
    this.h = h;
    const half = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: 4,
      depthBuffer: true,
      ...(this.opts.dof ? { depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) } : {}),
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    let mw = w;
    let mh = h;
    this.mips = [];
    this.ups = [];
    for (let i = 0; i < this.levels; i++) {
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
      const rt = new THREE.WebGLRenderTarget(mw, mh, { ...half, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      this.mips.push(rt);
      if (i < this.levels - 1) {
        this.ups.push(new THREE.WebGLRenderTarget(mw, mh, { ...half, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
      }
    }
  }

  get pixelHeight() {
    this.ensureSize();
    return this.h;
  }
  get pixelWidth() {
    this.ensureSize();
    return this.w;
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.cam);
  }

  // `prepass` runs after the clear and before the main scene render, into the
  // same target (e.g. a depth-only pass that feeds depth of field).
  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    loopFrame: number,
    prepass?: (r: THREE.WebGLRenderer) => void,
    // replaces the plain scene render (used by the glass to draw plates one
    // by one, each refracting what has already been drawn behind it)
    drawScene?: (r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) => void,
  ) {
    this.ensureSize();
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, this.opts.bloomMask ? 0 : 1);
    r.clear(true, true, true);
    r.autoClear = false;
    prepass?.(r);
    if (drawScene) drawScene(r, this.sceneRT);
    else r.render(scene, camera);
    r.autoClear = true;

    // bloom chain
    const p = this.prefilter.uniforms;
    p.tSrc.value = this.sceneRT.texture;
    p.texel.value.set(0.5 / this.w, 0.5 / this.h);
    this.pass(this.prefilter, this.mips[0]);
    for (let i = 1; i < this.levels; i++) {
      const src = this.mips[i - 1];
      this.down.uniforms.tSrc.value = src.texture;
      this.down.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.down, this.mips[i]);
    }
    let low = this.mips[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      this.up.uniforms.tLow.value = low.texture;
      this.up.uniforms.tHigh.value = this.mips[i].texture;
      this.up.uniforms.texel.value.set(1 / low.width, 1 / low.height);
      this.pass(this.up, this.ups[i]);
      low = this.ups[i];
    }

    const c = this.composite.uniforms;
    c.tScene.value = this.sceneRT.texture;
    c.tBloom.value = low.texture;
    c.tDepth.value = this.sceneRT.depthTexture ?? null;
    c.resolution.value.set(this.w, this.h);
    c.frameSeed.value = loopFrame >>> 0;
    c.cameraNear.value = camera.near;
    c.cameraFar.value = camera.far;
    this.pass(this.composite, null);
  }

  dispose(all = true) {
    this.sceneRT?.dispose();
    this.mips.forEach((m) => m.dispose());
    this.ups.forEach((m) => m.dispose());
    if (all) {
      this.tri.dispose();
      [this.prefilter, this.down, this.up, this.composite].forEach((m) => m.dispose());
    }
  }
}
