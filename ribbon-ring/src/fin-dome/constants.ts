// Timing matches the reference clip exactly: 6.0 s, re-timed to 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 180;

// Compositions are authored at 4K; the 1080p deliverable is rendered
// from the same composition with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Ring geometry (world units): FIN_COUNT thin washer-shaped slices of a
// torus (major radius MAJOR_RADIUS, tube radius TUBE_RADIUS), standing
// side by side around the ring like the gills of a mushroom.
export const MAJOR_RADIUS = 36;
export const TUBE_RADIUS = 3.2;
export const TUBE_INNER_RADIUS = 1.1;
export const FIN_COUNT = 396;
export const FIN_THICKNESS = 0.16;

// Only the stretch of ring facing the camera is drawn (the far side
// would otherwise cross the top of frame, which the reference never
// shows): NEAR_ANGLE is the ring angle nearest the camera (+z side),
// VISIBLE_ARC how much of the ring around it is drawn.
export const NEAR_ANGLE = Math.PI / 2;
export const VISIBLE_ARC = (Math.PI * 2) / 3;

// The ring turns by exactly one fin spacing per loop, so frame 0 and
// frame DURATION_IN_FRAMES are identical and the clip loops seamlessly
// (same as the reference).
export const LOOP_ROTATION = (Math.PI * 2) / FIN_COUNT;
