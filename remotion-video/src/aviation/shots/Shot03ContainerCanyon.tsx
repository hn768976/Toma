import React from "react";
import { AbsoluteFill } from "remotion";
import { MathUtils, Vector3 } from "three/webgpu";
import { QUALITY, type QualityProfile, type ResolutionKey } from "../config";
import { ThreeStage, type StageFactory } from "../three/ThreeStage";
import { createShotRig } from "./kit";
import { defaultSky } from "../three/sky";
import { defaultGrade } from "../post/grade";
import { bakeContainerMarkings } from "../three/canvas-textures";
import { createContainerYard, type ContainerYard } from "../props/containerYard";
import { createJet } from "../props/jet";
import { drift, easeInOutSine, range, smootherstep } from "../three/easing";

/**
 * Shot 3 — Container Canyon. 301 frames (10.04s at 30fps).
 *
 * The most formal of the three: two walls of stacks rising on either side of a
 * working aisle, converging towards a slot of sky, with the jet flying straight
 * down that slot. The symmetry is the shot, so the camera sits in the centre of
 * the aisle and pushes forward along it rather than panning — any lateral move
 * would break the vanishing point the whole frame is built on.
 */

const SKY = defaultSky({
  sunDirection: new Vector3(0.12, 0.78, -0.61).normalize(),
  zenithColor: new Vector3(0.14, 0.26, 0.49),
  horizonColor: new Vector3(0.55, 0.64, 0.77),
  hazeColor: new Vector3(0.74, 0.78, 0.83),
  sunColor: new Vector3(1, 0.97, 0.9),
  gradientFalloff: 1.1,
  hazeHeight: 0.18,
  mieStrength: 0.3,
  mieFalloff: 7,
  intensity: 1.02,
});

const GRADE = defaultGrade({
  exposure: -1.1,
  contrast: 0.17,
  contrastPivot: 0.36,
  saturation: 1.1,
  lift: new Vector3(0.01, 0.015, 0.024),
  gain: new Vector3(1.0, 0.993, 0.972),
  vignette: 0.3,
  vignetteSoftness: 0.5,
  grain: 0.014,
  chromaticAberration: 1.1,
});

const createFactory =
  (quality: QualityProfile): StageFactory =>
  async (ctx) => {
    const rig = createShotRig({
      ctx,
      sky: SKY,
      grade: GRADE,
      camera: { fov: 66, near: 0.2, far: 40000 },
      world: {
        radius: 18000,
        sunIntensity: 3.0,
        fillIntensity: 0.55,
        groundColor: new Vector3(0.19, 0.18, 0.16),
        environmentIntensity: 0.7,
      },
    });

    const markings = bakeContainerMarkings(quality.anisotropy);

    // Two blocks either side of an aisle a little wider than a reach stacker.
    const aisle = 7.2;
    const walls: ContainerYard[] = [];
    for (const side of [-1, 1] as const) {
      const block = await createContainerYard({
        seed: side > 0 ? 0x5e1 : 0x6f2,
        // Unrotated, so each box's long corrugated wall faces the aisle and the
        // rows run away from camera. Rotating the block would turn the walls
        // into a shallow slab of container ends instead.
        columns: 2,
        rows: 8,
        minTiers: 5,
        maxTiers: 9,
        gapChance: 0.04,
        markings,
        lod: true,
        grime: 1.2,
      });
      block.object.position.set(side * (aisle / 2 + 2.8), 0, -32);
      rig.world.scene.add(block.object);
      walls.push(block);
    }

    // The two boxes nearest camera carry the hero mesh: they are the only ones
    // close enough for the corrugation to resolve.
    const foreground = await createContainerYard({
      seed: 0x7a3,
      columns: 1,
      rows: 2,
      minTiers: 6,
      maxTiers: 7,
      gapChance: 0,
      markings,
      lod: false,
      grime: 1.1,
    });
    foreground.object.position.set(-(aisle / 2 + 1.3), 0, -10);
    rig.world.scene.add(foreground.object);

    const jet = await createJet();
    rig.world.scene.add(jet.object);

    const jetPosition = new Vector3();
    const camera = rig.camera;

    const update = (frame: number) => {
      const t = frame / (ctx.durationInFrames - 1);
      const seconds = frame / ctx.fps;

      // Straight push down the aisle. The rise is what opens the slot of sky.
      const push = easeInOutSine(t);
      camera.position.set(
        drift(seconds * 0.5, 4.8) * 0.05,
        1.45 + push * 0.35,
        4 - push * 7.5,
      );

      const pitch = MathUtils.degToRad(52 + smootherstep(t) * 8);
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        pitch + drift(seconds * 0.4, 5.6) * 0.0015,
        drift(seconds * 0.31, 1.4) * 0.0018,
        MathUtils.degToRad(-1.2 + smootherstep(t) * 2.4) + drift(seconds * 0.27, 7.2) * 0.001,
      );

      // Down the centre line, away from camera, so it shrinks as it goes.
      const progress = range(frame, -20, ctx.durationInFrames + 30);
      jetPosition.set(
        MathUtils.lerp(260, -140, progress),
        2400,
        MathUtils.lerp(-900, -4200, progress),
      );
      jet.setAttitude(jetPosition, MathUtils.degToRad(186), 0.005, MathUtils.degToRad(1), seconds);
    };

    return rig.toStage(update, () => {
      for (const wall of walls) wall.dispose();
      foreground.dispose();
      jet.dispose();
      markings.dispose();
    });
  };

export const Shot03ContainerCanyon: React.FC<{ readonly resolution: ResolutionKey }> = ({
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
