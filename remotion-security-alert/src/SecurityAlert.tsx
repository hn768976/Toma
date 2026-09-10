import React from "react";
import { AbsoluteFill } from "remotion";
import "./fonts";
import { accentFor, type Outcome } from "./theme";
import { Background } from "./background/Background";
import {
  AlarmWash,
  CrtGlow,
  Field as BaseField,
  Grain,
  Scanlines,
} from "./background/Overlays";
import { Dialog } from "./dialog/Dialog";

/**
 * The whole clip. The two deliverables are this component with a
 * different `outcome` — the build, the typing and the cut are identical;
 * only the resolution and how hard the background reacts differ.
 */
export const SecurityAlert: React.FC<{ outcome: Outcome }> = ({ outcome }) => {
  const accent = accentFor(outcome);

  return (
    <AbsoluteFill style={{ backgroundColor: "#04181e" }}>
      <BaseField />
      <Background accent={accent} />

      <AlarmWash accent={accent} />
      <CrtGlow />
      <Scanlines />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Dialog accent={accent} />
      </AbsoluteFill>

      <Grain />
    </AbsoluteFill>
  );
};
