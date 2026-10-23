// Deterministic flash schedule for the light wall.
//
// Measured from the reference: lamps are "on" ~30 % of the time, flashes
// ramp up in ~5-7 frames, hold a median of ~13 frames (6..27 frames for
// the 10th..90th percentile) and fade out over ~5-9 frames. Some flashes
// only reach partial brightness. Beams swing slowly while a lamp is lit.

export const COLS = 16; // full wall (V2 sees more of it)
export const ROWS = 8;
// The reference framing shows the centre 8 x 4 block.
export const VIEW_COLS = 8;
export const VIEW_ROWS = 4;
export const COL0 = (COLS - VIEW_COLS) / 2;
export const ROW0 = (ROWS - VIEW_ROWS) / 2;

type Flash = {
  start: number;
  attack: number;
  hold: number;
  release: number;
  peak: number;
  angle: number; // beam direction at flash start (radians)
  swing: number; // beam rotation speed (radians / frame)
  beam: number; // beam strength
  spread: number; // beam cone widening per unit length
};

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

const buildSchedule = (totalFrames: number): Flash[][] => {
  const rand = mulberry32(855195970);
  const lamps: Flash[][] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const flashes: Flash[] = [];
    // Start some lamps mid-flash so frame 0 already looks busy.
    let f = -Math.floor(rand() * 40);
    while (f < totalFrames + 10) {
      const hold = Math.round(3 + Math.pow(rand(), 1.6) * 28);
      const attack = 4 + Math.floor(rand() * 4);
      const release = 4 + Math.floor(rand() * 6);
      const full = rand() < 0.75;
      flashes.push({
        start: f,
        attack,
        hold,
        release,
        peak: full ? 1 : 0.35 + rand() * 0.4,
        angle: rand() * Math.PI * 2,
        swing: (rand() - 0.5) * 0.04,
        beam: 0.45 + rand() * 0.8,
        spread: 0.3 + rand() * 0.45,
      });
      const gap = Math.round(8 + Math.pow(rand(), 1.5) * 50);
      f += attack + hold + release + gap;
    }
    lamps.push(flashes);
  }
  return lamps;
};

let cache: { frames: number; lamps: Flash[][] } | null = null;
const schedule = (totalFrames: number) => {
  if (!cache || cache.frames !== totalFrames) {
    cache = { frames: totalFrames, lamps: buildSchedule(totalFrames) };
  }
  return cache.lamps;
};

// Per-lamp state packed for the shader:
// a = [intensity, beamAngle, beamStrength, beamSpread]
export const lampState = (frame: number, totalFrames: number) => {
  const lamps = schedule(totalFrames);
  const a = new Float32Array(COLS * ROWS * 4);
  for (let i = 0; i < lamps.length; i++) {
    let best = 0;
    let angle = 0;
    let beam = 0;
    let spread = 0.4;
    for (const fl of lamps[i]) {
      const t = frame - fl.start;
      if (t < 0 || t > fl.attack + fl.hold + fl.release) continue;
      let env: number;
      if (t < fl.attack) env = smooth(t / fl.attack);
      else if (t < fl.attack + fl.hold) env = 1;
      else env = 1 - smooth((t - fl.attack - fl.hold) / fl.release);
      const v = env * fl.peak;
      if (v > best) {
        best = v;
        angle = fl.angle + fl.swing * t;
        beam = fl.beam;
        spread = fl.spread;
      }
    }
    // Gamma on the envelope: soft start to each ramp (no one-frame snap
    // once the bright lamp face saturates).
    a[i * 4] = Math.pow(best, 2.2);
    a[i * 4 + 1] = angle;
    a[i * 4 + 2] = beam;
    a[i * 4 + 3] = spread;
  }
  return a;
};
