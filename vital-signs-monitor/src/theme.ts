/**
 * Two palettes. Colours sampled from the reference clip:
 *   digits #54beb4, trace core #ebffff, grey block #bebdc0.
 */

export type Theme = {
  /** Saturated phosphor colour used for the glow halo and the digits. */
  trace: string;
  /** Hot, near-white core of the stroke. */
  traceCore: string;
  /** Heart-rate number - on a real monitor it always matches the ECG lead. */
  hr: string;
  /** Secondary readout below the HR number. */
  sub: string;
  /** Far-left repeat trace and marker squares. */
  accent: string;
  grey: string;
};

export const TEAL: Theme = {
  trace: '#3fd6bc',
  traceCore: '#ebffff',
  hr: '#54beb4',
  sub: '#57b6ad',
  accent: '#3fd6bc',
  grey: '#bebdc0',
};

export const RED: Theme = {
  trace: '#ff2f3c',
  traceCore: '#ffdedb',
  hr: '#f0323c',
  sub: '#57b6ad',
  accent: '#ff2f3c',
  grey: '#bebdc0',
};
