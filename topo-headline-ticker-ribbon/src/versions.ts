import type { TopoVersion } from "./looks/topo/TopoLook";

// One data row per version. Add a colourway = add a row.
export const TOPO_VERSIONS: TopoVersion[] = [
  { id: "TopoTerrain-Teal", contour: "#5AE8E0", base: "#041A24", haze: "#082638", gold: "#E8B84A", tagMode: "values", tagCount: 2, seed: 1701 },
  { id: "TopoTerrain-Blue", contour: "#5A8AFF", base: "#040C2E", haze: "#0A1848", gold: "#E8B84A", tagMode: "bigdata", tagCount: 4, seed: 2903 },
];

import type { HeadlineVersion } from "./looks/headline/HeadlineLook";

// Headline topics: one row each. Generic economy words only.
export const HEADLINE_VERSIONS: HeadlineVersion[] = [
  { id: "HeadlineWords-Tariffs", headline: "TARIFFS", keywords: ["INFLATION", "FEAR", "JOB LOSSES", "TRADE WAR", "MARKET COLLAPSE", "INSTABILITY", "RECESSION"], seed: 31 },
  { id: "HeadlineWords-Recession", headline: "RECESSION", keywords: ["UNEMPLOYMENT", "DEBT", "FEAR", "LAYOFFS", "MARKET CRASH", "SLOWDOWN", "UNCERTAINTY"], seed: 47 },
  { id: "HeadlineWords-Inflation", headline: "INFLATION", keywords: ["RISING PRICES", "INTEREST RATES", "COST OF LIVING", "WAGES", "DEBT", "UNCERTAINTY"], seed: 59 },
];

import type { TickerVersion } from "./looks/ticker/TickerLook";

export const TICKER_VERSIONS: TickerVersion[] = [
  {
    id: "TickerFloor-Blue", bg: "#020A2A", tileDark: "#0A3A9A", tileBright: "#1A6ADF", line: "#E8F4FF", lineAlt: "#7AD8FF",
    haze: "#1A4AB8", hazeGain: 0.55, beam: "#6AA8FF", label: "#BFE0FF", bar: "#3A7AE8", gap: "#020a24",
    pUp: 0.33, pSigned: 0.66, markerUp: "#FFFFFF", markerDown: "#FFFFFF", waveAmp: 1.25, trend: 0, seed: 4242,
  },
  // Market-crash version: red tiles, ▼ dominant (~75%), lines trending down.
  {
    id: "TickerFloor-BearRed", bg: "#0A0103", tileDark: "#5A0A14", tileBright: "#A81A2A", line: "#FFFFFF", lineAlt: "#FF4A6A",
    haze: "#1A0204", hazeGain: 2.2, beam: "#FF5A4A", label: "#FFC8CC", bar: "#C82A3A", gap: "#120204",
    pUp: 0.25, pSigned: 1.0, markerUp: "#FFFFFF", markerDown: "#FF6A78", waveAmp: 0.75, trend: 3.4, seed: 4242,
  },
];

import type { RibbonVersion } from "./looks/ribbon/RibbonLook";

export const RIBBON_VERSIONS: RibbonVersion[] = [
  { id: "TrendRibbon-Multicolour", bg: "#030806", gradient: ["#8A6AFF", "#FF6A9A", "#3AD8C8", "#5AFF8A"], candleUp: "#3AE86A", candleDown: "#FF3A4A", label: ["#FFA03A", "#3AE86A", "#FF3A4A"], seed: 777 },
];
