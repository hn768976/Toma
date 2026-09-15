// Builds and drives the arch material.
//
// `ArchLook` is the full clinical state of the arch at one instant. Every
// version animates the same struct, which is why a "treatment" shot is
// literally the reverse of a "disease" shot rather than a separate scene.

import { Color, DoubleSide, Quaternion, ShaderMaterial, Vector3 } from "three";
import { ARCH_FRAGMENT_SHADER, ARCH_VERTEX_SHADER } from "./archShader";
import { LightRig, TISSUE } from "./palette";

export type ArchLook = {
  /** Gum-margin offset in model units. Negative recedes and exposes root. */
  gumLine: number;
  /** Softness of the gum/enamel transition. */
  gumBlend: number;
  /** Gingival oedema, as a normal-direction swell. */
  swell: number;
  /** Arch angle the swelling centres on, -1 (rear left) .. 1 (rear right). */
  swellCenter: number;
  swellWidth: number;

  stain: number;
  plaque: number;
  tartar: number;
  inflammation: number;
  inflamCenter: number;
  inflamWidth: number;
  polish: number;
  wetness: number;

  cavity: number;
  cavityCenter: [number, number, number];
  cavityRadius: number;
  cavityDepth: number;

  shield: number;

  /** Cleaning wavefront: [position in theta, edge half-width, strength]. */
  sweep: [number, number, number];
  /** +1 sweeps left-to-right around the arch, -1 the other way. */
  sweepSign: number;

  highlightTid: number;
  highlightAmount: number;

  /** Distance at which depth haze starts, in world units from the camera. */
  hazeNear: number;
  hazeFar: number;
  hazeStrength: number;
};

export const HEALTHY_LOOK: ArchLook = {
  gumLine: 0,
  gumBlend: 0.013,
  swell: 0,
  swellCenter: 0,
  swellWidth: 0.5,
  stain: 0,
  plaque: 0,
  tartar: 0,
  inflammation: 0,
  inflamCenter: 0,
  inflamWidth: 0.55,
  polish: 0,
  wetness: 0.35,
  cavity: 0,
  cavityCenter: [0, 0, 0],
  cavityRadius: 0.05,
  cavityDepth: 0.02,
  shield: 0,
  sweep: [0, 0.2, 0],
  sweepSign: 1,
  highlightTid: -1,
  highlightAmount: 0,
  hazeNear: 0.7,
  hazeFar: 2.2,
  hazeStrength: 0,
};

export const look = (overrides: Partial<ArchLook>): ArchLook => ({
  ...HEALTHY_LOOK,
  ...overrides,
});

const c = (hex: string) => new Color(hex);

export const createArchMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader: ARCH_VERTEX_SHADER,
    fragmentShader: ARCH_FRAGMENT_SHADER,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uGumLine: { value: 0 },
      uGumBlend: { value: 0.013 },
      uSwell: { value: 0 },
      uSwellCenter: { value: 0 },
      uSwellWidth: { value: 0.5 },

      uEnamelColor: { value: c(TISSUE.enamel) },
      uDentinColor: { value: c(TISSUE.dentin) },
      uRootColor: { value: c(TISSUE.root) },
      uGumColor: { value: c(TISSUE.gum) },
      uGumDeepColor: { value: c(TISSUE.gumDeep) },
      uInflamColor: { value: c(TISSUE.inflamed) },
      uStainColor: { value: c(TISSUE.stain) },
      uPlaqueColor: { value: c(TISSUE.plaque) },
      uTartarColor: { value: c(TISSUE.tartar) },
      uCariesColor: { value: c(TISSUE.caries) },

      uStain: { value: 0 },
      uPlaque: { value: 0 },
      uTartar: { value: 0 },
      uInflammation: { value: 0 },
      uInflamCenter: { value: 0 },
      uInflamWidth: { value: 0.55 },
      uPolish: { value: 0 },
      uWetness: { value: 0.35 },

      uCavity: { value: 0 },
      uCavityCenter: { value: new Vector3() },
      uCavityRadius: { value: 0.05 },
      uCavityDepth: { value: 0.02 },

      uShield: { value: 0 },
      uShieldColor: { value: c(TISSUE.shield) },

      uSweep: { value: new Vector3(0, 0.2, 0) },
      uSweepSign: { value: 1 },

      uHighlightTid: { value: -1 },
      uHighlightAmount: { value: 0 },
      uHighlightColor: { value: c(TISSUE.highlight) },

      uKeyDir: { value: new Vector3() },
      uKeyColor: { value: new Color() },
      uFillDir: { value: new Vector3() },
      uFillColor: { value: new Color() },
      uRimDir: { value: new Vector3() },
      uRimColor: { value: new Color() },
      uSkyColor: { value: new Color() },
      uGroundColor: { value: new Color() },
      uExposure: { value: 1 },

      uLightSize: { value: 0.16 },
      uEnvStrength: { value: 1.0 },

      uHazeColor: { value: new Color("#ffffff") },
      uHazeNear: { value: 0.7 },
      uHazeFar: { value: 2.2 },
      uHazeStrength: { value: 0 },
    },
  });

export const applyLook = (
  material: ShaderMaterial,
  state: ArchLook,
  rig: LightRig,
  timeInSeconds: number,
  hazeColor?: string,
  /** Camera orientation, required when the rig is in view space. */
  viewOrientation?: Quaternion,
) => {
  const u = material.uniforms;
  u.uTime.value = timeInSeconds;
  u.uGumLine.value = state.gumLine;
  u.uGumBlend.value = state.gumBlend;
  u.uSwell.value = state.swell;
  u.uSwellCenter.value = state.swellCenter;
  u.uSwellWidth.value = state.swellWidth;

  u.uStain.value = state.stain;
  u.uPlaque.value = state.plaque;
  u.uTartar.value = state.tartar;
  u.uInflammation.value = state.inflammation;
  u.uInflamCenter.value = state.inflamCenter;
  u.uInflamWidth.value = state.inflamWidth;
  u.uPolish.value = state.polish;
  u.uWetness.value = state.wetness;

  u.uCavity.value = state.cavity;
  (u.uCavityCenter.value as Vector3).set(...state.cavityCenter);
  u.uCavityRadius.value = state.cavityRadius;
  u.uCavityDepth.value = state.cavityDepth;

  u.uShield.value = state.shield;
  (u.uSweep.value as Vector3).set(...state.sweep);
  u.uSweepSign.value = state.sweepSign;

  u.uHighlightTid.value = state.highlightTid;
  u.uHighlightAmount.value = state.highlightAmount;

  const orient = (target: Vector3, dir: [number, number, number]) => {
    target.set(...dir).normalize();
    if (rig.space === "camera" && viewOrientation) {
      target.applyQuaternion(viewOrientation);
    }
  };
  orient(u.uKeyDir.value as Vector3, rig.keyDir);
  (u.uKeyColor.value as Color).set(rig.keyColor).multiplyScalar(rig.keyIntensity);
  orient(u.uFillDir.value as Vector3, rig.fillDir);
  (u.uFillColor.value as Color).set(rig.fillColor).multiplyScalar(rig.fillIntensity);
  orient(u.uRimDir.value as Vector3, rig.rimDir);
  (u.uRimColor.value as Color).set(rig.rimColor).multiplyScalar(rig.rimIntensity);
  (u.uSkyColor.value as Color).set(rig.skyColor).multiplyScalar(rig.skyIntensity);
  (u.uGroundColor.value as Color)
    .set(rig.groundColor)
    .multiplyScalar(rig.groundIntensity);
  u.uExposure.value = rig.exposure;
  u.uLightSize.value = rig.lightSize;
  u.uEnvStrength.value = rig.envStrength;

  u.uHazeNear.value = state.hazeNear;
  u.uHazeFar.value = state.hazeFar;
  u.uHazeStrength.value = state.hazeStrength;
  if (hazeColor) {
    (u.uHazeColor.value as Color).set(hazeColor);
  }
};
