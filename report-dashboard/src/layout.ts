/**
 * All geometry is expressed in "design pixels" against a 3840x2160 frame and
 * scaled by a single factor taken from useVideoConfig(). Rendering at
 * --scale=0.5 or at full 4K therefore changes nothing but the multiplier.
 */
export const DESIGN_WIDTH = 3840;

export const buildLayout = (width: number, height: number) => {
  const k = width / DESIGN_WIDTH;
  /** design px -> rendered px */
  const u = (px: number) => px * k;

  const margin = 233;
  const cardX = margin;
  const cardW = DESIGN_WIDTH - margin * 2;
  const cardY = 623;
  const cardH = 844;

  // The curve lives inside the card with generous air: no axes, no gridlines,
  // so the only thing establishing the plot area is the whitespace around it.
  const plot = { x: 350, y: 803, width: 3143, height: 564 };

  const statGap = 67;
  const statW = (cardW - statGap * 3) / 4;

  return {
    k,
    u,
    margin,
    badge: {
      centreY: 210,
      height: 84,
      fontSize: 37,
      padX: 46,
      tracking: 0.2,
    },
    title: { centreY: 367, fontSize: 120, rise: 40 },
    subtitle: { centreY: 503, fontSize: 50, rise: 28 },
    card: { x: cardX, y: cardY, width: cardW, height: cardH, radius: 64, rise: 46 },
    cardLabel: { x: cardX + 62, y: cardY + 58, fontSize: 33, tracking: 0.18 },
    plot,
    curveWidth: 7,
    marker: {
      // Inset from the plot box so no marker crowds the card edge or the
      // top-left label.
      x: plot.x + 40,
      y: plot.y + 30,
      width: plot.width - 90,
      height: plot.height - 40,
      minSeparation: 262,
    },
    stats: {
      y: 1540,
      height: 290,
      gap: statGap,
      width: statW,
      radius: 32,
      padX: 58,
      labelTop: 58,
      labelSize: 31,
      labelTracking: 0.16,
      valueTop: 140,
      valueSize: 94,
      deltaSize: 37,
      rise: 34,
    },
    footnote: { centreY: 1910, fontSize: 37, tracking: 0.06 },
    ecg: { centreY: 2067, amplitude: 64, stroke: 4, period: 260 },
    height,
    width,
  };
};

export type Layout = ReturnType<typeof buildLayout>;
