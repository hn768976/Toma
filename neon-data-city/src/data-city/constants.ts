/**
 * Master composition constants.
 *
 * The composition is authored at 4K. Every size that needs to look identical
 * at 1080p and at 4K is expressed in *composition pixels* and converted to
 * device pixels inside the shaders, so `--scale=0.5` and `--scale=1` produce
 * the same picture at different resolutions.
 */
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;

/** Distance between two neighbouring lattice intersections, in world units. */
export const CELL = 1;

/** Background of the void the grid dissolves into. */
export const BACKGROUND = "#020208";
