import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {SAMPLE_SPACING, TRACK_LENGTH, trackAt} from './track';

/** Nearest slot, just behind the camera. */
const Z_NEAR = -3;
/** Furthest slot. Past the grid's fade, so the waveform dissolves with it. */
const Z_FAR = 40;

export const INSTANCE_COUNT = Math.round((Z_FAR - Z_NEAR) / SAMPLE_SPACING);

/**
 * Lateral offset of the waveform's centre line from the world axis.
 *
 * Positive puts it on screen *left*: a camera made to look along +Z is rotated
 * 180 degrees about Y, so world +X ends up on the right-hand side of the
 * viewer's left. The waveform has to start bottom-left to recede to the upper
 * right, which is the diagonal the reference runs.
 */
export const WAVE_X = 1.6;

/**
 * The waveform: one instanced mesh of thin quads lying flat on the plane, each
 * spanning -h..+h across it so the row reads as a classic mirrored waveform.
 *
 * One InstancedMesh rather than one object per line — at ~750 samples a mesh
 * each, the draw-call count alone would dominate the frame.
 *
 * The instances never move between slots. Each frame a slot is nudged back by
 * the sub-sample remainder of the scroll and re-reads a different sample; when
 * the remainder wraps, the whole assignment shifts by one. That is what lets
 * the scroll be continuous while the geometry stays a fixed lattice.
 */
export const Waveform: React.FC<{
  /** Distance scrolled, in world units. */
  scroll: number;
  cameraPosition: THREE.Vector3;
  color: THREE.Color;
  /** Height above (or below, for the reflection) the plane. */
  y: number;
  /** Thickness of each line along Z, in world units. */
  thickness: number;
  /** Multiplies sample height — used to swell the glow copy. */
  heightScale: number;
  /** Multiplies emitted colour. */
  gain: number;
  /**
   * Fade the quad out toward its ends instead of drawing a flat slab. An
   * additive quad at 2x height reads as a wider band, not as a glow; the falloff
   * is what makes the halo look like light.
   */
  soft?: boolean;
  renderOrder: number;
  fadeStart: number;
  fadeEnd: number;
}> = ({
  scroll,
  cameraPosition,
  color,
  y,
  thickness,
  heightScale,
  gain,
  renderOrder,
  fadeStart,
  fadeEnd,
  soft = false,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  // Rotate the quad into the XZ plane once, on the geometry, so per-instance
  // scale maps straight onto world width and thickness.
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  // A bell across the quad's width. PlaneGeometry lays u along local X, which
  // after the rotation above is the waveform's height axis — so this is a
  // falloff from the centre line out to the tips.
  const falloff = useMemo(() => {
    const size = 128;
    const data = new Uint8Array(size * 4);
    for (let i = 0; i < size; i++) {
      const t = (i + 0.5) / size;
      const edge = Math.abs(t * 2 - 1);
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = Math.round(Math.pow(1 - edge, 2.2) * 255);
    }
    const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: soft ? falloff : null,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [soft, falloff],
  );

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }

    const step = Math.floor(scroll / SAMPLE_SPACING);
    const remainder = scroll - step * SAMPLE_SPACING;

    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const z = Z_NEAR + i * SAMPLE_SPACING - remainder;
      const half = trackAt(i + step) * heightScale;

      scratch.position.set(WAVE_X, y, z);
      scratch.scale.set(half * 2, 1, thickness);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);

      // Additive blending means fading the colour toward black is the fade.
      const dx = WAVE_X - cameraPosition.x;
      const dy = y - cameraPosition.y;
      const dz = z - cameraPosition.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const far =
        1 - Math.min(1, Math.max(0, (dist - fadeStart) / (fadeEnd - fadeStart)));
      // Nearest lines lose a little punch, standing in for a shallow DoF.
      const near = Math.min(1, 0.45 + 0.55 * Math.min(1, dist / 4.5));
      const k = gain * far * far * near;

      scratch.color.copy(color).multiplyScalar(k);
      mesh.setColorAt(i, scratch.color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, INSTANCE_COUNT]}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  );
};

export {TRACK_LENGTH};
