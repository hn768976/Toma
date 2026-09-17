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
        sunIntensity: 3.2,
        fillIntensity: 1.05,
        groundColor: new Vector3(0.2, 0.19, 0.17),
        environmentIntensity: 0.95,
      },
    });

    const markings = bakeContainerMarkings(quality.anisotropy);

    // Both blocks use the reduced mesh. The camera never gets closer than a few
    // metres, and at that distance the corrugation meshopt preserves is all
    // that reads — the hero mesh costs two and a half times the triangles, and
    // the yards are what this render spends most of its time rasterising.
    const nearYard = await createContainerYard({
      seed: 0x1a7,
      columns: 4,
      rows: 7,
      minTiers: 5,
      maxTiers: 9,
      gapChance: 0.05,
      markings,
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

      // An aircraft on approach, not one at cruise. Measured against the
      // reference, the jet spans about 9% of frame width — roughly 170px at
      // 1080p — which for a 60m wingspan puts it near 320m from the lens, and
      // it stays in shot for the full eight seconds, which only works at an
      // approach speed of about 70m/s rather than a cruise 240. Both follow
      // from the same reading: this is short final over the yard, and it is
      // what makes the aircraft read as an aircraft instead of a speck.
      // Placed against the frame, not just against the camera axis: the stacks
      // fill the lower two thirds, so an aircraft on the view axis sits behind
      // steel. This track runs through the band of open sky above them.
      const progress = range(frame, -40, ctx.durationInFrames + 40);
      jetPosition.set(
        MathUtils.lerp(-388, 406, progress),
        MathUtils.lerp(315, 328, progress),
        MathUtils.lerp(-70, -92, progress),
      );
      jet.setAttitude(
        jetPosition,
        MathUtils.degToRad(-92),
        MathUtils.degToRad(3),
        MathUtils.degToRad(1.5),
        seconds,
      );
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
