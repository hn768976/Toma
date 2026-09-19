import React from "react";
import { Composition } from "remotion";
import { BloodFlow, bloodFlowSchema } from "./BloodFlow";
import { LOOKS } from "./looks";

export const BLOOD_FPS = 30;
export const HD = { width: 1920, height: 1080 };
export const UHD = { width: 3840, height: 2160 };

/** The reference that ships a matte pass alongside its colour pass. */
const MATTE_LOOK_ID = "V5-DeepField";

/**
 * Every version is registered twice — 1080p and 4K — off the same component and
 * the same duration, so the 4K master is the identical shot at four times the
 * pixels rather than a separate edit.
 */
export const BloodCompositions: React.FC = () => (
  <>
    {LOOKS.map((look) => (
      <React.Fragment key={look.id}>
        <Composition
          id={look.id}
          component={BloodFlow}
          durationInFrames={look.durationInFrames}
          fps={BLOOD_FPS}
          {...HD}
          schema={bloodFlowSchema}
          defaultProps={{ lookId: look.id, backend: "auto" as const, matte: false, showBackend: false }}
        />
        <Composition
          id={`${look.id}-4K`}
          component={BloodFlow}
          durationInFrames={look.durationInFrames}
          fps={BLOOD_FPS}
          {...UHD}
          schema={bloodFlowSchema}
          defaultProps={{ lookId: look.id, backend: "auto" as const, matte: false, showBackend: false }}
        />
        {look.id === MATTE_LOOK_ID ? (
          <>
            <Composition
              id={`${look.id}-Matte`}
              component={BloodFlow}
              durationInFrames={look.durationInFrames}
              fps={BLOOD_FPS}
              {...HD}
              schema={bloodFlowSchema}
              defaultProps={{ lookId: look.id, backend: "auto" as const, matte: true, showBackend: false }}
            />
            <Composition
              id={`${look.id}-Matte-4K`}
              component={BloodFlow}
              durationInFrames={look.durationInFrames}
              fps={BLOOD_FPS}
              {...UHD}
              schema={bloodFlowSchema}
              defaultProps={{ lookId: look.id, backend: "auto" as const, matte: true, showBackend: false }}
            />
          </>
        ) : null}
      </React.Fragment>
    ))}
  </>
);
