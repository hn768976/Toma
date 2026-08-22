// Entry point for dist/minutephysics-alarm.html.

import React from "react";
import { createRoot } from "react-dom/client";
import { DURATION_IN_FRAMES, FPS, INK, RED } from "../pen/constants";
import { MinutePhysicsExplainer } from "../pen/MinutePhysicsExplainer";
import { Stage } from "./Stage";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <React.StrictMode>
    <Stage
      component={MinutePhysicsExplainer}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      meta="1920 × 1080 · 58s · 30fps"
      theme={{
        page: "#dcdcdf",
        meta: "rgba(0, 0, 0, 0.42)",
        buttonText: INK,
        buttonBackground: "rgba(0, 0, 0, 0.09)",
        accent: RED,
        accentText: "#ffffff",
        fontStack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    />
  </React.StrictMode>,
);
