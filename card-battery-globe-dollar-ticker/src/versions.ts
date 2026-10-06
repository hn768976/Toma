import { BatteryParams } from "./looks/circuitBattery";
import { DollarParams } from "./looks/dollarGlobe";
import { MapTickerParams } from "./looks/mapTicker";
import { MarketGlobeParams } from "./looks/marketGlobe";
import { PaymentParams } from "./looks/paymentNetwork";

/**
 * One data row per version. Every composition: 3840×2160, 30 fps, 600 frames.
 * `file` is the deliverable name; `id` is the Remotion composition id
 * (ids may not contain underscores). To add a colourway, add a row
 * (README → "Adding a colourway").
 */
export type Version =
  | { id: string; file: string; look: "payment"; params: PaymentParams }
  | { id: string; file: string; look: "battery"; params: BatteryParams }
  | { id: string; file: string; look: "marketGlobe"; params: MarketGlobeParams }
  | { id: string; file: string; look: "dollarGlobe"; params: DollarParams }
  | { id: string; file: string; look: "mapTicker"; params: MapTickerParams };

export const VERSIONS: Version[] = [
  {
    id: "PaymentNetwork-BlackCard",
    file: "PaymentNetwork_BlackCard",
    look: "payment",
    params: { finish: "black", body: "#16181C", text: "#E6E8EB", chip: "gold", accent: "#3AD8FF" },
  },
  {
    id: "PaymentNetwork-GoldCard",
    file: "PaymentNetwork_GoldCard",
    look: "payment",
    params: { finish: "gold", body: "#C8A04A", text: "#2A2010", chip: "silver", accent: "#3AD8FF" },
  },
  {
    id: "CircuitBattery-Blue",
    file: "CircuitBattery_Blue",
    look: "battery",
    params: { edge: "#5A8AFF", edgeCore: "#BFD8FF", board: "#081028", blue: "#3A8AFF", orange: "#FFA03A" },
  },
  {
    id: "MarketGlobe-Blue",
    file: "MarketGlobe_Blue",
    look: "marketGlobe",
    params: { globe: "#8AC8FF", bgTop: "#020A2A", bgBottom: "#041A6A", floor: "#1A3A8A", cyan: "#5FD8FF", red: "#FF3A5A" },
  },
  {
    id: "DollarGlobe-CrashRed",
    file: "DollarGlobe_CrashRed",
    look: "dollarGlobe",
    params: { tint: "#E0102A", bg: "#140204", highlight: "#FFD8D0", direction: "down" },
  },
  {
    id: "DollarGlobe-RallyGreen",
    file: "DollarGlobe_RallyGreen",
    look: "dollarGlobe",
    params: { tint: "#1AD86A", bg: "#021408", highlight: "#D8FFE6", direction: "up" },
  },
  {
    id: "MapTicker-Blue",
    file: "MapTicker_Blue",
    look: "mapTicker",
    params: { map: "#8AB8FF", bg: "#041A5A", up: "#3AFF6A", down: "#FF3A5A" },
  },
];
