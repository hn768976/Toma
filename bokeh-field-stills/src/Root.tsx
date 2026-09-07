import React from "react";
import { Composition } from "remotion";
import { BokehField, bokehFieldDefaultProps } from "./bokeh/BokehField";
import { REFERENCE_HEIGHT, REFERENCE_WIDTH } from "./bokeh/config";
import { ContactSheet } from "./contact/ContactSheet";
import { contactSheetDefaultProps, SHEET_HEIGHT, SHEET_WIDTH } from "./contact/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BokehField"
        component={BokehField}
        // This is a still: one frame, no animation, no loop, no timing.
        durationInFrames={1}
        fps={30}
        width={REFERENCE_WIDTH}
        height={REFERENCE_HEIGHT}
        defaultProps={bokehFieldDefaultProps}
      />
      {/* Review sheet. Its tiles are written into public/ by
          scripts/contact-sheet.ts, which then renders this. */}
      <Composition
        id="ContactSheet"
        component={ContactSheet}
        durationInFrames={1}
        fps={30}
        width={SHEET_WIDTH}
        height={SHEET_HEIGHT}
        defaultProps={contactSheetDefaultProps}
      />
    </>
  );
};
