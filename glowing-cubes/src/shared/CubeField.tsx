import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CUBE_TYPES, type CubeType } from "../rng";
import { createCubeMaterial } from "./cubeMaterials";

/** Everything needed to draw one cube on one frame. Pure data. */
export type CubeState = {
  type: CubeType;
  pos: Vector3;
  quat: Quaternion;
  scale: number;
  /** linear-space tint */
  tint: Color;
  glow: number;
};

type Props = {
  /** Fixed list (same length & types every frame), recomputed per frame. */
  cubes: CubeState[];
  /** World-space camera position, for back-to-front sorting of the glass. */
  cameraPos: Vector3;
  baseColors: Record<CubeType, Color>;
};

const _m = new Matrix4();
const _s = new Vector3();

/**
 * One InstancedMesh per cube type. Instance data are written in a layout
 * effect, i.e. synchronously in the same commit as the frame change, before
 * the gate in <FrameGate> triggers the WebGL render.
 */
export const CubeField: React.FC<Props> = ({ cubes, cameraPos, baseColors }) => {
  const counts = useMemo(() => {
    const c: Record<CubeType, number> = { glow: 0, frosted: 0, glass: 0, dark: 0 };
    for (const cube of cubes) c[cube.type]++;
    return c;
    // counts never change for a composition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubes.length]);

  const layers = useMemo(
    () =>
      CUBE_TYPES.filter((t) => counts[t] > 0).map((type) => {
        const n = counts[type];
        const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.075);
        const tint = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
        const glow = new InstancedBufferAttribute(new Float32Array(n), 1);
        tint.setUsage(DynamicDrawUsage);
        glow.setUsage(DynamicDrawUsage);
        geo.setAttribute("aTint", tint);
        geo.setAttribute("aGlow", glow);
        const mat = createCubeMaterial(type, baseColors[type]);
        const mesh = new InstancedMesh(geo, mat, n);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.frustumCulled = false;
        // opaque first, then frosted, then clear glass on top
        mesh.renderOrder = type === "frosted" ? 1 : type === "glass" ? 2 : 0;
        return { type, mesh, tint, glow };
      }),
    [counts, baseColors],
  );

  const group = useRef<React.ComponentRef<"group">>(null);

  useLayoutEffect(() => {
    for (const layer of layers) {
      let list = cubes.filter((c) => c.type === layer.type);
      if (layer.mesh.material.transparent) {
        // back-to-front, deterministic tie-break on original order
        list = list
          .map((c, i) => ({ c, i, d: c.pos.distanceToSquared(cameraPos) }))
          .sort((a, b) => b.d - a.d || a.i - b.i)
          .map((x) => x.c);
      }
      list.forEach((c, i) => {
        _s.setScalar(c.scale);
        _m.compose(c.pos, c.quat, _s);
        layer.mesh.setMatrixAt(i, _m);
        layer.tint.setXYZ(i, c.tint.r, c.tint.g, c.tint.b);
        layer.glow.setX(i, c.glow);
      });
      layer.mesh.instanceMatrix.needsUpdate = true;
      layer.tint.needsUpdate = true;
      layer.glow.needsUpdate = true;
    }
  }, [cubes, cameraPos, layers]);

  return (
    <group ref={group}>
      {layers.map((l) => (
        <primitive key={l.type} object={l.mesh} />
      ))}
    </group>
  );
};
