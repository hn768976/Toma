export const FPS = 30;
// Compositions are defined at 4K. All drawing happens in a fixed 1920x1080
// design space mapped onto the real frame with an SVG viewBox, so every
// position, font size, blur radius and line width is a fraction of the frame.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const LOOP_FRAMES = 600; // looks 1 and 3: 20 s seamless loops
export const OPENER_FRAMES = 450; // look 2: 15 s, one-way opener (not a loop)

export const TAU = Math.PI * 2;
