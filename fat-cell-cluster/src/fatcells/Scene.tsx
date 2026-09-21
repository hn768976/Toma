/**
 * The scene, assembled from a look row.
 *
 * Every value here is derived from `useCurrentFrame()` — there is no clock, no
 * delta accumulation and no state carried between frames. Uniforms are written
 * during render from the frame alone, so rendering any frame on its own gives
 * the same result as rendering it inside a full sequential pass.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DepthOfField, EffectComposer } from "@react-three/postprocessing";
import { Background } from "./Background";
import { BuiltScene, ClusterInstance, getScene } from "./build";
import { createCellMaterial } from "./CellMaterial";
import { createMembraneMaterial } from "./MembraneMaterial";
import { Fibres } from "./Fibres";
import { Grain } from "./Grain";
import { LOOP_FRAMES } from "./constants";
import { LookRow } from "./looks";
import { deflationAt, driftAt, spinAt } from "./motion";
import { Specks } from "./Specks";

/** Folds at full collapse, as a fraction of what is left of the cell. */
const FOLD_AMPLITUDE = 0.52;
/** Whole turns of the fold field over the clip, so the folds travel. */
const FOLD_TURNS = 1;

const axisQuaternion = (
  axis: [number, number, number],
  angle: number,
): [number, number, number, number] => {
  const l = Math.hypot(...axis) || 1;
  const s = Math.sin(angle / 2);
  return [(axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s, Math.cos(angle / 2)];
};

/**
 * A cluster that does not deflate: one rigid mesh, spinning a whole number of
 * turns about a fixed axis and drifting on a closed path.
 */
const ClusterMesh: React.FC<{
  instance: ClusterInstance;
  material: THREE.ShaderMaterial;
  t: number;
}> = ({ instance, material, t }) => {
  const d = driftAt(instance.drift, t);
  return (
    <mesh
      geometry={instance.geometry}
      material={material}
      position={[
        instance.position[0] + d[0],
        instance.position[1] + d[1],
        instance.position[2] + d[2],
      ]}
      quaternion={axisQuaternion(instance.spin.axis, spinAt(instance.spin, t))}
      scale={instance.scale}
    />
  );
};

/**
 * A cluster that deflates. Each cell is its own mesh: the shrink is the
 * object's scale, so the folds — which are in the cell's local space — deepen
 * in proportion to what is left of it, and an emptied cell simply drifts away
 * from its neighbours instead of dragging a crease behind it.
 */
const DeflatingCluster: React.FC<{
  instance: ClusterInstance;
  materials: THREE.ShaderMaterial[];
  t: number;
}> = ({ instance, materials, t }) => {
  const d = driftAt(instance.drift, t);
  const meshes = instance.cellMeshes ?? [];
  return (
    <group
      position={[
        instance.position[0] + d[0],
        instance.position[1] + d[1],
        instance.position[2] + d[2],
      ]}
      scale={instance.scale}
    >
      {meshes.map((m, i) => {
        const u = deflationAt(m.deflation, t);
        // r(u) = r0 * (1 - shrink * u)
        const s = 1 - (1 - m.residual) * u;
        const material = materials[i];
        // amp(u) = A * u^2. Quadratic matters: a cell that crumples linearly
        // looks like it is being crushed from outside, while one that stays
        // smooth until it is well down in volume and then folds looks like it
        // is emptying.
        material.uniforms.uCrumple.value = FOLD_AMPLITUDE * u * u * m.cell.r;
        material.uniforms.uFoldAngle.value = Math.PI * 2 * FOLD_TURNS * t;
        // Fragments drift and tumble once they have finished emptying.
        const release = Math.max(0, Math.min(1, (u - 0.68) / 0.32));
        const e = release * release * (3 - 2 * release);
        const fd = driftAt(m.drift, t);
        return (
          <mesh
            key={i}
            geometry={m.geometry}
            material={material}
            position={[
              m.cell.cx + fd[0] * e,
              m.cell.cy + (fd[1] - 1.5 * e) * e,
              m.cell.cz + fd[2] * e,
            ]}
            quaternion={axisQuaternion(m.tumbleAxis, m.tumbleRate * t * e)}
            scale={s}
          />
        );
      })}
    </group>
  );
};

export const Scene: React.FC<{ row: LookRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // The loop period, not the composition length: rendering 301 frames to check
  // that the loop closes must not change what one loop means.
  const t = frame / LOOP_FRAMES;

  const built: BuiltScene = getScene(row);
  const aspect = width / height;

  // One material per drawn mesh. The deflating look needs one per cell, since
  // each cell carries its own fold amplitude.
  const materials = useMemo(
    () =>
      built.clusters.map((c) => {
        const make = () =>
          createCellMaterial(
            {
              color: row.palette.cell,
              deepColor: row.palette.deep,
              rimColor: row.palette.rim,
              rimStrength: row.palette.rimStrength,
              sheenColor: row.palette.sheen,
              sheenStrength: row.palette.sheenStrength,
              roughness: row.palette.roughness,
              specular: row.palette.specular,
              mottleAmp: row.palette.mottleAmp,
              mottleFreq: row.palette.mottleFreq,
              aoStrength: row.palette.aoStrength,
              aoGamma: row.palette.aoGamma,
              cellRadius: 1,
              deflating: Boolean(c.cellMeshes),
            },
            row.lighting,
          );
        return c.cellMeshes
          ? c.cellMeshes.map(() => make())
          : [make()];
      }),
    [built, row],
  );

  const membraneMaterial = useMemo(
    () =>
      built.membrane
        ? createMembraneMaterial(row.palette.sheen, 0.34 * row.membrane, row.lighting)
        : null,
    [built, row],
  );

  const camZ = built.cameraDistance;
  const speckColor = row.kind === "fibre" ? "#cfe2ee" : "#fffaf0";
  // Specks read against a dark or cool field and wash out against a pale one.
  const speckOpacity = row.palette.bgCentre === "#9fb0bd" ? 0.95 : 0.65;

  return (
    <>
      <Background
        centre={row.palette.bgCentre}
        edge={row.palette.bgEdge}
        falloff={row.palette.bgFalloff}
        offset={row.palette.bgOffset}
        distance={camZ + 70}
        fov={row.camera.fov}
        aspect={aspect}
      />

      {built.clusters.map((c, i) =>
        c.cellMeshes ? (
          <DeflatingCluster key={i} instance={c} materials={materials[i]} t={t} />
        ) : (
          <ClusterMesh key={i} instance={c} material={materials[i][0]} t={t} />
        ),
      )}

      {built.membrane && membraneMaterial ? (
        <mesh
          geometry={built.membrane.geometry}
          material={membraneMaterial}
          position={[
            built.clusters[0].position[0] + driftAt(built.clusters[0].drift, t)[0],
            built.clusters[0].position[1] + driftAt(built.clusters[0].drift, t)[1],
            built.clusters[0].position[2] + driftAt(built.clusters[0].drift, t)[2],
          ]}
          quaternion={axisQuaternion(
            built.clusters[0].spin.axis,
            spinAt(built.clusters[0].spin, t),
          )}
          scale={built.clusters[0].scale}
          renderOrder={2}
        />
      ) : null}

      {built.fibres.length > 0 ? (
        <Fibres
          fibres={built.fibres}
          t={t}
          color={row.id.includes("Teal") ? "#b6d4d2" : "#9fb4c4"}
        />
      ) : null}

      {built.specks ? (
        <Specks
          field={built.specks}
          t={t}
          color={speckColor}
          opacity={speckOpacity}
          scale={height * 0.016}
        />
      ) : null}

      <EffectComposer
        multisampling={0}
        // Nothing in this chain accumulates across frames: no TAA, no temporal
        // motion blur, no temporally denoised occlusion. Remotion renders
        // frames out of order, so anything temporal would not survive it.
        enableNormalPass={false}
      >
        <DepthOfField
          // Focus sits on the hero cluster (looks 1, 3, 4) or is pulled
          // forward onto the front tissue layer (look 2).
          worldFocusDistance={camZ - row.dof.focusDistance}
          worldFocusRange={row.dof.focusRange}
          // Blur is quoted for the 2160p master and scaled by the height
          // actually being rendered, so a 1080p preview and a 4K render show
          // the same depth of field rather than the same pixel count.
          bokehScale={(row.dof.bokehScale * height) / 2160}
          resolutionScale={row.dof.resolutionScale}
        />
        <Grain
          amount={row.grain}
          // Periodic over the loop, so the grain repeats with everything else.
          frame={row.loops ? frame % LOOP_FRAMES : frame}
          width={width}
          height={height}
        />
      </EffectComposer>
    </>
  );
};
