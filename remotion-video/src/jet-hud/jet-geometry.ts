/**
 * The aircraft's geometry, built ONCE as flat data and shared by both
 * renderers. v1 fills these facets with four tonal steps; v2 strokes the very
 * same facets as a wireframe. Nothing here knows about colour.
 *
 * The subject is a GENERIC delta-canard fighter — the silhouette family only.
 * It carries no roundel, squadron marking, tail code or national insignia of
 * any kind, by design.
 */

export type Pt = { x: number; y: number };

export type PathCmd =
  | { c: "M"; p: Pt }
  | { c: "L"; p: Pt }
  | { c: "Q"; ctrl: Pt; p: Pt }
  | { c: "Z" };

/** Which of the four tonal steps a facet takes in solid mode. */
export type Tone = "darkest" | "dark" | "mid" | "light" | "canopy" | "band";
/** How brightly a facet's outline is stroked in wireframe mode. */
export type Wire = "bright" | "mid" | "dim";

export type Facet = {
  id: string;
  cmds: PathCmd[];
  tone: Tone;
  wire: Wire;
};

export type JetGeometry = {
  /** Sprite canvas size the geometry is authored inside. */
  spriteW: number;
  spriteH: number;
  /** Rotation/scale pivot: the fuselage mid-station. */
  pivot: Pt;
  /** Layered back-to-front. Draw order is array order. */
  facets: Facet[];
  /** Thin highlight lines — suggestions of curvature on flat fills. */
  strips: Facet[];
  /** Small dark surface panels, irregularly placed. */
  panels: Facet[];
  /** Wireframe-only frames and ribs. */
  structure: { cmds: PathCmd[]; wire: Wire }[];
  /** The canopy's internal division line. */
  canopyBow: PathCmd[];
  /** Nose probe. */
  probe: PathCmd[];
  /** Exhaust centre, in sprite space. */
  enginePos: Pt;
  /** Unit vector pointing from nose to tail, i.e. where the contrail goes. */
  aftDir: Pt;
  /** Fuselage length in sprite px, for scaling glow/contrail. */
  bodyLen: number;
};

const SPRITE = 1600;
const TAIL: Pt = { x: 250, y: 900 };
const NOSE: Pt = { x: 1380, y: 590 };

const dx = NOSE.x - TAIL.x;
const dy = NOSE.y - TAIL.y;
const LEN = Math.hypot(dx, dy);
/** Unit vector along the fuselage axis, tail -> nose (up and to the right). */
const U: Pt = { x: dx / LEN, y: dy / LEN };
/** Axis normal. Positive offsets lie toward the viewer (down-right). */
const P: Pt = { x: -U.y, y: U.x };

/**
 * The one primitive the whole airframe is authored in: `t` is the fraction
 * along the fuselage axis, `off` the perpendicular offset, `up` a purely
 * vertical screen lift (used for the fins and the canopy).
 */
const at = (t: number, off: number, up = 0): Pt => ({
  x: TAIL.x + U.x * LEN * t + P.x * off,
  y: TAIL.y + U.y * LEN * t + P.y * off - up,
});

const poly = (pts: Pt[]): PathCmd[] => [
  { c: "M", p: pts[0] },
  ...pts.slice(1).map((p) => ({ c: "L", p }) as PathCmd),
  { c: "Z" },
];

/** A band between two offset profiles sampled at the same stations. */
const band = (
  stations: readonly [t: number, inner: number, outer: number][],
): PathCmd[] => {
  const fwd = stations.map(([t, inner]) => at(t, inner));
  const back = stations
    .slice()
    .reverse()
    .map(([t, , outer]) => at(t, outer));
  return poly([...fwd, ...back]);
};

/** A quad of constant perpendicular thickness along a segment. */
const stripQuad = (a: Pt, b: Pt, thickness: number): PathCmd[] => {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const l = Math.hypot(sx, sy) || 1;
  const nx = (-sy / l) * (thickness / 2);
  const ny = (sx / l) * (thickness / 2);
  return poly([
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]);
};

/** A small rectangle authored in (t, off) space so it lies with the airframe. */
const axisRect = (
  t: number,
  off: number,
  dt: number,
  dOff: number,
): PathCmd[] =>
  poly([
    at(t, off),
    at(t + dt, off),
    at(t + dt, off + dOff),
    at(t, off + dOff),
  ]);

const line = (a: Pt, b: Pt): PathCmd[] => [
  { c: "M", p: a },
  { c: "L", p: b },
];

// ── Fuselage offset profile ────────────────────────────────────────────────
// Top surface runs from `far` to `near`; the shadowed flank from `near` to
// `flank`; the underside facet from `flank` to `under`. Widest station is
// t=0.36 at 360px against a 1172px length -> 3.26:1, as specified. The body
// tapers to a narrow nozzle at the tail; a constant-width tail reads as a
// slab, not as an airframe.
const STATIONS: readonly [
  t: number,
  far: number,
  near: number,
  flank: number,
  under: number,
][] = [
  [0.0, -95, 60, 105, 128],
  [0.08, -122, 72, 130, 160],
  [0.2, -158, 86, 160, 198],
  [0.36, -178, 92, 182, 222],
  [0.5, -164, 88, 168, 204],
  [0.64, -112, 66, 124, 150],
  [0.78, -70, 44, 82, 100],
  [0.88, -44, 28, 52, 62],
  [0.95, -22, 14, 26, 30],
  [1.0, 0, 0, 0, 0],
];

const fuselageTop = band(STATIONS.map(([t, f, n]) => [t, f, n]));
const fuselageFlank = band(STATIONS.map(([t, , n, fl]) => [t, n, fl]));
const fuselageUnder = band(STATIONS.map(([t, , , fl, un]) => [t, fl, un]));

// ── Wings ─────────────────────────────────────────────────────────────────
// Both wings are swept deltas with a near-perpendicular trailing edge. The
// span is deliberately not the full 60% of the length: in this projection the
// span axis projects steeply, so a 700px semi-span made the aircraft read as
// a hang-glider. What does measure ~60% of the length is the near wing's
// fore-aft extent, root leading edge (t=0.60) to tip trailing edge (t=0.055),
// which is the proportion that actually shows.
const FAR_WING = [at(0.5, -100), at(0.2, -330), at(0.14, -318), at(0.03, -124)];
const NEAR_WING = [at(0.58, 130), at(0.13, 360), at(0.075, 350), at(0.03, 150)];

// ── Canards ───────────────────────────────────────────────────────────────
// Span 246 against the wing's 700, and swept back at a distinctly shallower
// angle. These are what make the silhouette read as a delta-canard.
// Roots sit INSIDE the fuselage's own offset profile at their station,
// otherwise a canard reads as a paddle floating alongside the aircraft.
const NEAR_CANARD = [
  at(0.75, 68),
  at(0.662, 202),
  at(0.636, 194),
  at(0.655, 92),
];
const FAR_CANARD = [
  at(0.735, -56),
  at(0.66, -200),
  at(0.632, -192),
  at(0.665, -70),
];

// ── Fins ──────────────────────────────────────────────────────────────────
// Fin heights are drawn taller than a strict projection of this camera would
// give them. Seen this far from above a vertical fin foreshortens to almost
// nothing, and the aircraft loses the two shapes that most say "fighter" —
// so the fins are pushed until they clear the fuselage's far edge and read.
const FAR_FIN = [
  at(0.08, -84),
  at(0.25, -104),
  at(0.235, -168, 205),
  at(0.12, -176, 226),
];
const NEAR_FIN = [
  at(0.065, 26),
  at(0.265, 48),
  at(0.245, 100, 345),
  at(0.12, 110, 370),
];

// ── Canopy ────────────────────────────────────────────────────────────────
const CANOPY_REAR = at(0.715, -4, 30);
const CANOPY_FAR = at(0.815, -60, 40);
const CANOPY_FRONT = at(0.955, -2, 20);
const CANOPY_NEAR = at(0.83, 40, 32);
const canopy: PathCmd[] = [
  { c: "M", p: CANOPY_REAR },
  { c: "Q", ctrl: at(0.74, -56, 40), p: CANOPY_FAR },
  { c: "Q", ctrl: at(0.915, -46, 32), p: CANOPY_FRONT },
  { c: "Q", ctrl: at(0.905, 30, 26), p: CANOPY_NEAR },
  { c: "Q", ctrl: at(0.755, 36, 32), p: CANOPY_REAR },
  { c: "Z" },
];

// ── Intake, stores, probe ─────────────────────────────────────────────────
const INTAKE = [at(0.7, 58), at(0.7, 108), at(0.6, 128), at(0.595, 82)];

/** A slim underwing store: body, tail fins, nose fins and a coloured band. */
const store = (
  id: string,
  t0: number,
  t1: number,
  off: number,
  drop: number,
  thick: number,
  wire: Wire,
): Facet[] => {
  const a = at(t0, off, -drop);
  const b = at(t1, off, -drop);
  const finH = thick * 1.45;
  const noseT = t0 + (t1 - t0) * 0.86;
  return [
    { id: `${id}-body`, cmds: stripQuad(a, b, thick), tone: "light", wire },
    {
      id: `${id}-finA`,
      cmds: stripQuad(
        at(t0 + 0.012, off, -drop),
        at(t0 + 0.05, off, -drop),
        finH * 2,
      ),
      tone: "mid",
      wire,
    },
    {
      id: `${id}-finB`,
      cmds: stripQuad(
        at(noseT - 0.02, off, -drop),
        at(noseT + 0.015, off, -drop),
        finH * 1.7,
      ),
      tone: "mid",
      wire,
    },
    {
      id: `${id}-band`,
      cmds: stripQuad(
        at(noseT + 0.028, off, -drop),
        at(noseT + 0.046, off, -drop),
        thick,
      ),
      tone: "band",
      wire: "bright",
    },
  ];
};

/** A short strut hanging the store off the wing. */
const pylon = (t: number, off: number, drop: number, w: number): PathCmd[] =>
  poly([
    at(t - w, off),
    at(t + w, off),
    at(t + w * 0.6, off, -drop),
    at(t - w * 0.6, off, -drop),
  ]);

const build = (): JetGeometry => {
  const facets: Facet[] = [
    // 1. Far wing — darkest, partly occluded by the fuselage drawn over it.
    { id: "far-wing", cmds: poly(FAR_WING), tone: "darkest", wire: "dim" },
    // 2. Far tailfin — swept, angled away.
    { id: "far-fin", cmds: poly(FAR_FIN), tone: "darkest", wire: "dim" },
    { id: "far-canard", cmds: poly(FAR_CANARD), tone: "darkest", wire: "dim" },
    // Far store hangs beneath the far wing.
    ...store("far-store", 0.22, 0.4, -232, -13, 18, "dim"),
    {
      id: "far-pylon",
      cmds: pylon(0.31, -232, -11, 0.02),
      tone: "dark",
      wire: "dim",
    },
    // Nozzle: the blunt tail face the exhaust bloom sits over.
    {
      id: "nozzle",
      cmds: poly([
        at(-0.02, -78),
        at(0.025, -92),
        at(0.025, 100),
        at(-0.02, 88),
      ]),
      tone: "darkest",
      wire: "dim",
    },
    // 3. Fuselage: three facets, each a full tonal step from its neighbour.
    { id: "fuse-under", cmds: fuselageUnder, tone: "darkest", wire: "dim" },
    { id: "fuse-flank", cmds: fuselageFlank, tone: "dark", wire: "mid" },
    { id: "fuse-top", cmds: fuselageTop, tone: "mid", wire: "bright" },
    // 8. Intake, on the flank beneath the canopy.
    { id: "intake", cmds: poly(INTAKE), tone: "darkest", wire: "dim" },
    // 4. Near wing — larger, lighter, separated from the fuselage top by the
    //    dark flank so no two adjacent facets share a tone.
    { id: "near-wing", cmds: poly(NEAR_WING), tone: "light", wire: "bright" },
    // 5. Canards.
    {
      id: "near-canard",
      cmds: poly(NEAR_CANARD),
      tone: "light",
      wire: "bright",
    },
    // 9. Near pylon and store.
    {
      id: "near-pylon",
      cmds: pylon(0.3, 258, -26, 0.025),
      tone: "dark",
      wire: "mid",
    },
    ...store("near-store", 0.19, 0.41, 258, -30, 24, "bright"),
    // 6. Near tailfin — larger and lighter than the far one.
    { id: "near-fin", cmds: poly(NEAR_FIN), tone: "dark", wire: "bright" },
    // 7. Canopy — the brightest element, and what makes the nose read as the
    //    front of the aircraft.
    { id: "canopy", cmds: canopy, tone: "canopy", wire: "bright" },
  ];

  const strips: Facet[] = [
    {
      id: "spine",
      cmds: stripQuad(at(0.12, -132), at(0.88, -40), 16),
      tone: "light",
      wire: "bright",
    },
    {
      id: "flank-line",
      cmds: stripQuad(at(0.06, 60), at(0.9, 24), 13),
      tone: "light",
      wire: "bright",
    },
    {
      id: "near-wing-le",
      cmds: stripQuad(at(0.58, 130), at(0.13, 360), 14),
      tone: "canopy",
      wire: "bright",
    },
    {
      id: "far-wing-le",
      cmds: stripQuad(at(0.5, -100), at(0.2, -330), 10),
      tone: "mid",
      wire: "dim",
    },
    {
      id: "near-fin-le",
      cmds: stripQuad(at(0.265, 48), at(0.245, 100, 345), 11),
      tone: "canopy",
      wire: "bright",
    },
    {
      id: "nose-line",
      cmds: stripQuad(at(0.88, -26), at(0.99, -5), 10),
      tone: "canopy",
      wire: "bright",
    },
    {
      id: "near-canard-le",
      cmds: stripQuad(at(0.75, 68), at(0.662, 202), 9),
      tone: "canopy",
      wire: "bright",
    },
  ];

  // Five surface panels, deliberately at irregular stations — a regular grid
  // reads as texture rather than as hardware.
  const panels: Facet[] = [
    {
      id: "pn0",
      cmds: axisRect(0.45, -86, 0.03, 16),
      tone: "darkest",
      wire: "dim",
    },
    {
      id: "pn1",
      cmds: axisRect(0.6, 22, 0.022, 13),
      tone: "darkest",
      wire: "dim",
    },
    {
      id: "pn2",
      cmds: axisRect(0.24, 178, 0.026, 15),
      tone: "darkest",
      wire: "dim",
    },
    {
      id: "pn3",
      cmds: axisRect(0.19, -190, 0.022, 12),
      tone: "darkest",
      wire: "dim",
    },
    {
      id: "pn4",
      cmds: axisRect(0.8, 2, 0.017, 11),
      tone: "darkest",
      wire: "dim",
    },
  ];

  // Wireframe-only internal structure: three longitudinal frames plus five
  // spanwise ribs, at irregular spacing.
  const structure: { cmds: PathCmd[]; wire: Wire }[] = [
    { cmds: line(at(0.1, -118), at(0.9, -28)), wire: "mid" },
    { cmds: line(at(0.05, -20), at(0.94, -6)), wire: "bright" },
    { cmds: line(at(0.05, 52), at(0.88, 20)), wire: "mid" },
    { cmds: line(at(0.47, 178), at(0.06, 164)), wire: "bright" },
    { cmds: line(at(0.31, 248), at(0.085, 240)), wire: "bright" },
    { cmds: line(at(0.19, 316), at(0.07, 310)), wire: "mid" },
    { cmds: line(at(0.4, -170), at(0.055, -158)), wire: "dim" },
    { cmds: line(at(0.26, -254), at(0.09, -248)), wire: "dim" },
  ];

  return {
    spriteW: SPRITE,
    spriteH: SPRITE,
    pivot: at(0.5, 0),
    facets,
    strips,
    panels,
    structure,
    canopyBow: line(at(0.85, -56, 38), at(0.855, 34, 30)),
    probe: line(at(1.0, 0), at(1.075, 2)),
    enginePos: at(0.0, 6),
    aftDir: { x: -U.x, y: -U.y },
    bodyLen: LEN,
  };
};

export const JET_GEOMETRY: JetGeometry = build();

export const tracePath = (
  ctx: CanvasRenderingContext2D,
  cmds: readonly PathCmd[],
) => {
  ctx.beginPath();
  for (const cmd of cmds) {
    if (cmd.c === "M") ctx.moveTo(cmd.p.x, cmd.p.y);
    else if (cmd.c === "L") ctx.lineTo(cmd.p.x, cmd.p.y);
    else if (cmd.c === "Q")
      ctx.quadraticCurveTo(cmd.ctrl.x, cmd.ctrl.y, cmd.p.x, cmd.p.y);
    else ctx.closePath();
  }
};
