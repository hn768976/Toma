import { LookFactory } from "./lib/LookCanvas";
import { createEField } from "./looks/efield";
import { createTorus } from "./looks/torus";
import { createMagnets } from "./looks/magnets";
import { createPrism } from "./looks/prism";
import { createWindFarm } from "./looks/windfarm";

// One data row per version.
export interface Variant { id: string; factory: LookFactory }

export const VARIANTS: Variant[] = [
  { id: "WindFarmHologram-Blue", factory: createWindFarm({ bgBottom: "#0A2A6A", bgTop: "#1A4A8A", dots: "#8AC8FF", glow: "#9A7AFF" }) },
  { id: "WindFarmHologram-Green", factory: createWindFarm({ bgBottom: "#06302A", bgTop: "#0E5A44", dots: "#8AFFC8", glow: "#C8FF7A" }) },
  { id: "PrismDispersion-Dark", factory: createPrism() },
  { id: "MagneticTorus-PinkViolet", factory: createTorus({ top: "#FF7A8A", bottom: "#8A6AFF", bg: "#0A0624" }) },
  { id: "BarMagnets-Attract", factory: createMagnets({ attract: true }) },
  { id: "BarMagnets-Repel", factory: createMagnets({ attract: false }) },
  { id: "ElectricField-OppositeCharges", factory: createEField({ charges: [1, -1] }) },
  { id: "ElectricField-LikeCharges", factory: createEField({ charges: [1, 1] }) },
];
