// Censored Terminal story timeline (frames at 30 fps, 450 frames = 15 s).

export const STORY_FRAMES = 450;

export const T = {
  bootEnd: 21, // 0-0.7 s: black screen, boot glitch letters, blinking cursor
  // 0.7-4.5 s: three lines type on at 25 characters/second. Each line starts while the
  // previous one is still typing (0.65 s stagger) so all three finish inside the window.
  lineStart: [21, 41, 60],
  framesPerChar: 30 / 25,
  typeEnd: 135,
  // 4.5-6.0 s: highlight bars sweep each line (0.3 s each), becoming redaction bars.
  hlStart: [135, 150, 165],
  hlDur: 9,
  // 6.0-6.8 s: whip pan to the label (motion blur from sub-frames), RGB-split glitch.
  whipStart: 180,
  whipEnd: 204,
  glitch: [191, 195], // [start, end) frames of the RGB split
  // 6.8-7.5 s: label strip slides in and settles with an overshoot.
  labelIn: [204, 225],
  // 7.5-15 s: hold, slow push-in, background shape glitches about every 2 s for 2-3 frames.
  bgGlitches: [
    [246, 3],
    [305, 2],
    [366, 3],
    [424, 2],
  ] as [number, number][],
};

export const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
export const smoother = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const easeOutBack = (x: number, s = 1.3) => {
  const t = clamp01(x) - 1;
  return 1 + t * t * ((s + 1) * t + s);
};
