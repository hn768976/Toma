import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { CAPSULE_LENGTH, GEOM } from "../lib/pill-geometry";
import { PillMaterial } from "../lib/pill-material";
import { buildField, instanceScale, type FieldConfig, type FieldInstance } from "../lib/field";
import type { Colourway } from "./Pill";

export type PillFieldProps = {
  config: FieldConfig;
  colourway: Colourway;
  /** Loop length in frames. Not read from useVideoConfig, so the loop-check
   *  compositions can run one frame past the end and still close. */
  loopFrames: number;
  roughness?: number;
  clearcoat?: number;
};

type Bucket = {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  instances: FieldInstance[];
};

const scratchMatrix = new THREE.Matrix4();
const scratchQuat = new THREE.Quaternion();
const scratchSpin = new THREE.Quaternion();
const scratchPos = new THREE.Vector3();
const scratchScale = new THREE.Vector3();

/**
 * The falling field.
 *
 * One InstancedMesh per (pill part, shape) — a 60-pill field as individual
 * meshes would be hundreds of draw calls for nothing. Capsules and caplets
 * still render as two parts so they keep the cap's join step.
 *
 * Every instance matrix is recomputed from `frame` each frame, never advanced
 * from the previous frame's value. There is no physics solver: position is a
 * pure function of frame.
 */
export const PillField: React.FC<PillFieldProps> = ({
  config,
  colourway,
  loopFrames,
  roughness = 0.3,
  clearcoat = 0.6,
}) => {
  const frame = useCurrentFrame();
  const instances = useMemo(() => buildField(config), [config]);

  const materials = useMemo(() => {
    return {
      cap: new PillMaterial({ color: colourway.cap, roughness, clearcoat }),
      body: new PillMaterial({ color: colourway.body, roughness, clearcoat, wrap: 0.4 }),
    };
  }, [colourway.cap, colourway.body, roughness, clearcoat]);

  const buckets = useMemo<Bucket[]>(() => {
    const capsules = instances.filter((p) => p.shape === "capsule");
    const caplets = instances.filter((p) => p.shape === "caplet");
    const tablets = instances.filter((p) => p.shape === "tablet");
    const out: Bucket[] = [];
    for (const [name, list] of [
      ["capsule", capsules],
      ["caplet", caplets],
    ] as const) {
      if (!list.length) continue;
      out.push({ key: `${name}-body`, geometry: GEOM.capsuleBody, material: materials.body, instances: list });
      out.push({ key: `${name}-cap`, geometry: GEOM.capsuleCap, material: materials.cap, instances: list });
    }
    if (tablets.length) {
      out.push({ key: "tablet", geometry: GEOM.tabletPlain, material: materials.body, instances: tablets });
    }
    return out;
  }, [instances, materials]);

  // One full period of travel over the composition. At frame === loopFrames
  // the field has advanced exactly one tile and the image repeats.
  const t = frame / loopFrames;
  const yOffset = -config.period * t;

  return (
    <group>
      {buckets.map((b) => (
        <FieldBucket key={b.key} bucket={b} yOffset={yOffset} t={t} camera={config.camera} />
      ))}
    </group>
  );
};

const FieldBucket: React.FC<{
  bucket: Bucket;
  yOffset: number;
  t: number;
  camera: FieldConfig["camera"];
}> = ({ bucket, yOffset, t, camera }) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { instances } = bucket;
    const halfFov = (camera.fovDeg * Math.PI) / 360;
    for (let i = 0; i < instances.length; i++) {
      const p = instances[i];
      const y = p.y + yOffset;

      // Vertical tiling means most instances are off-screen at any frame.
      // three culls a whole InstancedMesh, never single instances, so collapse
      // the off-screen ones to zero scale: the triangles become degenerate and
      // rasterisation skips them. Still a pure function of frame, and the same
      // instances are visible at frame 0 and frame N, so the loop still closes.
      const halfHeight = Math.max(0.01, camera.z - p.z) * Math.tan(halfFov);
      const reach = p.scale * CAPSULE_LENGTH * 0.5;
      if (Math.abs(y) > halfHeight + reach) {
        scratchMatrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, scratchMatrix);
        continue;
      }

      scratchSpin.setFromAxisAngle(p.spinAxis, Math.PI * 2 * p.turns * t);
      scratchQuat.copy(p.baseQuat).premultiply(scratchSpin);
      scratchPos.set(p.x, y, p.z);
      instanceScale(p, scratchScale);
      scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
      mesh.setMatrixAt(i, scratchMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [bucket, yOffset, t, camera]);

  return (
    <instancedMesh
      ref={ref}
      args={[bucket.geometry, bucket.material, bucket.instances.length]}
      frustumCulled={false}
    />
  );
};
