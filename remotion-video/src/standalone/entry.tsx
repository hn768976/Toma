// Entry point for the single-file HTML build (see scripts/build-standalone.mjs).

import React from "react";
import { createRoot } from "react-dom/client";
import { Stage } from "./Stage";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <React.StrictMode>
    <Stage />
  </React.StrictMode>,
);
