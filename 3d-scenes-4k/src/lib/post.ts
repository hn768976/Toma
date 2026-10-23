import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/**
 * Custom post pipeline (linear HDR throughout, display transform at the end):
 *   scene  -> full-res HDR + depth
 *   prep   -> half-res colour + signed circle-of-confusion
 *   gather -> half-res N-tap (default 96) Vogel-disk bokeh (scatter-as-gather)
 *   fill   -> half-res tent to smooth the gather
 *   comp   -> full-res mix of sharp/blurred by per-pixel CoC
 *   bloom  -> optional UnrealBloom on the composite
 *   grade  -> ACES tone map, lift/gain, saturation, vignette, sRGB, dither
 */

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const cocChunk = /* glsl */ `
  uniform sampler2D tDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float focus;     // focus distance (world units)
  uniform float cocScale;  // pixels (full-res) of blur per unit |1/f - 1/z|
  uniform float nearScale; // extra multiplier for near-field blur
  uniform float maxCoc;    // clamp (full-res pixels)
  float viewDist(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    float viewZ = (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar);
    return -viewZ;
  }
  float cocAt(vec2 uv) {
    float z = viewDist(uv);
    float c = cocScale * (1.0 / focus - 1.0 / z);
    // c > 0: behind the focus plane, c < 0: in front of it
    if (c < 0.0) c *= nearScale;
    return clamp(c, -maxCoc, maxCoc);
  }
`;

const PrepShader = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 200 },
    focus: { value: 6 },
    cocScale: { value: 100 },
    nearScale: { value: 1 },
    maxCoc: { value: 48 },
    fireflyClamp: { value: 8 },
    texel: { value: new THREE.Vector2() },
  },
  vertexShader: quadVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor;
    uniform vec2 texel; // full-res texel size
    uniform float fireflyClamp;
    ${cocChunk}
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tColor, vUv).rgb; // bilinear = 2x2 box at half res
      float coc = cocAt(vUv);
      // Clamp fireflies so tiny highlights don't turn into hard discs.
      float l = max(c.r, max(c.g, c.b));
      c *= min(1.0, fireflyClamp / max(l, 1e-4));
      gl_FragColor = vec4(c, coc);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

const GatherShader = new THREE.ShaderMaterial({
  uniforms: {
    tPrep: { value: null },
    halfTexel: { value: new THREE.Vector2() },
    maxCoc: { value: 48 },
  },
  defines: { TAPS: 96 },
  vertexShader: quadVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tPrep;
    uniform vec2 halfTexel;
    uniform float maxCoc;
    varying vec2 vUv;
    void main() {
      vec4 center = texture2D(tPrep, vUv);
      // Work in half-res pixels.
      float maxR = maxCoc * 0.5;
      float cR = abs(center.a) * 0.5;
      vec3 acc = center.rgb;
      float wsum = 1.0;
      const float GOLDEN = 2.39996323;
      for (int i = 1; i < TAPS; i++) {
        float fi = float(i);
        float r = sqrt(fi / float(TAPS)) * maxR;
        float th = fi * GOLDEN;
        vec2 off = vec2(cos(th), sin(th)) * r;
        vec4 s = texture2D(tPrep, vUv + off * halfTexel);
        float sR = abs(s.a) * 0.5;
        // A sample contributes if its own blur disc reaches the centre;
        // background samples cannot bleed over a sharper foreground.
        float reach = s.a < center.a ? min(sR, cR + 0.75) : sR;
        float w = smoothstep(r - 1.0, r + 1.0, reach);
        acc += s.rgb * w;
        wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, center.a);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

// Small 9-tap tent over the gathered result hides undersampling noise.
const FillShader = new THREE.ShaderMaterial({
  uniforms: {
    tBlur: { value: null },
    halfTexel: { value: new THREE.Vector2() },
    fillScale: { value: 0.18 },
  },
  vertexShader: quadVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tBlur;
    uniform vec2 halfTexel;
    uniform float fillScale;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tBlur, vUv);
      float r = clamp(abs(c.a) * 0.5 * fillScale, 0.0, 6.0);
      vec3 acc = c.rgb * 4.0;
      float w = 4.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          if (x == 0 && y == 0) continue;
          float k = (x == 0 || y == 0) ? 2.0 : 1.0;
          acc += texture2D(tBlur, vUv + vec2(float(x), float(y)) * r * halfTexel).rgb * k;
          w += k;
        }
      }
      gl_FragColor = vec4(acc / w, c.a);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

const CompShader = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null },
    tBlur: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 200 },
    focus: { value: 6 },
    cocScale: { value: 100 },
    nearScale: { value: 1 },
    maxCoc: { value: 48 },
  },
  vertexShader: quadVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor;
    uniform sampler2D tBlur;
    ${cocChunk}
    varying vec2 vUv;
    void main() {
      vec3 sharp = texture2D(tColor, vUv).rgb;
      vec4 blur = texture2D(tBlur, vUv);
      float coc = abs(cocAt(vUv));
      float k = smoothstep(1.0, 4.0, coc);
      gl_FragColor = vec4(mix(sharp, blur.rgb, k), 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

const GradeShader = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null },
    exposure: { value: 1 },
    vignette: { value: 0.35 },
    lift: { value: new THREE.Vector3(0, 0, 0) },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    saturation: { value: 1 },
  },
  vertexShader: quadVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor;
    uniform float exposure;
    uniform float vignette;
    uniform vec3 lift;
    uniform vec3 gain;
    uniform float saturation;
    varying vec2 vUv;
    // ACES fitted (Stephen Hill)
    vec3 RRTAndODTFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 aces(vec3 color) {
      const mat3 ACESInputMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 ACESOutputMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      color = ACESInputMat * color;
      color = RRTAndODTFit(color);
      color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 col = texture2D(tColor, vUv).rgb * exposure;
      col = aces(col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = lift + col * (gain - lift);
      vec2 d = vUv - 0.5;
      d.x *= 1.3;
      col *= 1.0 - vignette * smoothstep(0.2, 0.85, length(d));
      col = toSRGB(clamp(col, 0.0, 1.0));
      col += (rand(vUv * 1731.0) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

export type PostOptions = {
  focus: number;
  cocScale: number;
  nearScale?: number;
  maxCoc: number;
  taps?: number; // bokeh gather samples (default 96)
  fireflyClamp?: number; // max luminance fed into the blur (default 8)
  fillScale?: number; // post-gather smoothing radius factor (default 0.18)
  exposure?: number;
  bloom?: { strength: number; radius: number; threshold: number };
  vignette: number;
  lift?: [number, number, number];
  gain?: [number, number, number];
  saturation?: number;
};

export const createPost = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  opts: PostOptions,
) => {
  const hdr = { type: THREE.HalfFloatType, depthBuffer: false } as const;
  const sceneRT = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });
  sceneRT.depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
  const hw = Math.ceil(width / 2);
  const hh = Math.ceil(height / 2);
  const prepRT = new THREE.WebGLRenderTarget(hw, hh, hdr);
  const blurRT = new THREE.WebGLRenderTarget(hw, hh, hdr);
  const fillRT = new THREE.WebGLRenderTarget(hw, hh, hdr);
  const compRT = new THREE.WebGLRenderTarget(width, height, hdr);

  const prep = PrepShader.clone();
  const gather = GatherShader.clone();
  gather.defines = { TAPS: opts.taps ?? 96 };
  const fill = FillShader.clone();
  const comp = CompShader.clone();
  const grade = GradeShader.clone();
  const quad = new FullScreenQuad();

  const cocUniforms = [prep.uniforms, comp.uniforms];
  const setCoc = (focus: number) => {
    for (const u of cocUniforms) {
      u.tDepth.value = sceneRT.depthTexture;
      u.cameraNear.value = camera.near;
      u.cameraFar.value = camera.far;
      u.focus.value = focus;
      u.cocScale.value = opts.cocScale;
      u.nearScale.value = opts.nearScale ?? 1;
      u.maxCoc.value = opts.maxCoc;
    }
  };
  setCoc(opts.focus);
  prep.uniforms.tColor.value = sceneRT.texture;
  prep.uniforms.texel.value.set(1 / width, 1 / height);
  prep.uniforms.fireflyClamp.value = opts.fireflyClamp ?? 8;
  gather.uniforms.tPrep.value = prepRT.texture;
  gather.uniforms.halfTexel.value.set(1 / hw, 1 / hh);
  gather.uniforms.maxCoc.value = opts.maxCoc;
  comp.uniforms.tColor.value = sceneRT.texture;
  fill.uniforms.tBlur.value = blurRT.texture;
  fill.uniforms.halfTexel.value.set(1 / hw, 1 / hh);
  fill.uniforms.fillScale.value = opts.fillScale ?? 0.18;
  comp.uniforms.tBlur.value = fillRT.texture;
  grade.uniforms.tColor.value = compRT.texture;
  grade.uniforms.exposure.value = opts.exposure ?? 1;
  grade.uniforms.vignette.value = opts.vignette;
  if (opts.lift) grade.uniforms.lift.value.set(...opts.lift);
  if (opts.gain) grade.uniforms.gain.value.set(...opts.gain);
  grade.uniforms.saturation.value = opts.saturation ?? 1;

  const bloom = opts.bloom
    ? new UnrealBloomPass(
        new THREE.Vector2(width, height),
        opts.bloom.strength,
        opts.bloom.radius,
        opts.bloom.threshold,
      )
    : null;
  bloom?.setSize(width, height);

  const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  };

  let focus = opts.focus;
  return {
    setFocus: (d: number) => {
      focus = d;
    },
    render: () => {
      setCoc(focus);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);
      pass(prep, prepRT);
      pass(gather, blurRT);
      pass(fill, fillRT);
      pass(comp, compRT);
      if (bloom) {
        bloom.renderToScreen = false;
        // UnrealBloomPass composites additively back onto its read buffer.
        bloom.render(renderer, compRT, compRT, 0, false);
      }
      pass(grade, null);
    },
    dispose: () => {
      [sceneRT, prepRT, blurRT, fillRT, compRT].forEach((t) => t.dispose());
      [prep, gather, fill, comp, grade].forEach((m) => m.dispose());
      quad.dispose();
      bloom?.dispose();
    },
  };
};
