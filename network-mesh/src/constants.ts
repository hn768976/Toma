// Composition geometry. Everything in this project is authored at 4K and
// scaled down at render time (`--scale=0.5`), never re-laid-out, so all
// pixel sizes below are 4K pixels.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 450;

// Nodes are seeded across a region larger than the frame so the mesh has no
// visible border and edges can run in from off-screen.
export const FIELD_MARGIN = 340;
