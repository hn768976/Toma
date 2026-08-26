import React, {useLayoutEffect, useMemo} from 'react';
import {random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {makeAvatarVariants} from './avatars';
import {cameraPose} from './cameraPath';
import {CONFIG} from './config';
import type {HeightField} from './terrain';
import type {Theme} from './theme';

type Pin = {
  x: number;
  z: number;
  scale: number;
  /** Frame at which this pin's rise spring starts. */
  riseStart: number;
  pulsePhase: number;
  pulsePeriod: number;
  flashOffset: number;
  flashPeriod: number;
  variant: number;
};

/**
 * ~140 pins: instanced stems (cylinders) + instanced rings (tori) + one
 * InstancedMesh of avatar discs per texture variant. Rings and discs
 * billboard to the camera every frame; stems stay vertical.
 *
 * All per-pin randomness is Remotion random() with stable string seeds, so
 * positions / stagger / avatar assignment are identical on every render.
 */
export const Pins: React.FC<{
  theme: Theme;
  heightField: HeightField;
}> = ({theme, heightField}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const P = CONFIG.pins;

  const pins = useMemo<Pin[]>(() => {
    const out: Pin[] = [];
    for (let i = 0; i < P.count; i++) {
      const sign = random(`pin-xsign-${i}`) < 0.5 ? -1 : 1;
      out.push({
        // Centre-biased x keeps a good share of pins near the camera corridor.
        x: sign * P.xHalf * Math.pow(random(`pin-x-${i}`), P.centerBias),
        z: P.zMin + (P.zMax - P.zMin) * random(`pin-z-${i}`),
        scale: 1 + (random(`pin-scale-${i}`) * 2 - 1) * P.scaleJitter,
        riseStart: random(`pin-rise-${i}`) * (P.riseWindow - 35),
        pulsePhase: random(`pin-pulsephase-${i}`) * Math.PI * 2,
        pulsePeriod: 55 + random(`pin-pulseperiod-${i}`) * 50,
        flashPeriod: Math.round(P.flashMeanPeriod * (0.6 + 0.8 * random(`pin-flashperiod-${i}`))),
        flashOffset: Math.floor(random(`pin-flashoffset-${i}`) * 10_000),
        variant: Math.floor(random(`pin-avatar-${i}`) * P.avatarVariants),
      });
    }
    return out;
  }, [P]);

  const avatars = useMemo(() => makeAvatarVariants(theme), [theme]);

  const meshes = useMemo(() => {
    // Unit-height stem with its base at y=0 so scaleY = current height.
    const stemGeo = new THREE.CylinderGeometry(P.stemRadius, P.stemRadius, 1, 6, 1, true);
    stemGeo.translate(0, 0.5, 0);
    const ringGeo = new THREE.TorusGeometry(P.ringRadius, P.ringTube, 10, 36);
    const discGeo = new THREE.CircleGeometry(P.discRadius, 32);

    const white = new THREE.Color(1, 1, 1);
    const makeInstanced = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.frustumCulled = false;
      // Allocate instanceColor up front.
      for (let i = 0; i < count; i++) mesh.setColorAt(i, white);
      return mesh;
    };

    const stems = makeInstanced(stemGeo, new THREE.MeshBasicMaterial(), pins.length);
    const rings = makeInstanced(ringGeo, new THREE.MeshBasicMaterial(), pins.length);
    // One bright dot cycles up each stem.
    const stemDots = makeInstanced(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial(),
      pins.length,
    );
    const discs = avatars.map((v, vi) =>
      makeInstanced(
        discGeo,
        new THREE.MeshBasicMaterial({map: v.texture}),
        pins.filter((p) => p.variant === vi).length,
      ),
    );
    return {stems, rings, stemDots, discs};
  }, [P, pins, avatars]);

  const palette = useMemo(
    () => ({
      pin: new THREE.Color(theme.pin),
      hot: new THREE.Color(theme.pinHot),
    }),
    [theme],
  );

  useLayoutEffect(() => {
    const pose = cameraPose(frame / durationInFrames);
    const [camX, camY, camZ] = pose.position;
    const tNoise = (frame / fps) * CONFIG.terrain.breatheSpeed;

    // Screen-aligned billboard rotation = the camera's own orientation.
    const camQ = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(
        new THREE.Vector3(...pose.position),
        new THREE.Vector3(...pose.target),
        new THREE.Vector3(0, 1, 0),
      ),
    );

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const noRot = new THREE.Quaternion();
    const color = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const discCursor = new Array(avatars.length).fill(0);

    pins.forEach((pin, i) => {
      const visible = pin.z > camZ - 2 && pin.z < camZ + CONFIG.contours.fadeEnd + 20;
      const local = frame - pin.riseStart;
      const growth =
        local <= 0
          ? 0
          : spring({
              frame: local,
              fps,
              config: {damping: 11, stiffness: 130, mass: 1},
            });

      const di = discCursor[pin.variant]++;
      if (!visible || growth <= 0.001) {
        meshes.stems.setMatrixAt(i, zero);
        meshes.rings.setMatrixAt(i, zero);
        meshes.stemDots.setMatrixAt(i, zero);
        meshes.discs[pin.variant].setMatrixAt(di, zero);
        return;
      }

      const baseY = heightField(pin.x, pin.z, tNoise);
      const stemH = P.stemHeight * pin.scale * growth;
      const topY = baseY + stemH;

      m.compose(
        pos.set(pin.x, baseY, pin.z),
        noRot,
        scl.set(pin.scale, stemH, pin.scale),
      );
      meshes.stems.setMatrixAt(i, m);

      const headScale = pin.scale * Math.min(growth, 1.15);
      m.compose(pos.set(pin.x, topY, pin.z), camQ, scl.set(headScale, headScale, headScale));
      meshes.rings.setMatrixAt(i, m);

      // Nudge the disc toward the camera so it never z-fights the ring.
      const toCam = pos.set(camX - pin.x, camY - topY, camZ - pin.z).normalize().multiplyScalar(0.05);
      m.compose(
        new THREE.Vector3(pin.x + toCam.x, topY + toCam.y, pin.z + toCam.z),
        camQ,
        scl.set(headScale, headScale, headScale),
      );
      meshes.discs[pin.variant].setMatrixAt(di, m);

      // A dot travels up the stem, looping — seeded phase per pin.
      if (growth > 0.3) {
        const cycle = P.stemDotCycleSeconds * fps * (0.8 + 0.4 * (pin.pulsePhase / (Math.PI * 2)));
        const frac = ((frame / cycle + pin.pulsePhase) % 1 + 1) % 1;
        const ds = P.stemDotSize * pin.scale;
        m.makeScale(ds, ds, ds);
        m.setPosition(pin.x, baseY + stemH * frac, pin.z);
        meshes.stemDots.setMatrixAt(i, m);
      } else {
        meshes.stemDots.setMatrixAt(i, zero);
      }

      // Glow: seeded ±12% pulse, plus an occasional few-frame flash.
      let glow = 1 + P.pulseAmount * Math.sin((Math.PI * 2 * frame) / pin.pulsePeriod + pin.pulsePhase);
      const flashing = (frame + pin.flashOffset) % pin.flashPeriod < P.flashFrames;
      if (flashing) glow *= P.flashBoost;

      color.copy(palette.pin).multiplyScalar(0.85 * glow);
      meshes.stems.setColorAt(i, color);
      color.copy(palette.pin).lerp(palette.hot, 0.6).multiplyScalar(1.35 * glow);
      meshes.rings.setColorAt(i, color);
      color.copy(palette.hot).multiplyScalar(P.stemDotBrightness * glow);
      meshes.stemDots.setColorAt(i, color);
      color.setScalar(flashing ? 1.35 : 0.92 + 0.08 * glow);
      meshes.discs[pin.variant].setColorAt(di, color);
    });

    for (const mesh of [meshes.stems, meshes.rings, meshes.stemDots, ...meshes.discs]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [frame, fps, durationInFrames, pins, meshes, avatars.length, heightField, palette, P]);

  return (
    <group>
      <primitive object={meshes.stems} />
      <primitive object={meshes.rings} />
      <primitive object={meshes.stemDots} />
      {meshes.discs.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
};
