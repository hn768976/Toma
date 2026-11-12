import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { PlaneDofPass, DofParams } from "./PlaneDofPass";
import { createGradePass } from "./GradePass";

export type Updatable = { update: (time: number, pxScale: number) => void };

export type SceneSpec = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  batches: Updatable[];
  dof: DofParams;
  bloom?: { strength: number; radius: number; threshold: number };
  grade: { exposure: number; vignette: number; vignetteColor?: THREE.Color };
  /** Called every frame before rendering: animate camera, DOF, bloom etc. */
  animate: (time: number, stage: Stage) => void;
  dispose?: () => void;
};

export class Stage {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  dof: PlaneDofPass;
  bloom?: UnrealBloomPass;
  grade: ReturnType<typeof createGradePass>;
  spec: SceneSpec;
  private drawH: number;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number, spec: SceneSpec) {
    this.spec = spec;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    const dw = Math.round(width * pixelRatio);
    const dh = Math.round(height * pixelRatio);
    this.drawH = dh;
    const rt = new THREE.WebGLRenderTarget(dw, dh, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    spec.camera.aspect = width / height;
    spec.camera.updateProjectionMatrix();
    this.composer.addPass(new RenderPass(spec.scene, spec.camera));
    this.dof = new PlaneDofPass(spec.camera, spec.dof);
    this.composer.addPass(this.dof);
    if (spec.bloom) {
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(dw, dh),
        spec.bloom.strength,
        spec.bloom.radius,
        spec.bloom.threshold,
      );
      this.composer.addPass(this.bloom);
    }
    this.grade = createGradePass(spec.grade);
    this.grade.uniforms.uAspect.value = width / height;
    this.composer.addPass(this.grade);
  }

  render(time: number) {
    this.spec.animate(time, this);
    const cam = this.spec.camera;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const pxScale = (this.drawH / 2) * cam.projectionMatrix.elements[5];
    this.spec.batches.forEach((b) => b.update(time, pxScale));
    this.composer.render();
  }

  dispose() {
    this.spec.dispose?.();
    this.dof.dispose();
    this.bloom?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
