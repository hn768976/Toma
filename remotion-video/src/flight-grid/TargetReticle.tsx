import * as THREE from "three";
import { DepthLines } from "./DepthLines";
import { buildReticle } from "./reticle";
import {
  RETICLE_COLOR,
  RETICLE_DROP,
  RETICLE_GLOW_OPACITY,
  RETICLE_GLOW_WIDTH_PX,
  RETICLE_LINE_WIDTH_PX,
  RETICLE_OPACITY,
  RETICLE_SIZE,
} from "./constants";

// Built once in local space and carried to each aircraft by that
// aircraft's own transform, so the square lies flat in the aircraft's
// horizontal plane and turns with its heading.
const RETICLE_BATCH = buildReticle();

export type TargetReticleProps = {
  /** The aircraft's world transform. */
  matrix: THREE.Matrix4;
  /** Wingspan in world units; the bracket is a multiple of it. */
  wingspan: number;
  /** Blink envelope times any fade on the aircraft it belongs to. */
  opacity: number;
  resolution: [number, number];
  resolutionScale: number;
  near: number;
};

export const TargetReticle: React.FC<TargetReticleProps> = ({
  matrix,
  wingspan,
  opacity,
  resolution,
  resolutionScale,
  near,
}) => {
  if (opacity <= 0) return null;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  matrix.decompose(position, quaternion, new THREE.Vector3());

  // Drop it along the aircraft's own vertical, so it stays under the jet
  // however the jet is banked.
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  position.addScaledVector(up, -wingspan * RETICLE_DROP);

  const common = {
    batch: RETICLE_BATCH,
    resolution,
    // No shader defocus. The hero sits on the focal plane, and a
    // companion's reticle is blurred by its layer's CSS filter along with
    // the aircraft it belongs to — running both would double-blur it.
    focus: 1,
    bokehK: 0,
    maxCocPx: 0,
    // Unfogged, unlike the graticule. The bracket is a readout drawn over
    // the scene, not something sitting in its atmosphere — at the hero's
    // ~200 unit range the scene fog would otherwise halve it, and the red
    // never reaches the saturated rgb(255, 0, 0) the reference holds.
    fogDensity: 0,
    color: RETICLE_COLOR,
    near,
    position: [position.x, position.y, position.z] as [number, number, number],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [
      number,
      number,
      number,
      number,
    ],
    scale: wingspan * RETICLE_SIZE,
  };

  // Glow first, then the core on top. Both blend additively, so the two
  // sum into a bright line inside a soft halo.
  return (
    <>
      <DepthLines
        {...common}
        widthPx={RETICLE_GLOW_WIDTH_PX * resolutionScale}
        opacity={RETICLE_GLOW_OPACITY * opacity}
        renderOrder={11}
      />
      <DepthLines
        {...common}
        widthPx={RETICLE_LINE_WIDTH_PX * resolutionScale}
        opacity={RETICLE_OPACITY * opacity}
        renderOrder={12}
      />
    </>
  );
};
