import { BatteryParams } from "./looks/circuitBattery";
import { PaymentParams } from "./looks/paymentNetwork";

/**
 * One data row per version. Every composition: 3840×2160, 30 fps, 600 frames.
 * `file` is the deliverable name; `id` is the Remotion composition id
 * (ids may not contain underscores). To add a colourway, add a row
 * (README → "Adding a colourway").
 */
export type Version =
  | { id: string; file: string; look: "payment"; params: PaymentParams }
  | { id: string; file: string; look: "battery"; params: BatteryParams };

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
];
