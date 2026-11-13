import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Cinematic post-processing chain (linear HDR, half-float targets), designed
 * to stay fast under software WebGL at 4K:
 *   1. scene -> full-res colour + depth
 *   2. 4x4 box downsample (quarter res), alpha = nearest view distance
 *   3. bokeh depth-of-field gather on the quarter-res buffer
 *   4. dual-filter (Kawase) bloom chain built from the DOF result
 *   5. optional anamorphic horizontal streaks
 *   6. ONE full-res pass: sharp/defocused mix by circle of confusion,
 *      chromatic aberration, bloom + streaks, ACES filmic, vignette, grain,
 *      sRGB encode and dithering.
 * All sizes are resolution-relative, so a 4K render and a scaled render match.
 */

export type PostParams = {
  focusDistance: number;
  focusRange: number; // half-width of the sharp zone (world units)
  blurRangeNear: number; // distance over which near blur ramps to max
  blurRangeFar: number; // distance over which far blur ramps to max
  maxBlur: number; // max blur radius as fraction of frame height
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee: number;
  streakStrength: number;
  streakThreshold: number;
  streakTint: THREE.Color;
  exposure: number;
  contrast: number;
  saturation: number;
  lift: THREE.Color; // added to shadows (linear)
  vignette: number;
  grain: number;
  aberration: number; // fraction of frame size at the corners
  seed: number; // per-frame grain seed
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DEPTH_FN = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
float viewDist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}
`;

const COC_FN = /* glsl */ `
uniform float focusDistance;
uniform float focusRange;
uniform float blurRangeNear;
uniform float blurRangeFar;
float cocNorm(float dist) {
  float dd = dist - focusDistance;
  float r = dd < 0.0 ? blurRangeNear : blurRangeFar;
  return clamp((abs(dd) - focusRange) / r, 0.0, 1.0);
}
`;

const makeRT = (w: number, h: number, depth = false) => {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
  });
  if (depth) {
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
  }
  return rt;
};

const quad = (uniforms: Record<string, THREE.IUniform>, frag: string) =>
  new FullScreenQuad(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    }),
  );

const mat = (q: FullScreenQuad) => q.material as THREE.ShaderMaterial;

export class PostFX {
  private renderer: THREE.WebGLRenderer;
  private h: number;
  private sceneRT: THREE.WebGLRenderTarget;
  private quarterRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private overlayRT: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private streakA: THREE.WebGLRenderTarget;
  private streakB: THREE.WebGLRenderTarget;
  private downQuad: FullScreenQuad;
  private dofQuad: FullScreenQuad;
  private prefilterQuad: FullScreenQuad;
  private kawaseDownQuad: FullScreenQuad;
  private kawaseUpQuad: FullScreenQuad;
  private streakBlurQuad: FullScreenQuad;
  private finalQuad: FullScreenQuad;
  private useStreaks: boolean;

  constructor(renderer: THREE.WebGLRenderer, w: number, h: number, opts: { streaks?: boolean } = {}) {
    this.renderer = renderer;
    this.h = h;
    this.useStreaks = Boolean(opts.streaks);
    const qw = Math.round(w / 4);
    const qh = Math.round(h / 4);
    this.sceneRT = makeRT(w, h, true);
    this.quarterRT = makeRT(qw, qh);
    this.dofRT = makeRT(qw, qh);
    // optional sharp overlay layer (e.g. particles with their own per-point
    // depth of field) composited on top of the defocused scene
    this.overlayRT = makeRT(w, h, true);
    // bloom: up[0]=1/4 (prefiltered + final result), down[i]=1/8..1/128, up[i]=1/8..1/64
    for (let i = 1; i <= 5; i++) {
      const d = 4 * Math.pow(2, i);
      this.bloomDown.push(makeRT(Math.round(w / d), Math.round(h / d)));
    }
    for (let i = 0; i < 5; i++) {
      const d = 4 * Math.pow(2, i);
      this.bloomUp.push(makeRT(Math.round(w / d), Math.round(h / d)));
    }
    this.streakA = makeRT(Math.round(w / 8), Math.round(h / 8));
    this.streakB = makeRT(Math.round(w / 8), Math.round(h / 8));

    const depthUniforms = () => ({
      tDepth: { value: this.sceneRT.depthTexture },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      focusDistance: { value: 10 },
      focusRange: { value: 1 },
      blurRangeNear: { value: 4 },
      blurRangeFar: { value: 8 },
    });

    this.downQuad = quad(
      {
        tColor: { value: this.sceneRT.texture },
        srcTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
        ...depthUniforms(),
      },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform vec2 srcTexel;
      ${DEPTH_FN}
      void main() {
        vec3 c = vec3(0.0);
        float dmin = 1e9;
        for (int y = -1; y <= 1; y += 2) {
          for (int x = -1; x <= 1; x += 2) {
            vec2 o = vec2(float(x), float(y)) * srcTexel;
            c += texture2D(tColor, vUv + o).rgb;
            dmin = min(dmin, viewDist(vUv + o * 1.5));
          }
        }
        gl_FragColor = vec4(c * 0.25, dmin);
      }`,
    );

    this.dofQuad = quad(
      {
        tQuarter: { value: this.quarterRT.texture },
        texel: { value: new THREE.Vector2(1 / qw, 1 / qh) },
        maxBlurPx: { value: 12 },
        ...depthUniforms(),
      },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tQuarter;
      uniform vec2 texel;
      uniform float maxBlurPx;
      ${COC_FN}
      const float GOLDEN = 2.39996323;
      const float RAD_SCALE = 0.85;
      void main() {
        vec4 center = texture2D(tQuarter, vUv);
        float cDist = center.a;
        float cSize = cocNorm(cDist) * maxBlurPx;
        vec3 color = center.rgb;
        float tot = 1.0;
        float bleed = 0.0;
        float radius = RAD_SCALE;
        float ang = 0.0;
        for (int i = 0; i < 260; i++) {
          if (radius >= maxBlurPx) break;
          vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
          vec4 s = texture2D(tQuarter, tc);
          float sSize = cocNorm(s.a) * maxBlurPx;
          if (s.a > cDist) sSize = clamp(sSize, 0.0, cSize * 2.0);
          float m = smoothstep(radius - 0.5, radius + 0.5, sSize);
          color += mix(color / tot, s.rgb, m);
          tot += 1.0;
          if (s.a < cDist) bleed = max(bleed, m * sSize / maxBlurPx);
          ang += GOLDEN;
          radius += RAD_SCALE / radius;
        }
        gl_FragColor = vec4(color / tot, bleed);
      }`,
    );

    this.prefilterQuad = quad(
      {
        tSrc: { value: this.dofRT.texture },
        tOverlay: { value: this.overlayRT.texture },
        overlayWeight: { value: 0 },
        texel: { value: new THREE.Vector2(1 / qw, 1 / qh) },
        threshold: { value: 0.8 },
        knee: { value: 0.4 },
      },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tSrc;
      uniform sampler2D tOverlay;
      uniform float overlayWeight;
      uniform vec2 texel;
      uniform float threshold;
      uniform float knee;
      vec3 tap(vec2 uv) {
        return texture2D(tSrc, uv).rgb + texture2D(tOverlay, uv).rgb * overlayWeight;
      }
      void main() {
        vec3 c = tap(vUv + texel * vec2(-0.5, -0.5))
               + tap(vUv + texel * vec2( 0.5, -0.5))
               + tap(vUv + texel * vec2(-0.5,  0.5))
               + tap(vUv + texel * vec2( 0.5,  0.5));
        c *= 0.25;
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 1e-4);
        float contrib = max(soft, br - threshold) / max(br, 1e-4);
        gl_FragColor = vec4(c * contrib, 1.0);
      }`,
    );

    this.kawaseDownQuad = quad(
      { tSrc: { value: null }, texel: { value: new THREE.Vector2() } },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tSrc;
      uniform vec2 texel;
      void main() {
        vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
        s += texture2D(tSrc, vUv - texel).rgb;
        s += texture2D(tSrc, vUv + texel).rgb;
        s += texture2D(tSrc, vUv + vec2(texel.x, -texel.y)).rgb;
        s += texture2D(tSrc, vUv - vec2(texel.x, -texel.y)).rgb;
        gl_FragColor = vec4(s / 8.0, 1.0);
      }`,
    );

    this.kawaseUpQuad = quad(
      {
        tSrc: { value: null },
        tBase: { value: null },
        texel: { value: new THREE.Vector2() },
        baseWeight: { value: 1 },
      },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tSrc;
      uniform sampler2D tBase;
      uniform vec2 texel;
      uniform float baseWeight;
      void main() {
        vec3 s = texture2D(tSrc, vUv + vec2(-texel.x * 2.0, 0.0)).rgb;
        s += texture2D(tSrc, vUv + vec2(-texel.x, texel.y)).rgb * 2.0;
        s += texture2D(tSrc, vUv + vec2(0.0, texel.y * 2.0)).rgb;
        s += texture2D(tSrc, vUv + vec2(texel.x, texel.y)).rgb * 2.0;
        s += texture2D(tSrc, vUv + vec2(texel.x * 2.0, 0.0)).rgb;
        s += texture2D(tSrc, vUv + vec2(texel.x, -texel.y)).rgb * 2.0;
        s += texture2D(tSrc, vUv + vec2(0.0, -texel.y * 2.0)).rgb;
        s += texture2D(tSrc, vUv + vec2(-texel.x, -texel.y)).rgb * 2.0;
        gl_FragColor = vec4(s / 12.0 + texture2D(tBase, vUv).rgb * baseWeight, 1.0);
      }`,
    );

    this.streakBlurQuad = quad(
      { tSrc: { value: null }, stepUv: { value: 0.001 } },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tSrc;
      uniform float stepUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb;
        float tot = 1.0;
        for (int i = 1; i <= 8; i++) {
          float w = exp(-float(i * i) / 24.0);
          c += (texture2D(tSrc, vUv + vec2(float(i) * stepUv, 0.0)).rgb +
                texture2D(tSrc, vUv - vec2(float(i) * stepUv, 0.0)).rgb) * w;
          tot += 2.0 * w;
        }
        gl_FragColor = vec4(c / tot, 1.0);
      }`,
    );

    this.finalQuad = quad(
      {
        tColor: { value: this.sceneRT.texture },
        tDof: { value: this.dofRT.texture },
        tBloom: { value: this.bloomUp[0].texture },
        tStreak: { value: this.streakB.texture },
        tOverlay: { value: this.overlayRT.texture },
        overlayWeight: { value: 0 },
        ...depthUniforms(),
        bloomStrength: { value: 0.5 },
        streakStrength: { value: 0 },
        streakTint: { value: new THREE.Color(0.6, 0.8, 1.0) },
        exposure: { value: 1 },
        contrast: { value: 1 },
        saturation: { value: 1 },
        lift: { value: new THREE.Color(0, 0, 0) },
        vignette: { value: 0.3 },
        grain: { value: 0.03 },
        aberration: { value: 0.001 },
        aspect: { value: w / h },
        seed: { value: 0 },
        resolution: { value: new THREE.Vector2(w, h) },
      },
      /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDof;
      uniform sampler2D tBloom;
      uniform sampler2D tStreak;
      uniform sampler2D tOverlay;
      uniform float overlayWeight;
      ${DEPTH_FN}
      ${COC_FN}
      uniform float bloomStrength;
      uniform float streakStrength;
      uniform vec3 streakTint;
      uniform float exposure;
      uniform float contrast;
      uniform float saturation;
      uniform vec3 lift;
      uniform float vignette;
      uniform float grain;
      uniform float aberration;
      uniform float aspect;
      uniform float seed;
      uniform vec2 resolution;

      vec3 aces(vec3 x) {
        const float a = 2.51; const float b = 0.03;
        const float c = 2.43; const float d = 0.59; const float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) {
        vec3 lo = c * 12.92;
        vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
        return mix(lo, hi, step(vec3(0.0031308), c));
      }
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031 + seed * 0.37);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main() {
        vec2 d = vUv - 0.5;
        vec2 off = d * aberration * 2.0;
        vec3 sharp;
        sharp.r = texture2D(tColor, vUv - off).r;
        sharp.g = texture2D(tColor, vUv).g;
        sharp.b = texture2D(tColor, vUv + off).b;
        vec4 blurred = texture2D(tDof, vUv);
        float coc = cocNorm(viewDist(vUv));
        float f = max(smoothstep(0.04, 0.35, coc), smoothstep(0.05, 0.4, blurred.a));
        vec3 col = mix(sharp, blurred.rgb, f);
        col += texture2D(tOverlay, vUv).rgb * overlayWeight;
        col += texture2D(tBloom, vUv).rgb * bloomStrength;
        col += texture2D(tStreak, vUv).rgb * streakTint * streakStrength;
        col += lift;
        col *= exposure;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, saturation);
        col = aces(col);
        // contrast around 18% grey (keeps the toe/shadow tint intact)
        col = clamp(0.18 * pow(col / 0.18, vec3(contrast)), 0.0, 1.0);
        vec2 dv = d * vec2(aspect, 1.0);
        float v = smoothstep(1.15, 0.25, length(dv));
        col *= mix(1.0 - vignette, 1.0, v);
        vec3 s = toSRGB(col);
        s += (hash(vUv * resolution) - 0.5) * grain;
        s += (hash(vUv * resolution + 17.0) - 0.5) / 255.0;
        gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
      }`,
    );
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    p: PostParams,
    overlay?: THREE.Scene,
  ) {
    const r = this.renderer;
    const setDepth = (m: THREE.ShaderMaterial) => {
      const u = m.uniforms;
      u.cameraNear.value = camera.near;
      u.cameraFar.value = camera.far;
      if (u.focusDistance) {
        u.focusDistance.value = p.focusDistance;
        u.focusRange.value = p.focusRange;
        u.blurRangeNear.value = p.blurRangeNear;
        u.blurRangeFar.value = p.blurRangeFar;
      }
    };
    const pass = (q: FullScreenQuad, target: THREE.WebGLRenderTarget | null) => {
      r.setRenderTarget(target);
      q.render(r);
    };

    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);

    const ow = overlay ? 1 : 0;
    if (overlay) {
      const bg = overlay.background;
      overlay.background = null;
      r.setRenderTarget(this.overlayRT);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, true);
      r.render(overlay, camera);
      overlay.background = bg;
    }

    setDepth(mat(this.downQuad));
    pass(this.downQuad, this.quarterRT);

    setDepth(mat(this.dofQuad));
    mat(this.dofQuad).uniforms.maxBlurPx.value = Math.max(1, (p.maxBlur * this.h) / 4);
    pass(this.dofQuad, this.dofRT);

    // Bloom (dual Kawase): prefilter into up[0] (1/4), downsample chain, then
    // upsample back accumulating each level. Result ends in up[0].
    const pf = mat(this.prefilterQuad);
    pf.uniforms.threshold.value = p.bloomThreshold;
    pf.uniforms.knee.value = p.bloomKnee;
    pf.uniforms.overlayWeight.value = ow;
    pass(this.prefilterQuad, this.bloomUp[0]);
    const kd = mat(this.kawaseDownQuad);
    let src = this.bloomUp[0];
    for (const dst of this.bloomDown) {
      kd.uniforms.tSrc.value = src.texture;
      kd.uniforms.texel.value.set(0.5 / src.width, 0.5 / src.height);
      pass(this.kawaseDownQuad, dst);
      src = dst;
    }
    const ku = mat(this.kawaseUpQuad);
    for (let i = this.bloomDown.length - 2; i >= -1; i--) {
      const target = i >= 0 ? this.bloomUp[i + 1] : this.bloomUp[0];
      ku.uniforms.tSrc.value = src.texture;
      ku.uniforms.tBase.value = i >= 0 ? this.bloomDown[i].texture : this.bloomDown[0].texture;
      ku.uniforms.baseWeight.value = i >= 0 ? 1.0 : 0.0;
      ku.uniforms.texel.value.set(0.5 / src.width, 0.5 / src.height);
      pass(this.kawaseUpQuad, target);
      src = target;
    }

    if (this.useStreaks && p.streakStrength > 0) {
      pf.uniforms.threshold.value = p.streakThreshold;
      pass(this.prefilterQuad, this.streakA);
      const blur = mat(this.streakBlurQuad);
      let a = this.streakA;
      let b = this.streakB;
      for (const step of [1, 4, 16]) {
        blur.uniforms.tSrc.value = a.texture;
        blur.uniforms.stepUv.value = step / a.width;
        pass(this.streakBlurQuad, b);
        [a, b] = [b, a];
      }
      // three passes -> result in streakB
    }

    const g = mat(this.finalQuad);
    setDepth(g);
    g.uniforms.overlayWeight.value = ow;
    g.uniforms.bloomStrength.value = p.bloomStrength;
    g.uniforms.streakStrength.value = this.useStreaks ? p.streakStrength : 0;
    g.uniforms.streakTint.value.copy(p.streakTint);
    g.uniforms.exposure.value = p.exposure;
    g.uniforms.contrast.value = p.contrast;
    g.uniforms.saturation.value = p.saturation;
    g.uniforms.lift.value.copy(p.lift);
    g.uniforms.vignette.value = p.vignette;
    g.uniforms.grain.value = p.grain;
    g.uniforms.aberration.value = p.aberration;
    g.uniforms.seed.value = p.seed;
    pass(this.finalQuad, null);
  }

  dispose() {
    [
      this.sceneRT,
      this.quarterRT,
      this.dofRT,
      this.overlayRT,
      this.streakA,
      this.streakB,
      ...this.bloomDown,
      ...this.bloomUp,
    ].forEach((t) => t.dispose());
    [
      this.downQuad,
      this.dofQuad,
      this.prefilterQuad,
      this.kawaseDownQuad,
      this.kawaseUpQuad,
      this.streakBlurQuad,
      this.finalQuad,
    ].forEach((q) => {
      (q.material as THREE.Material).dispose();
      q.dispose();
    });
  }
}
