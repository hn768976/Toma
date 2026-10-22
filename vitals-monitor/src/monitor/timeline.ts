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
  k(0.34, "11"),
  k(0.5, "10"),
  k(0.84, "8"),
  k(1.0, "6"),
  k(1.34, "5"),
  k(1.5, "3"),
  k(1.84, "2", true),
  k(2.0, "0", true),
];

export const MID_READOUT: Readout[] = [
  k(0, "32"),
  k(0.34, "24"),
  k(0.5, "16"),
  k(0.67, "8"),
  k(0.84, "5"),
  k(1.67, "4"),
  k(3.17, "3"),
  k(3.67, "2"),
  k(3.9, "0", true),
];

export const BOTTOM_READOUT: Readout[] = [
  k(0, "16"),
  k(0.67, null),
  k(1.17, "7"),
  k(1.5, "8"),
  k(1.84, null),
  k(3.3, "0"),
  k(4.5, null),
  k(5.45, "0", true),
  k(6.85, null, true),
  k(7.2, "0", true),
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
export const ALARM_TOP = 1.84;
export const ALARM_MID = 3.9;
export const ALARM_BOTTOM = 5.45;
