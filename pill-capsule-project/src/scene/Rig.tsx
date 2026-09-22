import { useMemo } from "react";
import * as THREE from "three";
import { Environment, Lightformer, SoftShadows } from "@react-three/drei";
import type { Rig } from "../data/looks";

/**
 * The light rig, as data.
 *
 * Specular on a coated pill comes from an environment built out of light
 * cards, not from point lights: a card has area, so its reflection is an
 * elongated soft streak sliding across the surface rather than a dot. The
 * cards are rendered into a cube map once, at mount (`frames={1}`), so
 * nothing about the lighting varies from frame to frame.
 *
 * <SoftShadows> patches the PCSS shadow sampler. Note what is NOT here:
 * drei's AccumulativeShadows, which builds its result across frames. Remotion
 * renders frames out of order on separate threads, so it would be different
 * on every frame. (Fine for the stills harvest, not for video.)
 */
export const LightRig: React.FC<{ rig: Rig }> = ({ rig }) => {
  const cards = useMemo(
    () =>
      rig.lightformers.map((l, i) => ({
        ...l,
        key: i,
        quaternion: lookAtQuaternion(l.position, l.target),
      })),
    [rig],
  );

  return (
    <>
      {rig.softShadows ? (
        <SoftShadows
          size={rig.softShadows.size}
          samples={rig.softShadows.samples}
          focus={rig.softShadows.focus}
        />
      ) : null}

      <ambientLight intensity={rig.ambient.intensity} color={rig.ambient.color} />

      {rig.shadowLight ? (
        <directionalLight
          position={rig.shadowLight.position}
          intensity={rig.shadowLight.intensity}
          color={rig.shadowLight.color}
          castShadow
          shadow-bias={rig.shadowLight.bias}
          shadow-normalBias={rig.shadowLight.normalBias}
          shadow-mapSize-width={rig.shadowLight.mapSize}
          shadow-mapSize-height={rig.shadowLight.mapSize}
          shadow-camera-left={-rig.shadowLight.cameraSize}
          shadow-camera-right={rig.shadowLight.cameraSize}
          shadow-camera-top={rig.shadowLight.cameraSize}
          shadow-camera-bottom={-rig.shadowLight.cameraSize}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
        />
      ) : null}

      <Environment resolution={256} frames={1} environmentIntensity={rig.environmentIntensity}>
        <color attach="background" args={["#000000"]} />
        {cards.map((c) => (
          <Lightformer
            key={c.key}
            form={c.form}
            position={c.position}
            quaternion={c.quaternion}
            scale={[c.scale[0], c.scale[1], 1]}
            intensity={c.intensity}
            color={c.color}
          />
        ))}
      </Environment>
    </>
  );
};

const lookAtQuaternion = (
  position: [number, number, number],
  target: [number, number, number],
): THREE.Quaternion => {
  const m = new THREE.Matrix4().lookAt(
    new THREE.Vector3(...position),
    new THREE.Vector3(...target),
    new THREE.Vector3(0, 1, 0),
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
};
