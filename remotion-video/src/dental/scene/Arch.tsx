// The arch itself: one mandible mesh, optionally answered by a mirrored
// copy standing in for the maxilla.
//
// The source scan is a lower jaw only. Mirroring it in Y and nudging it up
// and forward gives a credible opposing arch at the camera angles these
// nine shots use, which is cheaper and more consistent than modelling a
// second one. The mirror is baked into a real geometry (positions, normals
// and winding all flipped) rather than done with a negative scale, so the
// lighting maths downstream never has to special-case handedness.

import React, { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, ShaderMaterial } from "three";
import { useMandible } from "../mesh/useMandible";
import { applyLook, ArchLook, createArchMaterial } from "../materials/archMaterial";
import { LightRig } from "../materials/palette";

const mirrorGeometry = (src: BufferGeometry): BufferGeometry => {
  const out = new BufferGeometry();
  const pos = src.getAttribute("position") as BufferAttribute;
  const nrm = src.getAttribute("normal") as BufferAttribute;

  const flip = (attr: BufferAttribute) => {
    const copy = new Float32Array(attr.array as Float32Array);
    for (let i = 1; i < copy.length; i += 3) {
      copy[i] = -copy[i];
    }
    return new BufferAttribute(copy, 3);
  };

  out.setAttribute("position", flip(pos));
  out.setAttribute("normal", flip(nrm));
  for (const name of ["aGumT", "aTheta", "aBand", "aAo", "aTid"]) {
    out.setAttribute(name, src.getAttribute(name) as BufferAttribute);
  }

  // Mirroring reverses triangle winding, so put it back.
  const idx = src.getIndex() as BufferAttribute;
  const src32 = idx.array as Uint32Array;
  const flipped = new Uint32Array(src32.length);
  for (let i = 0; i < src32.length; i += 3) {
    flipped[i] = src32[i];
    flipped[i + 1] = src32[i + 2];
    flipped[i + 2] = src32[i + 1];
  }
  out.setIndex(new BufferAttribute(flipped, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
};

export type ArchProps = {
  look: ArchLook;
  rig: LightRig;
  timeInSeconds: number;
  hazeColor?: string;
  /** Draw the mirrored opposing arch. */
  maxilla?: boolean;
  /** Vertical gap between the two occlusal planes, in model units. */
  maxillaGap?: number;
  /** Maxillary arches are a little wider than mandibular ones. */
  maxillaSpread?: number;
  /** Overjet: how far the upper arch sits forward of the lower. */
  maxillaOverjet?: number;
  /** Separate look for the opposing arch; defaults to the same one. */
  maxillaLook?: ArchLook;
};

export const Arch: React.FC<ArchProps> = ({
  look,
  rig,
  timeInSeconds,
  hazeColor,
  maxilla = false,
  maxillaGap = 0.012,
  maxillaSpread = 1.06,
  maxillaOverjet = 0.02,
  maxillaLook,
}) => {
  const data = useMandible();
  // The rig is authored in view space, so it needs the camera's current
  // orientation. CameraRig renders first and has already posed it.
  const camera = useThree((s) => s.camera);
  camera.updateMatrixWorld();

  const lowerMaterial = useMemo(() => createArchMaterial(), []);
  const upperMaterial = useMemo(() => createArchMaterial(), []);
  const upperGeometry = useMemo(
    () => (maxilla ? mirrorGeometry(data.geometry) : null),
    [data, maxilla],
  );

  // The occlusal plane sits at the top of the (centred) mandible bounds.
  const occlusalY = data.geometry.boundingBox?.max.y ?? 0.19;

  applyLook(
    lowerMaterial as ShaderMaterial,
    look,
    rig,
    timeInSeconds,
    hazeColor,
    camera.quaternion,
  );
  applyLook(
    upperMaterial as ShaderMaterial,
    maxillaLook ?? look,
    rig,
    timeInSeconds,
    hazeColor,
    camera.quaternion,
  );

  return (
    <group>
      <mesh geometry={data.geometry} material={lowerMaterial} frustumCulled={false} />
      {upperGeometry ? (
        <mesh
          geometry={upperGeometry}
          material={upperMaterial}
          position={[0, occlusalY * 2 + maxillaGap, maxillaOverjet]}
          scale={[maxillaSpread, 1, maxillaSpread]}
          frustumCulled={false}
        />
      ) : null}
    </group>
  );
};
