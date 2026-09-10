import React, { createContext, useContext } from "react";
import { paintFill, type FillOptions } from "../fills/treatments";
import type { FillKind } from "../types";

export type Painter = (options: FillOptions) => void;
export type PainterSlot = { current: Painter | null };

/** How a <MotifShape> hands its area over to a treatment. */
export const PainterSlotContext = createContext<PainterSlot | null>(null);

/**
 * The fill treatment for one motif instance: solid, stipple, line fill, dot
 * grid, outline only, metallic or woven.
 *
 * It draws nothing itself. It publishes a painter into the slot its parent
 * <MotifShape> provides, and the shape calls it with the clipped region once
 * the stage runs the draw stack. The variety of treatments is what gives the
 * set its richness, so the choice stays a first-class part of the tree.
 */
export const FillTreatment: React.FC<{ kind: FillKind }> = ({ kind }) => {
  const slot = useContext(PainterSlotContext);
  if (!slot) {
    throw new Error("<FillTreatment> must be rendered inside <MotifShape>");
  }
  slot.current = (options) => paintFill(kind, options);
  return null;
};
