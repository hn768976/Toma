// All compositions are authored in 4K UHD. Deliverables are rendered at 1080p
// with --scale=0.5 (see README); 4K renders use the default scale.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// Reference 1 (deep rays) is 20.04 s long, reference 2 (surface) 10.01 s.
// At 30 fps the closest whole-frame lengths are 601 frames (20.033 s) and
// 300 frames (10.000 s); both are within a single frame of the reference.
export const DEEP_RAYS_FRAMES = 601;
export const SURFACE_RAYS_FRAMES = 300;
