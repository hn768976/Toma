import React from "react";
import type { PeriodicElement } from "./data/elements";
import type { CardStyle } from "./layout";
import { NeonScene } from "./v1/NeonScene";
import { MetallicScene } from "./v2/MetallicScene";

export type ElementCardProps = {
  element: PeriodicElement;
  style: CardStyle;
};

/**
 * The whole clip for one element in one style: background, the card on a
 * perspective plane, and grain. Everything below this point is a pure
 * function of useCurrentFrame() — no state and no timers, because Remotion
 * renders frames out of order across threads.
 */
export const ElementCard: React.FC<ElementCardProps> = ({ element, style }) =>
  style === "neon" ? (
    <NeonScene element={element} />
  ) : (
    <MetallicScene element={element} />
  );
