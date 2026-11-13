import React from "react";
import { Stage } from "./engine/Stage";
import { createHydrationScene } from "./scene/hydration";

// Factories are created once so the WebGL scene is built a single time.
const referenceFactory = createHydrationScene("reference");
const cameraFactory = createHydrationScene("camera");

/** Version 1: reference match. */
export const HydrationReference: React.FC = () => <Stage factory={referenceFactory} background="#9fb4cf" />;

/** Version 2: same scene, alternative camera angle and movement. */
export const HydrationCameraMove: React.FC = () => <Stage factory={cameraFactory} background="#9fb4cf" />;
