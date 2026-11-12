export type CameraPose = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  /** camera roll in radians */
  roll: number;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** 0 -> 1 -> 0 over the loop with zero velocity at both ends (seamless). */
const pingPong = (loop: number) => 0.5 - 0.5 * Math.cos(loop * Math.PI * 2);

export const CAMERA_MOVES = {
  /**
   * Version 1 (reference match): gentle drift right-and-in towards the hero
   * vortex and back again, ending exactly where it started.
   */
  referenceDrift: (loop: number): CameraPose => {
    const s = pingPong(loop);
    return {
      position: mix3([0.2, 0.3, 5.9], [1.1, -0.45, 4.7], s),
      target: mix3([0.3, 0.1, -1], [1.1, -0.65, -1.6], s),
      fov: 46,
      roll: 0.06 * Math.sin(loop * Math.PI * 2),
    };
  },
  /**
   * Version 2 (alternative camera): starts wide and low, then sweeps in an arc
   * around the hero vortex and pushes down its throat with a slow barrel roll.
   */
  orbitPlunge: (loop: number): CameraPose => {
    // ease-in-out over the clip (one-way move, not a loop)
    const e = loop < 0.5 ? 4 * loop ** 3 : 1 - (-2 * loop + 2) ** 3 / 2;
    const ang = mix(-0.75, 0.35, e);
    const dist = mix(10.5, 3.6, e);
    const c = [1.15, -0.55, -1.2] as const;
    return {
      position: [c[0] + Math.sin(ang) * dist, c[1] + mix(-2.0, 0.2, e), c[2] + Math.cos(ang) * dist],
      target: [c[0], c[1], mix(c[2], -5.5, e)],
      fov: mix(40, 62, e),
      roll: mix(-0.25, 0.9, e),
    };
  },
} as const;

export type CameraMoveName = keyof typeof CAMERA_MOVES;
