import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Quaternion,
  type Texture,
} from "three";
import {
  placeElement,
  planeWorldSize,
  travelVector,
  type PlaneElement,
} from "../field";
import { TIERS, tierOfTextureIndex } from "../textures";
import type { VariantConfig } from "../variants";

/**
 * Total additive energy per element once its motion blur copies are summed.
 * Slightly above 1 so overlapping streaks run hot enough to feed the bloom.
 */
const ENERGY = 1.05;

/**
 * Only elements at or behind this distance contribute to the depth prepass.
 * The near field is already destroyed by its own motion blur; letting its
 * large quads into the depth buffer would push the depth-of-field pass into
 * blurring the entire frame at the near circle of confusion.
 */
const DEPTH_PREPASS_MIN_DIST = 30;

const scratch = new Object3D();
const scratchColor = new Color();

/**
 * `depth` writes a dense depth buffer (colour writes off) so the depth of
 * field pass has a smooth surface to read. `head` is the sharpest copy of
 * each element, `trail` its motion blur copies. Only the depth pass touches
 * the depth buffer; the colour passes accumulate additively in any order.
 */
type PlaneMode = "depth" | "head" | "trail";

type PlaneGroupProps = {
  readonly texture: Texture;
  readonly smearedTexture: Texture;
  /**
   * The near tier is smeared past legibility, so even its sharpest copy
   * samples the pre-smeared block.
   */
  readonly smearHead: boolean;
  readonly elements: readonly PlaneElement[];
  readonly mode: PlaneMode;
  readonly config: VariantConfig;
  readonly aspect: number;
  readonly t: number;
  readonly cameraQuaternion: Quaternion;
  readonly fieldQuaternion: Quaternion;
};

/** One instanced draw of every plane that shares a texture. */
const PlaneGroup: React.FC<PlaneGroupProps> = ({
  texture,
  smearedTexture,
  smearHead,
  elements,
  mode,
  config,
  aspect,
  t,
  cameraQuaternion,
  fieldQuaternion,
}) => {
  const meshRef = useRef<InstancedMesh>(null);

  const members = useMemo(
    () =>
      mode === "depth"
        ? elements.filter((e) => e.midDist >= DEPTH_PREPASS_MIN_DIST)
        : elements,
    [elements, mode],
  );

  const count = useMemo(
    () =>
      mode === "trail"
        ? members.reduce((acc, e) => acc + Math.max(0, e.passes - 1), 0)
        : members.length,
    [members, mode],
  );

  const travel = useMemo(
    () => travelVector(config.streamAxis, config.flowDirection),
    [config.streamAxis, config.flowDirection],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    // Planes billboard toward the camera by taking the camera's own
    // orientation. Expressed inside the field group, that is the field's
    // rotation undone and the camera's applied — which keeps every text block
    // upright and horizontal no matter which way the stream runs.
    const billboard = fieldQuaternion
      .clone()
      .invert()
      .multiply(cameraQuaternion);

    let cursor = 0;
    for (const el of members) {
      const approx = planeWorldSize(el.midDist, el.scale, aspect, config.planeBase);
      const halfAlongTravel =
        config.streamAxis === "horizontal"
          ? approx.width / 2
          : approx.height / 2;

      const place = placeElement(
        `plane-${config.streamAxis}-${el.id}`,
        el.laps,
        el.bandNear,
        el.bandFar,
        halfAlongTravel,
        config.streamAxis,
        config.flowDirection,
        config.cameraMode,
        config.dollyRate,
        t,
        el.crossBias,
      );
      const size = planeWorldSize(place.dist, el.scale, aspect, config.planeBase);

      // Streak length: how far this element travels during the shutter.
      const streak =
        place.speedPerFrame * config.shutterFrames * el.shutterScale;
      const alongTravelSize =
        config.streamAxis === "horizontal" ? size.width : size.height;
      const spacing = el.passes > 1 ? streak / (el.passes - 1) : 0;
      // Each copy is stretched along the travel axis by roughly the gap to the
      // next one, so the copies merge into one continuous smear instead of
      // reading as separate ghosts.
      const stretch =
        mode === "depth"
          ? 1
          : Math.min(3.4, 1 + (spacing / alongTravelSize) * 1.15);
      const sx =
        config.streamAxis === "horizontal" ? size.width * stretch : size.width;
      const sy =
        config.streamAxis === "vertical" ? size.height * stretch : size.height;

      // Normalised falloff so the total energy is independent of pass count.
      // Heavily blurred elements get a flatter falloff, so no single copy
      // stays sharp enough to read against the streak.
      const falloff = Math.max(0.4, Math.min(1.4, 1.4 - 0.1 * el.passes));
      let weightSum = 0;
      for (let j = 0; j < el.passes; j++) {
        weightSum += Math.pow(1 - j / el.passes, falloff);
      }

      const first = mode === "trail" ? 1 : 0;
      const last = mode === "trail" ? el.passes - 1 : 0;
      for (let j = first; j <= last; j++) {
        const back = el.passes > 1 ? j / (el.passes - 1) : 0;
        const offset = -back * streak;
        scratch.position.set(
          place.x + travel.x * offset,
          place.y + travel.y * offset,
          place.z + travel.z * offset,
        );
        scratch.quaternion.copy(billboard);
        if (mode === "depth") {
          // Slightly inset, matching the visible core of the faded texture.
          scratch.scale.set(size.width * 0.88, size.height * 0.86, 1);
        } else {
          scratch.scale.set(sx, sy, 1);
        }
        scratch.updateMatrix();
        mesh.setMatrixAt(cursor, scratch.matrix);

        // Stretching a copy spreads the same light over more area, so its
        // brightness has to come down with it — otherwise the near field,
        // which stretches most, blows the frame out.
        const weight = Math.pow(1 - j / el.passes, falloff) / weightSum;
        const b = (el.brightness * ENERGY * weight) / stretch;
        scratchColor.setScalar(b);
        mesh.setColorAt(cursor, scratchColor);
        cursor++;
      }
    }

    mesh.count = cursor;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [
    members,
    mode,
    count,
    config,
    aspect,
    t,
    cameraQuaternion,
    fieldQuaternion,
    travel,
  ]);

  if (count === 0) return null;

  if (mode === "depth") {
    return (
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        frustumCulled={false}
        renderOrder={-10}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite
          depthTest
          toneMapped={false}
          side={DoubleSide}
        />
      </instancedMesh>
    );
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      renderOrder={mode === "head" ? 1 : 2}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={mode === "trail" || smearHead ? smearedTexture : texture}
        transparent
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
};

export const CodeField: React.FC<{
  readonly elements: readonly PlaneElement[];
  readonly textures: readonly Texture[];
  readonly smearedTextures: readonly Texture[];
  /** Whether the near tier's sharpest copy also samples the smeared block. */
  readonly smearNearHeads?: boolean;
  readonly config: VariantConfig;
  readonly aspect: number;
  readonly t: number;
  readonly cameraQuaternion: Quaternion;
  readonly fieldQuaternion: Quaternion;
}> = ({
  elements,
  textures,
  smearedTextures,
  smearNearHeads = true,
  config,
  aspect,
  t,
  cameraQuaternion,
  fieldQuaternion,
}) => {
  const byTexture = useMemo(() => {
    const buckets: PlaneElement[][] = Array.from(
      { length: textures.length },
      () => [],
    );
    for (const el of elements) {
      buckets[el.textureIndex % textures.length].push(el);
    }
    return buckets;
  }, [elements, textures.length]);

  return (
    <>
      {byTexture.map((bucket, i) =>
        bucket.length === 0 ? null : (
          <React.Fragment key={i}>
            {(["depth", "head", "trail"] as const).map((mode) => (
              <PlaneGroup
                key={mode}
                texture={textures[i]}
                smearedTexture={smearedTextures[i]}
                smearHead={
                  smearNearHeads && tierOfTextureIndex(i) === TIERS.length - 1
                }
                elements={bucket}
                mode={mode}
                config={config}
                aspect={aspect}
                t={t}
                cameraQuaternion={cameraQuaternion}
                fieldQuaternion={fieldQuaternion}
              />
            ))}
          </React.Fragment>
        ),
      )}
    </>
  );
};
