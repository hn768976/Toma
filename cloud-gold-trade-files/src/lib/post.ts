import * as THREE from "three";

// Hand-rolled post chain, so every step is deterministic and resolution
// independent (all radii are fractions of the frame height):
//   scene (HDR, MSAA) -> depth of field -> bloom mip chain -> composite
//   composite = exposure -> ACES filmic -> sRGB -> dither + grain
// No temporal effects: each frame depends only on that frame's scene.

export type DofOptions = {
  /** focus distance in world units (camera space depth) */
  focus: number;
  /** blur growth in front of / behind the focus plane */
  nearK: number;
  farK: number;
  /** maximum blur radius as a fraction of frame height */
  maxBlur: number;
};

export type PostOptions = {
  exposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee: number;
  /** weight of each bloom mip (1/2 .. 1/64 res); larger tail = wider glow */
  bloomWeights: number[];
  dof: DofOptions | null;
  /** grain amplitude (0.02 = 2%); 0 disables */
  grain: number;
  /** keep pixels that are exactly black free of dither/grain */
  protectBlack: boolean;
  /** grain repeats with this period (loop length in frames) */
  grainPeriod: number;
  vignette: number;
  clearColor: THREE.ColorRepresentation;
  samples: number;
  dofSamples: number;
};

export const defaultPost = (): PostOptions => ({
  exposure: 1,
  bloomStrength: 0.08,
  bloomThreshold: 0,
  bloomKnee: 0.5,
  bloomWeights: [1, 1, 1, 1, 1, 1],
  dof: null,
  grain: 0.02,
  protectBlack: false,
  grainPeriod: 600,
  vignette: 0.2,
  clearColor: 0x000000,
  samples: 4,
  dofSamples: 128,
});

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const dofPrepFrag = /* glsl */ `
// downsample to the DOF working resolution (4 bilinear taps) + linear depth
uniform sampler2D tColor; uniform sampler2D tDepth; uniform float near; uniform float far; uniform vec2 texelW;
varying vec2 vUv;
void main() {
  vec2 o = texelW * 0.25;
  vec3 c = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, o.y)).rgb;
  float d = texture2D(tDepth, vUv).x;
  float z = near * far / (far - d * (far - near));
  gl_FragColor = vec4(c * 0.25, z);
}
`;

// Single-pass gather DOF (after Dennis Gustafsson), in working-res pixels.
// Output alpha = how blurred this pixel ended up (own CoC or foreground spill).
const dofFrag = /* glsl */ `
#define NS DOF_SAMPLES
uniform sampler2D tSrc; uniform vec2 texel; uniform float focus; uniform float nearK; uniform float farK;
uniform float maxBlur; uniform float stepS;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
float coc(float z) {
  float c = z < focus ? (focus - z) / z * nearK : (z - focus) / z * farK;
  return clamp(c, 0.0, 1.0) * maxBlur;
}
void main() {
  vec4 c0 = texture2D(tSrc, vUv);
  float cz = c0.a; float cs = coc(cz);
  vec3 col = c0.rgb; float tot = 1.0;
  float fg = 0.0;
  float radius = max(0.5, sqrt(stepS));
  float ang = 0.0;
  for (int i = 0; i < NS; i++) {
    if (radius > maxBlur) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
    vec4 s = texture2D(tSrc, tc);
    float ss = coc(s.a);
    if (s.a > cz) ss = clamp(ss, 0.0, cs * 2.0);
    float w = max(0.5, stepS / radius);
    float m = smoothstep(radius - w, radius + w, ss);
    if (s.a < cz) fg = max(fg, m * ss);
    col += mix(col / tot, s.rgb, m);
    tot += 1.0;
    radius += stepS / radius;
    ang += GOLDEN;
  }
  gl_FragColor = vec4(col / tot, max(cs, fg));
}
`;

// full-res: blend the sharp frame with the blurred working-res result
const dofMixFrag = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBlur;
uniform float near; uniform float far; uniform float focus; uniform float nearK; uniform float farK; uniform float maxBlur;
varying vec2 vUv;
void main() {
  float d = texture2D(tDepth, vUv).x;
  float z = near * far / (far - d * (far - near));
  float c = z < focus ? (focus - z) / z * nearK : (z - focus) / z * farK;
  c = clamp(c, 0.0, 1.0) * maxBlur;
  vec4 b = texture2D(tBlur, vUv);
  float f = smoothstep(0.4, 1.5, max(c, b.a));
  gl_FragColor = vec4(mix(texture2D(tColor, vUv).rgb, b.rgb, f), 1.0);
}
`;

const downFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold; uniform float knee; uniform float prefilter;
varying vec2 vUv;
vec3 s(float x, float y) { return texture2D(tSrc, vUv + vec2(x, y) * texel).rgb; }
void main() {
  vec3 a = s(-2.,-2.), b = s(0.,-2.), c = s(2.,-2.), d = s(-2.,0.), e = s(0.,0.), f = s(2.,0.);
  vec3 g = s(-2.,2.), h = s(0.,2.), i = s(2.,2.), j = s(-1.,-1.), k = s(1.,-1.), l = s(-1.,1.), m = s(1.,1.);
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (prefilter > 0.5) {
    col = min(col, vec3(64.0));
    float br = max(col.r, max(col.g, col.b));
    float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    rq = rq * rq / (4.0 * knee + 1e-5);
    col *= max(rq, br - threshold) / max(br, 1e-5);
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const upFrag = /* glsl */ `
uniform sampler2D tLow; uniform sampler2D tCur; uniform vec2 texelLow; uniform float wLow; uniform float wCur;
varying vec2 vUv;
vec3 s(float x, float y) { return texture2D(tLow, vUv + vec2(x, y) * texelLow).rgb; }
void main() {
  vec3 t = s(0.,0.) * 4.0 + (s(-1.,0.) + s(1.,0.) + s(0.,-1.) + s(0.,1.)) * 2.0
         + s(-1.,-1.) + s(1.,-1.) + s(-1.,1.) + s(1.,1.);
  gl_FragColor = vec4(t / 16.0 * wLow + texture2D(tCur, vUv).rgb * wCur, 1.0);
}
`;

const compFrag = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tBloom; uniform float bloomStrength; uniform float exposure;
uniform float grain; uniform float vignette; uniform float protectBlack; uniform float frameMod; uniform vec2 res;
varying vec2 vUv;

// ACES filmic fit (Stephen Hill), same as three.js ACESFilmicToneMapping.
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Integer hash (PCG3D): a fixed formula of pixel position and frame.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
void main() {
  vec3 hdr = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
  vec2 q = vUv - 0.5; q.x *= res.x / res.y;
  hdr *= exposure * mix(1.0, 1.0 - smoothstep(0.35, 1.25, length(q)), vignette);
  vec3 c = toSRGB(aces(hdr));
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(frameMod)));
  vec3 r = vec3(h) * (1.0 / 4294967295.0);
  float tri = (r.x + r.y - 1.0) / 255.0;          // +-1/255 triangular dither
  float g = (r.z - 0.5) * 2.0 * grain;             // grain, +-grain
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  g *= 0.35 + 0.65 * sqrt(clamp(lum, 0.0, 1.0));
  float keep = protectBlack > 0.5 ? step(0.5 / 255.0, max(c.r, max(c.g, c.b))) : 1.0;
  c += (tri + g) * keep;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const makeMat = (frag: string, uniforms: Record<string, THREE.IUniform>, defines?: Record<string, string | number>) =>
  new THREE.ShaderMaterial({
    vertexShader: quadVert,
    fragmentShader: frag,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
  });

export class PostFX {
  opts: PostOptions;
  readonly width: number;
  readonly height: number;
  private gl: THREE.WebGLRenderer;
  private sceneRT: THREE.WebGLRenderTarget;
  private prepRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mPrep: THREE.ShaderMaterial;
  private mDofMix: THREE.ShaderMaterial;
  private blurRT: THREE.WebGLRenderTarget;
  private workH: number;
  private mDof: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mUp: THREE.ShaderMaterial;
  private mComp: THREE.ShaderMaterial;

  constructor(gl: THREE.WebGLRenderer, width: number, height: number, opts: Partial<PostOptions> = {}) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.opts = { ...defaultPost(), ...opts };
    const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false } as const;
    const depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: this.opts.samples,
      depthBuffer: true,
      depthTexture,
    });
    // DOF works at <=540 lines with a fixed tap budget, so quality is the same at 720p and 4K
    this.workH = Math.min(height, 540);
    const workW = Math.round((width * this.workH) / height);
    this.prepRT = new THREE.WebGLRenderTarget(workW, this.workH, { ...hf, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.blurRT = new THREE.WebGLRenderTarget(workW, this.workH, { ...hf, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.dofRT = new THREE.WebGLRenderTarget(width, height, { ...hf, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    let w = width, h = height;
    for (let i = 0; i < 6; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      const o = { ...hf, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.mips.push(new THREE.WebGLRenderTarget(w, h, o));
      this.ups.push(new THREE.WebGLRenderTarget(w, h, o));
    }
    this.mPrep = makeMat(dofPrepFrag, {
      tColor: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 100 }, texelW: { value: new THREE.Vector2() },
    });
    this.mDofMix = makeMat(dofMixFrag, {
      tColor: { value: null }, tDepth: { value: null }, tBlur: { value: null }, near: { value: 0.1 }, far: { value: 100 },
      focus: { value: 10 }, nearK: { value: 1 }, farK: { value: 1 }, maxBlur: { value: 1 },
    });
    this.mDof = makeMat(
      dofFrag,
      {
        tSrc: { value: null }, texel: { value: new THREE.Vector2() }, focus: { value: 10 }, nearK: { value: 1 },
        farK: { value: 1 }, maxBlur: { value: 10 }, stepS: { value: 1 },
      },
      { DOF_SAMPLES: this.opts.dofSamples },
    );
    this.mDown = makeMat(downFrag, {
      tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0 }, knee: { value: 0.5 }, prefilter: { value: 0 },
    });
    this.mUp = makeMat(upFrag, {
      tLow: { value: null }, tCur: { value: null }, texelLow: { value: new THREE.Vector2() }, wLow: { value: 1 }, wCur: { value: 1 },
    });
    this.mComp = makeMat(compFrag, {
      tColor: { value: null }, tBloom: { value: null }, bloomStrength: { value: 0 }, exposure: { value: 1 }, grain: { value: 0 },
      vignette: { value: 0 }, protectBlack: { value: 0 }, frameMod: { value: 0 }, res: { value: new THREE.Vector2(width, height) },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mComp);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Height-relative pixel unit: 1.0 at 2160p. Use for screen-space sizes. */
  get px(): number {
    return this.height / 2160;
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: number) {
    const { gl, opts } = this;
    gl.autoClear = true;
    gl.setClearColor(opts.clearColor, 1);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    let src: THREE.Texture = this.sceneRT.texture;
    if (opts.dof) {
      const wW = this.prepRT.width, wH = this.prepRT.height;
      const u = this.mPrep.uniforms;
      u.tColor.value = this.sceneRT.texture;
      u.tDepth.value = this.sceneRT.depthTexture;
      u.near.value = camera.near;
      u.far.value = camera.far;
      u.texelW.value.set(1 / wW, 1 / wH);
      this.pass(this.mPrep, this.prepRT);
      const d = this.mDof.uniforms;
      const maxBlur = Math.max(1, opts.dof.maxBlur * wH); // in working-res px
      d.tSrc.value = this.prepRT.texture;
      d.texel.value.set(1 / wW, 1 / wH);
      d.focus.value = opts.dof.focus;
      d.nearK.value = opts.dof.nearK;
      d.farK.value = opts.dof.farK;
      d.maxBlur.value = maxBlur;
      // r^2 grows by 2*stepS per tap, so stepS sets the tap count
      d.stepS.value = Math.max(0.25, (maxBlur * maxBlur) / (2 * opts.dofSamples));
      this.pass(this.mDof, this.blurRT);
      const x = this.mDofMix.uniforms;
      x.tColor.value = this.sceneRT.texture;
      x.tDepth.value = this.sceneRT.depthTexture;
      x.tBlur.value = this.blurRT.texture;
      x.near.value = camera.near;
      x.far.value = camera.far;
      x.focus.value = opts.dof.focus;
      x.nearK.value = opts.dof.nearK;
      x.farK.value = opts.dof.farK;
      x.maxBlur.value = maxBlur;
      this.pass(this.mDofMix, this.dofRT);
      src = this.dofRT.texture;
    }

    // bloom: downsample chain
    const dn = this.mDown.uniforms;
    let srcW = this.width, srcH = this.height;
    for (let i = 0; i < this.mips.length; i++) {
      dn.tSrc.value = i === 0 ? src : this.mips[i - 1].texture;
      dn.texel.value.set(1 / srcW, 1 / srcH);
      dn.prefilter.value = i === 0 ? 1 : 0;
      dn.threshold.value = opts.bloomThreshold;
      dn.knee.value = Math.max(1e-4, opts.bloomKnee);
      this.pass(this.mDown, this.mips[i]);
      srcW = this.mips[i].width;
      srcH = this.mips[i].height;
    }
    // upsample chain: ups[i] = tent(ups[i+1]) + mips[i] * w[i]
    const up = this.mUp.uniforms;
    const W = opts.bloomWeights;
    const n = this.mips.length;
    const wsum = W.reduce((a, b) => a + b, 0) || 1;
    for (let i = n - 2; i >= 0; i--) {
      const low = i === n - 2 ? this.mips[n - 1] : this.ups[i + 1];
      up.tLow.value = low.texture;
      up.texelLow.value.set(1 / low.width, 1 / low.height);
      up.wLow.value = i === n - 2 ? W[n - 1] / wsum : 1;
      up.tCur.value = this.mips[i].texture;
      up.wCur.value = W[i] / wsum;
      this.pass(this.mUp, this.ups[i]);
    }

    const c = this.mComp.uniforms;
    c.tColor.value = src;
    c.tBloom.value = this.ups[0].texture;
    c.bloomStrength.value = opts.bloomStrength;
    c.exposure.value = opts.exposure;
    c.grain.value = opts.grain;
    c.vignette.value = opts.vignette;
    c.protectBlack.value = opts.protectBlack ? 1 : 0;
    c.frameMod.value = ((frame % opts.grainPeriod) + opts.grainPeriod) % opts.grainPeriod;
    this.pass(this.mComp, null);
  }
}
