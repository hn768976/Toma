import { PerspectiveCamera, Vector3 } from "three/webgpu";
import type { Stage, StageContext } from "../three/ThreeStage";
import { createWorld, type World, type WorldOptions } from "../three/world";
import { createCloudLayer, type CloudLayer, type CloudParams } from "../post/clouds";
import { createPipeline, type Pipeline } from "../post/pipeline";
import type { GradeParams } from "../post/grade";
import type { SkyParams } from "../three/sky";

/**
 * Boilerplate shared by all six shots: a camera, a world, an optional cloud
 * layer and the render pipeline, wired together and handed back so a shot only
 * has to write its staging and its camera move.
 */

export type ShotRigOptions = {
  readonly ctx: StageContext;
  readonly sky: SkyParams;
  readonly world: Omit<WorldOptions, "skyParams" | "clouds">;
  readonly clouds?: CloudParams;
  readonly grade: GradeParams;
  readonly camera: { readonly fov: number; readonly near: number; readonly far: number };
};

export type ShotRig = {
  readonly world: World;
  readonly camera: PerspectiveCamera;
  readonly pipeline: Pipeline;
  readonly clouds?: CloudLayer;
  /** Offsets the cloud noise lookups, drifting the layer across the sky. */
  setCloudWind(x: number, y: number, z: number): void;
  /**
   * Wraps a per-frame update into a {@link Stage}.
   *
   * The update runs before the dome is re-centred, so a shot can move the
   * camera freely and still get a correctly parented sky.
   */
  toStage(update: (frame: number) => void, dispose?: () => void): Stage;
};

export const createShotRig = (options: ShotRigOptions): ShotRig => {
  const { ctx, sky, grade } = options;
  const camera = new PerspectiveCamera(
    options.camera.fov,
    ctx.width / ctx.height,
    options.camera.near,
    options.camera.far,
  );

  const clouds = options.clouds
    ? createCloudLayer(options.clouds, ctx.quality.cloudSteps, ctx.quality.cloudLightSteps)
    : undefined;

  const world = createWorld({
    ...options.world,
    skyParams: sky,
    clouds,
    shadowMapSize: options.world.shadowMapSize ?? ctx.quality.shadowMapSize,
  });

  if (options.world.castShadows) {
    ctx.renderer.shadowMap.enabled = true;
  }

  const pipeline = createPipeline({
    renderer: ctx.renderer,
    scene: world.scene,
    skyScene: world.skyScene,
    camera,
    width: ctx.width,
    height: ctx.height,
    skyScale: clouds ? ctx.quality.cloudScale : 1,
    grade,
  });

  const wind = new Vector3();

  return {
    world,
    camera,
    pipeline,
    clouds,
    setCloudWind(x, y, z) {
      if (!clouds) return;
      wind.set(x, y, z);
      (clouds.uniforms.wind.value as Vector3).copy(wind);
    },
    toStage(update, dispose) {
      return {
        update(frame) {
          update(frame);
          camera.updateMatrixWorld();
          world.follow(camera);
          pipeline.setFrame(frame);
        },
        async draw(target) {
          await pipeline.render(target);
        },
        dispose() {
          dispose?.();
          pipeline.dispose();
          world.dispose();
        },
      };
    },
  };
};
