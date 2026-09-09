// Compositions are authored at 4K. Previews are rendered with --scale=0.5,
// which is why every size below is expressed as a fraction of frame height
// rather than in absolute pixels.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// One loop. Every animated value in this project is a periodic function of
// `frame / DURATION_IN_FRAMES`, so frame 300 lands back on frame 0.
export const DURATION_IN_FRAMES = 300;
