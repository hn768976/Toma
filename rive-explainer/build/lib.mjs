// Shared vocabulary: palette, timing, geometry helpers.
export const P = {
  bg: "#131A33", bgMid: "#1E2A52", bgViolet: "#2A1F47", bgTeal: "#12333A",
  cream: "#F5E6C8", coral: "#F26B5E", amber: "#F5A93F", mint: "#4FD9A5",
  sky: "#52B5E8", lavender: "#9B7FD4", offWhite: "#F0F4F8", dim: "#4A5578",
};

export const FPS = 30;
export const W = 1920, H = 1080;

// Scene spans are contiguous so playback never gaps: each scene runs until the
// next one starts. Total = 1050 frames = 35.0s.
export const SCENES = [
  { name: "A_Test",       start: 0,   len: 195, accent: P.mint,     bg: P.bg },
  { name: "B_NoMemory",   start: 195, len: 210, accent: P.lavender, bg: P.bgViolet },
  { name: "C_Crowd",      start: 405, len: 150, accent: P.sky,      bg: P.bgTeal },
  { name: "D_Desk",       start: 555, len: 165, accent: P.amber,    bg: P.bgMid },
  { name: "E_Microphone", start: 720, len: 190, accent: P.sky,      bg: P.bgTeal },
  { name: "F_Priority",   start: 910, len: 140, accent: P.amber,    bg: P.bgMid },
];

export const kf = (frame, value, easing) =>
  easing ? { frame: Math.round(frame), value, easing } : { frame: Math.round(frame), value };

export const track = (target, property, keyframes) => ({ target, property, keyframes });

// A ring is two concentric ellipses with the inner one used as a hole; we fake
// it with a stroked ellipse instead, which the writer supports directly.
export const ellipse = (id, x, y, w, h, fill, extra = {}) =>
  ({ id, type: "ellipse", x, y, width: w, height: h, fill: { color: fill }, ...extra });

export const rect = (id, x, y, w, h, fill, extra = {}) =>
  ({ id, type: "rect", x, y, width: w, height: h, fill: { color: fill }, ...extra });

export const poly = (id, x, y, points, fill, extra = {}) =>
  ({ id, type: "polygon", x, y, points, fill: { color: fill }, ...extra });

// Soft radial glow. A RadialGradient defaults its centre to the shape's
// top-left corner, so start/end are set explicitly; the multi-stop falloff
// keeps the edge from reading as a hard disc.
export const glow = (id, x, y, r, color, alpha = "59") => {
  const c = color.slice(1);
  return { id, type: "ellipse", x, y, width: r * 2, height: r * 2,
    fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: r, y: 0 }, stops: [
      { color: `#${alpha}${c}`, position: 0 },
      { color: `#${Math.round(parseInt(alpha, 16) * 0.55).toString(16).padStart(2, "0")}${c}`, position: 0.38 },
      { color: `#${Math.round(parseInt(alpha, 16) * 0.18).toString(16).padStart(2, "0")}${c}`, position: 0.68 },
      { color: `#00${c}`, position: 1 } ] } } };
};

// ---------------------------------------------------------------- camera ---
// Depth factors. Every camera move is applied to all three layers at its own
// rate, which is what makes a push read as a camera rather than a scale.
export const DEPTH = { far: 0.4, mid: 1.0, near: 1.5 };

// Ambient drift: a closed figure-eight, period 240f, +/-10px h, +/-6px v.
// Never stops, never syncs to a beat.
export const driftX = (f) => 10 * Math.sin((2 * Math.PI * f) / 240);
export const driftY = (f) => 6 * Math.sin((4 * Math.PI * f) / 240);

// Camera keyframe schedule in ABSOLUTE frames. scale is the mid-layer scale.
export const ANCHOR = { x: 1250, y: 470 };   // the listener's head in Scene B
export const CAM = [
  { at: 0,    scale: 1.0, slide: 0 },
  { at: 300,  scale: 1.0, slide: 0 },
  { at: 318,  scale: 1.8, slide: 0, easing: "emphasized-decel" },  // PUSH IN
  { at: 405,  scale: 1.8, slide: 0 },
  { at: 420,  scale: 1.0, slide: 0, easing: "ease-in-out" },       // PULL OUT
  { at: 630,  scale: 1.0, slide: 0 },
  { at: 642,  scale: 1.0, slide: -180, easing: "ease-in-out" },    // LATERAL
  { at: 1050, scale: 1.0, slide: -180 },
];

const lerp = (a, b, t) => a + (b - a) * t;

// Sample the camera schedule at an absolute frame (linear between keys; the
// real easing is carried on the emitted keyframes, not this sampler).
export function camAt(f) {
  let prev = CAM[0];
  for (const k of CAM) {
    if (k.at === f) return { scale: k.scale, slide: k.slide };
    if (k.at > f) {
      const t = (f - prev.at) / (k.at - prev.at);
      return { scale: lerp(prev.scale, k.scale, t), slide: lerp(prev.slide, k.slide, t) };
    }
    prev = k;
  }
  return { scale: prev.scale, slide: prev.slide };
}

// Resolve one layer's world transform at an absolute frame.
export function layerAt(f, d) {
  const { scale, slide } = camAt(f);
  const se = 1 + (scale - 1) * d;                 // depth-scaled zoom
  return {
    scaleX: se, scaleY: se,
    // Anchor compensation keeps ANCHOR fixed on screen while the world grows.
    x: ANCHOR.x * (1 - se) + slide * d + driftX(f) * d,
    y: ANCHOR.y * (1 - se) + driftY(f) * d,
  };
}

// Build camera tracks for one layer over a scene span. Drift is sampled on a
// coarse grid; camera moves get exact boundary keys with real easing.
export function cameraTracks(layerId, start, len, d) {
  const moves = CAM.filter((k) => k.easing).map((k) => {
    const i = CAM.indexOf(k);
    return { from: CAM[i - 1].at, to: k.at, easing: k.easing };
  });
  const inMove = (f) => moves.find((m) => f > m.from && f < m.to);

  const times = new Set([0, len]);
  for (let f = 0; f <= len; f += 10) times.add(f);
  for (const m of moves) {
    if (m.from >= start && m.from <= start + len) times.add(m.from - start);
    if (m.to >= start && m.to <= start + len) times.add(m.to - start);
  }
  const sorted = [...times].filter((f) => f >= 0 && f <= len && !inMove(f + start)).sort((a, b) => a - b);

  const kx = [], ky = [], ksx = [], ksy = [];
  for (const f of sorted) {
    const abs = start + f;
    const v = layerAt(abs, d);
    const mv = moves.find((m) => m.to === abs);
    const e = mv ? mv.easing : "ease-in-out";
    kx.push(kf(f, v.x, e)); ky.push(kf(f, v.y, e));
    ksx.push(kf(f, v.scaleX, e)); ksy.push(kf(f, v.scaleY, e));
  }
  return [
    track(layerId, "x", kx), track(layerId, "y", ky),
    track(layerId, "scaleX", ksx), track(layerId, "scaleY", ksy),
  ];
}
