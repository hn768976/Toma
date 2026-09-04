import {
  PANEL_COLS,
  PANEL_ROWS,
  SPACING_X,
  SPACING_Z,
  PANEL_HEIGHT,
} from "../constants";
import { mulberry32 } from "../random";

export type PanelInstance = {
  id: number;
  position: [number, number, number];
  /** 0..1 overall brightness multiplier for this panel. */
  brightness: number;
};

// Brightness is clustered, not random: a few seeded hot spots on the floor
// grid, with each panel taking the strongest one it falls under plus a
// little jitter. That reads as "some racks are busy" rather than noise.
const HOT_SPOTS = 3;

export const buildPanels = (seed: number): PanelInstance[] => {
  const rand = mulberry32(seed);

  const spots = Array.from({ length: HOT_SPOTS }, () => ({
    cx: rand() * (PANEL_COLS - 1),
    cz: rand() * (PANEL_ROWS - 1),
    radius: 1.6 + rand() * 1.7,
    strength: 0.55 + rand() * 0.45,
  }));

  const panels: PanelInstance[] = [];
  const originX = -((PANEL_COLS - 1) * SPACING_X) / 2;
  const originZ = -((PANEL_ROWS - 1) * SPACING_Z) / 2;

  for (let row = 0; row < PANEL_ROWS; row++) {
    for (let col = 0; col < PANEL_COLS; col++) {
      let hot = 0;
      for (const s of spots) {
        const dx = (col - s.cx) / s.radius;
        const dz = (row - s.cz) / s.radius;
        hot = Math.max(hot, s.strength * Math.exp(-(dx * dx + dz * dz)));
      }

      panels.push({
        id: row * PANEL_COLS + col,
        position: [
          originX + col * SPACING_X,
          PANEL_HEIGHT / 2,
          originZ + row * SPACING_Z,
        ],
        brightness: Math.min(1, 0.34 + hot * 0.72 + rand() * 0.1),
      });
    }
  }

  return panels;
};
