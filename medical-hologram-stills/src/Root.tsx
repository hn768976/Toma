import React from "react";
import { Still } from "remotion";
import {
  MedicalHologram,
  SUBJECTS,
  medicalHologramSchema,
} from "./hologram/MedicalHologram";
import { COLOURWAY_IDS } from "./hologram/colourways";

// Output spec: 6000 x 3375 (16:9), PNG. Sizes inside the template are
// fractions of frame height, so the preview composition below is the same
// layout at 1920 x 1080.
export const STILL_WIDTH = 6000;
export const STILL_HEIGHT = 3375;
export const PREVIEW_WIDTH = 1920;
export const PREVIEW_HEIGHT = 1080;

export const compositionId = (subjectId: string, colourway: string) =>
  `${subjectId}-${colourway}`;

export const RemotionRoot: React.FC = () => {
  const first = SUBJECTS[0];
  return (
    <>
      {/* One still per subject x colourway, composition id = "<subject-id>-<colourway>" (Remotion ids cannot contain "_"; the PNG is still named <subject-id>_<colourway>.png) */}
      {SUBJECTS.flatMap((subject) =>
        subject.colourways.map((colourway) => (
          <Still
            key={compositionId(subject.id, colourway)}
            id={compositionId(subject.id, colourway)}
            component={MedicalHologram}
            width={STILL_WIDTH}
            height={STILL_HEIGHT}
            schema={medicalHologramSchema}
            defaultProps={{ subjectId: subject.id, colourway }}
          />
        )),
      )}
      {/* Lightweight preview for Studio tweaking: pick any subject/colourway in the props panel */}
      {first ? (
        <Still
          id="Preview"
          component={MedicalHologram}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          schema={medicalHologramSchema}
          defaultProps={{ subjectId: first.id, colourway: COLOURWAY_IDS[0] }}
        />
      ) : null}
    </>
  );
};
