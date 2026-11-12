import { clamp, ease, Key, track } from '../lib/motion';
import { NovaPose } from '../characters/NovaRig';
import { Mouth } from '../characters/NovaFace';
import { blinkAt } from '../lib/motion';

export const NOVA_SIZE = 0.8;
export const CLAM_RIM_Y = 786;

// ---------------- keyframes (global frames) ----------------
// 0-60  pop-out of the clam, 60-135 swim, 135-150 point at the slate
const X: Key[] = [
  [0, 520], [32, 520, ease.rise], [42, 650, ease.inOut], [44, 672, ease.inOut], [50, 830, ease.out],
  [54, 836, ease.inOut], [60, 830, ease.inOut],
  [66, 814, ease.inOut], [118, 1074, ease.inOut], [126, 1058, ease.inOut], [132, 1066, ease.inOut], [135, 1064, ease.inOut],
  [141, 1040, ease.snap], [144, 1104, ease.inOut], [147, 1090, ease.inOut], [150, 1094],
];
const Y: Key[] = [
  [0, 1030], [24, 1030, ease.out], [28, 968, ease.inOut], [31, 996, ease.snap], [32, 996, ease.rise],
  [42, 400, ease.inOut], [44, 398, ease.fall], [50, 772, ease.out], [54, 768, ease.inOut], [60, 770, ease.inOut],
  [66, 778, ease.inOut], [118, 616, ease.inOut], [126, 606, ease.inOut], [135, 612, ease.inOut],
  [141, 620, ease.snap], [144, 596, ease.inOut], [147, 604, ease.inOut], [150, 602],
];
const ROT: Key[] = [
  [0, -82], [28, -80, ease.inOut], [31, -86, ease.inOut], [32, -86, ease.out], [40, -40, ease.inOut], [44, -6, ease.inOut],
  [48, 14, ease.out], [50, 10, ease.out], [53, -5, ease.inOut], [56, 2, ease.inOut], [60, 0, ease.inOut],
  [66, 7, ease.inOut], [76, -16, ease.inOut], [108, -10, ease.inOut], [120, 5, ease.inOut], [127, -2, ease.inOut], [135, 0, ease.inOut],
  [141, 7, ease.snap], [144, -21, ease.inOut], [147, -15, ease.inOut], [150, -16],
];
// vertical stretch in screen space (x = 1/y keeps volume)
const SQ: Key[] = [
  [0, 1], [28, 1.05, ease.inOut], [31, 0.86, ease.snap], [32, 0.86, ease.snap], [35, 1.3, ease.inOut], [40, 1.08, ease.inOut],
  [43, 0.95, ease.inOut], [45, 1, ease.in], [49, 1.12, ease.snap], [50, 1.1, ease.snap], [52, 0.8, ease.out],
  [55, 1.07, ease.inOut], [58, 0.96, ease.inOut], [61, 1, ease.inOut],
  [66, 0.92, ease.snap], [70, 1.06, ease.inOut], [76, 1],
  [135, 1, ease.inOut], [141, 0.92, ease.snap], [143, 1.08, ease.inOut], [146, 0.98, ease.inOut], [149, 1],
];
const PIVOT: Key[] = [[0, 195], [44, 195, ease.inOut], [48, 92], [64, 92, ease.inOut], [70, 0]];
const AMP: Key[] = [
  [0, 0], [31, 0, ease.out], [34, 30], [44, 24, ease.inOut], [50, 14, ease.inOut], [58, 8, ease.inOut],
  [62, 10, ease.inOut], [72, 36, ease.inOut], [122, 32, ease.inOut], [134, 9, ease.inOut], [150, 7],
];

const bobEnv = (f: number) =>
  track(f, [[66, 0, ease.inOut], [80, 1], [116, 1, ease.inOut], [130, 0]]);

const mouthAt = (f: number): Mouth => {
  if (f < 32) return 'smile';
  if (f < 49) return 'ah';
  if (f < 54) return 'o';
  if (f < 66) return 'grin';
  if (f < 138) return 'smile';
  if (f < 141) return 'o';
  return 'ee';
};

const rotAt = (f: number) => {
  const env = bobEnv(f);
  // pitch follows the bob (nose up while rising)
  const pitch = -5 * Math.cos(((f - 66) / 30) * Math.PI * 2 * 0.8) * env;
  return track(f, ROT) + pitch;
};

export const novaWidePose = (f: number): NovaPose => {
  const env = bobEnv(f);
  const bob = 11 * Math.sin(((f - 66) / 30) * Math.PI * 2 * 0.8) * env;
  const rot = rotAt(f);
  // secondary: tail lags body rotation by ~3 frames
  const bend = clamp(-(rot - rotAt(f - 3)) * 1.6, -40, 40);
  const finLag = f - 3;
  const flying = track(f, [[32, 0, ease.out], [36, 1], [46, 1, ease.inOut], [52, 0]]);
  const swimFin = 24 * Math.sin((finLag / 30) * Math.PI * 2 * 2.2);
  const hornLag = clamp(-(rot - rotAt(f - 2)) * 0.45, -12, 12);
  return {
    x: track(f, X),
    y: track(f, Y) + bob,
    rot,
    size: NOVA_SIZE,
    sq: track(f, SQ),
    pivot: track(f, PIVOT),
    amp: track(f, AMP),
    phase: (f / 30) * Math.PI * 2 * 1.2,
    bend,
    clipY: f < 44 ? CLAM_RIM_Y : undefined,
    visible: f >= 20,
    face: {
      mouth: mouthAt(f),
      blink: blinkAt(f, [96, 145]),
      pupil: f < 46 ? [3, -6] : f < 60 ? [0, 3] : f < 135 ? [6, -3] : [7, -6],
      brow: track(f, [[30, 0], [33, -9, ease.inOut], [46, -6, ease.inOut], [51, 3, ease.inOut], [56, -2, ease.inOut], [138, -2, ease.inOut], [141, 3, ease.snap], [144, -8, ease.inOut], [150, -6]]),
      hornRot: hornLag + track(f, [[135, 0], [141, 5, ease.snap], [144, -7, ease.inOut], [147, 2, ease.inOut], [150, 0]]),
      finRot: swimFin * (1 - flying) - 38 * flying,
      farFinRot: -swimFin * 0.8 * (1 - flying) + 30 * flying,
    },
  };
};
