// Canonical composition geometry. The canvas backing store is always this
// size; `npx remotion render --scale=0.5` downsamples the captured frame,
// it does not change what we draw into.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 390; // 13.0s, seamless loop

// Every periodic value in the piece is a function of this normalised loop
// phase, so frame 0 and frame 390 evaluate identically.
export const loopPhase = (frame: number) =>
  (((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES) /
  DURATION_IN_FRAMES;

// Reroll / flash cadences are expressed in whole frames that divide 390
// exactly, so the last bucket of the loop is followed by bucket 0.
export const READOUT_BUCKET = 5; // 6 rerolls per second
export const FLASH_BUCKET = 13; // ~2.3 flashes per second

/**
 * Ambient camera move: a closed figure-eight of +-8px, so there is life in the
 * frame without a camera "move". Zero at phase 0, which keeps the loop shut.
 */
export const AMBIENT_DRIFT = 8;
export const cameraDrift = (frame: number) => {
  const ph = loopPhase(frame) * Math.PI * 2;
  return {
    x: Math.sin(ph) * AMBIENT_DRIFT,
    y: Math.sin(ph * 2) * AMBIENT_DRIFT,
  };
};

/**
 * The HUD plane drifts by exactly one content tile over the loop, opposite to
 * the jet's travel. Scrolling content is periodic over exactly this distance,
 * so the drift has no visible seam and frame 390 lands back on frame 0.
 */
export const PLANE_TILE = 1600;
export const GRID_SPACING = 100; // 1600 / 16
