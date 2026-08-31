/**
 * "Error dialog cascade" — one failure repeating until it buries the frame.
 *
 * One composition component, two variants. `variant` selects a whole look and
 * a whole spawn curve out of VARIANTS; nothing else differs between them.
 *
 * Not a loop: frame 0 is one dialog on an empty field and frame 599 is a
 * completely covered frame. Dialogs accumulate and never clear.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { VARIANTS, type VariantName } from "./config";
import { SpawnLayer } from "./components/SpawnLayer";

export type ErrorCascadeProps = {
  variant: VariantName;
};

export const ErrorCascade: React.FC<ErrorCascadeProps> = ({ variant }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: VARIANTS[variant].palette.background }}>
      <SpawnLayer variant={variant} />
    </AbsoluteFill>
  );
};
