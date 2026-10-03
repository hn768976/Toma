import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { createFinalMaterial } from "./finalPass";

export type PipelineOptions = {
  bloom?: { strength: number; radius: number; threshold: number };
  grain?: number;
  exposure?: number;
  vignette?: number;
  samples?: number;
  /** extra passes inserted between scene render and bloom (e.g. depth of field) */
  extraPasses?: Pass[];
  /** soft-clamp HDR values before bloom so tiny specular hot spots don't flood the frame */
  clampHDR?: number;
};

/**
 * HDR (half-float, MSAA) scene render → optional extra passes → bloom →
 * final (ACES tonemap, sRGB, grain, dither). No temporal effects anywhere,
 * so any frame can be rendered alone and match a full render.
 */
export class Pipeline {
  composer: EffectComposer;
  renderPass: RenderPass;
  bloom: UnrealBloomPass | null = null;
  final: ShaderPass;
  private w = 0;
  private h = 0;

  constructor(
    public renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    public opts: PipelineOptions,
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: opts.samples ?? 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(1);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    for (const p of opts.extraPasses ?? []) this.composer.addPass(p);
    if (opts.clampHDR) {
      const clampPass = new ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: { tDiffuse: { value: null }, uMax: { value: opts.clampHDR } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
          fragmentShader: `uniform sampler2D tDiffuse; uniform float uMax; varying vec2 vUv;
            void main() {
              vec3 c = texture2D(tDiffuse, vUv).rgb;
              float m = max(max(c.r, c.g), c.b);
              float T = 0.5 * uMax;
              float mm = m > T ? T + (m - T) / (1.0 + (m - T) / (uMax - T)) : m;
              gl_FragColor = vec4(m > 0.0 ? c * (mm / m) : c, 1.0);
            }`,
        }),
        "tDiffuse",
      );
      this.composer.addPass(clampPass);
    }
    if (opts.bloom) {
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(size.x, size.y),
        opts.bloom.strength,
        opts.bloom.radius,
        opts.bloom.threshold,
      );
      this.composer.addPass(this.bloom);
    }
    const mat = createFinalMaterial();
    this.final = new ShaderPass(mat, "tDiffuse");
    this.final.material.uniforms.uGrain.value = opts.grain ?? 0.02;
    this.final.material.uniforms.uExposure.value = opts.exposure ?? 1;
    this.final.material.uniforms.uVignette.value = opts.vignette ?? 0;
    this.composer.addPass(this.final);
    this.ensureSize();
  }

  ensureSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== this.w || size.y !== this.h) {
      this.w = size.x;
      this.h = size.y;
      this.composer.setSize(size.x, size.y);
      this.final.material.uniforms.uAspect.value = size.x / size.y;
    }
    return { w: this.w, h: this.h };
  }

  /** `loopFrame` drives the grain hash — pass frame % loopLength for loops. */
  render(loopFrame: number) {
    this.ensureSize();
    this.final.material.uniforms.uFrame.value = loopFrame;
    this.composer.render(0);
  }

  dispose() {
    this.composer.dispose();
  }
}
