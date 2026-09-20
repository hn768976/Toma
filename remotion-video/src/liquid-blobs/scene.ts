import * as THREE from "three/webgpu";
import { CAMERA_FOV } from "./constants";
import {
  applyVariantToUniforms,
  createBlobMaterial,
  createBlobUniforms,
  type BlobUniforms,
} from "./material";
import {
  createBallField,
  sampleBallField,
  sampleCameraX,
  sampleCameraZ,
  type BallField,
} from "./motion";
import { createRenderer, type CreatedRenderer, type RendererPreference } from "./renderer";
import type { Variant } from "./variants";

export type SuperSample = 1 | 2 | 3;

export type SceneOptions = {
  canvas: HTMLCanvasElement;
  variant: Variant;
  width: number;
  height: number;
  superSample: SuperSample;
  blendRadius: number;
  rendererPreference: RendererPreference;
};

/**
 * Owns the renderer, the fullscreen quad and the uniform block. Everything is
 * driven from a single loop position, so the same `t` always produces exactly
 * the same pixels — which is what lets Remotion render frames out of order
 * and across several processes and still get a coherent clip.
 */
export class LiquidBlobsScene {
  readonly created: CreatedRenderer;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly uniforms: BlobUniforms;
  private readonly field: BallField = createBallField();
  private width: number;
  private height: number;

  private constructor(created: CreatedRenderer, options: SceneOptions) {
    this.created = created;
    this.width = options.width;
    this.height = options.height;

    this.uniforms = createBlobUniforms(options.variant);
    this.uniforms.blendRadius.value = options.blendRadius;

    const material = createBlobMaterial(this.uniforms, options.superSample);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.resize(options.width, options.height);
  }

  static async create(options: SceneOptions): Promise<LiquidBlobsScene> {
    const created = await createRenderer(
      options.canvas,
      options.rendererPreference,
    );
    return new LiquidBlobsScene(created, options);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    // The drawing buffer is sized explicitly and CSS stretches it, so the
    // render resolution never depends on layout.
    this.created.renderer.setPixelRatio(1);
    this.created.renderer.setSize(width, height, false);
    this.uniforms.resolution.value.set(width, height);
    const halfHeight = Math.tan((CAMERA_FOV * Math.PI) / 360);
    this.uniforms.halfExtent.value.set(
      (halfHeight * width) / height,
      halfHeight,
    );
  }

  setVariant(variant: Variant) {
    applyVariantToUniforms(this.uniforms, variant);
  }

  setBlendRadius(radius: number) {
    this.uniforms.blendRadius.value = radius;
  }

  /** `t` is the position in the loop, as a fraction. Periodic in 1. */
  async renderAt(t: number) {
    sampleBallField(this.field, t);
    const positions = this.uniforms.ballPositions.array as THREE.Vector3[];
    const radii = this.uniforms.ballRadii.array as number[];
    for (let i = 0; i < radii.length; i++) {
      positions[i].set(
        this.field.positions[i * 3 + 0],
        this.field.positions[i * 3 + 1],
        this.field.positions[i * 3 + 2],
      );
      radii[i] = this.field.radii[i];
    }
    this.uniforms.ballPositions.needsUpdate = true;
    this.uniforms.ballRadii.needsUpdate = true;
    this.uniforms.cameraPosition.value.set(
      sampleCameraX(t),
      0,
      sampleCameraZ(t),
    );

    await this.created.renderer.renderAsync(this.scene, this.camera);
  }

  dispose() {
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
    this.created.renderer.dispose();
  }

  get size() {
    return { width: this.width, height: this.height };
  }
}
