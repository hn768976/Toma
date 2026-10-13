import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { FRAG_OUT, FULLSCREEN_VERT, GLSL_COLOR, GLSL_HASH } from "./glsl";

/**
 * Post pipeline shared by the three.js looks.
 *
 *   scene  -> MSAA HDR target (+ depth)
 *          -> optional depth-of-field gather pass
 *          -> optional additive overlay scene (beams, glitter...) drawn sharp
 *          -> bloom built at a FIXED internal resolution (so 720p and 4K glow
 *             identically relative to the frame)
 *          -> final: exposure, optional ACES, sRGB, grain + dither
 *
 * Every size in here is either a fraction of the frame or expressed in
 * "720p pixels" and multiplied by pxScale = bufferHeight / 720, so a 720p
 * preview and a 4K render look the same.
 */

export type DofOptions = {
  /** Camera-space distance that is perfectly sharp. */
  focus: number;
  /** Blur (720p px) for an object infinitely far behind focus. */
  farBlur: number;
  /** Blur (720p px) per unit of (focus/z - 1) in front of focus. */
  nearBlur: number;
  /** Clamp (720p px). */
  maxBlur: number;
};

export type PostOptions = {
  dof?: DofOptions | null;
  bloom: {
    strength: number;
    threshold: number;
    knee: number;
    /** Weights for the 6 bloom levels (fine -> coarse). */
    weights: [number, number, number, number, number, number];
  } | null;
  exposure: number;
  aces: boolean;
  /** Grain amplitude (fraction of full scale). */
  grain: number;
  /** Fade grain + dither to zero in near-black (keeps pure black clean). */
  grainLumaFade: number;
  msaa: number;
};

const BLOOM_W = 640;
const BLOOM_H = 360;
const BLOOM_LEVELS = 6;

const makeTarget = (
  w: number,
  h: number,
  opts: Partial<THREE.RenderTargetOptions> = {},
) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

const dofShader = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 res;
uniform float pxScale, cameraNear, cameraFar;
uniform float focus, farBlur, nearBlur, maxBlur;
in vec2 vUv;
const float GOLDEN = 2.39996323;
float viewZ(float d) {
  // perspective depth -> positive view distance
  return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar) * -1.0;
}
float coc(float z) {
  float c = z > focus ? farBlur * (1.0 - focus / z) : nearBlur * (focus / z - 1.0);
  return clamp(c, 0.0, maxBlur);
}
void main() {
  float cz = viewZ(texture(tDepth, vUv).x);
  float csz = coc(cz);
  vec3 col = texture(tColor, vUv).rgb;
  float tot = 1.0;
  float radius = 0.6;
  float ang = 0.0;
  // radius in 720p px; offsets scaled to real px by pxScale.
  for (int i = 0; i < 260; i++) {
    if (radius >= maxBlur) break;
    vec2 off = vec2(cos(ang), sin(ang)) * radius * pxScale / res;
    vec2 tc = vUv + off;
    vec3 sc = texture(tColor, tc).rgb;
    float sz = viewZ(texture(tDepth, tc).x);
    float ss = coc(sz);
    if (sz > cz) ss = clamp(ss, 0.0, csz * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    col += mix(col / tot, sc, m);
    tot += 1.0;
    radius += 0.9 / radius;
    ang += GOLDEN;
  }
  gl_FragColor = vec4(col / tot, 1.0);
}
`;

// Box-ish downsample by an arbitrary ratio using N x N bilinear taps.
const downShader = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 srcTexel;
uniform vec2 ratio;
uniform int taps;
uniform float threshold, knee;
uniform bool prefilter;
in vec2 vUv;
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float n = float(taps);
  for (int j = 0; j < 8; j++) {
    if (j >= taps) break;
    for (int i = 0; i < 8; i++) {
      if (i >= taps) break;
      vec2 o = (vec2(float(i), float(j)) + 0.5) / n - 0.5;
      vec3 s = min(texture(tSrc, vUv + o * ratio * srcTexel).rgb, vec3(64.0));
      // Karis average on the first level: suppresses single-pixel fireflies
      float w = prefilter ? 1.0 / (1.0 + max(s.r, max(s.g, s.b))) : 1.0;
      acc += s * w;
      wsum += w;
    }
  }
  vec3 c = acc / wsum;
  if (prefilter) {
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-5);
    float contrib = max(soft, br - threshold) / max(br, 1e-5);
    c *= contrib;
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

const blurShader = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 dir;
in vec2 vUv;
void main() {
  // 9-tap gaussian (sigma ~ 2 texels) via 5 linear fetches
  vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
  vec2 o1 = dir * 1.3846153846;
  vec2 o2 = dir * 3.2307692308;
  c += texture(tSrc, vUv + o1).rgb * 0.3162162162;
  c += texture(tSrc, vUv - o1).rgb * 0.3162162162;
  c += texture(tSrc, vUv + o2).rgb * 0.0702702703;
  c += texture(tSrc, vUv - o2).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

// Combine level i (blurred) with upsampled coarser accumulation (tent filter).
const upShader = /* glsl */ `
uniform sampler2D tFine;
uniform sampler2D tCoarse;
uniform vec2 coarseTexel;
uniform float wFine;
uniform float wCoarse;
in vec2 vUv;
void main() {
  vec2 t = coarseTexel;
  vec3 c = texture(tCoarse, vUv).rgb * 4.0;
  c += (texture(tCoarse, vUv + vec2(t.x, 0.0)).rgb + texture(tCoarse, vUv - vec2(t.x, 0.0)).rgb +
        texture(tCoarse, vUv + vec2(0.0, t.y)).rgb + texture(tCoarse, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  c += texture(tCoarse, vUv + t).rgb + texture(tCoarse, vUv - t).rgb +
       texture(tCoarse, vUv + vec2(t.x, -t.y)).rgb + texture(tCoarse, vUv + vec2(-t.x, t.y)).rgb;
  c /= 16.0;
  gl_FragColor = vec4(texture(tFine, vUv).rgb * wFine + c * wCoarse, 1.0);
}
`;

const finalShader = /* glsl */ `
${GLSL_HASH}
${GLSL_COLOR}
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float bloomStrength, exposure, grain, grainLumaFade, frame;
uniform bool aces;
in vec2 vUv;
void main() {
  vec3 c = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * bloomStrength;
  c *= exposure;
  c = aces ? acesFitted(c) : clamp(c, 0.0, 1.0);
  c = lin2srgb(c);
  vec3 r = hash3u(uvec3(uvec2(gl_FragCoord.xy), uint(frame) + 7919u));
  vec3 r2 = hash3u(uvec3(uvec2(gl_FragCoord.xy) + 4099u, uint(frame) + 104729u));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float fade = grainLumaFade > 0.0 ? smoothstep(grainLumaFade * 0.25, grainLumaFade, l) : 1.0;
  float g = (r.x + r.y - 1.0) * grain;             // film grain, fixed formula of (x, y, frame % 600)
  vec3 d = (vec3(r.z, r2.x, r2.y) + r2.zxy - 1.0) / 255.0; // +-1/255 triangular dither
  c += (g + d) * fade;
  gl_FragColor = vec4(c, 1.0);
}
`;

const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FRAG_OUT + fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class Pipeline {
  readonly width: number;
  readonly height: number;
  readonly pxScale: number;
  private sceneRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget | null;
  private bloomA: THREE.WebGLRenderTarget[] = [];
  private bloomB: THREE.WebGLRenderTarget[] = [];
  private quad = new FullScreenQuad();
  private dofMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;

  constructor(
    private gl: THREE.WebGLRenderer,
    public opts: PostOptions,
  ) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.width = Math.round(size.x);
    this.height = Math.round(size.y);
    this.pxScale = this.height / 720;
    const w = this.width;
    const h = this.height;
    const useDof = !!opts.dof;
    this.sceneRT = makeTarget(w, h, {
      samples: opts.msaa,
      depthBuffer: true,
      depthTexture: useDof ? new THREE.DepthTexture(w, h, THREE.FloatType) : null,
    });
    this.dofRT = useDof ? makeTarget(w, h) : null;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const bw = Math.max(2, Math.round(BLOOM_W / 2 ** i));
      const bh = Math.max(2, Math.round(BLOOM_H / 2 ** i));
      this.bloomA.push(makeTarget(bw, bh));
      this.bloomB.push(makeTarget(bw, bh));
    }
    this.dofMat = mat(dofShader, {
      tColor: { value: null },
      tDepth: { value: null },
      res: { value: new THREE.Vector2(w, h) },
      pxScale: { value: this.pxScale },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      focus: { value: 10 },
      farBlur: { value: 0 },
      nearBlur: { value: 0 },
      maxBlur: { value: 0 },
    });
    this.downMat = mat(downShader, {
      tSrc: { value: null },
      srcTexel: { value: new THREE.Vector2() },
      ratio: { value: new THREE.Vector2() },
      taps: { value: 1 },
      threshold: { value: 1 },
      knee: { value: 0.5 },
      prefilter: { value: false },
    });
    this.blurMat = mat(blurShader, {
      tSrc: { value: null },
      dir: { value: new THREE.Vector2() },
    });
    this.upMat = mat(upShader, {
      tFine: { value: null },
      tCoarse: { value: null },
      coarseTexel: { value: new THREE.Vector2() },
      wFine: { value: 1 },
      wCoarse: { value: 1 },
    });
    this.finalMat = mat(finalShader, {
      tColor: { value: null },
      tBloom: { value: null },
      bloomStrength: { value: 1 },
      exposure: { value: 1 },
      grain: { value: 0.015 },
      grainLumaFade: { value: 0 },
      frame: { value: 0 },
      aces: { value: false },
    });
  }

  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.gl.setRenderTarget(target);
    this.quad.render(this.gl);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    overlay: THREE.Scene | null,
    frame: number,
  ) {
    const gl = this.gl;
    const o = this.opts;
    gl.autoClear = true;
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    let color: THREE.WebGLRenderTarget = this.sceneRT;
    if (o.dof && this.dofRT) {
      const u = this.dofMat.uniforms;
      u.tColor.value = this.sceneRT.texture;
      u.tDepth.value = this.sceneRT.depthTexture;
      u.cameraNear.value = camera.near;
      u.cameraFar.value = camera.far;
      u.focus.value = o.dof.focus;
      u.farBlur.value = o.dof.farBlur;
      u.nearBlur.value = o.dof.nearBlur;
      u.maxBlur.value = o.dof.maxBlur;
      this.pass(this.dofMat, this.dofRT);
      color = this.dofRT;
    }
    if (overlay) {
      // Drawn after DoF so the overlay stays sharp. No depth test against
      // the scene (overlay materials set depthTest:false).
      gl.autoClear = false;
      gl.setRenderTarget(color);
      gl.render(overlay, camera);
      gl.autoClear = true;
    }

    const f = this.finalMat.uniforms;
    f.tColor.value = color.texture;
    f.tBloom.value = o.bloom ? this.bloom(color, o.bloom) : color.texture;
    f.bloomStrength.value = o.bloom ? o.bloom.strength : 0;
    f.exposure.value = o.exposure;
    f.aces.value = o.aces;
    f.grain.value = o.grain;
    f.grainLumaFade.value = o.grainLumaFade;
    f.frame.value = frame;
    this.pass(this.finalMat, null);
  }

  /** Bloom at a fixed internal resolution; returns the accumulated texture. */
  private bloom(color: THREE.WebGLRenderTarget, bloom: NonNullable<PostOptions["bloom"]>) {
    const d = this.downMat.uniforms;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const src = i === 0 ? color : this.bloomA[i - 1];
      const dst = this.bloomA[i];
      const rx = src.width / dst.width;
      const ry = src.height / dst.height;
      d.tSrc.value = src.texture;
      d.srcTexel.value.set(1 / src.width, 1 / src.height);
      d.ratio.value.set(rx, ry);
      d.taps.value = Math.min(8, Math.max(1, Math.ceil(Math.max(rx, ry) / 2)));
      d.prefilter.value = i === 0;
      d.threshold.value = bloom.threshold;
      d.knee.value = bloom.knee;
      this.pass(this.downMat, dst);
      // blur in place: A -> B (h) -> A (v)
      const b = this.blurMat.uniforms;
      b.tSrc.value = dst.texture;
      b.dir.value.set(1 / dst.width, 0);
      this.pass(this.blurMat, this.bloomB[i]);
      b.tSrc.value = this.bloomB[i].texture;
      b.dir.value.set(0, 1 / dst.height);
      this.pass(this.blurMat, dst);
    }
    // upsample-accumulate coarse -> fine into bloomB
    const w = bloom.weights;
    const u = this.upMat.uniforms;
    let coarse = this.bloomA[BLOOM_LEVELS - 1];
    let coarseW = w[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      u.tFine.value = this.bloomA[i].texture;
      u.tCoarse.value = coarse.texture;
      u.coarseTexel.value.set(1 / coarse.width, 1 / coarse.height);
      u.wFine.value = w[i];
      u.wCoarse.value = coarseW;
      this.pass(this.upMat, this.bloomB[i]);
      coarse = this.bloomB[i];
      coarseW = 1;
    }
    return coarse.texture;
  }

  dispose() {
    this.sceneRT.dispose();
    this.dofRT?.dispose();
    this.bloomA.forEach((t) => t.dispose());
    this.bloomB.forEach((t) => t.dispose());
    this.quad.dispose();
  }
}
