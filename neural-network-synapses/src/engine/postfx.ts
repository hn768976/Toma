import * as THREE from "three";

/**
 * Small deterministic post-processing chain:
 *   scene (MSAA, HDR, depth) -> depth of field (half res gather) -> overlay
 *   scene (additive sprites) -> multi-level bloom -> grade / vignette / grain.
 * All pixel-based parameters are expressed relative to the frame height, so
 * the result looks identical at 4K and at 1080p.
 */

export type PostParams = {
  /** Focus distance in world units. */
  focus: number;
  /** Blur strength: CoC (fraction of frame height) = aperture * |1/focus - 1/d|. */
  aperture: number;
  /** Maximum CoC radius as a fraction of the frame height. */
  maxCoc: number;
  /** Multiplier on the blur behind the focal plane (1 = physical). */
  farScale: number;
  bloomStrength: number;
  bloomThreshold: number;
  exposure: number;
  /** Per-channel multiplier applied before the tone curve. */
  tint: THREE.Vector3;
  /** Lift added to blacks (linear), used to match the reference's black level. */
  lift: THREE.Vector3;
  vignette: number;
  grain: number;
  saturation: number;
  contrast: number;
  /** Global fade multiplier (1 = fully visible). */
  fade: number;
  seed: number;
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOF_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;      // 1 / full-res size
uniform float uHeight;    // full-res height in px
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uFarScale;
in vec2 vUv;
out vec4 outColor;

float viewDist(vec2 uv) {
  float d = texture(tDepth, uv).x;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}
// Circle of confusion radius in full-res pixels.
float cocAt(float dist) {
  float c = uAperture * abs(1.0 / uFocus - 1.0 / dist);
  if (dist > uFocus) c *= uFarScale;
  return min(c, uMaxCoc) * uHeight;
}
const float GOLDEN = 2.39996323;
void main() {
  float centerDist = viewDist(vUv);
  float centerCoc = cocAt(centerDist);
  vec3 color = texture(tColor, vUv).rgb;
  float cocAcc = centerCoc;
  float tot = 1.0;
  float maxR = uMaxCoc * uHeight;
  float soft = maxR / 14.0;
  // Golden-angle disc gather (scatter-as-gather), radius increasing so
  // near blurry samples correctly bleed over sharper ones.
  const int TAPS = 96;
  // Per-pixel rotation turns residual tap banding into fine noise.
  float rot = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  for (int i = 0; i < TAPS; i++) {
    float radius = maxR * sqrt((float(i) + 0.5) / float(TAPS));
    float ang = float(i) * GOLDEN + rot * 0.0;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec3 s = texture(tColor, tc).rgb;
    float sDist = viewDist(tc);
    float sCoc = cocAt(sDist);
    if (sDist > centerDist) sCoc = clamp(sCoc, 0.0, centerCoc * 2.0);
    float m = smoothstep(radius - soft, radius + soft, sCoc);
    color += mix(color / tot, s, m);
    cocAcc += mix(cocAcc / tot, sCoc, m);
    tot += 1.0;
  }
  outColor = vec4(color / tot, cocAcc / tot);
}`;

const COMPOSE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform float uHeight;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 sharp = texture(tSharp, vUv).rgb;
  vec4 blur = texture(tBlur, vUv);
  float k = smoothstep(0.0006, 0.0026, blur.a / uHeight);
  outColor = vec4(mix(sharp, blur.rgb, k), 1.0);
}`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform float uThreshold;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.5, l);
  outColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform vec2 uDir;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(tColor, vUv).rgb * 0.227027;
  c += texture(tColor, vUv + uDir * 1.384615).rgb * 0.316216;
  c += texture(tColor, vUv - uDir * 1.384615).rgb * 0.316216;
  c += texture(tColor, vUv + uDir * 3.230769).rgb * 0.070270;
  c += texture(tColor, vUv - uDir * 3.230769).rgb * 0.070270;
  outColor = vec4(c, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform float uBloom;
uniform float uExposure;
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;
uniform float uFade;
uniform float uSeed;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  vec3 bloom = texture(tBloom0, vUv).rgb * 0.34 + texture(tBloom1, vUv).rgb * 0.30
             + texture(tBloom2, vUv).rgb * 0.22 + texture(tBloom3, vUv).rgb * 0.14;
  c += bloom * uBloom;
  c *= uExposure * uTint * uFade;
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= mix(1.0, smoothstep(1.15, 0.25, length(q)), uVignette);
  // Soft filmic shoulder.
  c = 1.0 - exp(-c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  c = c + uLift * (1.0 - c);
  c = pow(c, vec3(1.0 / 2.2));
  // Grain is quantised to a 4K-referenced cell so it survives downscaling.
  vec2 cell = floor(vUv * vec2(1920.0 * uAspect / 1.7777778, 1080.0));
  float g = hash(cell + uSeed * 17.31) + hash(cell.yx + uSeed * 7.77 + 3.1) - 1.0;
  c += g * uGrain;
  // Half-LSB dither against banding in the dark gradients.
  c += (hash(gl_FragCoord.xy + uSeed) - 0.5) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function makeMaterial(frag: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

export class PostFX {
  readonly sceneRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private compRT: THREE.WebGLRenderTarget;
  private bloomRT: THREE.WebGLRenderTarget[] = [];
  private bloomTmp: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mats: Record<string, THREE.ShaderMaterial>;
  readonly depthTexture: THREE.DepthTexture;

  constructor(
    private renderer: THREE.WebGLRenderer,
    w: number,
    h: number,
    private opts: { dof: boolean; samples?: number } = { dof: true },
  ) {
    const type = THREE.HalfFloatType;
    this.depthTexture = new THREE.DepthTexture(w, h);
    this.depthTexture.type = THREE.UnsignedIntType;
    this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.magFilter = THREE.NearestFilter;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type,
      samples: opts.samples ?? 4,
      depthBuffer: true,
      depthTexture: this.depthTexture,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const mk = (ww: number, hh: number) =>
      new THREE.WebGLRenderTarget(Math.max(2, ww), Math.max(2, hh), {
        type,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
    this.dofRT = mk(Math.round(w / 2), Math.round(h / 2));
    this.compRT = mk(w, h);
    for (let i = 0; i < 4; i++) {
      const d = 2 << i;
      this.bloomRT.push(mk(Math.round(w / d), Math.round(h / d)));
      this.bloomTmp.push(mk(Math.round(w / d), Math.round(h / d)));
    }
    this.mats = {
      dof: makeMaterial(DOF_FRAG, {
        tColor: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
        uHeight: { value: h },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFocus: { value: 10 },
        uAperture: { value: 0 },
        uMaxCoc: { value: 0.02 },
        uFarScale: { value: 1 },
      }),
      compose: makeMaterial(COMPOSE_FRAG, {
        tSharp: { value: null },
        tBlur: { value: null },
        uHeight: { value: h },
      }),
      bright: makeMaterial(BRIGHT_FRAG, {
        tColor: { value: null },
        uThreshold: { value: 0.6 },
      }),
      blur: makeMaterial(BLUR_FRAG, {
        tColor: { value: null },
        uDir: { value: new THREE.Vector2() },
      }),
      final: makeMaterial(FINAL_FRAG, {
        tColor: { value: null },
        tBloom0: { value: null },
        tBloom1: { value: null },
        tBloom2: { value: null },
        tBloom3: { value: null },
        uBloom: { value: 1 },
        uExposure: { value: 1 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uLift: { value: new THREE.Vector3(0, 0, 0) },
        uVignette: { value: 0.5 },
        uGrain: { value: 0.02 },
        uSaturation: { value: 1 },
        uContrast: { value: 1 },
        uFade: { value: 1 },
        uSeed: { value: 0 },
        uAspect: { value: w / h },
      }),
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mats.dof);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    p: PostParams,
    overlay?: THREE.Scene,
  ) {
    const r = this.renderer;
    const { mats } = this;
    r.autoClear = true;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);

    let composed = this.sceneRT;
    if (this.opts.dof && p.aperture > 0) {
      const u = mats.dof.uniforms;
      u.tColor.value = this.sceneRT.texture;
      u.tDepth.value = this.depthTexture;
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      u.uFocus.value = p.focus;
      u.uAperture.value = p.aperture;
      u.uMaxCoc.value = p.maxCoc;
      u.uFarScale.value = p.farScale;
      this.pass(mats.dof, this.dofRT);
      mats.compose.uniforms.tSharp.value = this.sceneRT.texture;
      mats.compose.uniforms.tBlur.value = this.dofRT.texture;
      this.pass(mats.compose, this.compRT);
      composed = this.compRT;
    }
    if (overlay) {
      if (composed === this.sceneRT) {
        // Copy so the overlay can sample the scene depth while drawing.
        mats.compose.uniforms.tSharp.value = this.sceneRT.texture;
        mats.compose.uniforms.tBlur.value = this.sceneRT.texture;
        this.pass(mats.compose, this.compRT);
        composed = this.compRT;
      }
      r.autoClear = false;
      r.setRenderTarget(this.compRT);
      r.render(overlay, camera);
      r.autoClear = true;
    }

    // Bloom pyramid.
    mats.bright.uniforms.tColor.value = composed.texture;
    mats.bright.uniforms.uThreshold.value = p.bloomThreshold;
    this.pass(mats.bright, this.bloomRT[0]);
    for (let i = 0; i < 4; i++) {
      const rt = this.bloomRT[i];
      const tmp = this.bloomTmp[i];
      if (i > 0) {
        // Downsample from the previous level through the blur itself.
        mats.blur.uniforms.tColor.value = this.bloomRT[i - 1].texture;
        mats.blur.uniforms.uDir.value.set(1 / this.bloomRT[i - 1].width, 0);
        this.pass(mats.blur, tmp);
        mats.blur.uniforms.tColor.value = tmp.texture;
        mats.blur.uniforms.uDir.value.set(0, 1 / tmp.height);
        this.pass(mats.blur, rt);
      }
      for (let k = 0; k < 2; k++) {
        mats.blur.uniforms.tColor.value = rt.texture;
        mats.blur.uniforms.uDir.value.set(1 / rt.width, 0);
        this.pass(mats.blur, tmp);
        mats.blur.uniforms.tColor.value = tmp.texture;
        mats.blur.uniforms.uDir.value.set(0, 1 / rt.height);
        this.pass(mats.blur, rt);
      }
    }

    const f = mats.final.uniforms;
    f.tColor.value = composed.texture;
    f.tBloom0.value = this.bloomRT[0].texture;
    f.tBloom1.value = this.bloomRT[1].texture;
    f.tBloom2.value = this.bloomRT[2].texture;
    f.tBloom3.value = this.bloomRT[3].texture;
    f.uBloom.value = p.bloomStrength;
    f.uExposure.value = p.exposure;
    f.uTint.value.copy(p.tint);
    f.uLift.value.copy(p.lift);
    f.uVignette.value = p.vignette;
    f.uGrain.value = p.grain;
    f.uSaturation.value = p.saturation;
    f.uContrast.value = p.contrast;
    f.uFade.value = p.fade;
    f.uSeed.value = p.seed;
    this.pass(mats.final, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.dofRT.dispose();
    this.compRT.dispose();
    [...this.bloomRT, ...this.bloomTmp].forEach((t) => t.dispose());
    Object.values(this.mats).forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
