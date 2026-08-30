import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  InstancedMesh,
  Object3D,
  Quaternion,
  TorusGeometry,
  type Texture,
} from "three";
import {
  TAU,
  placeElement,
  travelVector,
  type CoinElement,
} from "../field";
import type { VariantConfig } from "../variants";

/** Coin radius at a given distance, matched to the plane sizing curve. */
const coinRadius = (dist: number, scale: number) =>
  Math.pow(dist, 0.6) * 0.34 * scale;

type CoinTransform = {
  readonly px: number;
  readonly py: number;
  readonly pz: number;
  readonly radius: number;
  readonly quaternion: Quaternion;
  readonly brightness: number;
};

const euler = new Euler(0, 0, 0, "XYZ");

/**
 * Every coin, resolved to one transform per motion blur copy. The tumble is
 * two whole-number revolution counts per loop, so the coins present face-on
 * and edge-on views as they travel and still land back where they started.
 */
const useCoinTransforms = (
  coins: readonly CoinElement[],
  config: VariantConfig,
  t: number,
): CoinTransform[] => {
  const travel = useMemo(
    () => travelVector(config.streamAxis, config.flowDirection),
    [config.streamAxis, config.flowDirection],
  );

  return useMemo(() => {
    const out: CoinTransform[] = [];
    for (const coin of coins) {
      const approx = coinRadius(coin.midDist, coin.scale);
      const place = placeElement(
        `coin-${coin.id}`,
        coin.laps,
        coin.bandNear,
        coin.bandFar,
        approx,
        config.streamAxis,
        config.flowDirection,
        config.cameraMode,
        config.dollyRate,
        t,
      );
      const radius = coinRadius(place.dist, coin.scale);
      const streak = place.speedPerFrame * config.shutterFrames * 0.07;

      euler.set(
        TAU * (coin.spinA * t + coin.phaseA),
        TAU * (coin.spinB * t + coin.phaseB),
        0,
      );
      const q = new Quaternion().setFromEuler(euler);

      let weightSum = 0;
      for (let j = 0; j < coin.passes; j++) {
        weightSum += Math.pow(1 - j / coin.passes, 1.2);
      }

      for (let j = 0; j < coin.passes; j++) {
        const back = coin.passes > 1 ? j / (coin.passes - 1) : 0;
        const offset = -back * streak;
        out.push({
          px: place.x + travel.x * offset,
          py: place.y + travel.y * offset,
          pz: place.z + travel.z * offset,
          radius,
          quaternion: q,
          brightness: (Math.pow(1 - j / coin.passes, 1.2) / weightSum) * 1.15,
        });
      }
    }
    return out;
  }, [coins, config, t, travel]);
};

const scratchColor = new Color();
const scratchObject = new Object3D();

type LayerProps = {
  readonly transforms: readonly CoinTransform[];
  readonly children: React.ReactNode;
  readonly renderOrder: number;
  readonly radialScale: number;
};

const CoinLayer: React.FC<LayerProps> = ({
  transforms,
  children,
  renderOrder,
  radialScale,
}) => {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    transforms.forEach((tr, i) => {
      scratchObject.position.set(tr.px, tr.py, tr.pz);
      scratchObject.quaternion.copy(tr.quaternion);
      const s = tr.radius * radialScale;
      scratchObject.scale.set(s, s, s);
      scratchObject.updateMatrix();
      mesh.setMatrixAt(i, scratchObject.matrix);
      scratchColor.setScalar(tr.brightness);
      mesh.setColorAt(i, scratchColor);
    });
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [transforms, radialScale]);

  if (transforms.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, transforms.length]}
      frustumCulled={false}
      renderOrder={renderOrder}
    >
      {children}
    </instancedMesh>
  );
};

/** Flat disc, axis rotated onto Z so the face points at a camera looking -Z. */
const bodyGeometry = () => {
  const g = new CylinderGeometry(1, 1, 0.085, 44, 1, false);
  g.rotateX(Math.PI / 2);
  return g;
};

/** Rim torus already lies in the XY plane, matching the rotated cylinder. */
const rimGeometry = () => new TorusGeometry(1, 0.035, 8, 56);

export const Coins: React.FC<{
  readonly coins: readonly CoinElement[];
  readonly markTextures: readonly Texture[];
  readonly config: VariantConfig;
  readonly t: number;
}> = ({ coins, markTextures, config, t }) => {
  const transforms = useCoinTransforms(coins, config, t);
  const body = useMemo(bodyGeometry, []);
  const rim = useMemo(rimGeometry, []);

  const byMark = useMemo(() => {
    const buckets: CoinTransform[][] = markTextures.map(() => []);
    let cursor = 0;
    for (const coin of coins) {
      for (let j = 0; j < coin.passes; j++) {
        buckets[coin.markIndex % buckets.length].push(transforms[cursor]);
        cursor++;
      }
    }
    return buckets;
  }, [coins, markTextures, transforms]);

  if (coins.length === 0) return null;

  const bodyColor = config.palette.coinBody ?? config.palette.codeMain;
  const rimColor = config.palette.coinRim ?? config.palette.codeWhite;

  return (
    <>
      <CoinLayer transforms={transforms} renderOrder={2} radialScale={1}>
        <primitive object={body} attach="geometry" />
        <meshBasicMaterial
          color={bodyColor}
          transparent
          opacity={0.26}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </CoinLayer>

      <CoinLayer transforms={transforms} renderOrder={3} radialScale={1}>
        <primitive object={rim} attach="geometry" />
        <meshBasicMaterial
          color={rimColor}
          transparent
          opacity={0.45}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </CoinLayer>

      {byMark.map((bucket, i) => (
        <CoinLayer
          key={i}
          transforms={bucket}
          renderOrder={4}
          radialScale={2.2}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={markTextures[i]}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
            side={DoubleSide}
          />
        </CoinLayer>
      ))}
    </>
  );
};
