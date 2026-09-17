import {
  HalfFloatType,
  LinearFilter,
  MeshBasicNodeMaterial,
  QuadMesh,
  RenderTarget,
  Vector2,
  type Camera,
  type RenderTarget as RenderTargetType,
  type Scene,
  type WebGPURenderer,
} from "three/webgpu";
import { screenUV, texture, uniform } from "three/tsl";
import {
  applyGradeUniforms,
  createGradeNode,
  createGradeUniforms,
  type GradeParams,
} from "./grade";
import type { TSL } from "../three/tsl";

/**
 * The frame, rendered in three passes.
 *
 * 1. **Sky** — the dome alone, into a reduced-resolution target. The cloud
 *    march lives in the dome's shader and is by far the most expensive thing
 *    in the frame, so halving its resolution buys back three quarters of its
 *    cost. Clouds are soft by nature, so the upscale costs nothing visually.
 * 2. **Scene** — everything else at full resolution, over the upscaled sky.
 *    Because the sky arrives as a background rather than as geometry, solid
 *    objects occlude cloud without any depth-buffer work.
 * 3. **Grade** — a full-screen pass carrying the look.
 *
 * The scene target is half-float: the sky in these references is several stops
 * above the subject, and 8 bits would band across it long before the tone map
 * had a chance to roll it off.
 */

export type Pipeline = {
  /** Renders one frame into `target` (null means the canvas). */
  render(target: RenderTargetType | null): Promise<void>;
  setGrade(grade: GradeParams): void;
  /** Frame number, used to keep grain deterministic. */
  setFrame(frame: number): void;
  dispose(): void;
};

export type PipelineOptions = {
  readonly renderer: WebGPURenderer;
  readonly scene: Scene;
  readonly skyScene: Scene;
  readonly camera: Camera;
  readonly width: number;
  readonly height: number;
  /** Sky pass resolution as a fraction of the output. */
  readonly skyScale: number;
  readonly grade: GradeParams;
};

export const createPipeline = ({
  renderer,
  scene,
  skyScene,
  camera,
  width,
  height,
  skyScale,
  grade,
}: PipelineOptions): Pipeline => {
  const skyWidth = Math.max(2, Math.round(width * skyScale));
  const skyHeight = Math.max(2, Math.round(height * skyScale));

  const skyTarget = new RenderTarget(skyWidth, skyHeight, {
    depthBuffer: false,
    type: HalfFloatType,
  });
  skyTarget.texture.minFilter = LinearFilter;
  skyTarget.texture.magFilter = LinearFilter;
  skyTarget.texture.generateMipmaps = false;

  const sceneTarget = new RenderTarget(width, height, {
    depthBuffer: true,
    type: HalfFloatType,
  });
  sceneTarget.texture.minFilter = LinearFilter;
  sceneTarget.texture.magFilter = LinearFilter;
  sceneTarget.texture.generateMipmaps = false;

  // Bilinear upscale of the sky pass, sampled per pixel as the scene's
  // background rather than drawn as another quad.
  //
  // The uv is explicit. A background node left to its default samples the mesh
  // uv attribute, which in this context is degenerate — the entire sky then
  // takes the colour of a single texel, and every gradient in it silently
  // disappears.
  scene.backgroundNode = texture(
    skyTarget.texture,
    screenUV,
  ) as unknown as typeof scene.backgroundNode;

  const gradeUniforms = createGradeUniforms(grade);
  const frameSeed = uniform(0);
  const resolution = uniform(new Vector2(width, height));

  const gradeMaterial = new MeshBasicNodeMaterial();
  gradeMaterial.depthTest = false;
  gradeMaterial.depthWrite = false;
  gradeMaterial.colorNode = createGradeNode(
    gradeUniforms,
    (uv) => texture(sceneTarget.texture, uv) as unknown as TSL,
    frameSeed,
    resolution,
  );
  const gradeQuad = new QuadMesh(gradeMaterial);

  return {
    async render(target) {
      renderer.setRenderTarget(skyTarget);
      await renderer.renderAsync(skyScene, camera);

      renderer.setRenderTarget(sceneTarget);
      await renderer.renderAsync(scene, camera);

      renderer.setRenderTarget(target);
      await gradeQuad.renderAsync(renderer);
    },
    setGrade(next) {
      applyGradeUniforms(gradeUniforms, next);
    },
    setFrame(frame) {
      frameSeed.value = frame;
    },
    dispose() {
      skyTarget.dispose();
      sceneTarget.dispose();
      gradeMaterial.dispose();
    },
  };
};
