// Entry point for dist/kurzgesagt-vault.html.

import React from "react";
import { createRoot } from "react-dom/client";
import {
  DURATION_IN_FRAMES,
  FONT_STACK,
  FPS,
  PALETTE,
} from "../vault/constants";
import { KurzgesagtVault } from "../vault/KurzgesagtVault";
import { Stage } from "./Stage";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <React.StrictMode>
    <Stage
      component={KurzgesagtVault}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      meta="1920 × 1080 · 29s · 30fps"
      theme={{
        page: "#05101d",
        meta: "rgba(247, 243, 233, 0.34)",
        buttonText: PALETTE.cream,
        buttonBackground: "rgba(247, 243, 233, 0.1)",
        accent: PALETTE.teal,
        accentText: PALETTE.navy,
        fontStack: FONT_STACK,
      }}
    />
  </React.StrictMode>,
);
