import { smoothstep } from "../engine/math";

/** All timings in seconds (reference clip is 13.4 s long). */
export const DURATION_S = 13.4;

export const timeline = (t: number) => {
  const flashUp = t >= 12.92 ? 0 : Math.pow(smoothstep(12.6, 12.91, t), 4);
  return {
    // opening sphere and its burst
    burstStart: 1.45,
    burst: smoothstep(1.35, 3.7, t),
    sphereAlpha: 1 - smoothstep(2.65, 3.5, t),
    streak: smoothstep(1.7, 2.15, t) * (1 - smoothstep(2.65, 3.25, t)),
    // network
    field: (0.2 + 0.8 * smoothstep(1.8, 4.4, t) + 0.25 * smoothstep(5.5, 8.5, t)) * (1 - smoothstep(12.55, 12.9, t)),
    icons: smoothstep(3.4, 5.0, t) * (1 - smoothstep(9.4, 10.9, t)),
    links: smoothstep(3.6, 5.2, t) * (1 - smoothstep(11.6, 12.4, t)),
    beams: smoothstep(3.4, 5.0, t) * (1 - smoothstep(11.8, 12.4, t)),
    circuits: (0.55 + 0.45 * smoothstep(2.6, 4.0, t)) * (1 - 0.7 * smoothstep(9.0, 10.5, t)) * (1 - smoothstep(11.8, 12.5, t)),
    // finale
    lattice: smoothstep(8.8, 10.6, t) * (1 - smoothstep(12.45, 12.85, t)),
    ring: smoothstep(9.7, 10.9, t) * (1 - smoothstep(12.25, 12.65, t)),
    chip: smoothstep(10.8, 11.5, t),
    core: 0.25 + 0.75 * smoothstep(3.2, 5.5, t),
    haze: 0.3 + 0.7 * smoothstep(3.4, 5.6, t) + 0.35 * smoothstep(5.5, 8.5, t) + 0.3 * smoothstep(11.6, 12.75, t),
    rays: smoothstep(10.9, 12.7, t),
    raysZoom: smoothstep(12.35, 12.92, t),
    flashUp,
    // post-flash: rotating light fan that decays to black
    fan: t >= 12.92 ? 1 - smoothstep(12.97, 13.17, t) : 0,
    black: t >= 13.2,
    backdrop: 1 - smoothstep(1.2, 2.2, t),
    // depth-of-field focus distance (world units)
    focus: 14 + 14 * smoothstep(1.3, 2.6, t) + 12 * smoothstep(3.4, 5.0, t) + 30 * smoothstep(9.0, 11.0, t),
  };
};
export type TimelineState = ReturnType<typeof timeline>;
