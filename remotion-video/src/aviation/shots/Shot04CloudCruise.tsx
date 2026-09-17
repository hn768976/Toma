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
import { createRidge } from "../props/ridge";
import { drift, easeInOutSine, smootherstep } from "../three/easing";

/**
 * Shot 4 — Cloud Cruise. 151 frames (5.03s at 30fps).
 *
 * The one hero shot of the aircraft, and the shortest: five seconds of a
 * widebody in the cruise above a lit cloud deck, with the camera swinging from
 * side-on to a rear three-quarter as mountains come up through the deck ahead.
 *
 * The camera flies in formation rather than orbiting a fixed point — it holds
 * station on the aircraft while its bearing changes, which is what a chase
 * aircraft actually does and why the background slides while the subject stays
 * put in frame. Because both are moving at cruise speed, the cloud deck below
 * is the only thing that reports the motion; it has to be real geometry in the
 * march, not a texture, or the whole shot dies.
 */

const SUN = new Vector3(-0.58, 0.2, 0.79).normalize();

const SKY = defaultSky({
  sunDirection: SUN.clone(),
  // Late afternoon at altitude: the zenith stays deep, the band above the deck
  // goes gold, and everything between is haze.
  zenithColor: new Vector3(0.06, 0.14, 0.36),
  horizonColor: new Vector3(0.55, 0.37, 0.25),
  hazeColor: new Vector3(0.52, 0.36, 0.25),
  sunColor: new Vector3(1, 0.82, 0.58),
  gradientFalloff: 1.5,
  hazeHeight: 0.045,
  mieStrength: 0.38,
  mieFalloff: 4.5,
  sunDiscIntensity: 6,
  sunDiscFalloff: 2600,
  intensity: 0.95,
});

const CLOUDS = defaultCloudParams({
  bottom: 850,
  top: 2250,
  coverage: 0.92,
  density: 1.8,
  cloudType: 0.5,
  weatherScale: 28000,
  shapeScale: 3000,
  detailScale: 340,
  detailStrength: 0.34,
  sunDirection: SUN.clone(),
  sunColor: new Vector3(1, 0.84, 0.62),
  sunIntensity: 6,
  ambientTop: new Vector3(0.44, 0.4, 0.44),
  ambientBottom: new Vector3(0.15, 0.15, 0.21),
  forwardScatter: 0.82,
  backScatter: -0.3,
  scatterBlend: 0.7,
  extinction: 0.1,
  powder: 0.5,
  lightMarchDistance: 1000,
  horizonFade: 0.016,
  horizonColor: new Vector3(0.94, 0.82, 0.65),
});

const GRADE = defaultGrade({
  exposure: -1.1,
  contrast: 0.24,
  contrastPivot: 0.44,
  saturation: 1.1,
  // Warm highlights, cool shadows — the standard golden-hour separation.
  lift: new Vector3(0.006, 0.012, 0.03),
  gain: new Vector3(1.03, 0.995, 0.955),
  gamma: new Vector3(1, 0.995, 0.985),
  vignette: 0.2,
  vignetteSoftness: 0.6,
  grain: 0.01,
  chromaticAberration: 0.6,
});

const createFactory = (): StageFactory => async (ctx) => {
    const rig = createShotRig({
      ctx,
      sky: SKY,
      clouds: CLOUDS,
      grade: GRADE,
      camera: { fov: 40, near: 1, far: 120000 },
      world: {
        radius: 55000,
        sunIntensity: 4.6,
        fillIntensity: 0.85,
        groundColor: new Vector3(0.5, 0.48, 0.5),
        environmentIntensity: 1.15,
      },
    });

    const jet = await createJet();
    rig.world.scene.add(jet.object);

    // Peaks well ahead of the aircraft, revealed as the bearing swings round.
    const ridge = createRidge({
      seed: 0x9f4,
      width: 90000,
      depth: 26000,
      relief: 3900,
      baseHeight: -200,
      snowLine: 2300,
    });
    ridge.object.position.set(-4000, 0, -46000);
    rig.world.scene.add(ridge.object);

    const jetPosition = new Vector3();
    const cameraPosition = new Vector3();
    const camera = rig.camera;
    const cruiseSpeed = 235;

    const update = (frame: number) => {
      const t = frame / (ctx.durationInFrames - 1);
      const seconds = frame / ctx.fps;

      // Both aircraft track down −Z at cruise speed.
      const travelled = seconds * cruiseSpeed;
      jetPosition.set(0, 3320 + drift(seconds * 0.4, 2.7) * 6, -travelled);
      jet.setAttitude(
        jetPosition,
        0,
        MathUtils.degToRad(1.1),
        MathUtils.degToRad(-1.6 + smootherstep(t) * 3.4),
        seconds,
      );

      // Chase position in the aircraft's own frame: bearing swings aft, the
      // camera settles a little above the wing line, and closes slightly.
      const bearing = MathUtils.degToRad(MathUtils.lerp(96, 148, smootherstep(t)));
      const distance = MathUtils.lerp(118, 96, easeInOutSine(t));
      const rise = MathUtils.lerp(-4, 16, smootherstep(t));
      cameraPosition.set(
        jetPosition.x + Math.sin(bearing) * distance,
        jetPosition.y + rise + drift(seconds * 0.55, 6.6) * 0.9,
        jetPosition.z + Math.cos(bearing) * distance,
      );
      camera.position.copy(cameraPosition);
      camera.lookAt(
        jetPosition.x + drift(seconds * 0.3, 1.1) * 1.4,
        jetPosition.y + 1.5,
        jetPosition.z,
      );
      // A slow roll on the camera keeps the horizon from sitting dead level.
      camera.rotateZ(MathUtils.degToRad(-1.4 + smootherstep(t) * 2.6));

      // The deck streams past under the aircraft.
      rig.setCloudWind(0, 0, travelled * 0.82);
    };

    return rig.toStage(update, () => {
      jet.dispose();
      ridge.dispose();
    });
  };

export const Shot04CloudCruise: React.FC<{ readonly resolution: ResolutionKey }> = ({
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
