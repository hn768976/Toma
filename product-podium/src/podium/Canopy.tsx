/**
 * The foliage gobo.
 *
 * This is a real occluder in the light path — a plane carrying a
 * procedurally generated leaf alpha, hung between the key and the stage —
 * not a shadow layer painted over the wall. That distinction is the whole
 * difference between a stage that reads and one that doesn't: a painted
 * layer sits flat on the wall, stops at the wall/floor seam and slides
 * straight over the plinth. A real occluder gives all three for free:
 *
 *   - the pattern crosses wall and floor and bends at the seam, because it
 *     is one projection through one occluder onto both surfaces;
 *   - it wraps over the plinth, because the plinth stands in the same light;
 *   - it softens with distance from the occluder, because the shadow is
 *     PCSS and the penumbra grows with the occluder-to-receiver gap.
 *
 * The occluder is hung well above the camera frustum, so it shades the
 * stage without ever appearing in shot.
 */
import { useCurrentFrame } from "remotion";
import { useMemo } from "react";
import * as THREE from "three";
import { foliageAlpha } from "./textures";
import { loopSin } from "./loop";
import { LOOP_FRAMES, type FoliageConfig } from "./types";

export const Canopy: React.FC<{ config: FoliageConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const alpha = useMemo(
    () =>
      foliageAlpha({
        seed: config.seed,
        branches: config.branches,
        leavesPerBranch: config.leavesPerBranch,
        leafScale: config.leafSize / config.planeSize,
        branchScale: config.branchSize / config.planeSize,
        blur: config.blur / config.planeSize,
        size: 1536,
        density: config.density,
        clumping: config.clumping,
      }),
    [config],
  );

  // One whole sway cycle and one whole drift cycle per clip — coherent
  // rigid motion of the whole canopy, so the pattern sways as one thing
  // rather than scrolling across the wall.
  // A SpotLight aims at its target object, which has to be in the scene for
  // its world matrix to update — hence the primitive below.
  const aim = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...config.lightAim);
    return o;
  }, [config.lightAim]);
  aim.position.set(...config.lightAim);

  const sway = config.swayAmplitude * loopSin(frame, LOOP_FRAMES, config.swayCycles);
  const drift =
    config.driftAmplitude * loopSin(frame, LOOP_FRAMES, config.driftCycles, 0.25);

  return (
    <group>
      <primitive object={aim} />
      <spotLight
        target={aim}
        position={config.lightPosition}
        angle={config.lightAngle}
        penumbra={1}
        decay={2}
        distance={0}
        intensity={config.lightIntensity}
        color={config.lightColor}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <group
        position={[config.position[0] + drift, config.position[1], config.position[2]]}
        rotation={[config.rotation[0], config.rotation[1] + sway, config.rotation[2]]}
      >
        <mesh castShadow receiveShadow={false}>
          <planeGeometry args={[config.planeSize, config.planeSize]} />
          {/*
            The shadow pass derives its depth material from this one and
            carries `alphaMap` and `alphaTest` across, so only the leaves
            occlude. The mesh itself never appears in shot.
          */}
          <meshBasicMaterial
            alphaMap={alpha}
            alphaTest={0.5}
            transparent={false}
            side={THREE.DoubleSide}
            color="#000000"
          />
        </mesh>
      </group>
    </group>
  );
};
