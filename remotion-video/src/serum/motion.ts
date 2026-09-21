/**
 * Closed-form motion.
 *
 * Every transform is a pure function of the frame index. Nothing integrates,
 * nothing accumulates, and no value is carried between frames -- so frame 150
 * rendered on its own from a cold start is identical to frame 150 from a full
 * sequential render.
 */
import * as THREE from 'three';
import type { Cluster } from './build';
import { halfHeightAt } from './build';

/**
 * A small closed Lissajous path.
 *
 * Because every frequency is an integer, at t = 1 each term is
 * `sin(2*pi*f + phase) = sin(phase)` -- exactly where it started. That is what
 * lets the composition loop without a cut. Translating and wrapping at the
 * frame edge would pop instead.
 */
export const clusterPosition = (
  cluster: Cluster,
  t: number,
  frame: number,
  target: THREE.Vector3,
): THREE.Vector3 => {
  const TWO_PI = Math.PI * 2;
  target.set(
    cluster.center[0] + cluster.amp[0] * Math.sin(TWO_PI * cluster.freq[0] * t + cluster.phase[0]),
    cluster.center[1] + cluster.amp[1] * Math.sin(TWO_PI * cluster.freq[1] * t + cluster.phase[1]),
    cluster.center[2] + cluster.amp[2] * Math.sin(TWO_PI * cluster.freq[2] * t + cluster.phase[2]),
  );

  if (cluster.rise !== undefined) {
    // Look 5 is not a loop: bubbles rise at a steady rate, leave the top and
    // re-enter below. The wrap happens well outside the frame, so it never
    // shows as a pop.
    const span = halfHeightAt(cluster.center[2]) * 2 + 4;
    const travelled = cluster.center[1] + cluster.rise * frame + span / 2;
    target.y = ((travelled % span) + span) % span - span / 2 + (target.y - cluster.center[1]);
  }
  return target;
};

/**
 * Rotation about a fixed axis by an integer number of full turns over the
 * composition. A single element on a fractional turn would break the loop for
 * the whole frame, so `turns` is always an integer -- see build.ts.
 */
export const clusterQuaternion = (cluster: Cluster, t: number, target: THREE.Quaternion, axis: THREE.Vector3) => {
  axis.set(cluster.axis[0], cluster.axis[1], cluster.axis[2]).normalize();
  return target.setFromAxisAngle(axis, cluster.turns * Math.PI * 2 * t);
};
