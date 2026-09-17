import React from "react";
import { AbsoluteFill } from "remotion";
import { MathUtils, Vector3 } from "three/webgpu";
import { QUALITY, type ResolutionKey } from "../config";
import { ThreeStage, type StageFactory } from "../three/ThreeStage";
import { createShotRig } from "./kit";
import { defaultSky } from "../three/sky";
import { defaultGrade } from "../post/grade";
import { defaultCloudParams } from "../post/clouds";
import { createJet } from "../props/jet";
import { drift, easeInOutSine, range } from "../three/easing";

/**
 * Shot 5 — Overhead Silhouette. 216 frames (7.20s at 30fps).
 *
 * Camera flat on its back, jet crossing the zenith as a hard silhouette against
 * broken cumulus, the whole frame pushed teal in the grade — the reference is
 * unmistakably a stills photographer's colour treatment rather than a natural
 * one, and the grade carries most of the look.
 *
 * The silhouette is earned rather than painted: the sun sits almost directly
 * behind the aircraft, so the surfaces facing the lens are lit only by skylight
 * while the sky around them is several stops brighter. The tone map does the
 * rest.
 *
 * Note this is the one shot retimed from 25fps. The duration is carried over
 * exactly; only the frame count changes.
 */

const SUN = new Vector3(0.16, 0.94, 0.3).normalize();

const SKY = defaultSky({
  sunDirection: SUN.clone(),
  zenithColor: new Vector3(0.09, 0.3, 0.56),
  horizonColor: new Vector3(0.52, 0.72, 0.85),
  hazeColor: new Vector3(0.72, 0.84, 0.9),
  sunColor: new Vector3(1, 0.98, 0.92),
  gradientFalloff: 1.6,
  hazeHeight: 0.1,
  mieStrength: 0.4,
  mieFalloff: 9,
  intensity: 1.25,
});

const CLOUDS = defaultCloudParams({
  bottom: 700,
  top: 1900,
  coverage: 1.25,
  density: 1.5,
  cloudType: 0.82,
  // Looking straight up, the whole frame maps to a patch of sky only a couple
  // of kilometres across, so both the weather system and the clouds themselves
  // have to be small enough for that patch to hold a field of them rather than
  // one lump — which is what the reference shows: scattered cumulus across the
  // entire frame with deep blue between.
  weatherScale: 2600,
  shapeScale: 750,
  detailScale: 110,
  detailStrength: 0.45,
  sunDirection: SUN.clone(),
  sunColor: new Vector3(1, 0.98, 0.94),
  sunIntensity: 10,
  ambientTop: new Vector3(0.66, 0.78, 0.9),
  ambientBottom: new Vector3(0.42, 0.55, 0.68),
  forwardScatter: 0.74,
  backScatter: -0.22,
  scatterBlend: 0.5,
  extinction: 0.09,
  powder: 0.55,
  horizonColor: new Vector3(0.8, 0.88, 0.93),
});

const GRADE = defaultGrade({
  exposure: -0.55,
  contrast: 0.3,
  contrastPivot: 0.46,
  saturation: 1.22,
  // The teal push: cyan into the highlights, a cold lift in the shadows, and
  // the red channel pulled down across the board.
  lift: new Vector3(-0.012, 0.004, 0.022),
  gain: new Vector3(0.9, 1.01, 1.03),
  gamma: new Vector3(0.98, 1.0, 1.02),
  tint: new Vector3(0.82, 1.04, 1.06),
  tintAmount: 0.55,
  vignette: 0.32,
  vignetteSoftness: 0.45,
  grain: 0.018,
  grainScale: 1.2,
  chromaticAberration: 1.4,
});

const createFactory = (): StageFactory => async (ctx) => {
    const rig = createShotRig({
      ctx,
      sky: SKY,
      clouds: CLOUDS,
      grade: GRADE,
      camera: { fov: 48, near: 1, far: 90000 },
      world: {
        radius: 42000,
        // Keyed low on purpose: the aircraft's underside should be lit by sky
        // alone, so the sun contributes almost nothing to what the lens sees.
        sunIntensity: 1.1,
        fillIntensity: 0.3,
        groundColor: new Vector3(0.1, 0.13, 0.16),
        environmentIntensity: 0.3,
      },
    });

    // Keyed right down: looking up at the underside with the sun almost behind
    // it, the aircraft should be reading as a shape, not as a lit surface.
    const jet = await createJet({ environmentIntensity: 0.28 });
    rig.world.scene.add(jet.object);

    const jetPosition = new Vector3();
    const camera = rig.camera;

    const update = (frame: number) => {
      const t = frame / (ctx.durationInFrames - 1);
      const seconds = frame / ctx.fps;

      // Lying on the ground looking up. Ninety degrees exactly would be a
      // gimbal singularity, so the rig stops a couple of degrees short and
      // makes up the difference with yaw.
      camera.position.set(0, 1.4, 0);
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        MathUtils.degToRad(87.5) + drift(seconds * 0.4, 3.9) * 0.0022,
        MathUtils.degToRad(-8 + easeInOutSine(t) * 5) + drift(seconds * 0.33, 8.1) * 0.0024,
        MathUtils.degToRad(6 - easeInOutSine(t) * 11) + drift(seconds * 0.26, 2.6) * 0.0016,
      );

      // Crossing the zenith on a diagonal and receding, so it shrinks towards
      // the end of the shot exactly as it does in the reference.
      const progress = range(frame, -14, ctx.durationInFrames + 22);
      jetPosition.set(
        // About 150m up rather than a kilometre and a half. Measured against
        // the reference the aircraft spans a quarter of frame width, which for
        // a 60m wingspan on this lens is a low pass almost directly overhead.
        MathUtils.lerp(-210, 240, progress),
        MathUtils.lerp(140, 178, progress),
        MathUtils.lerp(96, -150, progress),
      );
      jet.setAttitude(jetPosition, MathUtils.degToRad(-58), 0.01, MathUtils.degToRad(3), seconds);

      rig.setCloudWind(seconds * 14, 0, seconds * -21);
    };

    return rig.toStage(update, () => {
      jet.dispose();
    });
  };

export const Shot05OverheadSilhouette: React.FC<{ readonly resolution: ResolutionKey }> = ({
  resolution,
}) => {
  const quality = QUALITY[resolution];
  const factory = React.useMemo(() => createFactory(), []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeStage factory={factory} quality={quality} />
    </AbsoluteFill>
  );
};
