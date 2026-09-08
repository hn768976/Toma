import React from "react";
import {
  BAR_HEIGHT,
  CYCLE_HEIGHT,
  PLANE_WIDTH,
  ROW_HEIGHT,
} from "../constants";
import { SLOTS } from "../data/instruments";
import type { Theme } from "../theme";
import { SectionBar } from "./SectionBar";
import { InstrumentRow } from "./InstrumentRow";

const SLOT_COUNT = SLOTS.length;

/** Offset of each slot within one cycle. Fixed at module load. */
const SLOT_OFFSETS = (() => {
  const out: number[] = [];
  let y = 0;
  for (const slot of SLOTS) {
    out.push(y);
    y += slot.kind === "bar" ? BAR_HEIGHT : ROW_HEIGHT;
  }
  if (y !== CYCLE_HEIGHT) {
    throw new Error(
      `Cycle is ${y}px but CYCLE_HEIGHT is ${CYCLE_HEIGHT}px; the scroll would not loop.`,
    );
  }
  return out;
})();

const mod = (a: number, n: number) => ((a % n) + n) % n;

const slotHeight = (index: number) =>
  SLOTS[index].kind === "bar" ? BAR_HEIGHT : ROW_HEIGHT;

/**
 * The list is drawn as a CSS translate of a pure function of the frame - never
 * a real scroll container and never accumulated state - so any frame can be
 * rendered on its own, in any order, on any thread.
 *
 * Only the slots that intersect [windowTop, windowBottom] are built, and the
 * caller passes a window wider than the band it will actually show, so nothing
 * pops in at a band edge.
 */
export const BoardList: React.FC<{
  scroll: number;
  windowTop: number;
  windowBottom: number;
  frame: number;
  theme: Theme;
}> = ({ scroll, windowTop, windowBottom, frame, theme }) => {
  const contentLo = windowTop + scroll;
  const contentHi = windowBottom + scroll;

  const first = Math.floor(contentLo / CYCLE_HEIGHT) * SLOT_COUNT - 1;
  const last = Math.ceil(contentHi / CYCLE_HEIGHT) * SLOT_COUNT + 1;

  const children: React.ReactNode[] = [];
  for (let g = first; g <= last; g++) {
    const index = mod(g, SLOT_COUNT);
    const cycle = Math.floor(g / SLOT_COUNT);
    const y = cycle * CYCLE_HEIGHT + SLOT_OFFSETS[index];
    if (y + slotHeight(index) < contentLo || y > contentHi) continue;
    const slot = SLOTS[index];
    children.push(
      <div
        key={g}
        style={{
          position: "absolute",
          left: 0,
          top: y - scroll - windowTop,
          width: PLANE_WIDTH,
        }}
      >
        {slot.kind === "bar" ? (
          <SectionBar title={slot.title} theme={theme} />
        ) : (
          <InstrumentRow
            instrument={slot.instrument}
            model={slot.model}
            frame={frame}
            theme={theme}
            band={slot.rowIndex % 2 === 1}
          />
        )}
      </div>,
    );
  }

  return <>{children}</>;
};
