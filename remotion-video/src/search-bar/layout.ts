import type { BarStyle, ChromeConfig } from "./variants";

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
  /** Resolved position of the magnifier, wherever the chrome puts it. */
  markCx: number;
  markR: number;
  /** The filled search button at the right end, when the chrome has one. */
  buttonX: number;
  buttonY: number;
  buttonW: number;
  buttonH: number;
  buttonR: number;
  /** Autocomplete panel below the bar. */
  panelGap: number;
  rowH: number;
  panelPadY: number;
  /** Result count line below the bar. */
  countY: number;
  countSize: number;
};

/** Border weight per bar style, as a fraction of the pill's height. */
const BORDER_WEIGHT: Record<BarStyle, number> = {
  glow: 0.03,
  terminal: 0.022,
  clean: 0.03,
  minimal: 0.018,
  input: 0.018,
};

const BAR_WIDTH_FRACTION = 0.34;
const BAR_HEIGHT_FRACTION = 0.09; // of the bar's width
export const BAR_CENTRE_Y_FRACTION = 0.42;

export const getLayout = (
  width: number,
  height: number,
  barStyle: BarStyle,
  labelWidth: number,
  chrome: ChromeConfig,
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

  // The filled button, inset inside the right end of the pill.
  const buttonH = barH * 0.72;
  const buttonW = barH * 1.9;
  const buttonX = barX + barW - barH * 0.16 - buttonW;

  // Without the "SEARCH" label the typed text starts at the pill's own
  // padding, and the right edge is whatever the chrome leaves free.
  const textX = chrome.label ? dividerX + gap * 1.15 : barX + padX;
  const rightIconCx = barX + barW - padX - iconR;
  const textRight =
    chrome.icon === "button"
      ? buttonX - gap
      : chrome.icon === "right"
        ? rightIconCx - iconR - gap
        : barX + barW - padX * 0.6;
  const markCx =
    chrome.icon === "button"
      ? buttonX + buttonW / 2
      : chrome.icon === "right"
        ? rightIconCx
        : iconCx;

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
    textRight,
    borderWidth: Math.max(2, barH * BORDER_WEIGHT[barStyle]),
    markCx,
    markR: chrome.icon === "button" ? buttonH * 0.26 : iconR,
    buttonX,
    buttonY: barY + (barH - buttonH) / 2,
    buttonW,
    buttonH,
    buttonR: buttonH * 0.34,
    panelGap: barH * 0.16,
    rowH: barH * 0.9,
    panelPadY: barH * 0.22,
    countY: barY + barH + barH * 0.62,
    countSize: barH * 0.26,
  };
};
