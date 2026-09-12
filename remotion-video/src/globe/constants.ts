// Master design space. Everything in this scene is authored in 4K
// coordinates and scaled by `width / MASTER_WIDTH` at draw time, so the
// 1080p and 4K compositions are pixel-proportional to each other.
export const MASTER_WIDTH = 3840;
export const MASTER_HEIGHT = 2160;

export const FPS = 30;
/** 25.000s — same length as the reference clip. */
export const DURATION_IN_FRAMES = 750;

/** Pinhole focal length in master units (~65° horizontal FOV). */
export const FOCAL = 3000;

/** Globe placement, in master units, for the non-mirrored layout. */
export const GLOBE_CENTER_X = -170;
export const GLOBE_CENTER_Y = 30;
export const GLOBE_CENTER_Z = 2600;
export const GLOBE_RADIUS = 800;

/** Depth slab the ticker field lives in. */
export const FIELD_Z_NEAR = 820;
export const FIELD_Z_FAR = 7200;
export const FIELD_X = 4200;
export const FIELD_Y = 2400;
