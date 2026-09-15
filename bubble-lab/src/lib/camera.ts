import type { VersionConfig } from '../versions';

/**
 * Distance that makes `frameHeight` world units exactly fill the frame at
 * z=0. Working back from framing rather than forward from a hand-picked
 * distance keeps every radius in `versions.ts` readable as a fraction of
 * the screen, and keeps framing identical when a version changes its fov.
 */
export const cameraDistance = (config: VersionConfig) =>
  config.camera.frameHeight / (2 * Math.tan((config.camera.fov * Math.PI) / 360));
