import React, {useLayoutEffect, useMemo} from 'react';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {cameraPose} from './cameraPath';
import {CONFIG} from './config';
import {type HeightField} from './terrain';
import type {Theme} from './theme';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Dot = {
  seedX: number;
  seedZ: number;
  dir: 1 | -1;
  speed: number;
};

const EPS = 0.3;

/**
 * Bright dots traveling along the contour ropes.
 *
 * A dot lives on one iso-height level. Its seed point is projected onto that
 * level with a few Newton steps, then advanced along the line by stepping
 * perpendicular to the height-field gradient and re-projecting each step.
 * The whole path is re-integrated from frame 0 on every frame, so any render
 * worker computes the identical position for a given frame — deterministic
 * with zero cross-frame state. (The field is static: breatheSpeed = 0.)
 */
export const Dots: React.FC<{
  theme: Theme;
  heightField: HeightField;
}> = ({theme, heightField}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const D = CONFIG.dots;

  const dots = useMemo<Dot[]>(() => {
    const out: Dot[] = [];
    for (let i = 0; i < D.count; i++) {
      const sign = random(`dot-xsign-${i}`) < 0.5 ? -1 : 1;
      out.push({
        seedX: sign * D.xHalf * Math.pow(random(`dot-x-${i}`), 1.2),
        seedZ: D.zMin + (D.zMax - D.zMin) * random(`dot-z-${i}`),
        dir: random(`dot-dir-${i}`) < 0.5 ? -1 : 1,
        speed: D.speed * (0.7 + 0.6 * random(`dot-speed-${i}`)),
      });
    }
    return out;
  }, [D]);

  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial(),
      dots.length,
    );
    m.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < dots.length; i++) m.setColorAt(i, white);
    return m;
  }, [dots.length]);

  const dotColor = useMemo(() => new THREE.Color(theme.ropeDot), [theme]);

  useLayoutEffect(() => {
    const pose = cameraPose(frame / durationInFrames);
    const [camX, camY, camZ] = pose.position;
    const {fadeStart, fadeEnd, levelStep} = CONFIG.contours;
    const {tiltZ} = CONFIG.terrain;
    const t = 0; // static field

    // The dots ride the CONTOUR field (terrain noise + z-tilt) — the same
    // field the ropes are iso-lines of.
    const field = (x: number, z: number) => heightField(x, z, t) + tiltZ * z;

    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);

    dots.forEach((dot, i) => {
      let px = dot.seedX;
      let pz = dot.seedZ;
      // Each dot rides the rope nearest its seed point.
      const L = Math.round(field(px, pz) / levelStep) * levelStep;

      // Settle the seed onto the iso-line.
      let ok = false;
      for (let k = 0; k < 8; k++) {
        const h = field(px, pz);
        const gx = (field(px + EPS, pz) - h) / EPS;
        const gz = (field(px, pz + EPS) - h) / EPS;
        const g2 = gx * gx + gz * gz;
        if (g2 < 1e-6) break;
        const err = h - L;
        px -= (gx * err) / g2;
        pz -= (gz * err) / g2;
        if (Math.abs(err) < 0.004) {
          ok = true;
          break;
        }
      }
      if (!ok || Math.abs(field(px, pz) - L) > 0.05) {
        mesh.setMatrixAt(i, zero);
        return;
      }

      // Integrate along the line up to the current frame.
      const step = dot.speed / fps;
      for (let f = 1; f <= frame; f++) {
        const h = field(px, pz);
        const gx = (field(px + EPS, pz) - h) / EPS;
        const gz = (field(px, pz + EPS) - h) / EPS;
        const len = Math.hypot(gx, gz);
        if (len < 1e-4) break;
        px += (-gz / len) * step * dot.dir;
        pz += (gx / len) * step * dot.dir;
        // Project back onto the level.
        const h2 = field(px, pz);
        const gx2 = (field(px + EPS, pz) - h2) / EPS;
        const gz2 = (field(px, pz + EPS) - h2) / EPS;
        const g22 = gx2 * gx2 + gz2 * gz2;
        if (g22 > 1e-6) {
          const err = h2 - L;
          px -= (gx2 * err) / g22;
          pz -= (gz2 * err) / g22;
        }
      }

      const py = heightField(px, pz, t) + 0.16;
      const d = Math.hypot(px - camX, py - camY, pz - camZ);
      const behind = pz < camZ - 1.5;
      if (behind || d > fadeEnd) {
        mesh.setMatrixAt(i, zero);
        return;
      }

      m.makeScale(D.size, D.size, D.size);
      m.setPosition(px, py, pz);
      mesh.setMatrixAt(i, m);
      const fade = 1 - smoothstep(fadeStart, fadeEnd, d);
      color.copy(dotColor).multiplyScalar(D.brightness * (0.25 + 0.75 * fade));
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [frame, fps, durationInFrames, dots, mesh, heightField, dotColor, D]);

  return <primitive object={mesh} />;
};
