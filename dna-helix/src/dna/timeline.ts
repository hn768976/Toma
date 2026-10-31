/**
 * Pure, frame-deterministic timeline for the DNA helix composition.
 * Every value is a function of the frame number only, so Remotion can render
 * frames out of order / in parallel tabs and always get identical pixels.
 *
 * Reference beat sheet (30 fps, 520 frames = 17.333 s):
 *   0 – 115   helix spins and travels downward, camera close
 *   66 – 205  a red (mutated) base pair enters at the top and glides to just
 *             above centre while the helix decelerates; red pair ends face-on
 *   205 – 320 helix holds still
 *   236 – 320 a replacement (healthy) pair materialises on the right, slides
 *             left and docks into the gap while the red pair is pushed out
 *             to the left and dissolves (250 – 290)
 *   320 – 520 helix resumes a slow spin in place; camera dollies out from ~315
 */

export const FPS = 30;
export const DURATION = 520;

// Geometry (units: half a base-pair rung = 1)
export const RUNG_HALF = 1.0;
export const BALL_RADIUS = 0.25;
export const STICK_RADIUS = 0.045;
export const RUNG_SPACING = 0.57;
export const TWIST_PER_RUNG = Math.PI / 5.3; // ~10.6 pairs per turn
export const RUNG_MIN = -26;
export const RUNG_MAX = 34;
export const RED_RUNG = 0; // the mutated pair; sits at y = 0 when the helix stops

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Deceleration window, fitted to the reference: the red pair first peeks in at
// the top edge at frame ~66 and settles slightly above frame centre by ~205.
const DECEL_START = 115;
const STOP = 205;
const RESUME = 320;

/** Travel throttle: 1 = cruising, 0 = stopped. The helix never travels again after the stop. */
const travelThrottle = (f: number): number => {
  if (f < DECEL_START) return 1;
  return 1 - smoothstep(DECEL_START, STOP, f);
};

/** Spin throttle: like travel, but a slow spin-in-place resumes after the repair. */
const spinThrottle = (f: number): number => {
  if (f < RESUME) return travelThrottle(f);
  return 0.55 * smoothstep(RESUME, RESUME + 60, f);
};

// Pre-integrate once at module load (pure + deterministic).
const STEPS_PER_FRAME = 8;
const integrate = (fn: (f: number) => number) => {
  const out: number[] = [0];
  let acc = 0;
  for (let i = 1; i <= DURATION * STEPS_PER_FRAME; i++) {
    acc += fn((i - 0.5) / STEPS_PER_FRAME) / STEPS_PER_FRAME;
    out.push(acc);
  }
  return (f: number): number => {
    const x = clamp(f, 0, DURATION) * STEPS_PER_FRAME;
    const i = Math.floor(x);
    const t = x - i;
    const a = out[Math.min(i, out.length - 1)];
    const b = out[Math.min(i + 1, out.length - 1)];
    return a + (b - a) * t;
  };
};
const travelled = integrate(travelThrottle);
const spun = integrate(spinThrottle);
const TRAVEL_AT_STOP = travelled(STOP);
const SPIN_AT_STOP = spun(STOP);

const SCROLL_SPEED = 0.0319; // world units / frame while cruising (downwards)
const SPIN_SPEED = 0.026; // rad / frame while cruising

/** Vertical offset of the whole helix (0 at the stop so the red pair is centred). */
export const helixScroll = (f: number) => -(travelled(f) - TRAVEL_AT_STOP) * SCROLL_SPEED;

/** Spin of the helix around its axis (0 at the stop so the red pair is face-on). */
export const helixSpin = (f: number) => (spun(f) - SPIN_AT_STOP) * SPIN_SPEED;

// ---------------------------------------------------------------------------
// Repair event
// ---------------------------------------------------------------------------

/** 0..1 visibility of the red pair (dissolves 252 – 276). */
export const redVisibility = (f: number) => 1 - smoothstep(252, 276, f);

/** The red pair is pushed out of the helix to the left (rung-half units, ≤ 0). */
export const redOffset = (f: number) => -1.45 * easeInOutCubic((f - 244) / (276 - 244));

/** How "lit" the red pair is: glows a little as it is targeted. */
export const redGlow = (f: number) => smoothstep(200, 240, f) * (1 - smoothstep(256, 276, f));

export type IncomingPair = {
  /** Offset along the rung axis, in rung-half units (0 = docked). */
  offset: number;
  /** 0..1 opacity */
  opacity: number;
  /** 0 = ghostly blue hologram, 1 = solid white */
  solidity: number;
};

export const incomingPair = (f: number): IncomingPair => {
  const t = easeInOutCubic((f - 236) / (310 - 236));
  // Starts ~1.5 rung-lengths to the right, glides back into the helix.
  const offset = mix(3.2, 0, t);
  const opacity = smoothstep(238, 258, f);
  const solidity = smoothstep(256, 280, f);
  return { offset, opacity, solidity };
};

/** Has the new pair docked (it then becomes part of the helix)? */
export const docked = (f: number) => f >= 320;

/** Sparkle burst in the gap while the swap happens (0..1). */
export const gapSparkle = (f: number) => smoothstep(250, 264, f) * (1 - smoothstep(280, 302, f));

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  /** Camera roll around its view axis (dutch angle), radians */
  roll: number;
  /** Rotation applied to the whole helix group (tilt), radians */
  helixTiltZ: number;
  helixTiltX: number;
  /** Focus band for the tilt-shift / depth-of-field pass (0..1 screen y). */
  focusY: number;
  focusWidth: number;
  blurStrength: number;
};

export type Variant = "match" | "orbit";

/**
 * V1 ("match"): locked-off camera framing the helix at ~37 % of frame width.
 * Holds its distance until ~frame 315, then dollies out (≈0.79× scale by the
 * last frame) and is still moving at the cut, as in the reference.
 */
const cameraMatch = (f: number): CameraState => {
  const pull = clamp((f - 315) / (DURATION - 1 - 315));
  const dist = mix(10.0, 12.7, Math.pow(pull, 1.5));
  // keep the helix axis at 37 % of frame width as the camera pulls back
  const halfW = dist * Math.tan(((32 / 2) * Math.PI) / 180) * (16 / 9);
  const x = 0.26 * halfW + 0.05 * Math.sin(f / 90);
  const y = -0.07 + 0.04 * Math.sin(f / 120 + 0.7);
  return {
    position: [x, y, dist],
    target: [x, y - 0.05, 0],
    up: [0, 1, 0],
    fov: 32,
    roll: 0,
    helixTiltZ: 0,
    helixTiltX: 0,
    focusY: 0.5,
    focusWidth: 0.34,
    blurStrength: 1,
  };
};

/**
 * V2 ("orbit"): a low-angle camera that circles the (tilted) helix, pushes in
 * on the mutation while it is repaired, then pulls back and keeps orbiting.
 */
const cameraOrbit = (f: number): CameraState => {
  // Azimuth: sweep ~150° over the shot, easing near the repair so the event
  // is seen from a clear 3/4 front angle.
  const az = mix(-1.15, 1.45, easeInOutCubic(f / DURATION)) - 0.22 * Math.sin((f / DURATION) * Math.PI);
  // Push-in curve: wide → tight on the repair (frames 200–312) → wide again
  const push = smoothstep(150, 250, f) * (1 - smoothstep(322, 435, f));
  const dist = mix(13.0, 8.6, push) + 1.2 * (f / DURATION);
  const height = mix(-3.4, -1.2, push) + 0.6 * Math.sin(f / 110);
  const pos: [number, number, number] = [Math.sin(az) * dist, height, Math.cos(az) * dist];
  return {
    position: pos,
    target: [mix(0.9, 1.1, push), mix(0.4, 0.0, push), 0],
    up: [0, 1, 0],
    fov: mix(40, 34, push),
    roll: mix(0.4, 0.26, push) + 0.04 * Math.sin(f / 70),
    helixTiltZ: 0,
    helixTiltX: 0.1,
    focusY: 0.5,
    focusWidth: mix(0.26, 0.2, push),
    blurStrength: mix(1.15, 1.5, push),
  };
};

export const cameraAt = (f: number, variant: Variant): CameraState =>
  variant === "orbit" ? cameraOrbit(f) : cameraMatch(f);

// ---------------------------------------------------------------------------
// Deterministic hash noise
// ---------------------------------------------------------------------------
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
