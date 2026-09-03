// Composition geometry. The canvas backing store matches these exactly, so
// every drawing coordinate below is in real 4K pixels.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// 300 frames @ 30fps = 10.0s. Every periodic quantity in the piece uses a
// whole number of cycles over this span, so frame 0 and frame 300 are
// pixel-identical and the clip loops seamlessly.
export const DURATION_IN_FRAMES = 300;
