import {
  CAMERA_DRIFT,
  CHIP_HEIGHT_FRACTION,
  CHIP_OFFSET_FRACTION,
  FAN_ORIGIN_FRACTION,
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

const cubic = (a: number, b: number, c: number, d: number, t: number): number => {
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
    y: HEIGHT * 0.52,
  };

  const chipPlane = apply(inv, chipScreen);
  const fanOriginPlane = apply(inv, fanOriginScreen);

  /* ------------------------------------------------------------ strands */

  const originSpread = 150; // tight bundle at the origin, just off-frame
  const maxSpread = 900; // widest point of the fan, around the frame edge
  const pinch = 78; // the bundle pinches back down at the chip

  const strands: StrandGeom[] = [];
  for (let i = 0; i < STRAND_COUNT; i++) {
    const seed = `${variant}-strand-${i}`;
    // -1..1 across the bundle, with a little seeded scatter so the fan does
    // not read as a regular comb.
    const v = ((i + 0.5) / STRAND_COUNT) * 2 - 1 + rrange(`${seed}-jit`, -0.012, 0.012);

    const p0: Pt = {
      x: fanOriginPlane.x + rrange(`${seed}-ox`, -30, 30),
      y: fanOriginPlane.y + v * originSpread,
    };
    const p3: Pt = {
      x: chipPlane.x - dir * (chipW / 2) * 0.92,
      y: chipPlane.y + v * pinch,
    };

    const run = p3.x - p0.x;
    const bulge = maxSpread * rrange(`${seed}-bulge`, 0.72, 1.12);
    const c1: Pt = {
      x: p0.x + run * rrange(`${seed}-c1x`, 0.2, 0.34),
      y: fanOriginPlane.y + v * bulge,
    };
    const c2: Pt = {
      x: p0.x + run * rrange(`${seed}-c2x`, 0.55, 0.72),
      y: chipPlane.y + v * bulge * rrange(`${seed}-c2y`, 0.32, 0.5),
    };

    const xs = new Float32Array(SAMPLES);
    const ys = new Float32Array(SAMPLES);
    const env = new Float32Array(SAMPLES);
    for (let s = 0; s < SAMPLES; s++) {
      const t = s / (SAMPLES - 1);
      xs[s] = cubic(p0.x, c1.x, c2.x, p3.x, t);
      ys[s] = cubic(p0.y, c1.y, c2.y, p3.y, t);
      // Taper the undulation to zero at both ends so the anchors stay put.
      env[s] = Math.sin(Math.PI * t) ** 1.4;
    }

    strands.push({
      xs,
      ys,
      env,
      colorKey: rpick(`${seed}-hue`, ['fibreA', 'fibreB', 'fibreC'] as const),
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
