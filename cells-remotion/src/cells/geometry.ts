import { random } from "remotion";
import { compensate } from "./color";
import type { Variant, VariantName } from "./variants";

export const TAU = Math.PI * 2;

/** One point on a blob's outline. */
export type BlobPoint = {
  /** Angle around the centre. Jittered, but kept in order. */
  angle: number;
  /** This point's radius as a fraction of the blob's mean radius (±jitter). */
  radiusFactor: number;
  /** Integer cycles per loop, so the morph closes exactly at frame 450. */
  morphFreq: number;
  morphPhase: number;
  morphAmp: number;
};

export type Cell = {
  key: string;
  /** Position at frame 0, in 4K px. */
  x0: number;
  y0: number;
  /** Mean radius, in 4K px. */
  radius: number;
  /** Short-axis / long-axis ratio, and the angle of the long axis. */
  elongation: number;
  elongationAngle: number;
  points: BlobPoint[];
  /** 0 = far (least blurred), 1 = mid, 2 = near (blurriest, fastest). */
  depth: 0 | 1 | 2;
  /** Fill, already blur-compensated for this cell's depth. */
  fill: string;
  alpha: number;
  rotation0: number;
  /** Whole turns over the loop — an integer, so rotation closes too. */
  rotationTurns: number;
  driftMain: number;
  driftCross: number;
  driftPhaseMain: number;
  driftPhaseCross: number;
  /** Integer cycles per loop on the cross axis. */
  crossFreq: number;
};

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

const pick = <T,>(items: readonly T[], u: number): T =>
  items[Math.min(items.length - 1, Math.floor(u * items.length))];

/**
 * Builds the whole cell set once. Everything here is seeded off stable strings,
 * so the field is byte-for-byte the same on every render and on every machine.
 * Per frame we only evaluate drift, morph and rotation on top of this.
 */
export const buildCells = (
  variant: Variant,
  name: VariantName,
  width: number,
  height: number,
): Cell[] => {
  // Built without depth first; depth is ranked in afterwards so the configured
  // bucket shares hold exactly whatever the size bias does to the scores.
  type Draft = Omit<Cell, "depth" | "fill" | "driftMain" | "driftCross"> & {
    depthScore: number;
    baseHex: string;
    driftMainBase: number;
    driftCrossBase: number;
  };
  const drafts: Draft[] = [];
  const [minSize, maxSize] = variant.sizeRange;
  const [minAlpha, maxAlpha] = variant.opacityRange;
  const [minPoints, maxPoints] = variant.pointRange;
  const { shape: shapeSettings } = variant;
  const { drift } = variant;


  // Loose anchors the cells gather around. Placed with slack outside the frame
  // so masses can hang off an edge the way they do on a real slide.
  const anchors: [number, number][] = [];
  for (let a = 0; a < variant.clustering.anchors; a++) {
    anchors.push([
      lerp(-0.12, 1.12, random(`${name}-anchor-${a}-x`)) * width,
      lerp(-0.12, 1.12, random(`${name}-anchor-${a}-y`)) * height,
    ]);
  }

  for (let i = 0; i < variant.cellCount; i++) {
    const key = `${name}-cell-${i}`;
    const s = (part: string) => random(`${key}-${part}`);

    // Sizes vary widely: biased toward the small end so a handful of large
    // cells dominate rather than everything landing mid-range.
    let sizeU = Math.pow(s("size"), 1.15);

    // Tone is decided before size, because the two are correlated: the faint
    // tone carries the big diffuse washes and the strong tone the smaller,
    // denser cores. That layering is what makes a pool read as a mass with a
    // dark centre and a pale skirt rather than as a flat patch.
    const toneU = s("tone");
    if (toneU >= 0.63) {
      sizeU = lerp(0.5, 1, sizeU);
    }

    const diameter = lerp(minSize, maxSize, sizeU);
    const radius = diameter / 2;

    // Depth score. Mostly seeded, but leaning on size: the smallest cells are
    // pushed toward the blurriest bucket so nothing ends up as a small hard
    // speck of dirt on the slide. Ranked into buckets below.
    const depthScore = s("depth") * 0.55 + (1 - sizeU) * 0.45;

    // Most cells gather around an anchor; the rest go anywhere. No spacing
    // pass in either case — overlap is the point, and heavily blurred blobs
    // that overlap pool into one larger soft mass.
    const margin = radius * 0.85;
    let x0: number;
    let y0: number;
    if (anchors.length > 0 && s("stray") > variant.clustering.strayShare) {
      const anchor = pick(anchors, s("anchor"));
      // Two uniforms summed give a soft centre-weighted scatter.
      const spread = variant.clustering.spread;
      x0 = anchor[0] + (s("ox1") + s("ox2") - 1) * spread;
      y0 = anchor[1] + (s("oy1") + s("oy2") - 1) * spread;
    } else {
      x0 = lerp(-margin, width + margin, s("x"));
      y0 = lerp(-margin, height + margin, s("y"));
    }

    // Opacity is correlated with tone order, so the faintest tone is also the
    // most transparent.
    let baseHex: string;
    let alphaLow: number;
    let alphaHigh: number;
    if (toneU < 0.32) {
      baseHex = variant.palette.cellTones[0];
      alphaLow = lerp(minAlpha, maxAlpha, 0.66);
      alphaHigh = maxAlpha;
    } else if (toneU < 0.63) {
      baseHex = variant.palette.cellTones[1];
      alphaLow = lerp(minAlpha, maxAlpha, 0.33);
      alphaHigh = lerp(minAlpha, maxAlpha, 0.86);
    } else if (toneU < 0.86) {
      baseHex = variant.palette.cellTones[2];
      alphaLow = minAlpha;
      alphaHigh = lerp(minAlpha, maxAlpha, 0.55);
    } else {
      baseHex = variant.palette.cellEdge;
      alphaLow = lerp(minAlpha, maxAlpha, 0.25);
      alphaHigh = lerp(minAlpha, maxAlpha, 0.78);
    }

    // Biased toward the upper end of the range: five points reads as a rounded
    // polygon, seven or eight reads organic.
    const pointCount = Math.round(
      lerp(minPoints, maxPoints, Math.pow(s("points"), shapeSettings.countBias)),
    );
    // The per-point radii are varied along two low harmonics of the angle
    // rather than independently. Independent radii on six or eight points tend
    // to alternate long/short, which reads as a triangle or a square once the
    // curve is smoothed; two harmonics give the lopsided ovoid and kidney
    // shapes that read as cells. How gentle those curves are is a per-variant
    // setting.
    const harmonic1 = pick(shapeSettings.harmonics[0], s("h1"));
    const harmonic2 = pick(shapeSettings.harmonics[1], s("h2"));
    const phase1 = s("hp1") * TAU;
    const phase2 = s("hp2") * TAU;

    const points: BlobPoint[] = [];
    for (let p = 0; p < pointCount; p++) {
      const pk = (part: string) => random(`${key}-p${p}-${part}`);
      const slice = TAU / pointCount;
      // Angular jitter within the point's own slice keeps the order stable,
      // so the outline never self-crosses.
      const angle =
        p * slice + (pk("angle") - 0.5) * slice * shapeSettings.angleJitter;
      const shape =
        shapeSettings.harmonicWeights[0] *
          Math.sin(harmonic1 * angle + phase1) +
        shapeSettings.harmonicWeights[1] *
          Math.sin(harmonic2 * angle + phase2);
      points.push({
        angle,
        // Still +/-25% from the mean at most, just correlated around the ring.
        radiusFactor:
          1 +
          variant.radiusJitter *
            (shape * (1 - shapeSettings.pointNoise) +
              (pk("radius") - 0.5) * 2 * shapeSettings.pointNoise),
        morphFreq: pick(variant.morphFrequencies, pk("freq")),
        morphPhase: pk("phase"),
        morphAmp: lerp(
          variant.morphAmplitude[0],
          variant.morphAmplitude[1],
          pk("amp"),
        ),
      });
    }

    drafts.push({
      key,
      x0,
      y0,
      radius,
      // A cell built only from radii around a centre still tends toward a
      // circle, and circles read as bubbles. Squashing each blob along a
      // seeded axis is what makes the field read as cells.
      elongation: lerp(0.55, 0.98, s("elongation")),
      elongationAngle: s("elongationAngle") * TAU,
      points,
      depthScore,
      baseHex,
      alpha: lerp(alphaLow, alphaHigh, s("alpha")),
      rotation0: s("rot0") * TAU,
      rotationTurns:
        s("rotates") < variant.rotatingShare ? (s("rotdir") < 0.5 ? 1 : -1) : 0,
      driftMainBase: lerp(
        drift.mainAmplitude[0],
        drift.mainAmplitude[1],
        s("driftMain"),
      ),
      driftCrossBase: lerp(
        drift.crossAmplitude[0],
        drift.crossAmplitude[1],
        s("driftCross"),
      ),
      // Phase kept inside (-0.24, 0.24) so every cell is travelling along the
      // variant's drift direction at frame 0; each one turns back at its own
      // time, so the field churns instead of reversing in unison.
      driftPhaseMain: (s("phaseMain") - 0.5) * 0.48,
      driftPhaseCross: s("phaseCross"),
      crossFreq: pick(drift.crossFrequencies, s("crossFreq")),
    });
  }

  // Rank by depth score and cut the buckets at the configured shares, so
  // far/mid/near always come out at roughly [36%, 36%, 28%] of the field
  // however the size bias skews the raw scores.
  const order = drafts
    .map((draft, index) => ({ index, score: draft.depthScore }))
    // Ties broken by index, so the order is stable and deterministic.
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const farEnd = Math.round(variant.depthShare[0] * drafts.length);
  const midEnd = farEnd + Math.round(variant.depthShare[1] * drafts.length);
  const depths = new Array<0 | 1 | 2>(drafts.length);
  order.forEach((entry, rank) => {
    depths[entry.index] = rank < farEnd ? 0 : rank < midEnd ? 1 : 2;
  });

  return drafts.map((draft, index) => {
    const depth = depths[index];
    // The blurrier the bucket, the more compensation the fill needs.
    const blurWeight = variant.depthBlur[depth];
    const speed = variant.drift.depthSpeed[depth];
    const {
      depthScore: _score,
      baseHex,
      driftMainBase,
      driftCrossBase,
      ...rest
    } = draft;
    return {
      ...rest,
      depth,
      fill: compensate(
        baseHex,
        variant.saturationBoost * blurWeight,
        variant.lightnessShift * blurWeight,
      ),
      driftMain: driftMainBase * speed,
      driftCross: driftCrossBase * speed,
    };
  });
};

/**
 * Position offset for a cell at loop position t (0..1).
 *
 * Both terms are sine differences, so each is exactly 0 at t = 0. The caller
 * derives t from frame % 450, which makes t = 0 at frame 450 too — the path is
 * closed by construction rather than by luck of floating point.
 */
export const cellOffset = (
  cell: Cell,
  t: number,
  direction: [number, number],
): [number, number] => {
  const main =
    cell.driftMain *
    (Math.sin(TAU * (t + cell.driftPhaseMain)) -
      Math.sin(TAU * cell.driftPhaseMain));
  const cross =
    cell.driftCross *
    (Math.sin(TAU * (cell.crossFreq * t + cell.driftPhaseCross)) -
      Math.sin(TAU * cell.driftPhaseCross));
  const [dx, dy] = direction;
  // Cross axis is the perpendicular of the drift direction.
  return [dx * main - dy * cross, dy * main + dx * cross];
};

/**
 * Traces one blob as a closed path of cubic beziers through its points
 * (Catmull-Rom control points), so the outline is smooth and organic rather
 * than a polygon or a circle.
 */
export const traceBlob = (
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  cx: number,
  cy: number,
  t: number,
) => {
  const rotation = cell.rotation0 + TAU * cell.rotationTurns * t;
  const n = cell.points.length;

  // Plain Catmull-Rom control offsets are (P[i+1] - P[i-1]) / 6, which is 11%
  // too short to reproduce the curvature of a circle at eight points and 37%
  // too short at five. That shortfall is what leaves a blob with flat sides
  // and faint corners at its sample points. Scaling the offsets by the ratio
  // between the circular control length, (4/3)tan(pi/2n), and what Catmull-Rom
  // would give on a regular polygon, sin(2pi/n)/3, puts the curvature back.
  const tension = (4 * Math.tan(Math.PI / (2 * n))) / Math.sin(TAU / n);
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const p = cell.points[i];
    // Each point's radius breathes on its own integer-frequency sine, so the
    // blob morphs slowly and returns to its exact starting shape at t = 1.
    const r =
      cell.radius *
      p.radiusFactor *
      (1 + p.morphAmp * Math.sin(TAU * (p.morphFreq * t + p.morphPhase)));
    // Squash toward the cell's short axis. The rotation is applied to the
    // whole blob, axis included, so a rotating cell tumbles rather than
    // wobbling inside a fixed outline.
    const local = p.angle - cell.elongationAngle;
    const cosL = Math.cos(local);
    const sinL = Math.sin(local);
    const squash =
      1 / Math.hypot(cosL, sinL / cell.elongation);
    const a = p.angle + rotation;
    xs[i] = cx + Math.cos(a) * r * squash;
    ys[i] = cy + Math.sin(a) * r * squash;
  }

  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n;
    const i1 = i;
    const i2 = (i + 1) % n;
    const i3 = (i + 2) % n;
    ctx.bezierCurveTo(
      xs[i1] + ((xs[i2] - xs[i0]) / 6) * tension,
      ys[i1] + ((ys[i2] - ys[i0]) / 6) * tension,
      xs[i2] - ((xs[i3] - xs[i1]) / 6) * tension,
      ys[i2] - ((ys[i3] - ys[i1]) / 6) * tension,
      xs[i2],
      ys[i2],
    );
  }
  ctx.closePath();
};
