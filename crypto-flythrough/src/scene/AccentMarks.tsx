import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Quaternion,
  type Texture,
} from "three";
import { placeElement, travelVector } from "../field";
import type { VariantConfig } from "../variants";

/** A handful of small floating marks in the accent colour. Deliberately rare. */
const ACCENT_COUNT = 9;

type AccentSpec = {
  readonly id: number;
  readonly laps: number;
  readonly bandNear: number;
  readonly bandFar: number;
  readonly size: number;
  readonly textureIndex: number;
};

const scratch = new Object3D();
const scratchColor = new Color();

const buildAccents = (count: number, textures: number): AccentSpec[] => {
  const bands = [
    { laps: 5, near: 42, far: 70 },
    { laps: 8, near: 27, far: 48 },
    { laps: 13, near: 15, far: 30 },
  ];
  return Array.from({ length: count }, (_, i) => {
    const band = bands[Math.floor(random(`accent-band-${i}`) * bands.length)];
    return {
      id: i,
      laps: band.laps,
      bandNear: band.near,
      bandFar: band.far,
      size: 0.09 + random(`accent-size-${i}`) * 0.07,
      textureIndex: Math.floor(random(`accent-tex-${i}`) * textures),
    };
  });
};

const AccentGroup: React.FC<{
  readonly texture: Texture;
  readonly specs: readonly AccentSpec[];
  readonly config: VariantConfig;
  readonly t: number;
  readonly cameraQuaternion: Quaternion;
  readonly fieldQuaternion: Quaternion;
}> = ({ texture, specs, config, t, cameraQuaternion, fieldQuaternion }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const travel = useMemo(
    () => travelVector(config.streamAxis, config.flowDirection),
    [config.streamAxis, config.flowDirection],
  );

  const PASSES = 3;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const billboard = fieldQuaternion
      .clone()
      .invert()
      .multiply(cameraQuaternion);

    let cursor = 0;
    for (const spec of specs) {
      const place = placeElement(
        `accent-${spec.id}`,
        spec.laps,
        spec.bandNear,
        spec.bandFar,
        1,
        config.streamAxis,
        config.flowDirection,
        config.cameraMode,
        config.dollyRate,
        t,
      );
      const w = place.dist * spec.size;
      const streak = place.speedPerFrame * config.shutterFrames * 0.5;
      for (let j = 0; j < PASSES; j++) {
        const back = j / (PASSES - 1);
        const offset = -back * streak;
        scratch.position.set(
          place.x + travel.x * offset,
          place.y + travel.y * offset,
          place.z + travel.z * offset,
        );
        scratch.quaternion.copy(billboard);
        scratch.scale.set(w, w / 2, 1);
        scratch.updateMatrix();
        mesh.setMatrixAt(cursor, scratch.matrix);
        scratchColor.setScalar(0.5 * (1 - back * 0.75));
        mesh.setColorAt(cursor, scratchColor);
        cursor++;
      }
    }
    mesh.count = cursor;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [specs, config, t, cameraQuaternion, fieldQuaternion, travel]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, specs.length * PASSES]}
      frustumCulled={false}
      renderOrder={1}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
};

export const AccentMarks: React.FC<{
  readonly textures: readonly Texture[];
  readonly config: VariantConfig;
  readonly t: number;
  readonly cameraQuaternion: Quaternion;
  readonly fieldQuaternion: Quaternion;
}> = ({ textures, config, t, cameraQuaternion, fieldQuaternion }) => {
  const buckets = useMemo(() => {
    const specs = buildAccents(ACCENT_COUNT, textures.length);
    const out: AccentSpec[][] = textures.map(() => []);
    for (const spec of specs) {
      out[spec.textureIndex % out.length].push(spec);
    }
    return out;
  }, [textures]);

  return (
    <>
      {buckets.map((specs, i) =>
        specs.length === 0 ? null : (
          <AccentGroup
            key={i}
            texture={textures[i]}
            specs={specs}
            config={config}
            t={t}
            cameraQuaternion={cameraQuaternion}
            fieldQuaternion={fieldQuaternion}
          />
        ),
      )}
    </>
  );
};
