import * as THREE from "three";
import { mulberry32, range } from "../engine/random";
import { TimedSpline, lerp, smoothstep } from "../engine/spline";
import type { NetworkLayout } from "./network";

export type CameraState = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  roll: number;
  fov: number;
  /** focus distance in world units */
  focus: number;
  /** 0..1 overall exposure (used for the closing fade) */
  exposure: number;
};

export type CameraRig = {
  name: string;
  /** hubs "switch on" when the camera first comes within this distance */
  revealDistance: number;
  firstHubBirth: number;
  /** switch hubs on one after another instead of on camera approach */
  staggeredReveal?: boolean;
  /** defocus strength (px at 1080 for objects at infinity) */
  aperture: number;
  /** atmospheric falloff per world unit */
  fog: number;
  sample: (t: number) => Omit<CameraState, "focus">;
};

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);

/**
 * Version 1 — matches the reference: a continuous forward fly-through that
 * hops from hub to hub, passing each one off-centre so it sweeps across
 * the frame, with gentle banking.
 */
export const flyThroughRig = (
  layout: NetworkLayout,
  duration: number,
): CameraRig => {
  const rng = mulberry32(919);
  const hubs = layout.tour;
  const n = hubs.length;
  const t0 = 2.55;
  const step = (duration - 1.9 - t0) / (n - 1);
  const times = hubs.map((_, i) => t0 + i * step);

  const dir = (i: number) => {
    const a = hubs[Math.max(0, Math.min(n - 2, i))];
    const b = hubs[Math.max(1, Math.min(n - 1, i + 1))];
    return b.clone().sub(a).normalize();
  };

  const camKeys: { t: number; v: THREE.Vector3 }[] = [];
  const startDir = dir(0);
  camKeys.push({
    t: 0,
    v: hubs[0]
      .clone()
      .sub(startDir.clone().multiplyScalar(4))
      .add(v3(1.5, 1.0, 17)),
  });
  hubs.forEach((h, i) => {
    const d = dir(i).add(dir(i - 1)).normalize();
    const side = new THREE.Vector3().crossVectors(d, UP).normalize();
    const s = i % 2 === 0 ? 1 : -1;
    const off = side
      .multiplyScalar(s * range(rng, 3.6, 5.4))
      .add(UP.clone().multiplyScalar(range(rng, -2.2, 2.2)));
    camKeys.push({ t: times[i], v: h.clone().add(off).sub(d.multiplyScalar(1.5)) });
  });
  const lastDir = dir(n - 1);
  const endPos = camKeys[camKeys.length - 1].v
    .clone()
    .add(lastDir.clone().multiplyScalar(13))
    .add(v3(0, 2.5, 0));
  camKeys.push({ t: duration, v: endPos });

  const tgtKeys: { t: number; v: THREE.Vector3 }[] = [
    { t: 0, v: hubs[0].clone() },
    { t: 1.7, v: hubs[0].clone() },
  ];
  for (let i = 1; i < n; i++) {
    tgtKeys.push({ t: times[i - 1] + 0.3, v: hubs[i].clone() });
  }
  tgtKeys.push({
    t: duration,
    v: endPos.clone().add(lastDir.clone().multiplyScalar(30)).add(v3(6, -4, 0)),
  });

  const camSpline = new TimedSpline(camKeys);
  const tgtSpline = new TimedSpline(tgtKeys);
  return {
    name: "fly-through",
    revealDistance: 30,
    firstHubBirth: 0.55,
    aperture: 24,
    fog: 0.012,
    sample: (t) => {
      const pos = camSpline.at(t);
      pos.add(
        v3(
          Math.sin(t * 1.3) * 0.06,
          Math.sin(t * 1.7 + 1) * 0.06,
          Math.sin(t * 1.1 + 2) * 0.04,
        ),
      );
      return {
        pos,
        target: tgtSpline.at(t),
        roll: 0.14 * Math.sin(t * 0.33 + 0.8) + 0.05 * Math.sin(t * 0.9),
        fov: 50,
        exposure: 1 - 0.65 * smoothstep(duration - 1.2, duration, t),
      };
    },
  };
};

/**
 * Version 2 — alternative camera movement: a slow, descending crane-orbit
 * around the whole network on a longer lens. The camera starts high and
 * wide, revealing the structure, then arcs down and dollies in until hubs
 * slide through the foreground, with rack focus between nodes.
 */
export const orbitRig = (layout: NetworkLayout, duration: number): CameraRig => {
  const C = layout.center;
  const R = layout.radius;
  return {
    name: "crane-orbit",
    revealDistance: R * 2.2,
    firstHubBirth: 0.0,
    staggeredReveal: true,
    aperture: 18,
    fog: 0.004,
    sample: (t) => {
      const u = t / duration;
      const e = u * u * (3 - 2 * u);
      const theta = 0.6 - 2.3 * (0.35 * u + 0.65 * e);
      const r = lerp(R * 1.75, R * 0.55, e);
      const y = C.y + lerp(R * 0.95, -R * 0.12, Math.pow(e, 0.85));
      const pos = v3(C.x + Math.cos(theta) * r, y, C.z + Math.sin(theta) * r);
      const target = C.clone().add(
        v3(
          Math.sin(t * 0.21 + 0.5) * R * 0.18,
          Math.sin(t * 0.17) * R * 0.08,
          Math.cos(t * 0.19 + 1.1) * R * 0.18,
        ),
      );
      return {
        pos,
        target,
        roll: -0.05 + 0.1 * e + 0.03 * Math.sin(t * 0.5),
        fov: lerp(60, 40, e),
        exposure: 1 - 0.65 * smoothstep(duration - 1.2, duration, t),
      };
    },
  };
};

/**
 * Pre-computes every frame's camera, including an automatic focus puller
 * that racks to whichever hub sits closest to the centre of frame. The
 * focus is smoothed over time, so it is a pure function of the frame index
 * (identical in every render worker).
 */
export const computeStates = (
  rig: CameraRig,
  layout: NetworkLayout,
  fps: number,
  frames: number,
): CameraState[] => {
  const hubs = [...layout.tour, ...layout.extra];
  const out: CameraState[] = [];
  let focus = -1;
  for (let f = 0; f < frames; f++) {
    const s = rig.sample(f / fps);
    const fwd = s.target.clone().sub(s.pos).normalize();
    let best = Infinity;
    let bestDist = s.target.distanceTo(s.pos);
    for (const h of hubs) {
      const d = h.clone().sub(s.pos);
      const dist = d.length();
      const along = d.dot(fwd);
      if (along < 2) continue;
      const ang = Math.acos(Math.min(1, along / dist));
      if (ang > 0.42) continue;
      const score = ang * 3 + dist * 0.02;
      if (score < best) {
        best = score;
        bestDist = dist;
      }
    }
    focus = focus < 0 ? bestDist : focus + (bestDist - focus) * 0.12;
    out.push({ ...s, focus: Math.max(3, focus) });
  }
  return out;
};
