// Vital-sign readouts, keyed to the reference footage (seconds -> displayed value).
// `null` means the readout has dropped out (blank), as happens on the real monitor.

export type Readout = { t: number; value: string | null; alarm: boolean };

const k = (t: number, value: string | null, alarm = false): Readout => ({
  t,
  value,
  alarm,
});

export const TOP_READOUT: Readout[] = [
  k(0, "13"),
  k(0.2, "11"),
  k(0.5, "10"),
  k(0.75, "8"),
  k(0.95, "6"),
  k(1.15, "5"),
  k(1.55, "3"),
  k(1.8, "2", true),
  k(1.95, "0", true),
];

export const MID_READOUT: Readout[] = [
  k(0, "32"),
  k(0.35, "24"),
  k(0.47, "16"),
  k(0.58, "8"),
  k(0.75, "5"),
  k(1.55, "4"),
  k(3.15, "3"),
  k(3.55, "2"),
  k(3.9, "0", true),
];

export const BOTTOM_READOUT: Readout[] = [
  k(0, "16"),
  k(0.55, null),
  k(1.35, "7"),
  k(1.75, "8"),
  k(2.35, null),
  k(3.15, "0"),
  k(4.35, null),
  k(5.35, "0", true),
  k(6.35, null, true),
  k(7.35, "0", true),
  k(11.4, null, true),
  k(11.7, "0", true),
  k(16.1, null, true),
  k(16.4, "0", true),
];

export const readoutAt = (keys: Readout[], t: number): Readout => {
  let cur = keys[0];
  for (const key of keys) {
    if (key.t <= t) cur = key;
  }
  return cur;
};

// When each channel's alarm latches (used for label / tick colouring).
export const ALARM_TOP = 1.8;
export const ALARM_MID = 3.9;
export const ALARM_BOTTOM = 5.35;
