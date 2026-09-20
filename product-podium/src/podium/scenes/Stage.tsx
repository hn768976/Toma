/**
 * Wall and floor, shared by the two gobo looks.
 *
 * The seam between them is the scale cue that tells a buyer how big the
 * plinth is, and it is also what proves the foliage shadow is a real
 * projection: the pattern has to bend as it crosses it.
 */
import { useMemo } from "react";
import { plasterNormal } from "../textures";

export const WallFloor: React.FC<{
  wall: string;
  floor: string;
  /** Distance from the plinth centre back to the wall. */
  wallDistance: number;
  roughness?: number;
  normalStrength?: number;
  seed?: number;
}> = ({ wall, floor, wallDistance, roughness = 0.95, normalStrength = 0.6, seed = 7 }) => {
  const normalMap = useMemo(() => plasterNormal(seed, 1.4), [seed]);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial
          color={floor}
          roughness={roughness}
          metalness={0}
          normalMap={normalMap}
          normalScale={[normalStrength, normalStrength] as unknown as never}
          envMapIntensity={0.7}
        />
      </mesh>
      <mesh position={[0, 14, -wallDistance]} receiveShadow>
        <planeGeometry args={[70, 28]} />
        <meshStandardMaterial
          color={wall}
          roughness={roughness}
          metalness={0}
          normalMap={normalMap}
          normalScale={[normalStrength, normalStrength] as unknown as never}
          envMapIntensity={0.7}
        />
      </mesh>
    </>
  );
};
