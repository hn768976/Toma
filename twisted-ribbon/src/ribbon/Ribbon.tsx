import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { buildRibbon } from './geometry';
import {
  A_RATIO,
  H3_RATIO,
  K,
  R,
  ROTATION_PHASE_DEG,
  SEGMENTS,
  THICKNESS_RATIO,
  TWIST_PHASE_DEG,
  WIDTH_RATIO,
} from './params';
import type { VersionConfig } from './versions';

/**
 * Optional saddle "breathing". Off by default — the rotation alone carries the
 * shot. If switched on it must complete an integer number of cycles over the
 * loop or frame 300 stops matching frame 0.
 */
export const BREATHE_AMOUNT = 0;

export const buildGeometryForAmplitude = (
  aRatio: number,
  twistPhaseDeg = TWIST_PHASE_DEG,
  widthRatio = WIDTH_RATIO,
) => {
  const { positions, normals, indices } = buildRibbon({
    R,
    aRatio,
    h3Ratio: H3_RATIO,
    k: K,
    widthRatio,
    thicknessRatio: THICKNESS_RATIO,
    segments: SEGMENTS,
    twistPhase: (twistPhaseDeg * Math.PI) / 180,
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(new BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
};

export const Ribbon: React.FC<{ cfg: VersionConfig; progress: number }> = ({
  cfg,
  progress,
}) => {
  // progress is frame / durationInFrames, so every value below is a pure
  // function of the current frame.
  const amplitude =
    BREATHE_AMOUNT === 0
      ? A_RATIO
      : A_RATIO * (1 + BREATHE_AMOUNT * Math.sin(2 * Math.PI * progress));

  const geometry = useMemo(
    () => buildGeometryForAmplitude(amplitude),
    [amplitude],
  );

  // Exactly 180 degrees over the composition. With k = 2 the form has two-fold
  // rotational symmetry about Y, so this returns a pixel-identical frame — the
  // loop is exact by construction, not by tuning.
  //
  // The matrix is built by hand rather than via rotation={[0, angle, 0]} so the
  // half-turn is an exact sign flip. Math.cos(phase + PI) and -Math.cos(phase)
  // can differ in the last bit, and one bit in the model matrix is enough to
  // shift a rasterised edge by a pixel and fail the frame-300-equals-frame-0
  // check. Reducing to [0, PI) and carrying the sign separately makes frame 300
  // the exact negation of frame 0 instead of an almost-negation.
  const matrix = useMemo(() => {
    const phase = (ROTATION_PHASE_DEG * Math.PI) / 180;
    const halfTurns = Math.floor(progress);
    const base = phase + Math.PI * (progress - halfTurns);
    const sign = ((halfTurns % 2) + 2) % 2 === 0 ? 1 : -1;
    const c = Math.cos(base) * sign;
    const s = Math.sin(base) * sign;
    // prettier-ignore
    return new Matrix4().set(
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1,
    );
  }, [progress]);

  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={cfg.material.color}
          roughness={cfg.material.roughness}
          metalness={cfg.material.metalness}
          clearcoat={cfg.material.clearcoat}
          clearcoatRoughness={cfg.material.clearcoatRoughness}
          envMapIntensity={cfg.material.envMapIntensity}
          flatShading={false}
        />
      </mesh>
    </group>
  );
};
