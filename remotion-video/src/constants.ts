// Global timing, sizing and palette for the "How Bluetooth Works" explainer.
// Change values here to re-time or re-skin the whole video.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene lengths, in frames. Sum must equal DURATION_IN_FRAMES.
export const TITLE_DURATION = 150; // 0:00 - 0:05
export const DEVICES_DURATION = 180; // 0:05 - 0:11
export const PAIRING_DURATION = 210; // 0:11 - 0:18
export const TRANSFER_DURATION = 240; // 0:18 - 0:26
export const OUTRO_DURATION = 120; // 0:26 - 0:30

export const DURATION_IN_FRAMES =
  TITLE_DURATION +
  DEVICES_DURATION +
  PAIRING_DURATION +
  TRANSFER_DURATION +
  OUTRO_DURATION;

// Absolute frame where each scene starts, handy for debugging in the timeline.
export const SCENE_START = {
  title: 0,
  devices: TITLE_DURATION,
  pairing: TITLE_DURATION + DEVICES_DURATION,
  transfer: TITLE_DURATION + DEVICES_DURATION + PAIRING_DURATION,
  outro:
    TITLE_DURATION + DEVICES_DURATION + PAIRING_DURATION + TRANSFER_DURATION,
};

// Hand-drawn / whiteboard palette. Swap these to re-theme the whole video.
export const PALETTE = {
  paper: "#FAF3E4",
  paperDot: "rgba(43, 38, 30, 0.08)",
  ink: "#2B2620",
  blue: "#2F6FED",
  blueSoft: "#AFC9FA",
  orange: "#F2A93B",
  green: "#3F9A6B",
  red: "#E1584B",
  white: "#FFFDF8",
};

export const FONT_FAMILY = "Patrick Hand";
