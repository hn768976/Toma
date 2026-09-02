// 450 frames @ 30fps = 15.0s, and the piece has to loop seamlessly.
//
// THE RULE: every periodic motion in this project uses a period that divides
// 450 exactly. 450 = 2 * 3^2 * 5^2, so the usable periods are
//   1 2 3 5 6 9 10 15 18 25 30 45 50 75 90 150 225 450
// A period that does not divide 450 (60 is the tempting one) leaves the
// motion mid-stride at the cut, which reads as a hitch every 15 seconds even
// though frame 0 and frame 450 are individually identical.
export const FPS = 30;
export const DURATION = 450;

/** Wraps a frame into [0, DURATION). Everything downstream takes the wrapped
 *  value, which is what makes frame 450 identical to frame 0 by construction. */
export const loopFrame = (frame: number) => ((frame % DURATION) + DURATION) % DURATION;

// --- shared dashboard motion ------------------------------------------------
export const WAVEFORM_SCROLL_PERIOD = 150; // one pattern width per 5s
export const BAR_SLOW_PERIOD = 90;
export const BAR_FAST_PERIOD = 50;
export const GAUGE_SPRING_PERIOD = 90; // gauges re-target 5x across the loop
export const DASH_RADAR_PERIOD = 225; // dashboard radar: 2 slow turns
export const FLASH_SLOT = 10; // one panel border flash per 10 frames = 3/s
export const FLASH_LENGTH = 4; // frames a flash stays up
export const GRAIN_TILE_COUNT = 10;

// Data-table cells reroll on these periods (staggered per cell). 21 cells at
// an average period of ~100 frames lands at ~6 rerolls per second.
export const TABLE_PERIODS = [75, 90, 150] as const;

// --- centre element ---------------------------------------------------------
export const SEGMENT_RING_PERIOD = 150; // 3 full cycles across 450

// The brief asks for a 60-frame wifi pulse cycle, but 60 does not divide 450
// (450/60 = 7.5) and would visibly hitch at the loop point. 50 is the nearest
// divisor of 450 and holds the intent: an outward pulse roughly every 1.7s,
// 9 clean cycles across the loop.
export const WIFI_PULSE_PERIOD = 50;
export const WIFI_PULSE_STAGE_GAP = 8; // frames between dot -> arc1 -> arc2 -> arc3
export const WIFI_PULSE_WIDTH = 6; // frames a stage stays brightened

export const CRYPTO_BREATH_PERIOD = 75; // 6 cycles across 450
export const CENTRE_RADAR_PERIOD = 150; // exactly 3 full turns across 450
export const CENTRE_RADAR_CONTACT_DECAY = 40; // frames for a contact to fade out
