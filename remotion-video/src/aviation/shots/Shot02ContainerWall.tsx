import React from "react";
import { AbsoluteFill } from "remotion";
import { MathUtils, Vector3 } from "three/webgpu";
import { QUALITY, type QualityProfile, type ResolutionKey } from "../config";
import { ThreeStage, type StageFactory } from "../three/ThreeStage";
import { createShotRig } from "./kit";
import { defaultSky } from "../three/sky";
import { defaultGrade } from "../post/grade";
import { defaultCloudParams } from "../post/clouds";
import { bakeContainerMarkings } from "../three/canvas-textures";
import { createContainerYard } from "../props/containerYard";
import { createJet } from "../props/jet";
import { drift, easeInOutSine, range, smootherstep } from "../three/easing";

/**
 * Shot 2 — Container Wall. 360 frames (12.01s at 30fps).
 *
 * The widest and slowest of the three yard shots. The camera stands further
 * back than in shot 1, so the stacks read as a continuous wall with a ragged
 * skyline rather than as individual towers, and the top two thirds of frame is
 * sky. A jet crosses left to right and, at twelve seconds, has time to cross
 * the whole frame — which is what sets the pace of the camera move.
 *
 * A thin, high, broken cloud layer gives the sky something to hold the eye
 * across a shot this long.
 */

const SKY = defaultSky({
  sunDirection: new Vector3(-0.36, 0.58, -0.73).normalize(),
  zenithColor: new Vector3(0.17, 0.28, 0.5),
  horizonColor: new Vector3(0.58, 0.66, 0.78),
  hazeColor: new Vector3(0.76, 0.79, 0.84),
  sunColor: new Vector3(1, 0.96, 0.88),
  gradientFalloff: 1.25,
  hazeHeight: 0.2,
  mieStrength: 0.34,
  mieFalloff: 6,
  intensity: 1,
});

const CLOUDS = defaultCloudParams({
  bottom: 4200,
  top: 6200,
  coverage: 0.3,
  density: 0.55,
  cloudType: 0.35,
  weatherScale: 46000,
  shapeScale: 6400,
  detailScale: 620,
  sunDirection: SKY.sunDirection.clone(),
  sunColor: new Vector3(1, 0.96, 0.88),
  sunIntensity: 5.5,
  ambientTop: new Vector3(0.5, 0.58, 0.72),
  ambientBottom: new Vector3(0.3, 0.34, 0.42),
  extinction: 0.042,
  horizonColor: new Vector3(0.78, 0.81, 0.86),
});

const GRADE = defaultGrade({
  exposure: -1.05,
  contrast: 0.16,
  contrastPivot: 0.4,
  saturation: 1.08,
  lift: new Vector3(0.014, 0.018, 0.026),
  gain: new Vector3(1.0, 0.99, 0.975),
  vignette: 0.22,
  vignetteSoftness: 0.58,
  grain: 0.013,
  chromaticAberration: 0.8,
});

const createFactory =
  (quality: QualityProfile): StageFactory =>
  async (ctx) => {
    const rig = createShotRig({
      ctx,
      sky: SKY,
      clouds: CLOUDS,
      grade: GRADE,
      camera: { fov: 54, near: 0.25, far: 60000 },
      world: {
        radius: 26000,
        sunIntensity: 3.2,
        fillIntensity: 0.6,
        groundColor: new Vector3(0.2, 0.19, 0.17),
        environmentIntensity: 0.8,
      },
    });

    const markings = bakeContainerMarkings(quality.anisotropy);

    const wall = await createContainerYard({
      seed: 0x3c9,
      columns: 2,
      rows: 9,
      minTiers: 4,
      maxTiers: 8,
      gapChance: 0.06,
      markings,
      grime: 1.15,
    });
    wall.object.rotation.y = Math.PI / 2;
    wall.object.position.set(2, 0, -21);
    rig.world.scene.add(wall.object);

    const backdrop = await createContainerYard({
      seed: 0x4da,
      columns: 3,
      rows: 9,
      minTiers: 3,
      maxTiers: 9,
      gapChance: 0.14,
      markings,
      grime: 1.3,
    });
    backdrop.object.rotation.y = Math.PI / 2 + 0.06;
    backdrop.object.position.set(-24, 0, -62);
    rig.world.scene.add(backdrop.object);

    const jet = await createJet();
    rig.world.scene.add(jet.object);

    const jetPosition = new Vector3();
    const camera = rig.camera;

    const update = (frame: number) => {
      const t = frame / (ctx.durationInFrames - 1);
      const seconds = frame / ctx.fps;

      // A long, even dolly to the right on a slider, with the tilt easing up as
      // it travels so the skyline stays about a third of the way up frame.
      const travel = easeInOutSine(t);
      camera.position.set(
        -7.5 + travel * 12.5 + drift(seconds * 0.4, 3.3) * 0.05,
        1.7 + travel * 0.5,
        1.2 - travel * 1.1,
      );

      const pitch = MathUtils.degToRad(33 + smootherstep(t) * 7);
      const yaw = MathUtils.degToRad(10 - travel * 18);
      const roll = MathUtils.degToRad(1.6 - smootherstep(t) * 3.2);
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        pitch + drift(seconds * 0.33, 6.1) * 0.0014,
        yaw + drift(seconds * 0.29, 2.2) * 0.0016,
        roll + drift(seconds * 0.24, 9.4) * 0.001,
      );

      // The jet needs the whole twelve seconds to cross, so it starts well off
      // the left edge and is still travelling when the shot ends.
      const progress = range(frame, -25, ctx.durationInFrames + 25);
      jetPosition.set(
        MathUtils.lerp(-3400, 3100, progress),
        2150,
        MathUtils.lerp(-2300, -2750, progress),
      );
      jet.setAttitude(jetPosition, MathUtils.degToRad(-94), 0.003, MathUtils.degToRad(-1.5), seconds);

      // Cloud drifts across the sky over the length of the shot.
      rig.setCloudWind(seconds * -26, 0, seconds * 9);
    };

    return rig.toStage(update, () => {
      wall.dispose();
      backdrop.dispose();
      jet.dispose();
      markings.dispose();
    });
  };

export const Shot02ContainerWall: React.FC<{ readonly resolution: ResolutionKey }> = ({
  resolution,
}) => {
  const quality = QUALITY[resolution];
  const factory = React.useMemo(() => createFactory(quality), [quality]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeStage factory={factory} quality={quality} />
    </AbsoluteFill>
  );
};
