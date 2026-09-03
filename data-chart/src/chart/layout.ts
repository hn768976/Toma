import { ORIGIN_VALUE, VALUES, Y_MAX } from "./data";

/**
 * Every measurement is a fraction of the frame's own width or height, so a
 * composition defined at 1920×1080 renders pixel-identical to one at 3840×2160.
 * The fractions come from the reference frame (768×432); the comments give the
 * value each one lands on at 4K.
 */
const F = {
  /** Y axis / left edge of the plot. */
  axisX: 76 / 768, // 380
  /** Centre of the JAN column. */
  firstColX: 106.5 / 768, // 532.5
  /** Distance between month columns. */
  colStep: 52 / 768, // 260
  /** Right edge of the Y tick labels. */
  yLabelRightX: 64 / 768, // 320
  /** Left margin for the title block. */
  textLeftX: 68 / 768, // 340
  /** Right edge of the plot — where the X axis and the horizontals stop. */
  plotRightX: 708 / 768, // 3540

  /** Y of data value 0 — where the X axis sits. */
  baselineY: 379.5 / 432, // 1897.5
  /** Height of one data unit. */
  unitY: 0.23 / 432, // 1.15 per unit → 115 per 100
  /** Top of the vertical grid lines. */
  gridTopY: 123 / 432, // 615
  /** Top of the dashed Y axis (it stops just short of the grid). */
  axisTopY: 134 / 432, // 670

  titleBaselineY: 54 / 432, // 270
  subtitleBaselineY: 68 / 432, // 340
  subtitleLineHeight: 12 / 432, // 60
  xLabelBaselineY: 400 / 432, // 2000

  titleSize: 27.8 / 768, // 139
  subtitleSize: 11 / 768, // 55
  yLabelSize: 13.75 / 768, // 68.75
  xLabelSize: 10 / 768, // 50

  axisWidth: 1.7 / 768, // 8.5
  gridWidth: 1 / 768, // 5
  /** Dash pattern of the axes — the signature detail of the reference. */
  axisDash: 12 / 768, // 60
  axisGap: 2.4 / 768, // 12

  /** Dotted series stroke: dot diameter and centre-to-centre pitch. */
  dotSize: 2.3 / 768, // 11.5
  dotPitch: 3.6 / 768, // 18
} as const;

export type Point = { x: number; y: number };

export type Layout = ReturnType<typeof getLayout>;

export const getLayout = (width: number, height: number) => {
  const axisX = width * F.axisX;
  const firstColX = width * F.firstColX;
  const colStep = width * F.colStep;
  const baselineY = height * F.baselineY;
  const unitY = height * F.unitY;

  /** Data value → y in frame pixels. */
  const valueToY = (value: number) => baselineY - value * unitY;
  /** Month index (0 = JAN) → x in frame pixels. */
  const monthToX = (index: number) => firstColX + index * colStep;

  /** The polyline for the line and area variants: the Y-axis anchor + 12 months. */
  const seriesPoints: Point[] = [
    { x: axisX, y: valueToY(ORIGIN_VALUE) },
    ...VALUES.map((value, i) => ({ x: monthToX(i), y: valueToY(value) })),
  ];

  return {
    width,
    height,
    axisX,
    firstColX,
    colStep,
    lastColX: monthToX(VALUES.length - 1),
    plotRightX: width * F.plotRightX,
    baselineY,
    valueToY,
    monthToX,
    seriesPoints,
    gridTopY: height * F.gridTopY,
    axisTopY: height * F.axisTopY,
    topY: valueToY(Y_MAX),

    yLabelRightX: width * F.yLabelRightX,
    textLeftX: width * F.textLeftX,
    titleBaselineY: height * F.titleBaselineY,
    subtitleBaselineY: height * F.subtitleBaselineY,
    subtitleLineHeight: height * F.subtitleLineHeight,
    xLabelBaselineY: height * F.xLabelBaselineY,

    titleSize: width * F.titleSize,
    subtitleSize: width * F.subtitleSize,
    yLabelSize: width * F.yLabelSize,
    xLabelSize: width * F.xLabelSize,

    axisWidth: width * F.axisWidth,
    gridWidth: width * F.gridWidth,
    axisDash: width * F.axisDash,
    axisGap: width * F.axisGap,
    dotSize: width * F.dotSize,
    dotPitch: width * F.dotPitch,

    /** Bars sit at 55% of the column width. */
    barWidth: colStep * 0.55,
  };
};

/** Cumulative length of a polyline, plus the total. */
export const polylineLengths = (points: Point[]) => {
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }
  return { cumulative, total: cumulative[cumulative.length - 1] };
};

/** Point at `distance` along the polyline, clamped to both ends. */
export const pointAtLength = (
  points: Point[],
  cumulative: number[],
  distance: number,
): Point => {
  if (distance <= 0) return points[0];
  const total = cumulative[cumulative.length - 1];
  if (distance >= total) return points[points.length - 1];
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < distance) i++;
  const segStart = cumulative[i - 1];
  const t = (distance - segStart) / (cumulative[i] - segStart);
  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
  };
};

/** Evenly pitched dot centres along the polyline. */
export const dotsAlongPolyline = (points: Point[], pitch: number): Point[] => {
  const { cumulative, total } = polylineLengths(points);
  const dots: Point[] = [];
  for (let d = 0; d <= total; d += pitch) {
    dots.push(pointAtLength(points, cumulative, d));
  }
  return dots;
};
