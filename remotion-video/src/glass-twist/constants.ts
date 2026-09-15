// Timing, geometry and motion config for the "glass twist" loop.
//
// The shape is a long stack of identical rounded-rectangle glass frames
// ("plates") threaded along one axis. Each successive plate is rotated a
// fixed step about that axis, which turns the stack into a helical twist.
// Animating a single scalar offset slides every plate one notch further
// along the axis (and one notch further around it), so after exactly
// LOOP_ADVANCE_PLATES notches the stack is indistinguishable from its
// starting state -- that is what makes the video loop endlessly.

export const FPS = 30;

// 20s, matching the reference clip (600 frames @ 30fps).
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Plate geometry (world units) -----------------------------------------

// Outer silhouette of one plate: a rounded square.
export const PLATE_OUTER_SIZE = 2.05;
export const PLATE_CORNER_RADIUS = 0.58;

// Loops are rounded rectangles, not squares: the reference's bars have a
// long straight run, and that run is what carries the long diagonal
// streak. Height = PLATE_OUTER_SIZE x PLATE_ASPECT.
export const PLATE_ASPECT = 1.32;

// The bar is a rod of circular cross-section bent into a closed rounded
// square. Measured off the reference, the rod is about 10% of the plate's
// outer size across -- a thin rod bent into a loop, not a chunky frame.
// The large opening is what lets you see the plates behind.
export const PLATE_TUBE_RADIUS = 0.115;

// Tessellation of that rod. The tubular count has to be generous: the
// highlight streak runs along the rod, so any faceting there shows up
// directly as a stepped highlight.
export const PLATE_TUBULAR_SEGMENTS = 260;
export const PLATE_RADIAL_SEGMENTS = 16;

// --- Stack layout ---------------------------------------------------------

// Plates are laid along the local +Z axis. The count is deliberately
// generous: the loop works by the stack sliding one notch, which swaps a
// bar off one end for a new one at the other, so both ends must sit well
// clear of frame -- including the loops' own height, not just their
// centres. Too short a stack shows up as a faint pop at the loop point. Spacing is measured off the
// reference too: its stripe pitch is ~1/7.8 of a plate's on-screen size,
// so the loops sit nearly touching. The stack is built longer than the
// camera can see so both ends stay off-screen.
export const PLATE_COUNT = 46;
export const PLATE_SPACING = 0.315;

// Rotation added per plate, in radians. ~6.4 degrees means the stack turns
// through roughly half a revolution across the visible span, which gives
// the single "waist" (edge-on pinch) seen in the reference.
export const TWIST_PER_PLATE = 0.112;

// --- Motion ---------------------------------------------------------------

// How many plate notches the stack advances over one full loop. Any
// integer loops seamlessly; this controls apparent speed.
//
// 55 is measured from the reference clip: tracking the phase of the
// dominant stripe frequency along the stack axis across 60 consecutive
// reference frames gives 0.0917 notches/frame, i.e. 55.0 over 600 frames.
export const LOOP_ADVANCE_PLATES = 55;

// A gentle travelling bend applied across the stack so the silhouette
// breathes instead of being a rigid straight tube. Amplitude is in world
// units; the wavelength is expressed in plates and the wave travels along
// the axis once per loop.
export const BEND_AMPLITUDE = 0.10;
export const BEND_WAVELENGTH_PLATES = 34;

// --- Camera ---------------------------------------------------------------

// Solved jointly, not eyeballed, from three measurements off the
// reference: a face-on loop spans ~74% of frame height at frame centre,
// perspective is mild (near loops only ~1.35x the far ones), and ~28
// bars cross the frame.
//
// The band-height profile across the reference peaks at frame centre and
// falls off at both edges. That is the twist, not perspective: loops are
// face-on mid-frame and rotate towards edge-on at either side, which is
// what fixes the twist rate at roughly half a turn across the frame. Those pin down field of view, camera distance and plate spacing
// together -- tuning any one of them alone just breaks the other two.
export const CAMERA_FOV = 22;
export const CAMERA_DISTANCE = 8.6;

// Orientation of the stack axis in the camera's view, solved from two
// measurements off the reference rather than eyeballed:
//
//  - the axis climbs ~12 degrees from lower-left to upper-right (fitted
//    through the lit region's centroid, column by column), which fixes
//    the ratio of the axis's screen Y to its screen X;
//  - the loops are foreshortened to roughly 55% of their width, and that
//    compression factor IS the axis's Z component, which fixes how far
//    the axis leans towards the camera. Lean too far and the far end of
//    the stack piles up at the vanishing point into a wiry mess.
//
// Yaw is past 90 degrees on purpose: that points the far end of the
// stack away from the camera towards the upper right, so the big loops
// sit at the lower left exactly as they do in the reference. Flipping it
// puts the near end on the wrong side.
//
// Those two together give yaw 113 / pitch -11. Getting the second one
// wrong is what turns the rounded squares into flat capsules.
export const AXIS_YAW_DEG = 113;
export const AXIS_PITCH_DEG = -11;

// --- Post-processing ------------------------------------------------------

// Bloom, in normalised units, so it reads identically at 1080p and 4K.
export const BLOOM_STRENGTH = 1.0;
export const BLOOM_RADIUS = 0.42;
export const BLOOM_THRESHOLD = 0.13;
