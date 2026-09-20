/**
 * Look 3 — Fluted Plaster.
 *
 * A soft warm-white studio: wall and floor in the same pale plaster, the
 * seam barely there, an out-of-focus foliage shadow across both, and very
 * low contrast throughout.
 *
 * Two geometry variants share every one of those decisions — the single
 * fluted cylinder and the classical column pair differ only in the plinth
 * they put in the light. That is the cheapest second thumbnail in the set.
 */
import { useMemo } from "react";
import { studioEnvironment } from "../environment";
import { plasterNormal } from "../textures";
import { Canopy } from "../Canopy";
import { ContactAO } from "../ContactAO";
import { Column, FlutedCylinder } from "../plinths/Plinths";
import { WallFloor } from "./Stage";
import type { FlutedPlasterParams } from "../types";

export const FlutedPlasterScene: React.FC<{ params: FlutedPlasterParams }> = ({
  params: p,
}) => {
  const env = useMemo(
    () =>
      studioEnvironment({
        intensity: 0.56,
        top: [0.95, 0.94, 0.92],
        horizon: [0.66, 0.65, 0.64],
        bottom: [0.36, 0.36, 0.36],
      }),
    [],
  );

  const normalMap = useMemo(() => plasterNormal(11, 1.1), []);

  // Matte white plaster with a faint tooth — not a clean shiny white.
  const plaster = (
    <meshStandardMaterial
      color={p.plaster}
      roughness={0.92}
      metalness={0}
      normalMap={normalMap}
      normalScale={[0.13, 0.13] as unknown as never}
      envMapIntensity={0.85}
    />
  );

  return (
    <>
      <primitive object={env} attach="environment" />
      {/* Low contrast: a broad soft fill under the keyed canopy light. */}
      {/* Low contrast overall, but the key still has to carry the flutes:
          a plinth lit only by fill reads as a plain cylinder. */}
      <hemisphereLight args={["#ffffff", "#ded9d3", 0.56]} />
      <ambientLight intensity={0.06} color="#fff8f0" />

      <WallFloor
        wall={p.wall}
        floor={p.floor}
        wallDistance={p.wallDistance}
        roughness={0.94}
        normalStrength={0.1}
        seed={11}
      />

      {/* A soft raking key from the front left. The canopy light is aimed
          at the wall to place the gobo, which leaves it grazing the plinth;
          without this the flutes get no directional shading at all and the
          plinth reads as a plain cylinder. */}
      <spotLight
        position={[-5.5, 4.2, 6.5]}
        angle={0.6}
        penumbra={1}
        decay={2}
        intensity={280}
        color="#fffaf2"
      />

      <Canopy config={p.foliage} />

      {p.plinth === "cylinder" ? (
        <>
          <ContactAO radius={1.3} spread={1.7} strength={0.3} />
          <FlutedCylinder
            radius={1.3}
            height={1.3}
            flutes={20}
            fluteDepth={0.1}
            fluteSharpness={2.4}
            capRadius={1.34}
            capHeight={0.055}
            material={plaster}
          />
        </>
      ) : (
        <>
          {/* Shorter, front-left. */}
          <ContactAO radius={0.44} spread={2.2} strength={0.3} position={[-1.0, 0, 0.75]} />
          <ContactAO radius={0.44} spread={2.2} strength={0.3} position={[1.15, 0, -0.55]} />
          <Column
            height={1.4}
            shaftRadius={0.33}
            plateRadius={0.44}
            baseHeight={0.1}
            capitalHeight={0.11}
            flutes={20}
            fluteDepth={0.03}
            taper={0.94}
            position={[-1.0, 0, 0.75]}
            material={plaster}
          />
          {/* Taller, set back to the right. */}
          <Column
            height={1.43}
            shaftRadius={0.33}
            plateRadius={0.44}
            baseHeight={0.1}
            capitalHeight={0.11}
            flutes={20}
            fluteDepth={0.03}
            taper={0.94}
            position={[1.15, 0, -0.55]}
            material={plaster}
          />
        </>
      )}
    </>
  );
};
