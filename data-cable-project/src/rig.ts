import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Texture,
  TubeGeometry,
  Vector3,
} from "three";
import { CableMaterialConfig, createCableMaterial } from "./cableMaterial";
import { buildRibbonGeometry } from "./geometry";
import { LookConfig, StrandDef } from "./looks";

export type RigEntry = {
  def: StrandDef;
  geometry: BufferGeometry;
  material: ShaderMaterial;
};

/**
 * One BufferGeometry per strand -- not one per segment. A 22-cable rack built
 * segment-by-segment would be hundreds of draw calls for nothing.
 */
const buildGeometry = (def: StrandDef): BufferGeometry =>
  def.kind === "cable"
    ? new TubeGeometry(def.curve, def.segsU, def.size, def.segsV, false)
    : buildRibbonGeometry(def.curve, def.size, def.arcDeg, def.segsU, def.segsV);

export const buildRig = (
  config: LookConfig,
  digits: Texture,
  opts: { mirrored: boolean } = { mirrored: false },
): RigEntry[] => {
  const { palette, shading } = config;
  const dim = opts.mirrored ? (config.ground?.intensity ?? 0.2) : 1;

  return config.strands.map((def) => {
    const cfg: CableMaterialConfig = {
      baseColor: palette.base,
      glowColor: palette.glow,
      rimColor: palette.rim,
      baseIntensity: shading.baseIntensity * def.intensity * dim,
      digitIntensity: shading.digitIntensity * def.intensity * dim,
      rimIntensity: shading.rimIntensity * def.intensity * dim,
      rimPower: shading.rimPower,
      repeatU: def.repeatU,
      repeatV: def.repeatV,
      maskPeriods: def.maskPeriods,
      maskDepth: def.maskDepth,
      maskSoftness: shading.maskSoftness,
      maskBias: shading.maskBias,
      shadeAmount: shading.shadeAmount,
      fadeStart: opts.mirrored ? (config.ground?.fade ?? 1) * 3 : 0,
      fadeEnd: opts.mirrored ? (config.ground?.fade ?? 1) * 9 : 0,
      // Mirroring flips the winding order, so the reflection must be two-sided.
      doubleSided: opts.mirrored || def.kind === "ribbon",
    };
    return {
      def,
      geometry: buildGeometry(def),
      material: createCableMaterial(digits, cfg),
    };
  });
};

export type CollarPlacement = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
};

const Y_AXIS = new Vector3(0, 1, 0);

/** Regularly spaced collars along every cable that asks for them. */
export const buildCollarPlacements = (config: LookConfig): CollarPlacement[] => {
  const out: CollarPlacement[] = [];
  for (const def of config.strands) {
    if (def.collarCount <= 0) continue;
    for (let k = 0; k < def.collarCount; k++) {
      const t = (k + 0.5) / def.collarCount;
      const point = def.curve.getPointAt(t);
      const tangent = def.curve.getTangentAt(t).normalize();
      const q = new Quaternion().setFromUnitVectors(Y_AXIS, tangent);
      out.push({
        position: [point.x, point.y, point.z],
        quaternion: [q.x, q.y, q.z, q.w],
      });
    }
  }
  return out;
};

export const collarRadius = (config: LookConfig) => {
  const cable = config.strands.find((s) => s.kind === "cable");
  return cable ? cable.size : 0.34;
};

export const COLLAR_RADIUS_SCALE = 1.16;
export const COLLAR_LENGTH_SCALE = 1.5;

export const makeCollarGeometry = (radius: number) =>
  new CylinderGeometry(
    radius * COLLAR_RADIUS_SCALE,
    radius * COLLAR_RADIUS_SCALE,
    radius * COLLAR_LENGTH_SCALE,
    28,
    1,
    false,
  );

/**
 * The lit ring at a collar's edge. The references show a bright band of the
 * cable's own colour where the glowing body meets the fitting, and it is a
 * large part of what makes these read as hardware. It has to sit proud of the
 * collar -- inside its radius it is simply invisible.
 */
export const makeCollarRingGeometry = (radius: number) =>
  new CylinderGeometry(
    radius * (COLLAR_RADIUS_SCALE + 0.05),
    radius * (COLLAR_RADIUS_SCALE + 0.05),
    radius * 0.11,
    28,
    1,
    true,
  );

/** Offsets of the two glowing rings, just inside either end of a collar. */
export const collarRingOffsets = (radius: number): number[] => [
  -radius * (COLLAR_LENGTH_SCALE / 2 - 0.1),
  radius * (COLLAR_LENGTH_SCALE / 2 - 0.1),
];

export { DoubleSide, Euler, Matrix4 };
