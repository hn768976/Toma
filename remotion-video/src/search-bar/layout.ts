import type { BarStyle } from "./variants";

/**
 * Geometry, all in composition pixels. Everything inside the pill is derived
 * from the pill's height so the whole thing scales with one number.
 */
export type Layout = {
  width: number;
  height: number;
  /** The pill. */
  barX: number;
  barY: number;
  barW: number;
  barH: number;
  radius: number;
  /** Canvas rect shared by every bar-attached layer, with room for glow. */
  layerX: number;
  layerY: number;
  layerW: number;
  layerH: number;
  pad: number;
  /** Chrome slots. */
  iconCx: number;
  iconCy: number;
  iconR: number;
  iconStroke: number;
  labelX: number;
  labelSize: number;
  labelTracking: number;
  gap: number;
  /** Set once the label has been measured. */
  dividerX: number;
  textX: number;
  textSize: number;
  textRight: number;
  borderWidth: number;
  /** Autocomplete panel below the bar. */
  panelGap: number;
  rowH: number;
  panelPadY: number;
  /** Result count line below the bar. */
  countY: number;
  countSize: number;
};

const BAR_WIDTH_FRACTION = 0.34;
const BAR_HEIGHT_FRACTION = 0.09; // of the bar's width
export const BAR_CENTRE_Y_FRACTION = 0.42;

export const getLayout = (
  width: number,
  height: number,
  barStyle: BarStyle,
  labelWidth: number,
): Layout => {
  const barW = Math.round(width * BAR_WIDTH_FRACTION);
  const barH = Math.round(barW * BAR_HEIGHT_FRACTION);
  const barX = Math.round((width - barW) / 2);
  const barY = Math.round(height * BAR_CENTRE_Y_FRACTION - barH / 2);
  const pad = Math.round(barH * 1.25);

  const padX = barH * 0.42;
  const iconR = barH * 0.185;
  const gap = barH * 0.28;
  const iconCx = barX + padX + iconR;
  const labelX = iconCx + iconR + gap;
  const dividerX = labelX + labelWidth + gap;
  const textX = dividerX + gap * 1.15;

  return {
    width,
    height,
    barX,
    barY,
    barW,
    barH,
    radius: barStyle === "terminal" ? 0 : barH / 2,
    layerX: barX - pad,
    layerY: barY - pad,
    layerW: barW + pad * 2,
    layerH: barH + pad * 2,
    pad,
    iconCx,
    iconCy: barY + barH / 2,
    iconR,
    iconStroke: Math.max(2, barH * 0.055),
    labelX,
    labelSize: barH * 0.33,
    labelTracking: barH * 0.33 * 0.16,
    gap,
    dividerX,
    textX,
    textSize: barH * 0.42,
    textRight: barX + barW - padX * 0.6,
    borderWidth: barStyle === "terminal" ? Math.max(2, barH * 0.022) : Math.max(2, barH * 0.03),
    panelGap: barH * 0.16,
    rowH: barH * 0.9,
    panelPadY: barH * 0.22,
    countY: barY + barH + barH * 0.62,
    countSize: barH * 0.26,
  };
};
