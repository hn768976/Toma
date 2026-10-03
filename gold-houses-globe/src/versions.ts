// One data row per version. To add a version, copy a row, give it a new `id`
// and change its colours / symbol. Root.tsx turns every row into a composition.
import type { LowPolyParams } from "./looks/LowPolyLuxe";
import type { CloudParams } from "./looks/CloudUpload";
import type { HousesParams } from "./looks/PriceHouses";
import type { NetworkParams } from "./looks/NetworkGrowth";
import type { GlobeParams } from "./looks/ConnectedGlobe";

export type Version<P> = { id: string; params: P };

export const LOW_POLY: Version<LowPolyParams>[] = [
  { id: "LowPolyLuxe-Gold", params: { edge: "#E8B860", face: "#3a3027", envTint: "#FFE2B8" } },
  { id: "LowPolyLuxe-Silver", params: { edge: "#D8DEE8", face: "#30343b", envTint: "#DCE6F4" } },
];

export const CLOUD: Version<CloudParams>[] = [{ id: "CloudUpload", params: { accent: "#5FE8FF", bg: "#020A20" } }];

export const HOUSES: Version<HousesParams>[] = [
  { id: "PriceHouses-Dollar", params: { symbol: "$", glow: "#F8E8D0", dark: "#2A1E14" } },
  { id: "PriceHouses-Euro", params: { symbol: "\u20AC", glow: "#F8E8D0", dark: "#2A1E14" } },
];

export const NETWORK: Version<NetworkParams>[] = [{ id: "NetworkGrowth", params: { cyan: "#4FE8FF", lime: "#A0FF5F", floor: "#0E2A4A" } }];

export const GLOBE: Version<GlobeParams>[] = [
  { id: "ConnectedGlobe", params: { ocean: "#2A6AD8", rim: "#7FE0FF", city: "#FFB860", land: "#B8CCE4" } },
];
