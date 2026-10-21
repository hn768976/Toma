// Everything an editor is likely to change lives here, one row each.
// Sizes are fractions of frame height (H) or width (W), so they hold at any resolution.

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const GREEN = "#00FF00";
export const BLACK = "#000000";

// Floating hearts: colours, how many on screen at once, size range (of H).
export const HEARTS = { colors: ["#FF8AA8", "#F04A78", "#C8203A"], density: 50, sizeMin: 0.025, sizeMax: 0.05 };

// Segment spinner: bar count, ring radius to bar centres (of H), bar length/width (of H), frames per step.
export const SPINNER_SEGMENTS = { color: "#FFFFFF", bars: 12, radius: 0.108, barLength: 0.075, barWidth: 0.048, stepFrames: 5 };

// Dot spinner: dot count, ring radius (of H), dot radius (of H), revolutions per 10 s loop.
export const SPINNER_DOTS = { color: "#FFFFFF", dots: 8, radius: 0.095, dotRadius: 0.026, revolutions: 10 };

// Bar waveform: bar count, span (of W), max height (of H), bar width as a fraction of the pitch.
export const WAVEFORM_BARS = { color: "#FFFFFF", bars: 48, span: 0.6, maxHeight: 0.56, barFill: 0.66 };

// Line waveform: span (of W), max amplitude (of H), line width (px at 4K), glow radius (px at 4K).
export const WAVEFORM_LINE = { color: "#FFFFFF", span: 0.6, amplitude: 0.2, lineWidth: 6, glow: 10 };

// Chalk bulb: chalk colour, bulb height (glass top to base bottom, of H).
export const IDEA_BULB = { color: "#F4F4F0", height: 0.44 };

// Daisies: petal / shade / centre colours, how many per depth layer.
export const DAISIES = { petal: "#FAFAF5", shade: "#D6D6D0", centre: "#F2B21A", far: 92, mid: 38, near: 10 };
