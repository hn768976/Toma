/**
 * Dialog geometry, in composition pixels.
 *
 * The dialog is 0.34 of the frame width; every part of it is a fixed
 * ratio of that, taken off the reference frame, so changing WIDTH alone
 * rescales the whole window coherently.
 */
import { VIDEO } from "../theme";

const WIDTH = Math.round(VIDEO.width * 0.34);

export const DIALOG = {
  width: WIDTH,
  height: Math.round(WIDTH * 0.515),
  titleBar: Math.round(WIDTH * 0.057),
  footer: Math.round(WIDTH * 0.062),
  border: 4,

  fieldWidth: Math.round(WIDTH * 0.732),
  fieldHeight: Math.round(WIDTH * 0.08),
  fieldGap: Math.round(WIDTH * 0.035),
  fieldPadding: Math.round(WIDTH * 0.017),

  button: {
    width: Math.round(WIDTH * 0.24),
    height: Math.round(WIDTH * 0.036),
    indicator: Math.round(WIDTH * 0.028),
  },

  alert: {
    glyph: Math.round(WIDTH * 0.2),
    gap: Math.round(WIDTH * 0.035),
    label: Math.round(WIDTH * 0.063),
  },
} as const;
