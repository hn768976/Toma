import * as THREE from "three";

/**
 * Minimal WebGL 2 post-processing chain written as raw GLSL 3.00 shaders:
 *   scene (HDR + depth) -> depth-of-field gather -> bloom (3-level) -> grade/vignette/grain
 * All pixel quantities are expressed for a 1080-pixel-tall frame and scaled by
 * `unit`, so 1080p and 2160p renders look identical apart from detail.
 */

export type PostSettings = {
  /** View-space distance that is perfectly sharp (used when no focalPlane is given). */
  focusDistance: number;
  /**
   * Optional tilted focal plane (tilt-shift / Scheimpflug lens) in world space.
   * Blur grows with the distance from this plane instead of from a depth slice.
   */
  focalPlane?: { point: THREE.Vector3; normal: THREE.Vector3 };
  /**
   * Optional radial falloff (curvature of field): pixels farther than `radius`
   * (in frame heights) from `center` (uv, origin bottom-left) get extra blur.
   */
  fieldFocus?: { center: [number, number]; radius: number; gain: number };
  /** CoC scale (px @1080) for things nearer / farther than the focus. */
  nearBlur: number;
  farBlur: number;
  /** Max CoC radius in px @1080. */
  maxCoc: number;
  bloomStrength: number;
  bloomThreshold: number;
  exposure: number;
  vignette: number;
  grain: number;
  saturation: number;
  /** Multiplied into the final colour (white balance / tint). */
  gain: [number, number, number];
  /** Added to the final colour (black lift). */
  lift: [number, number, number];
  /** Optional chromatic aberration amount in px @1080 at the frame edge. */
  aberration: number;
};

const VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Shared helpers: view position from depth and signed CoC (px) against a
// (possibly tilted) focal plane.
const COC_FUNCS = /* glsl */ `
uniform mat4 invProj;
uniform vec4 focalPlane; // view space: xyz normal, w offset
uniform float nearK;
uniform float farK;
uniform float maxCoc;
// optional radial "field" falloff: xy = sharp-zone centre (uv), z = radius
// (frame heights), w = extra CoC px per frame-height beyond that radius
uniform vec4 field;
uniform float aspect;
vec3 viewPos(vec2 uv, float d) {
  vec4 v = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
float cocOf(vec3 v, vec2 uv) {
  float c = (dot(focalPlane.xyz, v) + focalPlane.w) / max(-v.z, 1e-4);
  c = c < 0.0 ? c * nearK : c * farK;
  float d = length((uv - field.xy) * vec2(aspect, 1.0));
  float extra = max(d - field.z, 0.0) * field.w;
  c += c < 0.0 ? -extra : extra;
  return clamp(c, -maxCoc, maxCoc);
}`;

// 1) half-resolution prepass: colour + signed CoC (in full-res px) in alpha
const PREP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
${COC_FUNCS}
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 col = texture(tColor, vUv).rgb; // bilinear at half res = 2x2 box
  float c = cocOf(viewPos(vUv, texture(tDepth, vUv).r), vUv);
  fragColor = vec4(col, c);
}`;

// 2) half-resolution gather along a golden-angle spiral
const DOF_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tPrep; // rgb + coc (full-res px)
uniform vec2 halfRes;
in vec2 vUv;
out vec4 fragColor;
const int N = 40;
void main() {
  vec4 ctr = textureLod(tPrep, vUv, 0.0);
  float r = abs(ctr.a) * 0.5; // to half-res px
  if (r < 0.5) { fragColor = vec4(ctr.rgb, ctr.a); return; }
  float spacing = r * 1.75 / sqrt(float(N));
  float lod = clamp(log2(max(spacing, 1.0)) - 0.5, 0.0, 5.0);
  vec3 acc = textureLod(tPrep, vUv, lod).rgb;
  float wsum = 1.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    float a = fi * 2.39996323;
    float rr = sqrt((fi + 0.5) / float(N)) * r;
    vec2 suv = clamp(vUv + vec2(cos(a), sin(a)) * rr / halfRes, vec2(0.001), vec2(0.999));
    vec4 sm = textureLod(tPrep, suv, lod);
    float sc = abs(sm.a) * 0.5;
    // sample contributes when its own disc reaches us; samples behind the
    // focal plane relative to us (larger signed coc) always do.
    float w = sm.a > ctr.a ? 1.0 : clamp(sc - rr + 1.0, 0.0, 1.0);
    acc += sm.rgb * w;
    wsum += w;
  }
  fragColor = vec4(acc / wsum, ctr.a);
}`;

// 3) full-resolution composite of sharp + blurred layers
const COMP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
${COC_FUNCS}
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 sharp = texture(tColor, vUv).rgb;
  float c = abs(cocOf(viewPos(vUv, texture(tDepth, vUv).r), vUv));
  vec4 bl = texture(tBlur, vUv);
  // near-field blur spreads over sharper pixels behind it
  float spread = max(c, -bl.a * 0.85);
  float k = smoothstep(0.6, 2.2, spread);
  fragColor = vec4(mix(sharp, bl.rgb, k), 1.0);
}`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tInput;
uniform float threshold;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 c = texture(tInput, vUv).rgb;
  float l = max(max(c.r, c.g), c.b);
  float k = max(l - threshold, 0.0) / max(l, 1e-4);
  fragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tInput;
uniform vec2 dir; // texel step
in vec2 vUv;
out vec4 fragColor;
void main() {
  // 9-tap gaussian using linear-sampling offsets (17 effective taps).
  vec3 c = texture(tInput, vUv).rgb * 0.1964825501511404;
  c += texture(tInput, vUv + dir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture(tInput, vUv - dir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture(tInput, vUv + dir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture(tInput, vUv - dir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture(tInput, vUv + dir * 5.176470588235294).rgb * 0.010381362401148057;
  c += texture(tInput, vUv - dir * 5.176470588235294).rgb * 0.010381362401148057;
  fragColor = vec4(c, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform vec2 resolution;
uniform float bloomStrength;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float saturation;
uniform vec3 gain;
uniform vec3 lift;
uniform float aberration;
uniform float seed;
in vec2 vUv;
out vec4 fragColor;

float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 d = vUv - 0.5;
  vec3 col;
  if (aberration > 0.0) {
    vec2 o = d * aberration / resolution * 2.0;
    col.r = texture(tColor, vUv + o).r;
    col.g = texture(tColor, vUv).g;
    col.b = texture(tColor, vUv - o).b;
  } else {
    col = texture(tColor, vUv).rgb;
  }
  vec3 bloom = texture(tBloom1, vUv).rgb * 0.5 + texture(tBloom2, vUv).rgb * 0.8 + texture(tBloom3, vUv).rgb * 1.0;
  col += bloom * bloomStrength;
  col *= exposure;
  // gentle filmic shoulder
  col = col / (1.0 + max(col - 0.8, 0.0) * 0.6);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col = col * gain + lift;
  float v = smoothstep(0.85, 0.2, length(d * vec2(1.15, 1.0)));
  col *= mix(1.0 - vignette, 1.0, v);
  float n = h12(gl_FragCoord.xy + seed * 61.7) - 0.5;
  col += n * grain;
  // dither to avoid 8-bit banding in dark gradients
  col += (h12(gl_FragCoord.yx + seed * 13.1) - 0.5) / 255.0;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, mips = false, depth = false) => {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: mips,
    depthBuffer: depth,
    colorSpace: THREE.NoColorSpace,
  });
  if (depth) {
    t.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    t.depthTexture.minFilter = THREE.NearestFilter;
    t.depthTexture.magFilter = THREE.NearestFilter;
  }
  return t;
};

export class PostChain {
  readonly width: number;
  readonly height: number;
  readonly unit: number;
  private sceneRT: THREE.WebGLRenderTarget;
  private prepRT: THREE.WebGLRenderTarget;
  private blurRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private brightRT: THREE.WebGLRenderTarget;
  private levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[];
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private prepMat: THREE.RawShaderMaterial;
  private dofMat: THREE.RawShaderMaterial;
  private compMat: THREE.RawShaderMaterial;
  private brightMat: THREE.RawShaderMaterial;
  private blurMat: THREE.RawShaderMaterial;
  private copyMat: THREE.RawShaderMaterial;
  private finalMat: THREE.RawShaderMaterial;

  constructor(
    private renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
  ) {
    this.width = width;
    this.height = height;
    this.unit = height / 1080;
    this.sceneRT = rt(width, height, false, true);
    this.dofRT = rt(width, height, false);
    const hw = Math.round(width / 2);
    const hh = Math.round(height / 2);
    this.prepRT = rt(hw, hh, true);
    this.blurRT = rt(hw, hh, false);
    this.brightRT = rt(hw, hh);
    this.levels = [4, 8, 16].map((d) => ({
      a: rt(Math.round(width / d), Math.round(height / d)),
      b: rt(Math.round(width / d), Math.round(height / d)),
    }));
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);

    const cocUniforms = () => ({
      invProj: { value: new THREE.Matrix4() },
      focalPlane: { value: new THREE.Vector4(0, 0, -1, -10) },
      nearK: { value: 10 },
      farK: { value: 10 },
      maxCoc: { value: 20 },
      field: { value: new THREE.Vector4(0.5, 0.5, 10, 0) },
      aspect: { value: width / height },
    });
    this.prepMat = mat(PREP_FRAG, { tColor: { value: null }, tDepth: { value: null }, ...cocUniforms() });
    this.dofMat = mat(DOF_FRAG, {
      tPrep: { value: null },
      halfRes: { value: new THREE.Vector2(hw, hh) },
    });
    this.compMat = mat(COMP_FRAG, {
      tColor: { value: null },
      tDepth: { value: null },
      tBlur: { value: null },
      ...cocUniforms(),
    });
    this.brightMat = mat(BRIGHT_FRAG, { tInput: { value: null }, threshold: { value: 0.8 } });
    this.blurMat = mat(BLUR_FRAG, { tInput: { value: null }, dir: { value: new THREE.Vector2() } });
    this.copyMat = mat(
      /* glsl */ `precision highp float; uniform sampler2D tInput; in vec2 vUv; out vec4 fragColor;
      void main(){ fragColor = vec4(texture(tInput, vUv).rgb, 1.0); }`,
      { tInput: { value: null } },
    );
    this.finalMat = mat(FINAL_FRAG, {
      tColor: { value: null },
      tBloom1: { value: null },
      tBloom2: { value: null },
      tBloom3: { value: null },
      resolution: { value: new THREE.Vector2(width, height) },
      bloomStrength: { value: 1 },
      exposure: { value: 1 },
      vignette: { value: 0.4 },
      grain: { value: 0.02 },
      saturation: { value: 1 },
      gain: { value: new THREE.Vector3(1, 1, 1) },
      lift: { value: new THREE.Vector3(0, 0, 0) },
      aberration: { value: 0 },
      seed: { value: 0 },
    });
  }

  private prof: [string, number][] = [];
  private mark(label: string) {
    if (!(globalThis as { __PROFILE__?: boolean }).__PROFILE__) return;
    this.renderer.getContext().finish();
    this.prof.push([label, performance.now()]);
  }

  private pass(material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    s: PostSettings,
    frame: number,
  ) {
    const r = this.renderer;
    const u = this.unit;
    this.prof = [];
    this.mark("start");
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);

    this.mark("scene");
    let fp: [number, number, number, number];
    if (s.focalPlane) {
      // transform the world-space plane into view space
      const n = s.focalPlane.normal.clone().transformDirection(camera.matrixWorldInverse);
      const p = s.focalPlane.point.clone().applyMatrix4(camera.matrixWorldInverse);
      // orient so that "behind the plane" (farther from camera) is positive
      if (n.z > 0) n.negate();
      fp = [n.x, n.y, n.z, -n.dot(p)];
    } else {
      fp = [0, 0, -1, -s.focusDistance];
    }
    for (const m of [this.prepMat, this.compMat]) {
      const d = m.uniforms;
      d.invProj.value.copy(camera.projectionMatrixInverse);
      d.focalPlane.value.set(...fp);
      d.nearK.value = s.nearBlur * u;
      d.farK.value = s.farBlur * u;
      d.maxCoc.value = s.maxCoc * u;
      const fz = s.fieldFocus;
      if (fz) d.field.value.set(fz.center[0], fz.center[1], fz.radius, fz.gain * u);
      else d.field.value.set(0.5, 0.5, 10, 0);
    }
    this.prepMat.uniforms.tColor.value = this.sceneRT.texture;
    this.prepMat.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.pass(this.prepMat, this.prepRT);
    this.dofMat.uniforms.tPrep.value = this.prepRT.texture;
    this.pass(this.dofMat, this.blurRT);
    this.compMat.uniforms.tColor.value = this.sceneRT.texture;
    this.compMat.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.compMat.uniforms.tBlur.value = this.blurRT.texture;
    this.pass(this.compMat, this.dofRT);
    this.mark("dof");

    this.brightMat.uniforms.tInput.value = this.dofRT.texture;
    this.brightMat.uniforms.threshold.value = s.bloomThreshold;
    this.pass(this.brightMat, this.brightRT);

    let src: THREE.WebGLRenderTarget = this.brightRT;
    for (const lv of this.levels) {
      this.copyMat.uniforms.tInput.value = src.texture;
      this.pass(this.copyMat, lv.a);
      this.blurMat.uniforms.tInput.value = lv.a.texture;
      this.blurMat.uniforms.dir.value.set(1 / lv.a.width, 0);
      this.pass(this.blurMat, lv.b);
      this.blurMat.uniforms.tInput.value = lv.b.texture;
      this.blurMat.uniforms.dir.value.set(0, 1 / lv.a.height);
      this.pass(this.blurMat, lv.a);
      src = lv.a;
    }

    this.mark("bloom");
    const f = this.finalMat.uniforms;
    f.tColor.value = this.dofRT.texture;
    f.tBloom1.value = this.levels[0].a.texture;
    f.tBloom2.value = this.levels[1].a.texture;
    f.tBloom3.value = this.levels[2].a.texture;
    f.bloomStrength.value = s.bloomStrength;
    f.exposure.value = s.exposure;
    f.vignette.value = s.vignette;
    f.grain.value = s.grain;
    f.saturation.value = s.saturation;
    f.gain.value.set(...s.gain);
    f.lift.value.set(...s.lift);
    f.aberration.value = s.aberration * u;
    f.seed.value = frame % 997;
    this.pass(this.finalMat, null);
    this.mark("final");
    if (this.prof.length > 1) {
      const out = this.prof.slice(1).map(([l, t], i) => `${l}=${(t - this.prof[i][1]).toFixed(0)}ms`);
      console.log(`[profile] frame ${frame} ${out.join(" ")}`);
    }
  }

  dispose() {
    [this.sceneRT, this.prepRT, this.blurRT, this.dofRT, this.brightRT, ...this.levels.flatMap((l) => [l.a, l.b])].forEach((t) =>
      t.dispose(),
    );
    [this.prepMat, this.dofMat, this.compMat, this.brightMat, this.blurMat, this.copyMat, this.finalMat].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
