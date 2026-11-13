import { smoothstep } from "../engine/math";

/** All timings in seconds (reference clip is 13.4 s long). */
export const DURATION_S = 13.4;

export const timeline = (t: number) => {
  const flashUp = t >= 12.92 ? 0 : Math.pow(smoothstep(12.5, 12.92, t), 3);
  return {
    // opening sphere and its burst
    burstStart: 1.35,
    burst: smoothstep(1.35, 3.7, t),
    sphereAlpha: 1 - smoothstep(2.7, 4.0, t),
    streak: smoothstep(1.1, 1.7, t) * (1 - smoothstep(3.0, 3.9, t)),
    // network
    field: (0.2 + 0.8 * smoothstep(1.9, 3.9, t)) * (1 - smoothstep(12.55, 12.9, t)),
    icons: smoothstep(2.6, 4.2, t) * (1 - smoothstep(9.4, 10.9, t)),
    links: smoothstep(3.0, 4.6, t) * (1 - smoothstep(11.6, 12.4, t)),
    beams: smoothstep(3.4, 5.0, t) * (1 - smoothstep(11.8, 12.4, t)),
    circuits: (0.3 + 0.7 * smoothstep(2.6, 4.0, t)) * (1 - 0.7 * smoothstep(9.0, 10.5, t)) * (1 - smoothstep(11.8, 12.5, t)),
    // finale
    lattice: smoothstep(8.8, 10.6, t) * (1 - smoothstep(12.45, 12.85, t)),
    ring: smoothstep(9.7, 10.9, t) * (1 - smoothstep(12.25, 12.65, t)),
    chip: smoothstep(10.9, 11.7, t),
    core: 0.25 + 0.75 * smoothstep(3.2, 5.5, t),
    haze: 0.35 + 0.65 * smoothstep(2.5, 5.0, t) + 0.6 * smoothstep(10.5, 12.4, t),
    rays: smoothstep(10.7, 12.5, t),
    raysZoom: smoothstep(11.9, 12.92, t),
    flashUp,
    // post-flash: rotating light fan that decays to black
    fan: t >= 12.92 ? 1 - smoothstep(12.97, 13.2, t) : 0,
    black: t >= 13.2,
    // depth-of-field focus distance (world units)
    focus: 14 + 14 * smoothstep(1.3, 2.6, t) + 12 * smoothstep(3.4, 5.0, t) + 30 * smoothstep(9.0, 11.0, t),
  };
};
export type TimelineState = ReturnType<typeof timeline>;
