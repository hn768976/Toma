import { Group, Mesh, MeshStandardMaterial, Vector3, type Material } from "three/webgpu";
import { loadModel } from "../three/assets";
import { drift } from "../three/easing";

/**
 * The airliner, rigged so a shot can fly it rather than pose it.
 *
 * The supplied model is textured — base colour, metallic-roughness and normal —
 * so its material is used as delivered rather than replaced with a procedural
 * one. The only adjustment is environment intensity, because these six skies
 * range from overcast to golden hour and the airframe has to sit in each.
 *
 * `setAttitude` takes the three things a shot actually wants to say — where the
 * aircraft is, which way it is heading, and how it is banked — and adds the
 * low-frequency wallow every real aircraft has in cruise. That drift is what
 * stops a CG aeroplane looking like it is on a wire.
 */

export type Jet = {
  readonly object: Group;
  /** Wingspan in metres. */
  readonly span: number;
  readonly length: number;
  /**
   * Places the aircraft.
   *
   * @param position world position of the centroid
   * @param heading  yaw in radians; 0 flies towards −Z
   * @param pitch    nose-up angle in radians
   * @param bank     roll in radians, positive right wing down
   * @param time     seconds, for the low-frequency wallow
   */
  setAttitude(position: Vector3, heading: number, pitch: number, bank: number, time: number): void;
  dispose(): void;
};

export const createJet = async (
  options: { readonly environmentIntensity?: number } = {},
): Promise<Jet> => {
  const model = await loadModel("skyliner");
  const span = model.size.x;
  const length = model.size.z;

  const material: Material =
    model.material ?? new MeshStandardMaterial({ color: 0xd8dade, roughness: 0.32, metalness: 0.2 });
  if (material instanceof MeshStandardMaterial) {
    material.envMapIntensity = options.environmentIntensity ?? 1;
  }

  const mesh = new Mesh(model.geometry, material);
  mesh.castShadow = true;
  const object = new Group();
  object.add(mesh);
  object.rotation.order = "YXZ";

  return {
    object,
    span,
    length,
    setAttitude(position, heading, pitch, bank, time) {
      object.position.copy(position);
      // Yaw, then pitch, then roll — the order an attitude is actually built.
      object.rotation.y = heading + drift(time * 0.21, 3.1) * 0.004;
      object.rotation.x = pitch + drift(time * 0.17, 7.7) * 0.0035;
      object.rotation.z = bank + drift(time * 0.13, 1.3) * 0.006;
    },
    dispose() {
      material.dispose();
    },
  };
};
