/**
 * One data row per version. To add a colourway, copy a row, give it a new id
 * and change the props — nothing else needs to be touched.
 */
import type { CardRainProps } from "./looks/CardRain";
import type { CoinGrowthProps } from "./looks/CoinGrowth";
import type { DiamondReliefProps } from "./looks/DiamondRelief";
import type { NetworkEarthProps } from "./looks/NetworkEarth";
import type { WireframeBulbProps } from "./looks/WireframeBulb";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const LOOP_FRAMES = 600; // 20s seamless loops
export const STORY_FRAMES = 300; // 10s stories (Coin Growth)

export const diamondRelief: { id: string; props: DiamondReliefProps }[] = [
  {
    id: "DiamondRelief-WhiteRight",
    props: {
      surface: "#F2F2F2",
      shadowTint: "#9AA3B0",
      mirror: false,
      rim: 0,
      keyIntensity: 1.3,
      areaIntensity: 1.2,
      ambient: 1.2,
      exposure: 1.1,
      gradientLow: 0.78,
      grain: 0.01,
      background: "#F2F2F2",
    },
  },
  {
    id: "DiamondRelief-GraphiteLeft",
    props: {
      surface: "#2A2C30",
      shadowTint: "#202228",
      mirror: true,
      rim: 9,
      keyIntensity: 1.6,
      areaIntensity: 1.2,
      ambient: 0.9,
      exposure: 1.1,
      gradientLow: 0.5,
      grain: 0.015,
      background: "#2A2C30",
    },
  },
];

const CARD_COLOURS_ALL = [
  { name: "blue", a: "#2F6FE0", b: "#173C8F" },
  { name: "green", a: "#3FB87A", b: "#1D6E48" },
  { name: "teal", a: "#2AA9B8", b: "#136A78" },
  { name: "silver", a: "#A9B1BC", b: "#69717D", metal: true },
  { name: "purple", a: "#8A4FD8", b: "#4A2589" },
  { name: "red", a: "#D9434B", b: "#8A1F2A" },
  { name: "gold", a: "#E2B65A", b: "#9C7428", metal: true },
  { name: "olive", a: "#B7B04A", b: "#6E6A22" },
];

// No green (or green-leaning teal/olive) on the green-screen version.
const CARD_COLOURS_KEY = [
  { name: "blue", a: "#2F6FE0", b: "#173C8F" },
  { name: "navy", a: "#3A4FA8", b: "#1A2350" },
  { name: "silver", a: "#A9B1BC", b: "#69717D", metal: true },
  { name: "purple", a: "#8A4FD8", b: "#4A2589" },
  { name: "red", a: "#D9434B", b: "#8A1F2A" },
  { name: "gold", a: "#E2B65A", b: "#9C7428", metal: true },
  { name: "rose", a: "#E0709A", b: "#97335C" },
  { name: "copper", a: "#D98A55", b: "#8C4A22", metal: true },
];

export const cardRain: { id: string; props: CardRainProps }[] = [
  {
    id: "CardRain-Black",
    props: { background: "#000000", chromaKey: false, colourways: CARD_COLOURS_ALL, exposure: 0.88, grain: 0.015 },
  },
  {
    id: "CardRain-GreenScreen",
    props: { background: "#00FF00", chromaKey: true, colourways: CARD_COLOURS_KEY, exposure: 0.88, grain: 0.015 },
  },
];

export const networkEarth: { id: string; props: NetworkEarthProps }[] = [
  {
    id: "NetworkEarth-BlueRight",
    props: {
      mirror: false,
      centerLon: 5,
      lights: "#7FD4FF",
      arcs: "#5AC8FF",
      plexus: "#8AC8FF",
      glowInner: "#8FD8FF",
      glowMid: "#2F8AD8",
      glowFar: "#082048",
      dayTint: "#3C78C8",
      exposure: 1.0,
      grain: 0.015,
    },
  },
  {
    id: "NetworkEarth-GoldLeft",
    props: {
      mirror: true,
      centerLon: 105,
      lights: "#FFC86A",
      arcs: "#FFB447",
      plexus: "#FFD596",
      glowInner: "#FFE2A8",
      glowMid: "#B9772E",
      glowFar: "#0B1A3C",
      dayTint: "#5A6E96",
      exposure: 1.0,
      grain: 0.015,
    },
  },
];

export const wireframeBulb: { id: string; props: WireframeBulbProps }[] = [
  {
    id: "WireframeBulb-Blue",
    props: {
      line: "#5AC8FF",
      filament: "#BDEFFF",
      bgDeep: "#04104A",
      bgBright: "#0A3A9A",
      network: "#5AB4FF",
      exposure: 0.8,
      grain: 0.015,
    },
  },
  {
    id: "WireframeBulb-Emerald",
    props: {
      line: "#5AF0B0",
      filament: "#C4FFE6",
      bgDeep: "#03241A",
      bgBright: "#0A5A4A",
      network: "#5AE8B0",
      exposure: 0.85,
      grain: 0.015,
    },
  },
];

export const coinGrowth: { id: string; props: CoinGrowthProps }[] = [
  {
    id: "CoinGrowth-BlueSilver",
    props: { coin: "#C8CCD0", bars: "#3A9AFF", chart: "#7CC4FF", rings: "#3A9AFF", exposure: 1.0, grain: 0.015 },
  },
  {
    id: "CoinGrowth-GoldGreen",
    props: { coin: "#E8B84A", bars: "#3AE88A", chart: "#8CF5B8", rings: "#B8E05A", exposure: 1.0, grain: 0.015 },
  },
];
