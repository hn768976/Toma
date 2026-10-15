import type { RenderTexture, WebGLRenderer } from "pixi.js";
import { GLSL_COMMON, Pass, hdrTarget } from "./gl";

// ---------------------------------------------------------------------------
// Shared post chain: HDR scene target (rgba16float) -> dual-filter bloom on
// half-float targets -> final grade (RGB or luminance ramp), vignette, grain
// and +-1/255 dither. Grain and dither fade to zero below ~3% luminance so
// black stays exactly 0.
// ---------------------------------------------------------------------------

const DOWN = /* glsl */ `
in vec2 vUV; out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uHalf; // half texel of the SOURCE
void main() {
  vec4 s = texture(uSrc, vUV) * 4.0;
  s += texture(uSrc, vUV - uHalf);
  s += texture(uSrc, vUV + uHalf);
  s += texture(uSrc, vUV + vec2(uHalf.x, -uHalf.y));
  s += texture(uSrc, vUV - vec2(uHalf.x, -uHalf.y));
  o = s / 8.0;
}`;

const UP = /* glsl */ `
in vec2 vUV; out vec4 o;
uniform sampler2D uSrc;   // smaller level (accumulated)
uniform sampler2D uAdd;   // this level's downsample
uniform vec2 uHalf;       // half texel of uSrc
uniform float uAddW;
void main() {
  vec2 h = uHalf;
  vec4 s = texture(uSrc, vUV + vec2(-h.x * 2.0, 0.0));
  s += texture(uSrc, vUV + vec2(-h.x, h.y)) * 2.0;
  s += texture(uSrc, vUV + vec2(0.0, h.y * 2.0));
  s += texture(uSrc, vUV + vec2(h.x, h.y)) * 2.0;
  s += texture(uSrc, vUV + vec2(h.x * 2.0, 0.0));
  s += texture(uSrc, vUV + vec2(h.x, -h.y)) * 2.0;
  s += texture(uSrc, vUV + vec2(0.0, -h.y * 2.0));
  s += texture(uSrc, vUV + vec2(-h.x, -h.y)) * 2.0;
  o = s / 12.0 + texture(uAdd, vUV) * uAddW;
}`;

const FINAL = /* glsl */ `
${GLSL_COMMON}
in vec2 vUV; out vec4 o;
uniform sampler2D uHdr;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform float uExposure;
uniform float uMode;      // 0 = RGB, 1 = ramp driven by the red channel
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform vec4 uStops;      // ramp positions of C1..C4
uniform float uVig;       // vignette strength
uniform vec2 uVigShape;   // inner / outer radius
uniform float uAspect;
uniform float uGrain;
uniform float uFrame;
uniform float uToneMap;   // 1 = soft shoulder on RGB
uniform float uDither;

vec3 ramp(float v) {
  if (v <= uStops.x) return mix(uC0, uC1, v / uStops.x);
  if (v <= uStops.y) return mix(uC1, uC2, (v - uStops.x) / (uStops.y - uStops.x));
  if (v <= uStops.z) return mix(uC2, uC3, (v - uStops.y) / (uStops.z - uStops.y));
  if (v <= uStops.w) return mix(uC3, uC4, (v - uStops.z) / (uStops.w - uStops.z));
  return uC4;
}

void main() {
  vec3 hdr = texture(uHdr, vUV).rgb + texture(uBloom, vUV).rgb * uBloomAmt;
  hdr = max(hdr * uExposure, 0.0);
  vec3 col;
  if (uMode > 0.5) {
    col = ramp(hdr.r);
  } else {
    col = hdr;
    if (uToneMap > 0.5) {
      // Shoulder only above 0.8, so mid-tones and blacks are untouched.
      vec3 x = max(col - 0.8, 0.0);
      col = min(col, 0.8) + 0.2 * (1.0 - exp(-x / 0.2));
    }
  }
  if (uVig > 0.0) {
    vec2 d = (vUV - 0.5) * vec2(uAspect, 1.0);
    float r = length(d);
    col *= mix(1.0, smoothstep(uVigShape.y, uVigShape.x, r), uVig);
  }
  col = clamp(col, 0.0, 1.0);
  // Grain + dither: a fixed formula of pixel position and (frame % 600).
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(0.03, 0.06, lum);
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame) + 7919u));
  vec3 r = vec3(h) * (1.0 / 4294967295.0);
  float g = (r.x - 0.5) * 2.0;
  float d = (r.y + r.z - 1.0);
  col = col * (1.0 + g * uGrain * w) + vec3(d / 255.0) * w * uDither;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export type Grade = {
  mode: "rgb" | "ramp";
  ramp?: [string, string, string, string, string];
  stops?: [number, number, number, number];
  exposure?: number;
  bloom?: number;
  vignette?: number;
  vignetteShape?: [number, number];
  grain?: number;
  toneMap?: boolean;
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// sRGB-ish hex -> the linear-ish working values we composite in. We keep the
// working space display-referred (no gamma conversion) for predictability.
const vec3 = (hex: string) => new Float32Array(hexToRgb(hex));

export class Post {
  readonly hdr: RenderTexture;
  private downs: RenderTexture[] = [];
  private ups: RenderTexture[] = [];
  private down: Pass;
  private up: Pass;
  private final: Pass;
  private bloomAmt = 0;

  constructor(
    private renderer: WebGLRenderer,
    private W: number,
    private H: number,
    private res: number,
    private levels = 6,
  ) {
    this.hdr = hdrTarget(W, H, res);
    let w = W;
    let h = H;
    for (let i = 0; i < levels; i++) {
      w = Math.max(2, Math.round(w / 2));
      h = Math.max(2, Math.round(h / 2));
      this.downs.push(hdrTarget(w, h, res));
      this.ups.push(hdrTarget(w, h, res));
    }
    this.down = new Pass("bloom-down", DOWN, { uHalf: { value: new Float32Array(2), type: "vec2<f32>" } }, { uSrc: this.hdr });
    this.up = new Pass(
      "bloom-up",
      UP,
      { uHalf: { value: new Float32Array(2), type: "vec2<f32>" }, uAddW: { value: 1, type: "f32" } },
      { uSrc: this.hdr, uAdd: this.hdr },
    );
    this.final = new Pass(
      "final",
      FINAL,
      {
        uBloomAmt: { value: 0, type: "f32" },
        uExposure: { value: 1, type: "f32" },
        uMode: { value: 0, type: "f32" },
        uC0: { value: vec3("#000000"), type: "vec3<f32>" },
        uC1: { value: vec3("#000000"), type: "vec3<f32>" },
        uC2: { value: vec3("#000000"), type: "vec3<f32>" },
        uC3: { value: vec3("#000000"), type: "vec3<f32>" },
        uC4: { value: vec3("#000000"), type: "vec3<f32>" },
        uStops: { value: new Float32Array([0.25, 0.5, 0.75, 1]), type: "vec4<f32>" },
        uVig: { value: 0, type: "f32" },
        uVigShape: { value: new Float32Array([0.3, 1.0]), type: "vec2<f32>" },
        uAspect: { value: W / H, type: "f32" },
        uGrain: { value: 0.015, type: "f32" },
        uFrame: { value: 0, type: "f32" },
        uToneMap: { value: 0, type: "f32" },
        uDither: { value: 1, type: "f32" },
      },
      { uHdr: this.hdr, uBloom: this.hdr },
    );
  }

  setGrade(g: Grade) {
    const u = this.final.uniforms;
    u.uMode = g.mode === "ramp" ? 1 : 0;
    if (g.ramp) {
      u.uC0 = vec3(g.ramp[0]);
      u.uC1 = vec3(g.ramp[1]);
      u.uC2 = vec3(g.ramp[2]);
      u.uC3 = vec3(g.ramp[3]);
      u.uC4 = vec3(g.ramp[4]);
    }
    if (g.stops) u.uStops = new Float32Array(g.stops);
    u.uExposure = g.exposure ?? 1;
    this.bloomAmt = g.bloom ?? 0;
    u.uVig = g.vignette ?? 0;
    if (g.vignetteShape) u.uVigShape = new Float32Array(g.vignetteShape);
    u.uGrain = g.grain ?? 0.015;
    u.uToneMap = g.toneMap ? 1 : 0;
  }

  private half(t: RenderTexture) {
    return new Float32Array([0.5 / t.source.pixelWidth, 0.5 / t.source.pixelHeight]);
  }

  /** Bloom from the HDR target; returns false when bloom is disabled. */
  private bloom() {
    const r = this.renderer;
    let src: RenderTexture = this.hdr;
    for (let i = 0; i < this.levels; i++) {
      this.down.setTexture("uSrc", src);
      this.down.uniforms.uHalf = this.half(src);
      this.down.run(r, this.downs[i]);
      src = this.downs[i];
    }
    let acc = this.downs[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      this.up.setTexture("uSrc", acc);
      this.up.setTexture("uAdd", this.downs[i]);
      this.up.uniforms.uHalf = this.half(acc);
      this.up.uniforms.uAddW = 1;
      this.up.run(r, this.ups[i]);
      acc = this.ups[i];
    }
    return acc;
  }

  /** Grade the HDR target to the canvas. `frame` must already be frame % 600. */
  present(frame: number) {
    const u = this.final.uniforms;
    u.uBloomAmt = this.bloomAmt / this.levels; // the up-chain sums `levels` octaves
    if (this.bloomAmt > 0) this.final.setTexture("uBloom", this.bloom());
    u.uFrame = frame;
    this.final.setTexture("uHdr", this.hdr);
    this.final.run(this.renderer, null);
  }
}
