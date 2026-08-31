import { continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/RobotoMono";

// Roboto Mono, not a proportional grotesque: canvas 2D has no way to ask
// for the `tabular-nums` OpenType feature, so the only way to stop the
// callout digits shuffling sideways as their values change is a face whose
// figures are the same width by construction.
export const FONT_FAMILY = "Roboto Mono";

const handle = delayRender("Loading Roboto Mono");

const { waitUntilDone } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

waitUntilDone()
  .then(() => continueRender(handle))
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load Roboto Mono", err);
    continueRender(handle);
  });

export const font = (size: number, weight: 400 | 500 | 700 = 400) =>
  `${weight} ${size}px "${FONT_FAMILY}", monospace`;
