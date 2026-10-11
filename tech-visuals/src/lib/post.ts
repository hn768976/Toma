import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Shared single-frame post pipeline (no temporal state, no TAA):
 *   scene (MSAA, half-float, depth) → [gather DoF] → [mip bloom] → final
 *   final = bloom add + flare + vignette → sRGB → grain (pixel+frame hash) → ±1/255 dither.
 * Everything is a pure function of the inputs passed to render().
 */

export type DofOptions = {
  focus: number; // view-space distance in focus
  range: number; // half-width of the fully sharp zone (world units)
  aperture: number; // CoC growth with |z - focus| / z
  maxRadius: number; // max blur radius as a fraction of frame height
};

export type BloomOptions = {
  strength: number;
  threshold: number;
  knee: number;
  levels?: number; // mip levels (spread); default 7
  falloff?: number; // weight of each coarser level relative to the finer one; default 0.7
};

export type FlareOptions = {
  pos: [number, number]; // uv
  color: THREE.Color; // linear
  radius: number; // fraction of height
  intensity: number;
};

export type FinalOptions = {
  frame: number;
  period: number; // grain is driven by frame % period
  grain: number; // amplitude in display space (0.02 = 2%)
  grainLumaCut?: number; // fade grain out below this display luminance
  vignette: number; // 0..1 darkening at corners
  vignetteColor?: THREE.Color; // linear; default black
  flare?: FlareOptions;
  exposure?: number;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */ `
float linZ(float d, float n, float f) {
  float ndc = d * 2.0 - 1.0;
  return 2.0 * n * f / (f + n - ndc * (f - n));
}
`;

const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 srcTexel; uniform float cNear; uniform float cFar;
uniform float focus; uniform float range; uniform float aperture;
varying vec2 vUv;
${COMMON}
float coc(vec2 uv) {
  float z = linZ(texture2D(tDepth, uv).x, cNear, cFar);
  float d = z - focus;
  float a = max(abs(d) - range, 0.0) / max(z, 1e-3) * aperture;
  return clamp(a, 0.0, 1.0) * sign(d);
}
void main() {
  vec2 o = srcTexel * 0.5;
  vec3 c = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, o.y)).rgb;
  float k = coc(vUv + vec2(-o.x, -o.y)) + coc(vUv + vec2(o.x, -o.y)) + coc(vUv + vec2(-o.x, o.y)) + coc(vUv + vec2(o.x, o.y));
  gl_FragColor = vec4(c * 0.25, k * 0.25);
}
`;

const GATHER_FRAG = /* glsl */ `
uniform sampler2D tPre; uniform vec2 texel; uniform float maxR;
varying vec2 vUv;
#define N 56
void main() {
  vec4 c = texture2D(tPre, vUv);
  float cc = abs(c.a);
  vec3 acc = c.rgb; float wsum = 1.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N));
    float th = fi * 2.39996323;
    vec2 o = vec2(cos(th), sin(th)) * r * maxR;
    vec4 s = texture2D(tPre, vUv + o * texel);
    float sc = abs(s.a);
    float eff = (s.a > c.a) ? min(sc, cc) : sc;
    float w = clamp(eff * maxR - r * maxR + 1.0, 0.0, 1.0);
    acc += s.rgb * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, c.a);
}
`;

const FILL_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 texel; uniform float maxR;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv);
  float s = clamp(abs(c.a) * maxR * 0.18, 0.0, 2.5);
  vec3 acc = c.rgb * 4.0;
  acc += texture2D(tSrc, vUv + vec2( s, 0) * texel).rgb * 2.0;
  acc += texture2D(tSrc, vUv + vec2(-s, 0) * texel).rgb * 2.0;
  acc += texture2D(tSrc, vUv + vec2(0,  s) * texel).rgb * 2.0;
  acc += texture2D(tSrc, vUv + vec2(0, -s) * texel).rgb * 2.0;
  acc += texture2D(tSrc, vUv + vec2( s,  s) * texel).rgb;
  acc += texture2D(tSrc, vUv + vec2(-s,  s) * texel).rgb;
  acc += texture2D(tSrc, vUv + vec2( s, -s) * texel).rgb;
  acc += texture2D(tSrc, vUv + vec2(-s, -s) * texel).rgb;
  gl_FragColor = vec4(acc / 16.0, c.a);
}
`;

const DOF_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBlur;
uniform float cNear; uniform float cFar; uniform float focus; uniform float range; uniform float aperture;
uniform float maxRpx;
varying vec2 vUv;
${COMMON}
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 b = texture2D(tBlur, vUv);
  float z = linZ(texture2D(tDepth, vUv).x, cNear, cFar);
  float a = clamp(max(abs(z - focus) - range, 0.0) / max(z, 1e-3) * aperture, 0.0, 1.0);
  float r = max(a, abs(b.a)) * maxRpx;
  float m = smoothstep(0.6, 2.2, r);
  gl_FragColor = vec4(mix(sharp, b.rgb, m), 1.0);
}
`;

const BLOOM_PRE_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 srcTexel; uniform float threshold; uniform float knee;
varying vec2 vUv;
vec3 pre(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-4);
  float w = max(rq, br - threshold) / max(br, 1e-4);
  return c * w;
}
void main() {
  vec2 o = srcTexel * 0.5;
  vec3 c = pre(texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb) + pre(texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb)
         + pre(texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb) + pre(texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb);
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 srcTexel;
varying vec2 vUv;
void main() {
  vec2 o = srcTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 lowTexel; uniform float lowWeight;
varying vec2 vUv;
void main() {
  vec2 o = lowTexel;
  vec3 c = texture2D(tLow, vUv).rgb * 4.0;
  c += (texture2D(tLow, vUv + vec2(o.x, 0)).rgb + texture2D(tLow, vUv - vec2(o.x, 0)).rgb
      + texture2D(tLow, vUv + vec2(0, o.y)).rgb + texture2D(tLow, vUv - vec2(0, o.y)).rgb) * 2.0;
  c += texture2D(tLow, vUv + o).rgb + texture2D(tLow, vUv - o).rgb
     + texture2D(tLow, vUv + vec2(o.x, -o.y)).rgb + texture2D(tLow, vUv + vec2(-o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 16.0 * lowWeight + texture2D(tHigh, vUv).rgb, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tBloom;
uniform float bloomStrength; uniform float useBloom;
uniform vec2 res; uniform float frameIdx;
uniform float grain; uniform float grainLumaCut;
uniform float vignette; uniform vec3 vignetteColor;
uniform vec2 flarePos; uniform vec3 flareColor; uniform float flareRadius; uniform float flareIntensity;
uniform float exposure;
varying vec2 vUv;

uint hashU(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x;
}
float h01(uvec3 p) {
  return float(hashU(p.x + hashU(p.y + hashU(p.z)))) / 4294967295.0;
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 col = texture2D(tColor, vUv).rgb * exposure;
  if (useBloom > 0.5) col += texture2D(tBloom, vUv).rgb * bloomStrength;
  float aspect = res.x / res.y;
  if (flareIntensity > 0.0) {
    vec2 d = (vUv - flarePos) * vec2(aspect, 1.0);
    float r = length(d) / flareRadius;
    col += flareColor * flareIntensity * (exp(-r * r * 2.0) * 0.8 + 0.25 / (1.0 + r * r * 6.0));
  }
  vec2 v = (vUv - 0.5) * vec2(aspect, 1.0) / (0.5 * length(vec2(aspect, 1.0)));
  float vig = smoothstep(0.35, 1.05, length(v));
  col = mix(col, vignetteColor, vig * vignette);
  vec3 s = toSRGB(col);
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(frameIdx);
  float g = (h01(uvec3(px, f * 3u + 1u)) + h01(uvec3(px, f * 3u + 2u)) - 1.0);
  float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float gm = grainLumaCut > 0.0 ? smoothstep(grainLumaCut * 0.5, grainLumaCut * 1.5, luma) : 1.0;
  s += g * grain * gm;
  float d = (h01(uvec3(px, f * 3u + 7919u)) - h01(uvec3(px.yx, f * 3u + 104729u))) / 255.0;
  s += d;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });

export class Pipeline {
  w = 0;
  h = 0;
  scene!: THREE.WebGLRenderTarget;
  color!: THREE.WebGLRenderTarget;
  pre!: THREE.WebGLRenderTarget;
  gather!: THREE.WebGLRenderTarget;
  fill!: THREE.WebGLRenderTarget;
  down: THREE.WebGLRenderTarget[] = [];
  up: THREE.WebGLRenderTarget[] = [];
  quad = new FullScreenQuad();
  mPre = mat(PREFILTER_FRAG, {
    tColor: { value: null }, tDepth: { value: null }, srcTexel: { value: new THREE.Vector2() },
    cNear: { value: 0.1 }, cFar: { value: 100 }, focus: { value: 10 }, range: { value: 0 }, aperture: { value: 1 },
  });
  mGather = mat(GATHER_FRAG, { tPre: { value: null }, texel: { value: new THREE.Vector2() }, maxR: { value: 8 } });
  mFill = mat(FILL_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, maxR: { value: 8 } });
  mDof = mat(DOF_COMPOSITE_FRAG, {
    tColor: { value: null }, tDepth: { value: null }, tBlur: { value: null },
    cNear: { value: 0.1 }, cFar: { value: 100 }, focus: { value: 10 }, range: { value: 0 }, aperture: { value: 1 },
    maxRpx: { value: 8 },
  });
  mBloomPre = mat(BLOOM_PRE_FRAG, {
    tSrc: { value: null }, srcTexel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 },
  });
  mDown = mat(DOWN_FRAG, { tSrc: { value: null }, srcTexel: { value: new THREE.Vector2() } });
  mUp = mat(UP_FRAG, {
    tLow: { value: null }, tHigh: { value: null }, lowTexel: { value: new THREE.Vector2() }, lowWeight: { value: 0.7 },
  });
  mFinal = mat(FINAL_FRAG, {
    tColor: { value: null }, tBloom: { value: null }, bloomStrength: { value: 0 }, useBloom: { value: 0 },
    res: { value: new THREE.Vector2() }, frameIdx: { value: 0 }, grain: { value: 0.015 }, grainLumaCut: { value: 0 },
    vignette: { value: 0.2 }, vignetteColor: { value: new THREE.Color(0, 0, 0) },
    flarePos: { value: new THREE.Vector2() }, flareColor: { value: new THREE.Color() }, flareRadius: { value: 0.3 },
    flareIntensity: { value: 0 }, exposure: { value: 1 },
  });

  constructor(private samples = 4) {}

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    this.scene = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: this.samples,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
    });
    this.color = rt(w, h);
    const hw = Math.max(1, Math.round(w / 2));
    const hh = Math.max(1, Math.round(h / 2));
    this.pre = rt(hw, hh);
    this.gather = rt(hw, hh);
    this.fill = rt(hw, hh);
    this.down = [];
    this.up = [];
    let lw = hw;
    let lh = hh;
    for (let i = 0; i < 7; i++) {
      this.down.push(rt(lw, lh));
      this.up.push(rt(lw, lh));
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
    }
  }

  private pass(gl: THREE.WebGLRenderer, m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    gl.setRenderTarget(target);
    this.quad.render(gl);
  }

  /** Begin a frame: binds the MSAA scene target. Callers draw their scene(s) into it. */
  begin(gl: THREE.WebGLRenderer, clear: THREE.Color) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.resize(size.x, size.y);
    gl.setRenderTarget(this.scene);
    gl.setClearColor(clear, 1);
    gl.clear(true, true, true);
  }

  finish(
    gl: THREE.WebGLRenderer,
    opts: { camera?: THREE.PerspectiveCamera; dof?: DofOptions; bloom?: BloomOptions; final: FinalOptions },
  ) {
    const { w, h } = this;
    let src: THREE.Texture = this.scene.texture;
    if (opts.dof && opts.camera) {
      const d = opts.dof;
      const cam = opts.camera;
      const hw = this.pre.width;
      const hh = this.pre.height;
      const maxRHalf = d.maxRadius * hh;
      const u = this.mPre.uniforms;
      u.tColor.value = this.scene.texture;
      u.tDepth.value = this.scene.depthTexture;
      u.srcTexel.value.set(1 / w, 1 / h);
      u.cNear.value = cam.near;
      u.cFar.value = cam.far;
      u.focus.value = d.focus;
      u.range.value = d.range;
      u.aperture.value = d.aperture;
      this.pass(gl, this.mPre, this.pre);
      this.mGather.uniforms.tPre.value = this.pre.texture;
      this.mGather.uniforms.texel.value.set(1 / hw, 1 / hh);
      this.mGather.uniforms.maxR.value = maxRHalf;
      this.pass(gl, this.mGather, this.gather);
      this.mFill.uniforms.tSrc.value = this.gather.texture;
      this.mFill.uniforms.texel.value.set(1 / hw, 1 / hh);
      this.mFill.uniforms.maxR.value = maxRHalf;
      this.pass(gl, this.mFill, this.fill);
      const c = this.mDof.uniforms;
      c.tColor.value = this.scene.texture;
      c.tDepth.value = this.scene.depthTexture;
      c.tBlur.value = this.fill.texture;
      c.cNear.value = cam.near;
      c.cFar.value = cam.far;
      c.focus.value = d.focus;
      c.range.value = d.range;
      c.aperture.value = d.aperture;
      c.maxRpx.value = d.maxRadius * h;
      this.pass(gl, this.mDof, this.color);
      src = this.color.texture;
    }
    const f = this.mFinal.uniforms;
    if (opts.bloom) {
      const b = opts.bloom;
      this.mBloomPre.uniforms.tSrc.value = src;
      this.mBloomPre.uniforms.srcTexel.value.set(1 / w, 1 / h);
      this.mBloomPre.uniforms.threshold.value = b.threshold;
      // knee ≤ threshold, otherwise near-black pixels get lifted into the bloom
      this.mBloomPre.uniforms.knee.value = Math.min(b.knee, b.threshold * 0.999);
      this.pass(gl, this.mBloomPre, this.down[0]);
      for (let i = 1; i < Math.min(this.down.length, b.levels ?? 7); i++) {
        this.mDown.uniforms.tSrc.value = this.down[i - 1].texture;
        this.mDown.uniforms.srcTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
        this.pass(gl, this.mDown, this.down[i]);
      }
      const n = Math.min(this.down.length, b.levels ?? 7);
      let low = this.down[n - 1];
      this.mUp.uniforms.lowWeight.value = b.falloff ?? 0.7;
      for (let i = n - 2; i >= 0; i--) {
        this.mUp.uniforms.tLow.value = low.texture;
        this.mUp.uniforms.tHigh.value = this.down[i].texture;
        this.mUp.uniforms.lowTexel.value.set(1 / low.width, 1 / low.height);
        this.pass(gl, this.mUp, this.up[i]);
        low = this.up[i];
      }
      f.tBloom.value = this.up[0].texture;
      f.useBloom.value = 1;
      f.bloomStrength.value = b.strength;
    } else {
      f.useBloom.value = 0;
    }
    const o = opts.final;
    f.tColor.value = src;
    f.res.value.set(w, h);
    f.frameIdx.value = ((o.frame % o.period) + o.period) % o.period;
    f.grain.value = o.grain;
    f.grainLumaCut.value = o.grainLumaCut ?? 0;
    f.vignette.value = o.vignette;
    f.vignetteColor.value.copy(o.vignetteColor ?? new THREE.Color(0, 0, 0));
    f.exposure.value = o.exposure ?? 1;
    if (o.flare) {
      f.flarePos.value.set(o.flare.pos[0], o.flare.pos[1]);
      f.flareColor.value.copy(o.flare.color);
      f.flareRadius.value = o.flare.radius;
      f.flareIntensity.value = o.flare.intensity;
    } else {
      f.flareIntensity.value = 0;
    }
    this.pass(gl, this.mFinal, null);
  }

  dispose() {
    this.scene?.dispose();
    this.color?.dispose();
    this.pre?.dispose();
    this.gather?.dispose();
    this.fill?.dispose();
    this.down.forEach((r) => r.dispose());
    this.up.forEach((r) => r.dispose());
  }
}
