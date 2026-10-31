import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { smoothstep } from "../random";
import { BAR, Palette } from "./constants";
import { Piece } from "./pieces";

const segmentMatrix = (s: Piece["segments"][number]) => {
  const [ax, ay, az] = s.from;
  const [bx, by, bz] = s.to;
  const mid = new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  // Extend each bar by its thickness so corners close cleanly.
  // Bars along different axes get minutely different thicknesses so faces
  // that meet at a corner are never exactly coplanar (no z-fighting seams).
  const axisBar =
    bx !== ax ? BAR * 1.008 : bz !== az ? BAR * 1.016 : BAR;
  const scale = new THREE.Vector3(
    Math.abs(bx - ax) + axisBar,
    Math.abs(by - ay) + axisBar,
    Math.abs(bz - az) + axisBar,
  );
  // Floor bars sit on the ground instead of being centred on it.
  if (ay === 0 && by === 0) mid.y = axisBar / 2;
  return new THREE.Matrix4().compose(mid, new THREE.Quaternion(), scale);
};

// Fold cycle: rest -> fold over -> hold -> fold back -> rest.
const hingeAngle = (hinge: NonNullable<Piece["hinge"]>, t: number) => {
  const u = (((t / hinge.period + hinge.phase) % 1) + 1) % 1;
  const k = smoothstep(0.08, 0.42, u) * (1 - smoothstep(0.58, 0.92, u));
  return hinge.maxAngle * k;
};

export const Bars: React.FC<{
  pieces: Piece[];
  time: number;
  palette: Palette;
}> = ({ pieces, time, palette }) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  const layout = useMemo(() => {
    const local: THREE.Matrix4[] = [];
    const owner: number[] = [];
    pieces.forEach((p, i) => {
      for (const s of p.segments) {
        local.push(segmentMatrix(s));
        owner.push(i);
      }
    });
    return { local, owner };
  }, [pieces]);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const pieceM = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    const out = new THREE.Matrix4();
    const axis = new THREE.Vector3();
    let last = -1;
    for (let i = 0; i < layout.local.length; i++) {
      const pi = layout.owner[i];
      if (pi !== last) {
        const p = pieces[pi];
        pieceM.makeTranslation(p.origin[0], p.origin[1], p.origin[2]);
        if (p.hinge) {
          axis.set(...p.hinge.axis);
          rot.makeRotationAxis(axis, hingeAngle(p.hinge, time));
          pieceM.multiply(rot);
        }
        last = pi;
      }
      out.multiplyMatrices(pieceM, layout.local[i]);
      mesh.setMatrixAt(i, out);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [layout, pieces, time]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, layout.local.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={palette.bar}
        roughness={0.72}
        metalness={0}
        dithering
      />
    </instancedMesh>
  );
};
