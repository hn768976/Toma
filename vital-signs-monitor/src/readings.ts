/**
 * The numbers drift the way they do in the reference: heart rate hunts around
 * 60, the secondary value's middle digit steps between a handful of values.
 * Both are pure functions of the frame, so renders are reproducible.
 */

const HR_STEPS: {at: number; value: number}[] = [
  {at: 0, value: 60},
  {at: 104, value: 61},
  {at: 122, value: 60},
  {at: 141, value: 59},
  {at: 196, value: 60},
  {at: 243, value: 61},
  {at: 268, value: 60},
  {at: 319, value: 59},
  {at: 352, value: 60},
  {at: 409, value: 61},
  {at: 437, value: 60},
  {at: 470, value: 61},
];

const SUB_STEPS: {at: number; value: number}[] = [
  {at: 0, value: 160},
  {at: 74, value: 130},
  {at: 96, value: 120},
  {at: 148, value: 180},
  {at: 178, value: 120},
  {at: 214, value: 150},
  {at: 259, value: 120},
  {at: 300, value: 170},
  {at: 342, value: 160},
  {at: 388, value: 120},
  {at: 431, value: 190},
  {at: 476, value: 120},
];

const stepAt = (steps: {at: number; value: number}[], frame: number) => {
  let v = steps[0].value;
  for (const s of steps) {
    if (frame >= s.at) v = s.value;
    else break;
  }
  return v;
};

export const heartRate = (frame: number) => stepAt(HR_STEPS, frame);

/** Rendered as "1.2.0" - the display shows a separator between every digit. */
export const subReadout = (frame: number) =>
  String(stepAt(SUB_STEPS, frame)).split('').join('.');
