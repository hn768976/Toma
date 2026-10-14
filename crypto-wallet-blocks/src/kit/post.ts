import * as THREE from "three";
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from "postprocessing";

// Final pass: tone curve, then TPDF dither of ±1/255 plus ~1.5% film grain, both from a fixed
// integer hash of (pixel, frame mod loop). The grain fades out below ~3%
// luminance so the near-black background stays clean. Done in sRGB space
// (converted in and out), because that is where 8-bit quantisation happens.
const GRAIN_FRAG = /* glsl */ `
uniform float uFrame;
uniform float uGrain;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float h01(uvec3 p) {
  uint v = pcg(p.x + pcg(p.y + pcg(p.z)));
  return float(v) / 4294967295.0;
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
// Tone curve: exactly linear below 0.7 (no toe, so the navy background keeps
// its hue), a soft hue-preserving shoulder above, and very hot values rolling
// toward white the way glowing glass does.
vec3 toneMap(vec3 c) {
  c = max(c, 0.0);
  float m = max(max(c.r, c.g), c.b);
  if (m <= 0.7) return c;
  float k = 0.7;
  float mm = k + (1.0 - k) * (1.0 - exp(-(m - k) / (1.0 - k)));
  vec3 t = c * (mm / m);
  float w = 1.0 - exp(-max(m - 1.0, 0.0) * 0.5);
  return mix(t, vec3(mm), w * 0.65);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 s = toSRGB(clamp(toneMap(inputColor.rgb), 0.0, 1.0));
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrame);
  float n1 = h01(uvec3(px, f * 4u + 0u));
  float n2 = h01(uvec3(px, f * 4u + 1u));
  float n3 = h01(uvec3(px, f * 4u + 2u));
  float dither = (n1 + n2 - 1.0) / 255.0;
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float grain = (n3 - 0.5) * 2.0 * uGrain * smoothstep(0.03, 0.08, lum);
  s = clamp(s + grain + dither, 0.0, 1.0);
  outputColor = vec4(toLinear(s), inputColor.a);
}`;

// Replaces NaN/Inf (and clamps extreme highlights) in the HDR buffer. A single
// bad pixel from a glancing specular on the glass would otherwise be smeared
// into a large white flare by the DoF and bloom blurs.
class SanitizeEffect extends Effect {
  constructor() {
    super(
      "SanitizeEffect",
      /* glsl */ `
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        bvec3 bad = bvec3(isnan(c.r) || isinf(c.r), isnan(c.g) || isinf(c.g), isnan(c.b) || isinf(c.b));
        c = vec3(bad.r ? 0.0 : c.r, bad.g ? 0.0 : c.g, bad.b ? 0.0 : c.b);
        outputColor = vec4(clamp(c, 0.0, 10.0), inputColor.a);
      }`,
      { blendFunction: BlendFunction.SET },
    );
  }
}

export class GrainDitherEffect extends Effect {
  constructor() {
    super("GrainDitherEffect", GRAIN_FRAG, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, THREE.Uniform>([
        ["uFrame", new THREE.Uniform(0)],
        ["uGrain", new THREE.Uniform(0.015)],
      ]),
    });
  }
  setFrame(f: number) {
    this.uniforms.get("uFrame")!.value = f;
  }
}

export class Post {
  readonly composer: EffectComposer;
  private readonly dof: DepthOfFieldEffect;
  private readonly bloom: BloomEffect;
  private readonly grain: GrainDitherEffect;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ) {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    this.composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new EffectPass(camera, new SanitizeEffect()));
    this.dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 8, worldFocusRange: 2.4, bokehScale: 2 });
    this.composer.addPass(new EffectPass(camera, this.dof));
    this.bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.62,
      luminanceSmoothing: 0.3,
      intensity: 2.2,
      radius: 0.72,
      levels: 8,
    });
    this.grain = new GrainDitherEffect();
    this.composer.addPass(new EffectPass(camera, this.bloom, this.grain));
  }

  // Everything pixel-sized is scaled by drawing-buffer height / 720 so that
  // a 720p preview and a 4K master look the same.
  setSize(width: number, height: number) {
    this.composer.setSize(width, height, false);
    const buf = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const k = buf.y / 720;
    this.dof.bokehScale = 2.2 * k;
    this.bloom.mipmapBlurPass.levels = 8 + Math.max(0, Math.round(Math.log2(k)));
    return k;
  }

  setFrame(loopFrame: number, focusDistance: number, focusRange: number) {
    this.grain.setFrame(loopFrame);
    this.dof.cocMaterial.worldFocusDistance = focusDistance;
    this.dof.cocMaterial.worldFocusRange = focusRange;
  }

  render() {
    this.composer.render(0);
  }

  dispose() {
    this.composer.dispose();
  }
}
