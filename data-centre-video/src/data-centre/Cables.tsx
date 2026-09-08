/**
 * Cable bundles and vertical drops.
 *
 * Each bundle is a swept tube along a piecewise-quadratic sag curve. The
 * curve is built once with its final sag and both endpoints at local y = 0,
 * so "settling into the sag" is a scale.y animation on the parent group and
 * the supports never move. The sweep-in is a draw-range animation along the
 * tube, which costs nothing per frame.
 */

import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { clamp, easeOutCubic, easeOutQuint, lerp, progress } from "./anim";
import { CAMERA_DIRECTION, T } from "./constants";
import type { CableRun, Drop, Layout } from "./layout";
import { radialTexture } from "./textures";
import type { Theme } from "./theme";

const PULSE_PERIOD = 165;
const PULSE_TRAVEL = 96;

const useDrawRange = (geometry: THREE.BufferGeometry, amount: number) => {
  useLayoutEffect(() => {
    const index = geometry.index;
    if (!index) return;
    const triples = Math.floor((index.count / 3) * clamp(amount)) * 3;
    geometry.setDrawRange(0, triples);
  });
};

const Cable: React.FC<{ run: CableRun; theme: Theme; billboard: THREE.Quaternion }> = ({
  run,
  theme,
  billboard,
}) => {
  const frame = useCurrentFrame();

  const { geometry, curve } = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(
      run.points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
      "centripetal",
      0.5,
    );
    const segments = Math.max(28, Math.round(run.length * 20));
    return {
      geometry: new THREE.TubeGeometry(c, segments, run.radius, 6, false),
      curve: c,
    };
  }, [run]);

  const sweep = easeOutCubic(progress(frame, run.delay, T.cableSweep));
  const sag = easeOutQuint(
    progress(frame, run.delay + T.cableSagDelay, T.cableSag),
  );
  const sagScale = lerp(0.08, 1, sag);

  useDrawRange(geometry, sweep);

  const pulsePoint = useMemo(() => new THREE.Vector3(), []);
  let pulse: { x: number; y: number; z: number; intensity: number } | null = null;
  if (run.pulse && frame >= T.pulseStart && sweep >= 1) {
    const cycle = (frame - T.pulseStart) % PULSE_PERIOD;
    const t = cycle / PULSE_TRAVEL;
    if (t <= 1) {
      curve.getPointAt(clamp(t), pulsePoint);
      pulse = {
        x: pulsePoint.x,
        y: pulsePoint.y * sagScale,
        z: pulsePoint.z,
        intensity: Math.sin(clamp(t) * Math.PI) ** 0.4,
      };
    }
  }

  const glowMap = useMemo(() => radialTexture(2.4), []);

  if (sweep <= 0) return null;

  return (
    <group position={[run.originX, run.y, run.z]}>
      <group scale={[1, sagScale, 1]}>
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial
            color={run.color}
            roughness={0.88}
            metalness={0.04}
          />
        </mesh>
      </group>
      {pulse ? (
        <group position={[pulse.x, pulse.y, pulse.z]}>
          <mesh>
            <sphereGeometry args={[run.radius * 1.9, 8, 6]} />
            <meshBasicMaterial color={theme.pulseColor} toneMapped={false} />
          </mesh>
          {theme.glow ? (
            <mesh quaternion={billboard} scale={[0.2, 0.2, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={glowMap}
                color={theme.pulseColor}
                transparent
                opacity={0.55 * pulse.intensity}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ) : null}
        </group>
      ) : null}
    </group>
  );
};

const CableDrop: React.FC<{ drop: Drop }> = ({ drop }) => {
  const frame = useCurrentFrame();

  const geometry = useMemo(() => {
    const dx = drop.to[0] - drop.from[0];
    const dy = drop.to[1] - drop.from[1];
    const dz = drop.to[2] - drop.from[2];
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(dx * 0.15, dy * 0.55, dz * 0.15 + drop.bend),
      new THREE.Vector3(dx, dy, dz),
    );
    return new THREE.TubeGeometry(curve, 26, drop.radius, 6, false);
  }, [drop]);

  const draw = easeOutCubic(progress(frame, drop.delay, T.dropDraw));
  useDrawRange(geometry, draw);

  if (draw <= 0) return null;

  return (
    <mesh position={drop.from} geometry={geometry} castShadow>
      <meshStandardMaterial color={drop.color} roughness={0.88} metalness={0.04} />
    </mesh>
  );
};

export const Cables: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const billboard = useMemo(() => {
    const helper = new THREE.Object3D();
    helper.position.set(...CAMERA_DIRECTION);
    helper.lookAt(0, 0, 0);
    helper.updateMatrixWorld();
    return helper.quaternion.clone();
  }, []);

  return (
    <group>
      {layout.cables.map((run, i) => (
        <Cable key={i} run={run} theme={theme} billboard={billboard} />
      ))}
      {layout.drops.map((drop, i) => (
        <CableDrop key={i} drop={drop} />
      ))}
    </group>
  );
};
