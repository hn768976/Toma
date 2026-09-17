import React from "react";
import { AbsoluteFill } from "remotion";
import { MathUtils, Vector3 } from "three/webgpu";
import { QUALITY, type QualityProfile, type ResolutionKey } from "../config";
import { ThreeStage, type StageFactory } from "../three/ThreeStage";
import { createShotRig } from "./kit";
import { defaultSky } from "../three/sky";
import { defaultGrade } from "../post/grade";
import { defaultCloudParams } from "../post/clouds";
import { createJet } from "../props/jet";
import { createSignBoard } from "../props/signBoard";
import { drift, easeInOutSine, range, smootherstep } from "../three/easing";

/**
 * Shot 6 — Airport Sign. 270 frames (9.00s at 30fps).
 *
 * A direction sign reading Paris International Airport, shot from below against
 * building cumulus, with a departure climbing out behind it.
 *
 * Staging is the whole trick here. The sign is close and the aircraft is nearly
 * a kilometre away, so the two only share a frame because the lens is long
 * enough to compress them — and the camera has to drift just enough to give the
 * sign parallax against the cloud without losing the aircraft behind it.
 *
 * Retimed from 25fps; the nine-second duration is carried over exactly.
 */

const SUN = new Vector3(0.52, 0.56, 0.65).normalize();

const SKY = defaultSky({
  sunDirection: SUN.clone(),
  zenithColor: new Vector3(0.13, 0.28, 0.58),
  horizonColor: new Vector3(0.6, 0.72, 0.86),
  hazeColor: new Vector3(0.8, 0.85, 0.9),
  sunColor: new Vector3(1, 0.96, 0.87),
  gradientFalloff: 1.35,
  hazeHeight: 0.14,
  mieStrength: 0.45,
  mieFalloff: 7,
  intensity: 1.12,
});

const CLOUDS = defaultCloudParams({
  bottom: 1100,
  top: 3400,
  coverage: 0.86,
  density: 1.5,
  cloudType: 0.88,
  // The frame covers only a small patch of sky, so the weather system has to be
  // small enough for that patch to contain structure rather than one value.
  weatherScale: 7500,
  shapeScale: 2300,
  detailScale: 230,
  detailStrength: 0.46,
  sunDirection: SUN.clone(),
  sunColor: new Vector3(1, 0.96, 0.88),
  sunIntensity: 9.5,
  ambientTop: new Vector3(0.6, 0.7, 0.85),
  ambientBottom: new Vector3(0.34, 0.42, 0.56),
  forwardScatter: 0.8,
  backScatter: -0.26,
  scatterBlend: 0.6,
  extinction: 0.058,
  powder: 0.68,
  horizonColor: new Vector3(0.83, 0.88, 0.93),
});

const GRADE = defaultGrade({
  exposure: -0.75,
  contrast: 0.2,
  contrastPivot: 0.42,
  saturation: 1.12,
  lift: new Vector3(0.004, 0.01, 0.02),
  gain: new Vector3(1.01, 1.0, 0.985),
  vignette: 0.26,
  vignetteSoftness: 0.54,
  grain: 0.013,
  chromaticAberration: 1,
});

const createFactory =
  (quality: QualityProfile): StageFactory =>
  async (ctx) => {
    const rig = createShotRig({
      ctx,
      sky: SKY,
      clouds: CLOUDS,
      grade: GRADE,
      // Long enough to compress a 900m-away aircraft against a 12m-away sign.
      camera: { fov: 27, near: 0.5, far: 90000 },
      world: {
        radius: 42000,
        sunIntensity: 3.6,
        fillIntensity: 0.75,
        groundColor: new Vector3(0.24, 0.24, 0.22),
        environmentIntensity: 1,
        castShadows: false,
      },
    });

    const sign = createSignBoard(quality.anisotropy);
    sign.object.position.set(2.1, 7.4, -12.5);
    sign.object.rotation.y = MathUtils.degToRad(-17);
    sign.object.rotation.x = MathUtils.degToRad(2.5);
    rig.world.scene.add(sign.object);

    const jet = await createJet();
    rig.world.scene.add(jet.object);

    const jetPosition = new Vector3();
    const camera = rig.camera;

    const update = (frame: number) => {
      const t = frame / (ctx.durationInFrames - 1);
      const seconds = frame / ctx.fps;

      // A slow lift and a few centimetres of lateral drift. At this focal
      // length that is enough to slide the sign against the cloud behind it.
      const rise = easeInOutSine(t);
      camera.position.set(
        -0.6 + rise * 1.3 + drift(seconds * 0.42, 5.2) * 0.035,
        1.62 + rise * 0.55,
        1.1 - rise * 0.9,
      );

      const pitch = MathUtils.degToRad(15.5 + smootherstep(t) * 4.5);
      const yaw = MathUtils.degToRad(3.5 - rise * 5);
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        pitch + drift(seconds * 0.36, 4.3) * 0.0012,
        yaw + drift(seconds * 0.3, 7.9) * 0.0014,
        MathUtils.degToRad(-0.8 + smootherstep(t) * 1.8) + drift(seconds * 0.25, 1.7) * 0.0009,
      );

      // Climbing out behind the sign, left to right, gear up and still turning
      // onto its departure heading.
      const progress = range(frame, -18, ctx.durationInFrames + 26);
      jetPosition.set(
        MathUtils.lerp(-470, 380, progress),
        MathUtils.lerp(180, 430, progress),
        MathUtils.lerp(-640, -545, progress),
      );
      jet.setAttitude(
        jetPosition,
        MathUtils.degToRad(-76),
        MathUtils.degToRad(11),
        MathUtils.degToRad(-7 + progress * 12),
        seconds,
      );

      rig.setCloudWind(seconds * 11, 0, seconds * -7);
    };

    return rig.toStage(update, () => {
      sign.dispose();
      jet.dispose();
    });
  };

export const Shot06AirportSign: React.FC<{ readonly resolution: ResolutionKey }> = ({
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
