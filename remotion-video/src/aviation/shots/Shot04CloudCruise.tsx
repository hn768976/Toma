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

// High and well behind the aircraft. The reference has no sun in frame at all:
// the light is diffuse, scattered through the haze above a solid deck, and the
// brightest part of the sky is a broad glow rather than a disc.
const SUN = new Vector3(-0.42, 0.62, 0.66).normalize();

const SKY = defaultSky({
  sunDirection: SUN.clone(),
  // Bright, high-key and almost colourless — a luminous white-grey that lifts
  // towards the top of frame. Not the golden hour this shot used to be.
  zenithColor: new Vector3(0.42, 0.52, 0.66),
  horizonColor: new Vector3(0.9, 0.92, 0.94),
  hazeColor: new Vector3(0.95, 0.96, 0.97),
  sunColor: new Vector3(1, 0.97, 0.92),
  gradientFalloff: 1.7,
  hazeHeight: 0.07,
  mieStrength: 0.5,
  mieFalloff: 3,
  // No disc. A sun this size in frame is the single most artificial thing the
  // shot had, and the reference does not have one.
  sunDiscIntensity: 0,
  sunDiscFalloff: 2600,
  intensity: 1.05,
});

const CLOUDS = defaultCloudParams({
  // A solid deck the aircraft is flying just above, not a scattering of
  // islands: coverage is effectively total, and the shapes are sized so the
  // surface reads as a rolling carpet rather than separate clouds.
  bottom: 2000,
  top: 3255,
  coverage: 1.05,
  density: 2.6,
  cloudType: 0.45,
  weatherScale: 14000,
  shapeScale: 1500,
  detailScale: 190,
  detailStrength: 0.3,
  sunDirection: SUN.clone(),
  sunColor: new Vector3(1, 0.98, 0.94),
  // Cloud tops have to out-read the sky behind them. The phase function
  // normalises by 4pi, so the key needs to be numerically large before a lit
  // top comes out brighter than the haze it sits against.
  sunIntensity: 26,
  // Low enough that the deck keeps its form. Lit this flat, a solid overcast
  // top reads as white paper rather than as cloud.
  ambientTop: new Vector3(0.36, 0.4, 0.48),
  ambientBottom: new Vector3(0.15, 0.17, 0.24),
  forwardScatter: 0.82,
  backScatter: -0.3,
  scatterBlend: 0.7,
  extinction: 0.13,
  powder: 0.55,
  lightMarchDistance: 1000,
  horizonFade: 0.016,
  horizonColor: new Vector3(0.82, 0.84, 0.87),
});

const GRADE = defaultGrade({
  exposure: -1.15,
  contrast: 0.2,
  contrastPivot: 0.46,
  // Nearly monochrome. What colour there is sits in the shadowed cloud, which
  // goes slightly blue against the warm-white haze.
  saturation: 0.82,
  lift: new Vector3(0.004, 0.008, 0.016),
  gain: new Vector3(1.0, 1.0, 1.005),
  gamma: new Vector3(1, 1, 1),
  vignette: 0.16,
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
        sunIntensity: 3.0,
        // The deck below is a huge white reflector, so the airframe is lit from
        // underneath almost as much as from above.
        fillIntensity: 1.1,
        groundColor: new Vector3(0.78, 0.8, 0.84),
        environmentIntensity: 1.3,
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
      jetPosition.set(0, 3390 + drift(seconds * 0.4, 2.7) * 6, -travelled);
      jet.setAttitude(
        jetPosition,
        0,
        MathUtils.degToRad(1.1),
        MathUtils.degToRad(-1.6 + smootherstep(t) * 3.4),
        seconds,
      );

      // Chase position in the aircraft's own frame: bearing swings aft, the
      // camera settles a little above the wing line, and closes slightly.
      // Close enough for the aircraft to be the subject. Measured against the
      // reference it spans about three quarters of frame width, which on this
      // lens puts the chase plane around sixty metres off the wingtip.
      const bearing = MathUtils.degToRad(MathUtils.lerp(98, 146, smootherstep(t)));
      const distance = MathUtils.lerp(72, 58, easeInOutSine(t));
      // Sitting above the aircraft and looking a little under it tips the deck
      // into the lower two thirds of frame, where the reference keeps it.
      const rise = MathUtils.lerp(4, 16, smootherstep(t));
      cameraPosition.set(
        jetPosition.x + Math.sin(bearing) * distance,
        jetPosition.y + rise + drift(seconds * 0.55, 6.6) * 0.9,
        jetPosition.z + Math.cos(bearing) * distance,
      );
      camera.position.copy(cameraPosition);
      camera.lookAt(
        jetPosition.x + drift(seconds * 0.3, 1.1) * 1.4,
        jetPosition.y - 1,
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
