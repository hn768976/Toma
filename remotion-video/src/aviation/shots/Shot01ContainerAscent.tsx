import React from "react";
import { AbsoluteFill } from "remotion";
import { MathUtils, Vector3 } from "three/webgpu";
import { QUALITY, type QualityProfile, type ResolutionKey } from "../config";
import { ThreeStage, type StageFactory } from "../three/ThreeStage";
import { createShotRig } from "./kit";
import { defaultSky } from "../three/sky";
import { defaultGrade } from "../post/grade";
import { bakeContainerMarkings } from "../three/canvas-textures";
import { createContainerYard } from "../props/containerYard";
import { createJet } from "../props/jet";
import { drift, easeInOutSine, range, smootherstep } from "../three/easing";

/**
 * Shot 1 — Container Ascent. 251 frames (8.38s at 30fps).
 *
 * Recreates the first reference: a very wide lens at ground level, tipped
 * almost vertical, with a wall of stacked boxes running out of the bottom of
 * frame and converging towards the top right. The camera barely translates —
 * the whole move is a slow rotation, and the drama comes entirely from
 * perspective convergence, which is why the lens is this wide and the camera is
 * this close to the steel.
 *
 * A jet crosses the sky high above, small enough to read as scale rather than
 * as subject.
 */

const SKY = defaultSky({
  sunDirection: new Vector3(0.42, 0.66, -0.62).normalize(),
  // Overcast-hazed daylight: the blue never gets deep because there is always
  // a few kilometres of port air between the lens and the zenith.
  zenithColor: new Vector3(0.2, 0.3, 0.5),
  horizonColor: new Vector3(0.6, 0.67, 0.77),
  hazeColor: new Vector3(0.78, 0.8, 0.83),
  sunColor: new Vector3(1, 0.95, 0.86),
  gradientFalloff: 1.15,
  hazeHeight: 0.22,
  mieStrength: 0.42,
  mieFalloff: 5.5,
  intensity: 1.05,
});

const GRADE = defaultGrade({
  exposure: -1.15,
  contrast: 0.14,
  contrastPivot: 0.38,
  saturation: 1.05,
  lift: new Vector3(0.012, 0.016, 0.024),
  gain: new Vector3(1.0, 0.995, 0.98),
  vignette: 0.26,
  vignetteSoftness: 0.55,
  grain: 0.014,
  chromaticAberration: 0.9,
});

const createFactory =
  (quality: QualityProfile): StageFactory =>
  async (ctx) => {
    const rig = createShotRig({
      ctx,
      sky: SKY,
      grade: GRADE,
      camera: { fov: 62, near: 0.25, far: 40000 },
      world: {
        radius: 18000,
        sunIntensity: 3.4,
        fillIntensity: 0.62,
        groundColor: new Vector3(0.2, 0.19, 0.17),
        environmentIntensity: 0.75,
      },
    });

    const markings = bakeContainerMarkings(quality.anisotropy);

    // The near block is what the shot is actually about, so it gets the hero
    // mesh; the blocks behind it only ever appear as silhouette and skyline.
    const nearYard = await createContainerYard({
      seed: 0x1a7,
      columns: 4,
      rows: 7,
      minTiers: 5,
      maxTiers: 9,
      gapChance: 0.05,
      markings,
      lod: false,
      grime: 1.1,
    });
    // Turned broadside: the reference reads the long corrugated walls, not the
    // door ends, and the corrugation is what gives the convergence its texture.
    nearYard.object.rotation.y = Math.PI / 2;
    nearYard.object.position.set(9.2, 0, -13);
    rig.world.scene.add(nearYard.object);

    const farYard = await createContainerYard({
      seed: 0x2b8,
      columns: 4,
      rows: 9,
      minTiers: 4,
      maxTiers: 8,
      gapChance: 0.12,
      markings,
      grime: 1.25,
    });
    farYard.object.position.set(-14, 0, -44);
    farYard.object.rotation.y = Math.PI / 2 + 0.1;
    rig.world.scene.add(farYard.object);

    const jet = await createJet();
    rig.world.scene.add(jet.object);

    const jetPosition = new Vector3();
    const camera = rig.camera;

    const update = (frame: number) => {
      const t = frame / (ctx.durationInFrames - 1);
      const seconds = frame / ctx.fps;

      // The camera stands still and turns. A handheld operator leaning back
      // against a fence would drift a few centimetres over eight seconds, and
      // that tiny parallax is what sells the scale of the steel.
      camera.position.set(
        drift(seconds * 0.6, 2.4) * 0.06,
        1.55 + easeInOutSine(t) * 0.22 + drift(seconds * 0.5, 5.1) * 0.02,
        0.4 - easeInOutSine(t) * 0.5,
      );

      // Steeply up, rotating slowly anticlockwise so the convergence point
      // sweeps across frame.
      const pitch = MathUtils.degToRad(58 + smootherstep(t) * 5.5);
      const yaw = MathUtils.degToRad(-14 + easeInOutSine(t) * 15);
      const roll = MathUtils.degToRad(-4.5 + smootherstep(t) * 9);

      camera.rotation.order = "YXZ";
      camera.rotation.set(
        pitch + drift(seconds * 0.45, 8.2) * 0.0016,
        yaw + drift(seconds * 0.38, 1.9) * 0.0018,
        roll + drift(seconds * 0.3, 4.4) * 0.0012,
      );

      // Jet at cruise, crossing high and slightly away from camera. It enters
      // before frame 0 and leaves after the cut, as it does in the reference.
      const progress = range(frame, -30, ctx.durationInFrames + 40);
      jetPosition.set(
        MathUtils.lerp(-1900, 2400, progress),
        2650,
        MathUtils.lerp(-2600, -3500, progress),
      );
      jet.setAttitude(jetPosition, MathUtils.degToRad(-108), 0.004, MathUtils.degToRad(2), seconds);
    };

    return rig.toStage(update, () => {
      nearYard.dispose();
      farYard.dispose();
      jet.dispose();
      markings.dispose();
    });
  };

export const Shot01ContainerAscent: React.FC<{ readonly resolution: ResolutionKey }> = ({
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
