import * as THREE from "three";

// Shared post chain for every look, all on the GPU:
//   scene (HDR half-float, 4x MSAA, depth texture)
//   -> optional depth-of-field (single-pass gather, Vogel disc)
//   -> bloom (6-level downsample / tent upsample mip chain)
//   -> composite: exposure, soft highlight shoulder, vignette,
//      then grain (~1.5%) + ±1/255 dither from an integer hash of
//      (pixel, frame). No temporal accumulation of any kind.

THREE.ColorManagement.enabled = false;

export type PostOptions = {
  exposure?: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  bloomKnee?: number;
  /** Blend between tight (0) and wide (1) bloom. */
  bloomRadius?: number;
  vignette?: number;
  grain?: number;
  /** Loop length in frames; grain repeats on it so loops are seamless. */
  loop?: number;
  dof?: {
    /** View-space distance in focus. */
    focus: number;
    /** Distance range around focus that stays sharp. */
    range: number;
    /** Distance over which blur ramps to max (beyond range). */
    ramp: number;
    /** Max blur radius as a fraction of output height. */
    maxNear: number;
    maxFar: number;
  };
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

// DoF in three cheap passes:
//  A (full res): colour + signed circle of confusion (px) from the depth texture
//  B (half res): Vogel-disc gather; samples behind a sharper centre are clamped
//                so sharp foreground never smears onto blurred background
//  C (full res): mix sharp / blurred by CoC.
const COC_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float near, far, focus, range, ramp, maxNear, maxFar, pxH;
void main() {
  float d = texture(tDepth, vUv).x;
  float z = (near * far) / ((far - near) * d - far) * -1.0;
  float dz = z - focus;
  float a = clamp(max(abs(dz) - range, 0.0) / ramp, 0.0, 1.0);
  float coc = a * (dz < 0.0 ? maxNear : maxFar) * pxH;
  outColor = vec4(texture(tColor, vUv).rgb, dz < 0.0 ? -coc : coc);
}
`;

const GATHER_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tCoc;
uniform vec2 texel;     // full-res texel
uniform float maxR;     // px (full res)
void main() {
  vec4 c0 = texture(tCoc, vUv);
  float cs = abs(c0.a);
  vec3 col = c0.rgb;
  float tot = 1.0;
  float cocSum = cs;
  const int N = 40;
  for (int i = 0; i < N; i++) {
    float r = sqrt((float(i) + 0.5) / float(N)) * maxR;
    float ang = float(i) * 2.39996323;
    vec4 s = texture(tCoc, vUv + vec2(cos(ang), sin(ang)) * texel * r);
    float ss = abs(s.a);
    // a sample behind the centre may not blur over a sharper centre
    if (s.a > c0.a) ss = min(ss, cs * 2.0);
    float m = smoothstep(r - 1.5, r + 1.5, ss);
    col += mix(col / tot, s.rgb, m);
    cocSum += mix(cocSum / tot, ss, m);
    tot += 1.0;
  }
  outColor = vec4(col / tot, cocSum / tot);
}
`;

const DOFMIX_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tCoc;
uniform sampler2D tBlur;
void main() {
  vec4 sharp = texture(tCoc, vUv);
  vec4 blur = texture(tBlur, vUv);
  float f = smoothstep(0.6, 2.5, max(abs(sharp.a), blur.a));
  outColor = vec4(mix(sharp.rgb, blur.rgb, f), 1.0);
}
`;

// 13-tap downsample (Jimenez 2014) with optional soft-threshold prefilter.
const DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float prefilter, threshold, knee;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * texel).rgb; }
void main() {
  vec3 a = s(vec2(-2,-2)), b = s(vec2(0,-2)), c = s(vec2(2,-2));
  vec3 d = s(vec2(-1,-1)), e = s(vec2(1,-1));
  vec3 f = s(vec2(-2,0)), g = s(vec2(0,0)), h = s(vec2(2,0));
  vec3 i = s(vec2(-1,1)), j = s(vec2(1,1));
  vec3 k = s(vec2(-2,2)), l = s(vec2(0,2)), m = s(vec2(2,2));
  vec3 col = (d+e+i+j)*0.125 + (a+c+k+m)*0.03125 + (b+f+h+l)*0.0625 + g*0.125;
  if (prefilter > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    rq = (rq * rq) / (4.0 * knee + 1e-5);
    float w = max(rq, br - threshold) / max(br, 1e-5);
    col *= w;
  }
  outColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 texel;
uniform float radius;
vec3 s(vec2 o) { return texture(tLow, vUv + o * texel).rgb; }
void main() {
  vec3 up = (s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1))) * 0.0625
          + (s(vec2(0,-1)) + s(vec2(-1,0)) + s(vec2(1,0)) + s(vec2(0,1))) * 0.125
          + s(vec2(0,0)) * 0.25;
  outColor = vec4(texture(tHigh, vUv).rgb + up * radius, 1.0);
}
`;

const COMP_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float exposure, bloomStrength, vignette, grain;
uniform int frame;
uniform vec2 res;

uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x;
}
float h01(uvec3 v) {
  return float(hashu(v.x ^ hashu(v.y ^ hashu(v.z)))) / 4294967295.0;
}
vec3 shoulder(vec3 x) {
  const float a = 0.72;
  vec3 over = max(x - a, 0.0);
  return min(x, vec3(a)) + (1.0 - a) * (1.0 - exp(-over / (1.0 - a)));
}
void main() {
  vec3 col = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * bloomStrength;
  col *= exposure;
  vec2 q = vUv - 0.5;
  q.x *= res.x / res.y;
  col *= 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
  col = shoulder(max(col, 0.0));
  uvec2 p = uvec2(gl_FragCoord.xy);
  uint f = uint(frame);
  float g1 = h01(uvec3(p, f * 3u + 1u));
  float g2 = h01(uvec3(p, f * 3u + 2u));
  float d1 = h01(uvec3(p.yx, f * 3u + 7u));
  // grain, triangular, near-uniform across tones: it must stay strong enough in
  // the darkest gradients to survive H.264 (weaker dark grain got flattened into blocks)
  float n = (g1 + g2 - 1.0) * grain;
  col += n * (0.8 + 0.2 * sqrt(clamp(dot(col, vec3(0.3, 0.55, 0.15)), 0.0, 1.0)));
  col += (d1 - 0.5) * (2.0 / 255.0);                // ±1/255 dither, last
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class Post {
  private gl: THREE.WebGLRenderer;
  private w: number;
  private h: number;
  readonly sceneRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private cocRT: THREE.WebGLRenderTarget | null = null;
  private blurRT: THREE.WebGLRenderTarget | null = null;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private dofMat: THREE.ShaderMaterial;
  private gatherMat: THREE.ShaderMaterial;
  private mixMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  opts: Required<Omit<PostOptions, "dof">> & { dof?: PostOptions["dof"] };

  constructor(gl: THREE.WebGLRenderer, opts: PostOptions, w: number, h: number) {
    this.gl = gl;
    this.w = w;
    this.h = h;
    this.opts = {
      exposure: 1,
      bloomStrength: 0.8,
      bloomThreshold: 0.55,
      bloomKnee: 0.35,
      bloomRadius: 0.85,
      vignette: 0.35,
      grain: 0.015,
      loop: 1 << 30,
      ...opts,
    };
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(this.w, this.h, THREE.UnsignedIntType),
    });
    if (opts.dof) {
      this.dofRT = new THREE.WebGLRenderTarget(this.w, this.h, hf);
      this.cocRT = new THREE.WebGLRenderTarget(this.w, this.h, hf);
      this.blurRT = new THREE.WebGLRenderTarget(Math.ceil(this.w / 2), Math.ceil(this.h / 2), hf);
    }
    let bw = this.w;
    let bh = this.h;
    for (let i = 0; i < 7; i++) {
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
      this.down.push(new THREE.WebGLRenderTarget(bw, bh, hf));
      this.up.push(new THREE.WebGLRenderTarget(bw, bh, hf));
    }
    this.gatherMat = mat(GATHER_FRAG, {
      tCoc: { value: null },
      texel: { value: new THREE.Vector2(1 / this.w, 1 / this.h) },
      maxR: { value: 1 },
    });
    this.mixMat = mat(DOFMIX_FRAG, { tCoc: { value: null }, tBlur: { value: null } });
    this.dofMat = mat(COC_FRAG, {
      tColor: { value: null },
      tDepth: { value: null },
      near: { value: 0.1 },
      far: { value: 100 },
      focus: { value: 10 },
      range: { value: 1 },
      ramp: { value: 1 },
      maxNear: { value: 0 },
      maxFar: { value: 0 },
      pxH: { value: this.h },
    });
    this.downMat = mat(DOWN_FRAG, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2() },
      prefilter: { value: 0 },
      threshold: { value: 0.5 },
      knee: { value: 0.3 },
    });
    this.upMat = mat(UP_FRAG, {
      tLow: { value: null },
      tHigh: { value: null },
      texel: { value: new THREE.Vector2() },
      radius: { value: 1 },
    });
    this.compMat = mat(COMP_FRAG, {
      tColor: { value: null },
      tBloom: { value: null },
      exposure: { value: 1 },
      bloomStrength: { value: 1 },
      vignette: { value: 0 },
      grain: { value: 0.015 },
      frame: { value: 0 },
      res: { value: new THREE.Vector2(this.w, this.h) },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compMat);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  get width() {
    return this.w;
  }
  get height() {
    return this.h;
  }

  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.gl.setRenderTarget(target);
    this.gl.render(this.qScene, this.qCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, frame: number, bloomScale = 1) {
    const gl = this.gl;
    const o = this.opts;
    gl.autoClear = true;
    gl.setRenderTarget(this.sceneRT);
    gl.render(scene, camera);

    let color: THREE.Texture = this.sceneRT.texture;
    if (o.dof && this.dofRT && camera instanceof THREE.PerspectiveCamera) {
      const u = this.dofMat.uniforms;
      u.tColor.value = this.sceneRT.texture;
      u.tDepth.value = this.sceneRT.depthTexture;
      u.near.value = camera.near;
      u.far.value = camera.far;
      u.focus.value = o.dof.focus;
      u.range.value = o.dof.range;
      u.ramp.value = o.dof.ramp;
      u.maxNear.value = o.dof.maxNear;
      u.maxFar.value = o.dof.maxFar;
      this.pass(this.dofMat, this.cocRT!);
      this.gatherMat.uniforms.tCoc.value = this.cocRT!.texture;
      this.gatherMat.uniforms.maxR.value = Math.max(o.dof.maxNear, o.dof.maxFar) * this.h;
      this.pass(this.gatherMat, this.blurRT!);
      this.mixMat.uniforms.tCoc.value = this.cocRT!.texture;
      this.mixMat.uniforms.tBlur.value = this.blurRT!.texture;
      this.pass(this.mixMat, this.dofRT);
      color = this.dofRT.texture;
    }

    // Bloom
    let src: THREE.Texture = color;
    let sw = this.w;
    let sh = this.h;
    this.down.forEach((rt, i) => {
      const u = this.downMat.uniforms;
      u.tSrc.value = src;
      u.texel.value.set(1 / sw, 1 / sh);
      u.prefilter.value = i === 0 ? 1 : 0;
      u.threshold.value = o.bloomThreshold;
      u.knee.value = o.bloomKnee;
      this.pass(this.downMat, rt);
      src = rt.texture;
      sw = rt.width;
      sh = rt.height;
    });
    let low: THREE.Texture = this.down[this.down.length - 1].texture;
    let lw = this.down[this.down.length - 1].width;
    let lh = this.down[this.down.length - 1].height;
    for (let i = this.down.length - 2; i >= 0; i--) {
      const u = this.upMat.uniforms;
      u.tLow.value = low;
      u.tHigh.value = this.down[i].texture;
      u.texel.value.set(1 / lw, 1 / lh);
      u.radius.value = o.bloomRadius;
      this.pass(this.upMat, this.up[i]);
      low = this.up[i].texture;
      lw = this.up[i].width;
      lh = this.up[i].height;
    }

    const c = this.compMat.uniforms;
    c.tColor.value = color;
    c.tBloom.value = low;
    c.exposure.value = o.exposure;
    c.bloomStrength.value = o.bloomStrength * bloomScale;
    c.vignette.value = o.vignette;
    c.grain.value = o.grain;
    c.frame.value = ((frame % o.loop) + o.loop) % o.loop;
    this.pass(this.compMat, null);
  }
}
