import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { createCellEmissiveTexture } from "./assets";
import { cellPosition, normalizeDirection, type Cell, type Volume } from "./flow";
import type { BloodLook } from "./looks";

type Props = {
  look: BloodLook;
  geometry: THREE.BufferGeometry;
  /** Pre-placed cells. Placement is done once for the whole population so the
   * hero and swarm draw calls cannot overlap each other. */
  cells: Cell[];
  volume: Volume;
  /** Disc thickness as a fraction of diameter. Always below 1, which is what
   * keeps the bounding sphere equal to the cell radius used at placement. */
  thickness?: number;
  /** Renders flat white on black for the alpha-matte pass. */
  matte?: boolean;
};

const scratch = new THREE.Object3D();
const scratchPosition = new THREE.Vector3();

/**
 * A population of slowly turning red blood cells.
 *
 * All instances share one draw call, and every frame is recomputed from the
 * current time alone — nothing depends on the previous frame having been
 * rendered, which is what lets Remotion render frames out of order across
 * several browser tabs.
 *
 * Note there is no per-cell size animation here. Scale is fixed at the radius
 * the cell was placed with, so the spacing established at placement is exactly
 * the spacing on screen.
 */
export const CellField: React.FC<Props> = ({
  look,
  geometry,
  cells,
  volume,
  thickness = 0.72,
  matte = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const direction = useMemo(() => normalizeDirection(look.flowDirection), [look.flowDirection]);

  const material = useMemo(() => {
    if (matte) {
      return new THREE.MeshBasicMaterial({ color: "#ffffff" });
    }
    // The emissive map carries both the ambient inner glow and the gold
    // speckles, so a single emissive slot covers both looks.
    const glow = new THREE.Color(look.cellEmissive).multiplyScalar(
      look.cellEmissiveIntensity * (0.55 + 0.45 * look.translucency),
    );
    return new THREE.MeshPhongMaterial({
      color: "#ffffff",
      emissive: "#ffffff",
      emissiveMap: createCellEmissiveTexture(glow.getStyle(), look.speckleColor, look.speckle),
      specular: new THREE.Color(look.specular).multiplyScalar(0.3 + 0.7 * look.translucency),
      shininess: look.shininess,
    });
  }, [
    matte,
    look.cellEmissive,
    look.cellEmissiveIntensity,
    look.translucency,
    look.speckleColor,
    look.speckle,
    look.specular,
    look.shininess,
  ]);

  const mesh = useMemo(() => {
    const instanced = new THREE.InstancedMesh(geometry, material, Math.max(1, cells.length));
    // Instances are repositioned every frame, so three's cached bounds are
    // always stale — culling against them would drop cells at frame edges.
    instanced.frustumCulled = false;
    const color = new THREE.Color();
    for (let i = 0; i < cells.length; i++) {
      color.copy(matte ? new THREE.Color("#ffffff") : cells[i].tint);
      instanced.setColorAt(i, color);
    }
    if (instanced.instanceColor) {
      instanced.instanceColor.needsUpdate = true;
    }
    return instanced;
  }, [geometry, material, cells, matte]);

  useLayoutEffect(() => {
    return () => {
      mesh.dispose();
      material.dispose();
    };
  }, [mesh, material]);

  // Layout effect, not effect: @remotion/three advances the renderer in a
  // passive effect, and layout effects flush first — so the matrices written
  // here are the ones drawn for this frame, not the previous one.
  useLayoutEffect(() => {
    const instanced = meshRef.current;
    if (!instanced) {
      return;
    }
    const time = frame / fps;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cellPosition(cell, time, direction, look.flowSpeed, volume, scratchPosition);

      scratch.position.copy(scratchPosition);
      scratch.rotation.set(
        cell.rot[0] + time * cell.spin[0],
        cell.rot[1] + time * cell.spin[1],
        cell.rot[2] + time * cell.spin[2],
      );
      // Round face, squashed thickness — a disc, not a ball.
      scratch.scale.set(cell.size, cell.size, cell.size * thickness);
      scratch.updateMatrix();
      instanced.setMatrixAt(i, scratch.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;
  }, [frame, fps, cells, direction, look.flowSpeed, volume, thickness]);

  return <primitive ref={meshRef} object={mesh} />;
};
