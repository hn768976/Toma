/**
 * Look 4 — Wood and Leaf.
 *
 * A cool blue-white field with a light oak disc standing in it. The whole
 * look is the warm/cool contrast, so the wood has to stay warm against a
 * wall that stays cool — which is why the field is desaturated rather than
 * blue, and why the grain runs across the top face where it reads.
 *
 * The leaf shadow is the same real-occluder gobo as look 3, but with a
 * smaller light and the canopy hung closer, which is all it takes to move
 * from look 3's very soft foliage to defined leaf edges.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { studioEnvironment } from "../environment";
import { woodMaps } from "../textures";
import { Canopy } from "../Canopy";
import { ContactAO } from "../ContactAO";
import { Disc } from "../plinths/Plinths";
import { WallFloor } from "./Stage";
import type { WoodLeafParams } from "../types";

export const WoodLeafScene: React.FC<{ params: WoodLeafParams }> = ({
  params: p,
}) => {
  const env = useMemo(
    () =>
      studioEnvironment({
        intensity: 0.75,
        // Deliberately flat top-to-horizon: a top-heavy environment leaves
        // the upward-facing floor much brighter than the wall, and this
        // stage wants them reading as the same cool material.
        top: [0.86, 0.90, 1.0],
        horizon: [0.74, 0.78, 0.9],
        bottom: [0.46, 0.48, 0.55],
      }),
    [],
  );

  const wood = useMemo(
    () =>
      woodMaps({
        seed: 4201,
        light: p.wood.light,
        dark: p.wood.dark,
        rings: p.wood.rings,
        turbulence: p.wood.turbulence,
      }),
    [p.wood.light, p.wood.dark, p.wood.rings, p.wood.turbulence],
  );

  return (
    <>
      <primitive object={env} attach="environment" />
      {/* Cool fill against a warm key: the reference has a genuine warm sun
          pool on the wall sitting in cool shade, and without the split the
          stage reads overcast and flat. */}
      <hemisphereLight args={["#dbe7ff", "#cddcf2", 0.55]} />
      <ambientLight intensity={0.1} color="#dfe9ff" />

      <WallFloor
        wall={p.wall}
        floor={p.floor}
        wallDistance={p.wallDistance}
        roughness={0.96}
        normalStrength={0.1}
        seed={29}
      />

      <Canopy config={p.foliage} />

      {/* Light oak disc: low, wide, grain across the top face. The top face
          carries planar UVs from the geometry builder, so the grain runs
          across it rather than spiralling round it. */}
      <ContactAO radius={p.disc.radius} spread={1.8} strength={0.4} />
      <Disc
        radius={p.disc.radius}
        height={p.disc.height}
        bevel={p.disc.bevel}
        material={
          <meshStandardMaterial
            map={wood.color}
            roughnessMap={wood.roughness}
            roughness={0.72}
            metalness={0}
            envMapIntensity={0.55}
            side={THREE.FrontSide}
          />
        }
      />
    </>
  );
};
