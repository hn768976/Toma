/** Composition is authored at 4K so it can be rendered at full size later. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15s

/**
 * Invented issuer. Nothing here maps to a real listed company — keep it that
 * way, and change it in this one place if a different name is ever wanted.
 */
export const TICKER = "NVX";
export const COMPANY_NAME = "Novaris Systems, Inc.";

/** A deliberately future session date, so the clip never dates itself. */
export const SESSION_DATE = "Nov 13, 2027";

/** A US-style regular session: 9:30 AM to 4:00 PM, one point per minute. */
export const SESSION_POINTS = 390;
export const SESSION_OPEN_MINUTES = 9 * 60 + 30;

/** Playhead sweep. Linear — this is a playback scrub, not an animation. */
export const SWEEP_START_FRAME = 10;
export const SWEEP_END_FRAME = 420;
export const HEADER_FADE_FRAMES = 15;
