import { DotGrid } from "./DotGrid";
import { midnightPalette, referencePalette } from "./palettes";

export const DotGridReference: React.FC = () => (
  <DotGrid palette={referencePalette} />
);

export const DotGridMidnight: React.FC = () => (
  <DotGrid palette={midnightPalette} />
);
