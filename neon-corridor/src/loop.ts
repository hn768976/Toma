import {CORRIDOR_DEPTH, FRAME_COUNT, SPACING, TRAVEL_SPACINGS, Z_SLOT0} from './config';

/**
 * The loop.
 * ---------
 * The camera travels forward a whole number of frame-spacings
 * (TRAVEL_SPACINGS) over the composition, and tubes are recycled from the back
 * to the front. We express that with the camera pinned at the origin and the
 * corridor sliding past it, which is equivalent and keeps the reflection/DOF
 * maths in a fixed frame.
 *
 * Tube `k` sits at slot `m = (k - TRAVEL_SPACINGS * t) mod FRAME_COUNT`, where
 * `t` goes 0 -> 1 across the loop, and slot `m` is at
 * `z = Z_SLOT0 - m * SPACING`.
 *
 * At t = 1 every tube has advanced exactly TRAVEL_SPACINGS slots — a whole
 * number — so the *set* of occupied positions is identical at t = 0 and t = 1.
 *
 * That gives the invariant this whole file exists to protect:
 *
 *   >  Any visual property that is a pure function of a tube's
 *   >  camera-relative position loops perfectly.
 *
 * So colour and brightness are keyed off `slot`/`depth`, never off the tube's
 * identity `k`. Keying colour off `k` would break the loop: at t = 1 a
 * *different* tube stands where tube k stood at t = 0.
 *
 * Flicker is the one exception, and is keyed off `k` on purpose — see
 * flicker.ts for why that is still exact.
 */

/** Normalised loop position in [0, 1). */
export const loopT = (frame: number, durationInFrames: number) =>
	(frame % durationInFrames) / durationInFrames;

/** Slot occupied by tube `k` at loop position `t`, in [0, FRAME_COUNT). */
export const slotOf = (k: number, t: number, offset = 0) => {
	const m = (k + offset - TRAVEL_SPACINGS * t) % FRAME_COUNT;
	return m < 0 ? m + FRAME_COUNT : m;
};

/** World z of a slot. The camera sits at z = 0 looking down -z. */
export const zOfSlot = (slot: number) => Z_SLOT0 - slot * SPACING;

/** Distance in front of the camera. Clamped: slot 0 is slightly behind it. */
export const depthOfSlot = (slot: number) => Math.max(0, slot * SPACING - Z_SLOT0);

export {CORRIDOR_DEPTH, FRAME_COUNT, SPACING, TRAVEL_SPACINGS, Z_SLOT0};
