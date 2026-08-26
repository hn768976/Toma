import {
  CAMERA_DRIFT,
  CHIP_HEIGHT_FRACTION,
  CHIP_OFFSET_FRACTION,
  FAN_ORIGIN_FRACTION,
  FAN_ORIGIN_Y_OFFSET,
  FAN_UPSTREAM_LIFT,
  HEIGHT,
  ICON_STRIP,
  PANELS,
  PLANE,
  STRAND_COUNT,
  DRIFT_STEP,
  VARIANT_CONFIG,
  WIDTH,
  type PanelSpec,
} from './config';
import {
  closedCosine,
  closedSine,
  makePolyline,
  orthoRoute,
  rint,
  rpick,
  rrange,
  TRAVEL_PERIODS,
  type Polyline,
  type Pt,
} from './lib/draw';
import {
  apply,
  compose,
  invert,
  rotate,
  scale,
  shearX,
  translate,
  type Mat,
} from './lib/mat';
import type {Variant} from './theme';

/* ------------------------------------------------------------ the plane */

/**
 * The one transform every element inherits. Built about the frame centre so
 * that plane (0,0) lands on screen centre.
 */
export const basePlaneMatrix = (): Mat => {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  return compose(
    translate(cx, cy),
    rotate((PLANE.rotationDeg * Math.PI) / 180),
    shearX(PLANE.shearX),
    scale(1, PLANE.compressY),
    translate(-cx, -cy)
  );
};

/** Ambient camera drift: a closed ellipse, so it returns exactly at frame 372. */
export const cameraOffset = (frame: number): Pt => ({
  x: closedSine(frame, CAMERA_DRIFT.freqX) * CAMERA_DRIFT.ampX,
  y: closedCosine(frame, CAMERA_DRIFT.freqY) * CAMERA_DRIFT.ampY,
});

export const frameMatrix = (base: Mat, frame: number): Mat => {
  const c = cameraOffset(frame);
  return compose(translate(c.x, c.y), base);
};

/* ------------------------------------------------------------- geometry */

export type StrandGeom = {
  /** Sampled centreline in plane space. */
  xs: Float32Array;
  ys: Float32Array;
  /** Undulation envelope per sample — zero at both anchored ends. */
  env: Float32Array;
  colorKey: 'fibreA' | 'fibreB' | 'fibreC';
  /** Blend toward the chip colour over the last stretch of the strand. */
  coreWidth: number;
  alpha: number;
  /** Travelling-pulse period; always a divisor of 372. */
  period: number;
  pulseOffset: number;
  undA: number;
  undF: number;
  undP: number;
  undA2: number;
  undF2: number;
  undP2: number;
};

export type PanelLayout = {
  spec: PanelSpec;
  /** Panel centre in plane space. */
  plane: Pt;
  /** Chip-to-panel trace, in plane space, running chip (t=0) → panel (t=1). */
  route: Polyline;
  routePeriod: number;
  routeOffset: number;
  /** Second dot on the same trace, offset half a cycle. */
  routeOffset2: number;
};

export type Scene = {
  variant: Variant;
  flowDirection: 1 | -1;
  base: Mat;
  inv: Mat;
  /** Screen-space anchors, kept for the background's screen-fixed features. */
  chipScreen: Pt;
  fanOriginScreen: Pt;
  chip: {plane: Pt; w: number; h: number};
  fanOriginPlane: Pt;
  /** Where the whole bundle converges, in plane space. */
  fanFocus: Pt;
  strands: StrandGeom[];
  panels: PanelLayout[];
  iconStrip: {plane: Pt; count: number; size: number; gap: number; depth: 0 | 1 | 2};
  /**
   * Width, along the plane's x axis, of one background tile — the plane-space
   * pre-image of DRIFT_STEP.
   */
  tilePlaneWidth: number;
};

const SAMPLES = 48;

/** Scalar cubic Bezier — used to shape the funnel's two 1-D profiles. */
const cubic1d = (a: number, b: number, c: number, d: number, t: number): number => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};


export const buildScene = (variant: Variant): Scene => {
  const dir = VARIANT_CONFIG[variant].flowDirection;
  const base = basePlaneMatrix();
  const inv = invert(base);

  const chipH = HEIGHT * CHIP_HEIGHT_FRACTION;
  const chipW = chipH;

  // Layout anchors are chosen in screen space and pulled back onto the plane.
  // Mirroring is entirely a matter of the sign of `dir`.
  const chipScreen: Pt = {
    x: WIDTH * (0.5 - dir * CHIP_OFFSET_FRACTION),
    y: HEIGHT * 0.5,
  };
  const fanOriginScreen: Pt = {
    x: WIDTH * (0.5 - dir * FAN_ORIGIN_FRACTION),
    y:
      HEIGHT *
      (0.5 - dir * FAN_ORIGIN_Y_OFFSET - ((1 - dir) / 2) * FAN_UPSTREAM_LIFT),
  };

  const chipPlane = apply(inv, chipScreen);
  const fanOriginPlane = apply(inv, fanOriginScreen);

  /* ------------------------------------------------------------ strands */

  // The bundle is a funnel, not a spindle: a tall curtain near the frame edge
  // tapering the whole way to a single tight focus at the chip's upstream face.
  //
  // The funnel spreads along the plane's OWN y axis, so every cross-section of
  // the bundle recedes exactly like the panels and the connector traces do. The
  // fan has to share the dashboard's perspective; orienting the curtain in
  // screen space instead makes it stand up out of the plane and the whole scene
  // stops reading as one surface.
  const along: Pt = {x: 0, y: 1};
  const curtainSpread = 1100; // half-height of the curtain, in plane px

  const focus: Pt = {
    x: chipPlane.x - dir * (chipW / 2) * 0.9,
    y: chipPlane.y,
  };
  const axis: Pt = {x: focus.x - fanOriginPlane.x, y: focus.y - fanOriginPlane.y};

  const strands: StrandGeom[] = [];
  for (let i = 0; i < STRAND_COUNT; i++) {
    const seed = `${variant}-strand-${i}`;
    // -1..1 across the bundle, with a little seeded scatter so the curtain does
    // not read as a regular comb.
    const v = ((i + 0.5) / STRAND_COUNT) * 2 - 1 + rrange(`${seed}-jit`, -0.012, 0.012);

    // Two 1-D profiles drive the whole strand. `spread` runs 1 -> 0 across the
    // curtain direction, flaring just past the mouth before it turns over;
    // `advance` runs 0 -> 1 along the axis to the focus. Because spread ends at
    // zero and advance ends at one, every strand lands exactly on the focus.
    const flare = rrange(`${seed}-flare`, 1, 1.13);
    const adv1 = rrange(`${seed}-d1`, 0.09, 0.17);
    const adv2 = rrange(`${seed}-d2`, 0.6, 0.72);
    const tail = rrange(`${seed}-tail`, 0.05, 0.13);

    // Small offsets so the ends are not mathematically perfect.
    const jx = rrange(`${seed}-jx`, -16, 16);
    const jy = rrange(`${seed}-jy`, -16, 16);
    const ox = rrange(`${seed}-ox`, -26, 26);

    const xs = new Float32Array(SAMPLES);
    const ys = new Float32Array(SAMPLES);
    const env = new Float32Array(SAMPLES);
    for (let s2 = 0; s2 < SAMPLES; s2++) {
      const t = s2 / (SAMPLES - 1);
      const spread = cubic1d(1, flare, tail, 0, t);
      const advance = cubic1d(0, adv1, adv2, 1, t);
      const back = (1 - t) * (1 - t);
      const fwd = t * t;
      xs[s2] =
        fanOriginPlane.x + along.x * v * curtainSpread * spread + axis.x * advance + ox * back + jx * fwd;
      ys[s2] =
        fanOriginPlane.y + along.y * v * curtainSpread * spread + axis.y * advance + jy * fwd;
      // Zero at both ends so the anchors stay put, and weighted toward the open
      // end: near the focus the strands are packed and must not smear.
      env[s2] = Math.sin(Math.PI * t) ** 1.2 * (1 - t) ** 0.5 * 1.5;
    }

    // Hue is organised across the bundle rather than at random: the outer
    // strands stay cool and the core carries the warmer fibre, which is what
    // makes the funnel read as converging.
    const across = Math.abs(v) + rrange(`${seed}-hue`, -0.12, 0.12);
    const colorKey =
      across > 0.62 ? 'fibreC' : across > 0.3 ? 'fibreA' : 'fibreB';

    strands.push({
      xs,
      ys,
      env,
      colorKey,
      coreWidth: rrange(`${seed}-w`, 1.5, 3),
      alpha: rrange(`${seed}-a`, 0.35, 1),
      period: rpick(`${seed}-per`, TRAVEL_PERIODS),
      pulseOffset: rrange(`${seed}-po`, 0, 1),
      undA: rrange(`${seed}-ua`, 8, 22),
      undF: rint(`${seed}-uf`, 1, 3),
      undP: rrange(`${seed}-up`, 0, Math.PI * 2),
      undA2: rrange(`${seed}-ua2`, 3, 8),
      undF2: rint(`${seed}-uf2`, 2, 5),
      undP2: rrange(`${seed}-up2`, 0, Math.PI * 2),
    });
  }

  /* ------------------------------------------------------------- panels */

  const panels: PanelLayout[] = PANELS.map((spec) => {
    const screen: Pt = {
      x: chipScreen.x + dir * spec.du,
      y: chipScreen.y + spec.dv,
    };
    const plane = apply(inv, screen);

    // Traces leave the chip on the downstream face and enter the panel on the
    // face pointing back at the chip. Both offsets are signed by `dir`.
    const from: Pt = {
      x: chipPlane.x + dir * (chipW / 2),
      y:
        chipPlane.y +
        Math.max(-chipH * 0.34, Math.min(chipH * 0.34, spec.dv * 0.12)),
    };
    const to: Pt = {x: plane.x - dir * (spec.w / 2), y: plane.y};

    return {
      spec,
      plane,
      route: orthoRoute(from, to, spec.routeBias, 46),
      routePeriod: rpick(`${variant}-route-${spec.id}`, TRAVEL_PERIODS),
      routeOffset: rrange(`${variant}-route-o-${spec.id}`, 0, 1),
      routeOffset2: rrange(`${variant}-route-o2-${spec.id}`, 0, 1),
    };
  });

  /* --------------------------------------------------------- icon strip */

  const stripScreen: Pt = {
    x: chipScreen.x + dir * ICON_STRIP.du,
    y: chipScreen.y + ICON_STRIP.dv,
  };

  /* ------------------------------------------------- background tiling */

  // How far along the plane's x axis one DRIFT_STEP carries: the inverse of the
  // matrix's linear part applied to the step. Because DRIFT_STEP is very nearly
  // parallel to the plane's x axis, the y component of this is ~0 and each tile
  // is effectively a pure plane-x translation.
  const stepPlaneX = inv[0] * DRIFT_STEP.x + inv[2] * DRIFT_STEP.y;

  return {
    variant,
    flowDirection: dir,
    base,
    inv,
    chipScreen,
    fanOriginScreen,
    chip: {plane: chipPlane, w: chipW, h: chipH},
    fanOriginPlane,
    fanFocus: focus,
    strands,
    panels,
    iconStrip: {
      plane: apply(inv, stripScreen),
      count: ICON_STRIP.count,
      size: ICON_STRIP.size,
      gap: ICON_STRIP.gap,
      depth: ICON_STRIP.depth,
    },
    tilePlaneWidth: stepPlaneX,
  };
};

/** Straight-line polyline helper used by the icon strip's stub traces. */
export const straight = (a: Pt, b: Pt): Polyline => makePolyline([a, b]);
