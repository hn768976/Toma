import {BASE_SCALE, ROLL_DEG, ZOOM_AMT} from './constants';

/**
 * The whole-frame camera move.
 *
 * Both channels are full cycles of a sinusoid rather than linear ramps, so they
 * are guaranteed to arrive back at their starting value on the loop point —
 * roll returns via sin(2*pi*t) and zoom via a raised cosine.
 *
 * @param t normalised time, 0 at frame 0 and 1 at the loop point.
 */
export const cameraAt = (t: number) => {
  const tau = Math.PI * 2 * t;
  const rollRad = (((ROLL_DEG / 2) * Math.sin(tau)) * Math.PI) / 180;
  const zoom = BASE_SCALE * (1 + ZOOM_AMT * 0.5 * (1 - Math.cos(tau)));
  return {rollRad, zoom};
};
