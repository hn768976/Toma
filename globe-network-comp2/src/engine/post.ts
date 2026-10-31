import * as THREE from "three";

/**
 * Small hand-written post-processing chain (no external deps):
 *   scene (full res, HDR)
 *     -> half-res downsample -> gaussian blur        (depth-of-field, near)
 *     -> quarter-res downsample -> gaussian blur     (depth-of-field, far)
 *     -> bright-pass (half) -> blur, -> quarter blur (bloom)
 *   composite: tilt-shift DOF mix, bloom, vignette, colour grade, film grain.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWNSAMPLE = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 srcTexel; uniform float threshold; uniform float knee;
varying vec2 vUv;
void main() {
  // 13-tap "dual filter" style downsample: stable, no fireflies.
  vec2 t = srcTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + t * vec2( 1.0, -1.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + t * vec2(-1.0,  1.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2( 1.0,  1.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 col = e * 0.5 + (a + b + c + d) * 0.125;
  if (threshold > 0.0) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - threshold) / max(br, 1e-4);
    col *= contrib;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 dir; // texel * direction * radius
varying vec2 vUv;
void main() {
  // 9-tap gaussian using linear sampling (5 fetches)
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene, tDofA, tDofB, tBloomA, tBloomB;
uniform float focusY, focusHalf, focusSoft, blurTop, blurBottom;
uniform float bloomA, bloomB, vignette, grain, time, exposure, saturation;
uniform vec3 lift, gain, tint;
uniform vec2 resolution;
uniform float flipY;
uniform vec3 hazeColor; uniform float hazeAmount, hazeX, contrast, bottomDark;
varying vec2 vUv;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main() {
  // flipY: emit rows top-down so readPixels() output can be blitted directly
  vec2 uv = flipY > 0.5 ? vec2(vUv.x, 1.0 - vUv.y) : vUv;
  vec3 sharp = texture2D(tScene, uv).rgb;
  vec3 dA = texture2D(tDofA, uv).rgb;
  vec3 dB = texture2D(tDofB, uv).rgb;
  float dy = uv.y - focusY;
  float amt = smoothstep(focusHalf, focusHalf + focusSoft, abs(dy)) * (dy > 0.0 ? blurTop : blurBottom);
  vec3 col = amt < 0.5 ? mix(sharp, dA, amt * 2.0) : mix(dA, dB, amt * 2.0 - 1.0);
  col += texture2D(tBloomA, uv).rgb * bloomA + texture2D(tBloomB, uv).rgb * bloomB;
  col *= exposure;
  // atmospheric haze brightening towards the horizon (top of frame), hottest
  // around hazeX (art-directed, moves with the camera)
  float hz = smoothstep(0.35, 1.0, uv.y) * (0.55 + 0.45 * exp(-pow((uv.x - hazeX) / 0.35, 2.0)));
  col = mix(col, hazeColor, clamp(hazeAmount * hz, 0.0, 1.0));
  col = (col - 0.32) * contrast + 0.32;
  col *= 1.0 - bottomDark * (1.0 - smoothstep(0.0, 0.6, uv.y));
  // grade
  col = col * gain + lift * (1.0 - col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation) * tint;
  // filmic shoulder so additive highlights roll off instead of clipping hard
  float m = max(col.r, max(col.g, col.b));
  if (m > 0.8) col *= (0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2))) / m;
  // vignette
  vec2 q = uv - 0.5; q.x *= resolution.x / resolution.y;
  col *= 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
  // grain (also dithers 8-bit banding)
  float n = hash(uv * resolution + fract(time * 13.37) * 431.0) - 0.5;
  col += n * grain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export type PostParams = {
  focusY: number;
  focusHalf: number;
  focusSoft: number;
  blurTop: number;
  blurBottom: number;
  dofRadius: number;
  bloomThreshold: number;
  bloomA: number;
  bloomB: number;
  vignette: number;
  grain: number;
  exposure: number;
  saturation: number;
  lift: [number, number, number];
  gain: [number, number, number];
  tint: [number, number, number];
  haze?: number;
  hazeColor?: [number, number, number];
  hazeX?: number;
  contrast?: number;
  bottomDark?: number;
};

const rt = (w: number, h: number, type: THREE.TextureDataType) =>
  new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });

export class PostFX {
  sceneRT: THREE.WebGLRenderTarget;
  private targets: Record<string, THREE.WebGLRenderTarget>;
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private down: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private comp: THREE.ShaderMaterial;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private w: number,
    h: number,
    public params: PostParams,
  ) {
    // 8-bit targets: 2-3x faster than half-float on software GL; highlights are
    // rolled off before they would clip anyway.
    const type = THREE.UnsignedByteType;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.targets = {
      h0: rt(w / 2, h / 2, type),
      q0: rt(w / 4, h / 4, type),
      q1: rt(w / 4, h / 4, type),
      e0: rt(w / 8, h / 8, type),
      e1: rt(w / 8, h / 8, type),
      bh0: rt(w / 2, h / 2, type),
      bq0: rt(w / 4, h / 4, type),
      bq1: rt(w / 4, h / 4, type),
      be0: rt(w / 8, h / 8, type),
      be1: rt(w / 8, h / 8, type),
    };
    const mk = (fs: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.down = mk(DOWNSAMPLE, {
      tSrc: { value: null },
      srcTexel: { value: new THREE.Vector2() },
      threshold: { value: 0 },
      knee: { value: 0.2 },
    });
    this.blur = mk(BLUR, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    this.comp = mk(COMPOSITE, {
      tScene: { value: null },
      tDofA: { value: null },
      tDofB: { value: null },
      tBloomA: { value: null },
      tBloomB: { value: null },
      focusY: { value: 0 },
      focusHalf: { value: 0 },
      focusSoft: { value: 0 },
      blurTop: { value: 0 },
      blurBottom: { value: 0 },
      bloomA: { value: 0 },
      bloomB: { value: 0 },
      vignette: { value: 0 },
      grain: { value: 0 },
      time: { value: 0 },
      exposure: { value: 1 },
      saturation: { value: 1 },
      lift: { value: new THREE.Vector3() },
      gain: { value: new THREE.Vector3(1, 1, 1) },
      tint: { value: new THREE.Vector3(1, 1, 1) },
      resolution: { value: new THREE.Vector2(w, h) },
      flipY: { value: 1 },
      hazeColor: { value: new THREE.Vector3(0.36, 0.57, 0.7) },
      hazeAmount: { value: 0 },
      hazeX: { value: 0.5 },
      contrast: { value: 1 },
      bottomDark: { value: 0 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.down);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  private downsample(src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, threshold = 0) {
    this.down.uniforms.tSrc.value = src.texture;
    this.down.uniforms.srcTexel.value.set(1 / src.width, 1 / src.height);
    this.down.uniforms.threshold.value = threshold;
    this.pass(this.down, dst);
  }

  private gaussian(a: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, radius: number, iterations = 1) {
    for (let i = 0; i < iterations; i++) {
      const r = radius * (1 + i * 0.75);
      this.blur.uniforms.tSrc.value = a.texture;
      this.blur.uniforms.dir.value.set(r / a.width, 0);
      this.pass(this.blur, tmp);
      this.blur.uniforms.tSrc.value = tmp.texture;
      this.blur.uniforms.dir.value.set(0, r / a.height);
      this.pass(this.blur, a);
    }
  }

  /** Call after rendering the 3D scene into `sceneRT`. Writes final image to the canvas. */
  finish(time: number) {
    const p = this.params;
    const T = this.targets;
    const k = this.w / 3840; // keep blur radii resolution-independent
    // depth of field chain
    // Mip-style chains: every step halves resolution and blurs with a small,
    // contiguous kernel, so tiny bright dots never turn into a sparse tap grid.
    const r = p.dofRadius * 0.5 * k;
    this.downsample(this.sceneRT, T.h0);
    this.downsample(T.h0, T.q0);
    this.gaussian(T.q0, T.q1, r, 2); // DOF near  (1/4 res)
    this.downsample(T.q0, T.e0);
    this.gaussian(T.e0, T.e1, r, 2); // DOF far   (1/8 res)
    this.downsample(this.sceneRT, T.bh0, p.bloomThreshold);
    this.downsample(T.bh0, T.bq0);
    this.gaussian(T.bq0, T.bq1, 1.0 * k, 1); // bloom tight (1/4)
    this.downsample(T.bq0, T.be0);
    this.gaussian(T.be0, T.be1, 1.0 * k, 3); // bloom wide (1/8)

    const u = this.comp.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tDofA.value = T.q0.texture;
    u.tDofB.value = T.e0.texture;
    u.tBloomA.value = T.bq0.texture;
    u.tBloomB.value = T.be0.texture;
    u.focusY.value = p.focusY;
    u.focusHalf.value = p.focusHalf;
    u.focusSoft.value = p.focusSoft;
    u.blurTop.value = p.blurTop;
    u.blurBottom.value = p.blurBottom;
    u.bloomA.value = p.bloomA;
    u.bloomB.value = p.bloomB;
    u.vignette.value = p.vignette;
    u.grain.value = p.grain;
    u.time.value = time;
    u.exposure.value = p.exposure;
    u.saturation.value = p.saturation;
    u.lift.value.set(...p.lift);
    u.gain.value.set(...p.gain);
    u.tint.value.set(...p.tint);
    u.hazeAmount.value = p.haze ?? 0;
    u.hazeX.value = p.hazeX ?? 0.5;
    u.contrast.value = p.contrast ?? 1;
    u.bottomDark.value = p.bottomDark ?? 0;
    if (p.hazeColor) u.hazeColor.value.set(...p.hazeColor);
    this.pass(this.comp, null);
  }

  dispose() {
    this.sceneRT.dispose();
    Object.values(this.targets).forEach((t) => t.dispose());
    this.down.dispose();
    this.blur.dispose();
    this.comp.dispose();
    this.quad.geometry.dispose();
  }
}
