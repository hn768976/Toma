import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * HDR post pipeline: scene (half-float, with depth texture)
 *   -> optional physically-inspired depth of field (half-res gather + full-res composite)
 *   -> bloom -> grade (ACES, vignette, sRGB) -> canvas.
 * All parameters are plain values so a frame is a pure function of its inputs.
 */
export type PostParams = {
  focusDistance: number; // world units
  aperture: number; // CoC scale (pixels at 1080p height per unit of relative defocus)
  maxCoc: number; // max blur radius in 1080p pixels
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
  vignette: number;
  saturation: number;
  lift: THREE.Vector3; // additive shadow tint (linear)
  grain: number;
  frame: number;
};

const quadVS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const cocChunk = /* glsl */ `
uniform sampler2D tDepth;
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc, uPxScale;
float viewDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  float ndc = z * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}
// signed CoC in *output* pixels: negative = foreground (nearer than focus)
float cocAt(vec2 uv) {
  float d = viewDepth(uv);
  float c = uAperture * (d - uFocus) / max(d, 1e-3);
  return clamp(c, -uMaxCoc, uMaxCoc) * uPxScale;
}
`;

const dofGatherFS = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uTexel; // texel size of the full-res input
${cocChunk}
varying vec2 vUv;
const int N = 56;
const float GOLDEN = 2.39996323;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float cC = cocAt(vUv);
  float aC = abs(cC);
  float radius = uMaxCoc * uPxScale; // gather radius in full-res pixels
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float nearAcc = 0.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N)) * radius;
    float th = fi * GOLDEN + rot;
    vec2 off = vec2(cos(th), sin(th)) * r;
    vec2 suv = vUv + off * uTexel;
    float cS = cocAt(suv);
    float aS = abs(cS);
    // a sample contributes if its own blur disk covers the centre;
    // background samples cannot spill over a sharper foreground centre
    float reach = (cS < cC) ? aS : min(aS, aC);
    float w = clamp(reach - r + 1.0, 0.0, 1.0) / max(reach * reach, 1.0);
    vec3 col = texture2D(tColor, suv).rgb;
    acc += col * w;
    wsum += w;
    nearAcc += (cS < 0.0 ? aS : 0.0) * w;
  }
  vec3 centre = texture2D(tColor, vUv).rgb;
  float wc = 1.0 / max(aC * aC, 1.0);
  acc += centre * wc; wsum += wc;
  float nearCoc = nearAcc / wsum;
  gl_FragColor = vec4(acc / wsum, max(aC, nearCoc));
}
`;

const dofCompositeFS = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBlur;
${cocChunk}
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 blur = texture2D(tBlur, vUv);
  float c = max(abs(cocAt(vUv)), blur.a);
  float t = smoothstep(0.6, 2.5, c);
  gl_FragColor = vec4(mix(sharp, blur.rgb, t), 1.0);
}
`;

const gradeFS = /* glsl */ `
uniform sampler2D tColor;
uniform float uExposure, uVignette, uSaturation, uGrain, uFrame;
uniform vec3 uLift;
uniform vec2 uRes;
varying vec2 vUv;
vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main() {
  vec3 c = texture2D(tColor, vUv).rgb * uExposure;
  c += uLift;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = aces(max(c, 0.0));
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  c *= mix(1.0, smoothstep(1.25, 0.25, length(q)), uVignette);
  c = toSRGB(c);
  float g = hash(vUv * uRes + fract(uFrame * 0.6180339) * 97.0) - 0.5;
  c += g * uGrain;
  gl_FragColor = vec4(c, 1.0);
}
`;

export class PostPipeline {
  private sceneRT: THREE.WebGLRenderTarget;
  private blurRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private bloom: UnrealBloomPass;
  private gatherQuad: FullScreenQuad;
  private compositeQuad: FullScreenQuad;
  private gradeQuad: FullScreenQuad;
  private gatherMat: THREE.ShaderMaterial;
  private compositeMat: THREE.ShaderMaterial;
  private gradeMat: THREE.ShaderMaterial;
  private readonly useDof: boolean;

  constructor(
    private renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    options: { dof: boolean },
  ) {
    this.useDof = options.dof;
    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthTexture,
      depthBuffer: true,
    });
    this.blurRT = new THREE.WebGLRenderTarget(Math.round(width / 2), Math.round(height / 2), {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    this.dofRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    const cocUniforms = () => ({
      tDepth: { value: depthTexture },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 10 },
      uAperture: { value: 1 },
      uMaxCoc: { value: 10 },
      uPxScale: { value: height / 1080 },
    });
    this.gatherMat = new THREE.ShaderMaterial({
      vertexShader: quadVS,
      fragmentShader: dofGatherFS,
      uniforms: {
        tColor: { value: this.sceneRT.texture },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        ...cocUniforms(),
      },
      depthTest: false,
      depthWrite: false,
    });
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: quadVS,
      fragmentShader: dofCompositeFS,
      uniforms: {
        tColor: { value: this.sceneRT.texture },
        tBlur: { value: this.blurRT.texture },
        ...cocUniforms(),
      },
      depthTest: false,
      depthWrite: false,
    });
    this.gradeMat = new THREE.ShaderMaterial({
      vertexShader: quadVS,
      fragmentShader: gradeFS,
      uniforms: {
        tColor: { value: this.useDof ? this.dofRT.texture : this.sceneRT.texture },
        uExposure: { value: 1 },
        uVignette: { value: 0.5 },
        uSaturation: { value: 1 },
        uGrain: { value: 0.01 },
        uFrame: { value: 0 },
        uLift: { value: new THREE.Vector3() },
        uRes: { value: new THREE.Vector2(width, height) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.gatherQuad = new FullScreenQuad(this.gatherMat);
    this.compositeQuad = new FullScreenQuad(this.compositeMat);
    this.gradeQuad = new FullScreenQuad(this.gradeMat);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1, 0.5, 1);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: PostParams) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);

    let bloomInput = this.sceneRT;
    if (this.useDof) {
      for (const m of [this.gatherMat, this.compositeMat]) {
        m.uniforms.uNear.value = camera.near;
        m.uniforms.uFar.value = camera.far;
        m.uniforms.uFocus.value = p.focusDistance;
        m.uniforms.uAperture.value = p.aperture;
        m.uniforms.uMaxCoc.value = p.maxCoc;
      }
      r.setRenderTarget(this.blurRT);
      this.gatherQuad.render(r);
      r.setRenderTarget(this.dofRT);
      this.compositeQuad.render(r);
      bloomInput = this.dofRT;
    }

    this.bloom.strength = p.bloomStrength;
    this.bloom.radius = p.bloomRadius;
    this.bloom.threshold = p.bloomThreshold;
    this.bloom.render(r, null as unknown as THREE.WebGLRenderTarget, bloomInput, 0, false);

    const g = this.gradeMat.uniforms;
    g.uExposure.value = p.exposure;
    g.uVignette.value = p.vignette;
    g.uSaturation.value = p.saturation;
    g.uGrain.value = p.grain;
    g.uFrame.value = p.frame;
    g.uLift.value.copy(p.lift);
    r.setRenderTarget(null);
    this.gradeQuad.render(r);
  }

  dispose() {
    this.sceneRT.depthTexture?.dispose();
    this.sceneRT.dispose();
    this.blurRT.dispose();
    this.dofRT.dispose();
    this.bloom.dispose();
    this.gatherQuad.dispose();
    this.compositeQuad.dispose();
    this.gradeQuad.dispose();
    this.gatherMat.dispose();
    this.compositeMat.dispose();
    this.gradeMat.dispose();
  }
}
