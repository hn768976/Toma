import * as THREE from "three";

// Post-processing chain shared by every look. Everything renders into
// half-float targets; the last pass adds grain + ±1/255 dither (both a fixed
// hash of pixel position and frame index) and writes 8-bit to the canvas.
//
//   scene ──► rtScene (RGBA16F, MSAA×4, depth texture)
//          ──► rtHalf  : ½-res colour + signed circle-of-confusion (thin lens)
//          ──► rtBlur  : ½-res gather depth-of-field (golden-angle disc)
//          ──► bloom   : ¼, ⅛, 1/16, 1/32 Gaussian pyramid of the bright parts
//          ──► canvas  : mix(sharp, dof) + bloom, vignette, grain, dither
//
// Nothing here keeps state between frames: each call to render() is a pure
// function of (scene state, frame).

export type PostParams = {
  focusDist: number; // world units from the camera
  aperture: number; // coc = clamp((1 - focus/z) * aperture) * maxBlur
  focusBand: number; // |1 - focus/z| below this stays perfectly sharp
  nearScale: number; // extra multiplier for the near field
  maxBlur: number; // largest blur radius, as a fraction of image height
  bloomThreshold: number;
  bloomStrength: number;
  bloomWeights: [number, number, number, number];
  vignette: number;
  grain: number; // e.g. 0.015 = ±1.5 %
  // screen-space light flare (soft radial glow), uv 0..1 from bottom-left
  flare?: { x: number; y: number; radius: number; color: [number, number, number]; strength: number };
  // haze veil that lifts the darks towards a colour (0 = off)
  veil?: { color: [number, number, number]; amount: number };
};

export const DEFAULT_POST: PostParams = {
  focusDist: 10,
  aperture: 0,
  focusBand: 0,
  nearScale: 1,
  maxBlur: 0.012,
  bloomThreshold: 0.8,
  bloomStrength: 0,
  bloomWeights: [1, 1, 1, 1],
  vignette: 0,
  grain: 0.015,
};

const VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const HEAD = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
`;

const COC_FRAG = /* glsl */ `${HEAD}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 fullRes;
uniform float near, far, focusDist, aperture, focusBand, nearScale, maxBlurPx;
float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - z * (far - near));
}
void main() {
  vec3 c = texture(tColor, vUv).rgb; // bilinear tap = 2×2 box average
  ivec2 p = ivec2(floor(vUv * fullRes - 0.5));
  ivec2 m = ivec2(fullRes) - 1;
  float d = min(min(texelFetch(tDepth, clamp(p, ivec2(0), m), 0).r,
                    texelFetch(tDepth, clamp(p + ivec2(1, 0), ivec2(0), m), 0).r),
                min(texelFetch(tDepth, clamp(p + ivec2(0, 1), ivec2(0), m), 0).r,
                    texelFetch(tDepth, clamp(p + ivec2(1, 1), ivec2(0), m), 0).r));
  float z = linDepth(d);
  float k = 1.0 - focusDist / z; // <0 near, >0 far
  float ak = max(abs(k) - focusBand, 0.0) * aperture * (k < 0.0 ? nearScale : 1.0);
  float coc = clamp(ak, 0.0, 1.0) * maxBlurPx * sign(k);
  outColor = vec4(c, coc); // signed CoC in full-res pixels
}
`;

const DOF_SAMPLES = 64;
const DOF_FRAG = /* glsl */ `${HEAD}
uniform sampler2D tHalf;
uniform vec2 halfRes;
uniform float maxR; // half-res pixels
const int N = ${DOF_SAMPLES};
const float PI = 3.14159265;
void main() {
  vec2 texel = 1.0 / halfRes;
  vec4 C = texture(tHalf, vUv);
  float cC = C.a * 0.5;
  float rC = abs(cC);
  // Centre pixel: keeps all of its own energy when sharp.
  float w0 = 1.0 / max(PI * rC * rC, 1.0);
  vec3 acc = C.rgb * w0;
  float wsum = w0;
  float sampleArea = PI * maxR * maxR / float(N);
  // Fixed per-pixel spiral rotation (interleaved gradient noise) breaks up
  // the sample pattern; it depends on pixel position only.
  float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N)) * maxR;
    float th = fi * 2.39996323 + rot;
    vec2 off = vec2(cos(th), sin(th)) * r;
    vec4 S = textureLod(tHalf, vUv + off * texel, 0.0);
    float sC = S.a * 0.5;
    // A sample farther away than the centre cannot blur over it by more than
    // the centre's own radius (stops background bleeding onto sharp detail).
    float rS = sC > cC ? min(abs(sC), rC) : abs(sC);
    // samples that are themselves in focus scatter nothing
    float cover = clamp(rS - r + 0.75, 0.0, 1.0) * step(0.5, rS);
    float w = cover * sampleArea / max(PI * rS * rS, 1.0);
    acc += S.rgb * w;
    wsum += w;
  }
  vec3 col = acc / wsum;
  // alpha = how much the blurred result should replace the sharp full-res
  // image: centre blur, or energy scattered in from (near) neighbours.
  float sharpShare = (rC < 0.5) ? w0 / wsum : 0.0;
  float a = max(smoothstep(0.25, 1.25, rC), 1.0 - sharpShare);
  outColor = vec4(col, a);
}
`;

const BRIGHT_FRAG = /* glsl */ `${HEAD}
uniform sampler2D tSrc;
uniform vec2 srcTexel;
uniform float threshold;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tSrc, vUv + srcTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + srcTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + srcTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(tSrc, vUv + srcTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float k = max(l - threshold, 0.0) / max(l, 1e-4);
  outColor = vec4(c * k / max(1.0 - threshold, 0.05), 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `${HEAD}
uniform sampler2D tSrc;
uniform vec2 srcTexel;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tSrc, vUv + srcTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + srcTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + srcTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(tSrc, vUv + srcTexel * vec2( 1.0,  1.0)).rgb;
  outColor = vec4(c * 0.25, 1.0);
}
`;

const GAUSS_FRAG = /* glsl */ `${HEAD}
uniform sampler2D tSrc;
uniform vec2 dir; // texel step along the blur axis
void main() {
  vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
  c += texture(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `${HEAD}
uniform sampler2D tScene;
uniform sampler2D tBlur;
uniform sampler2D tB0;
uniform sampler2D tB1;
uniform sampler2D tB2;
uniform sampler2D tB3;
uniform vec2 halfTexel;
uniform vec4 bloomWeights;
uniform float bloomStrength, vignette, grain, useDof;
uniform vec4 flare; // x, y, radius, strength
uniform vec3 flareColor;
uniform vec4 veil; // rgb, amount
uniform float aspect;
uniform uint frameIndex;
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
void main() {
  vec3 col = texture(tScene, vUv).rgb;
  if (useDof > 0.5) {
    // 4-tap tent over the ½-res DoF result smooths the gather pattern.
    vec4 b = texture(tBlur, vUv + halfTexel * vec2(-0.6, -0.6));
    b += texture(tBlur, vUv + halfTexel * vec2( 0.6, -0.6));
    b += texture(tBlur, vUv + halfTexel * vec2(-0.6,  0.6));
    b += texture(tBlur, vUv + halfTexel * vec2( 0.6,  0.6));
    b *= 0.25;
    col = mix(col, b.rgb, clamp(b.a, 0.0, 1.0));
  }
  vec3 bloom = texture(tB0, vUv).rgb * bloomWeights.x + texture(tB1, vUv).rgb * bloomWeights.y
             + texture(tB2, vUv).rgb * bloomWeights.z + texture(tB3, vUv).rgb * bloomWeights.w;
  col += bloom * bloomStrength;
  col = mix(col, veil.rgb, veil.a);
  vec2 fq = (vUv - flare.xy) * vec2(aspect, 1.0);
  float fr = length(fq) / max(flare.z, 1e-4);
  col += flareColor * flare.w * (exp(-fr * fr * 2.0) + 0.35 * exp(-fr * 1.2));
  vec2 q = vUv - 0.5;
  col *= 1.0 - vignette * dot(q, q) * 2.0;
  // Grain + dither: fixed formula of pixel position and frame (mod length).
  vec3 h = vec3(pcg3d(uvec3(uvec2(gl_FragCoord.xy), frameIndex))) / 4294967295.0;
  col += (h.x - 0.5) * 2.0 * grain;
  col += (h.y + h.z - 1.0) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

export class Pipeline {
  private gl: THREE.WebGLRenderer;
  private w = 0;
  private h = 0;
  private rtScene!: THREE.WebGLRenderTarget;
  private rtHalf!: THREE.WebGLRenderTarget;
  private rtBlur!: THREE.WebGLRenderTarget;
  private levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mCoc = mat(COC_FRAG, {
    tColor: { value: null },
    tDepth: { value: null },
    fullRes: { value: new THREE.Vector2() },
    near: { value: 0.1 },
    far: { value: 100 },
    focusDist: { value: 10 },
    aperture: { value: 0 },
    focusBand: { value: 0 },
    nearScale: { value: 1 },
    maxBlurPx: { value: 0 },
  });
  private mDof = mat(DOF_FRAG, {
    tHalf: { value: null },
    halfRes: { value: new THREE.Vector2() },
    maxR: { value: 1 },
  });
  private mBright = mat(BRIGHT_FRAG, {
    tSrc: { value: null },
    srcTexel: { value: new THREE.Vector2() },
    threshold: { value: 0.8 },
  });
  private mDown = mat(DOWN_FRAG, { tSrc: { value: null }, srcTexel: { value: new THREE.Vector2() } });
  private mGauss = mat(GAUSS_FRAG, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
  private mFinal = mat(FINAL_FRAG, {
    tScene: { value: null },
    tBlur: { value: null },
    tB0: { value: null },
    tB1: { value: null },
    tB2: { value: null },
    tB3: { value: null },
    halfTexel: { value: new THREE.Vector2() },
    bloomWeights: { value: new THREE.Vector4() },
    bloomStrength: { value: 0 },
    vignette: { value: 0 },
    grain: { value: 0.015 },
    useDof: { value: 1 },
    flare: { value: new THREE.Vector4() },
    flareColor: { value: new THREE.Color() },
    veil: { value: new THREE.Vector4() },
    aspect: { value: 16 / 9 },
    frameIndex: { value: 0 },
  });

  constructor(gl: THREE.WebGLRenderer) {
    this.gl = gl;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mFinal);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private ensureSize() {
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.round(size.x);
    const h = Math.round(size.y);
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.rtScene = rt(w, h, { samples: 4, depthBuffer: true, depthTexture });
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.rtHalf = rt(hw, hh);
    this.rtBlur = rt(hw, hh);
    this.levels = [4, 8, 16, 32].map((d) => ({
      a: rt(Math.ceil(w / d), Math.ceil(h / d)),
      b: rt(Math.ceil(w / d), Math.ceil(h / d)),
    }));
  }

  dispose() {
    this.rtScene?.depthTexture?.dispose();
    this.rtScene?.dispose();
    this.rtHalf?.dispose();
    this.rtBlur?.dispose();
    for (const l of this.levels) {
      l.a.dispose();
      l.b.dispose();
    }
    this.levels = [];
  }

  private pass(m: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    frameIndex: number,
    p: PostParams,
  ) {
    this.ensureSize();
    const { gl, w, h } = this;
    gl.autoClear = true;

    gl.setRenderTarget(this.rtScene);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const useDof = p.aperture > 0;
    const maxBlurPx = p.maxBlur * h;
    const u = this.mCoc.uniforms;
    u.tColor.value = this.rtScene.texture;
    u.tDepth.value = this.rtScene.depthTexture;
    u.fullRes.value.set(w, h);
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.focusDist.value = p.focusDist;
    u.aperture.value = p.aperture;
    u.focusBand.value = p.focusBand;
    u.nearScale.value = p.nearScale;
    u.maxBlurPx.value = maxBlurPx;
    this.pass(this.mCoc, this.rtHalf);

    let bloomSrc = this.rtHalf;
    if (useDof) {
      const d = this.mDof.uniforms;
      d.tHalf.value = this.rtHalf.texture;
      d.halfRes.value.set(this.rtHalf.width, this.rtHalf.height);
      d.maxR.value = Math.max(1, maxBlurPx * 0.5);
      this.pass(this.mDof, this.rtBlur);
      bloomSrc = this.rtBlur;
    }

    if (p.bloomStrength > 0) {
      const b = this.mBright.uniforms;
      b.tSrc.value = bloomSrc.texture;
      b.srcTexel.value.set(0.5 / bloomSrc.width, 0.5 / bloomSrc.height);
      b.threshold.value = p.bloomThreshold;
      this.pass(this.mBright, this.levels[0].a);
      for (let i = 0; i < this.levels.length; i++) {
        const L = this.levels[i];
        if (i > 0) {
          const prev = this.levels[i - 1].a;
          this.mDown.uniforms.tSrc.value = prev.texture;
          this.mDown.uniforms.srcTexel.value.set(0.5 / prev.width, 0.5 / prev.height);
          this.pass(this.mDown, L.a);
        }
        const g = this.mGauss.uniforms;
        g.tSrc.value = L.a.texture;
        g.dir.value.set(1 / L.a.width, 0);
        this.pass(this.mGauss, L.b);
        g.tSrc.value = L.b.texture;
        g.dir.value.set(0, 1 / L.a.height);
        this.pass(this.mGauss, L.a);
      }
    }

    const f = this.mFinal.uniforms;
    f.tScene.value = this.rtScene.texture;
    f.tBlur.value = this.rtBlur.texture;
    f.tB0.value = this.levels[0].a.texture;
    f.tB1.value = this.levels[1].a.texture;
    f.tB2.value = this.levels[2].a.texture;
    f.tB3.value = this.levels[3].a.texture;
    f.halfTexel.value.set(1 / this.rtHalf.width, 1 / this.rtHalf.height);
    f.bloomWeights.value.set(...p.bloomWeights);
    f.bloomStrength.value = p.bloomStrength;
    f.vignette.value = p.vignette;
    f.grain.value = p.grain;
    f.useDof.value = useDof ? 1 : 0;
    const fl = p.flare;
    f.flare.value.set(fl?.x ?? 0, fl?.y ?? 0, fl?.radius ?? 1, fl?.strength ?? 0);
    f.flareColor.value.setRGB(...(fl?.color ?? [0, 0, 0]));
    f.veil.value.set(...(p.veil?.color ?? [0, 0, 0]), p.veil?.amount ?? 0);
    f.aspect.value = w / h;
    f.frameIndex.value = frameIndex >>> 0;
    this.pass(this.mFinal, null);
  }
}
