import { loadFont as loadSans } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";

/**
 * A condensed technical sans for labels and readouts, a monospace for the
 * dense instrument text. Both are gated with delayRender()/continueRender()
 * by the root component so no frame is ever captured with a fallback face.
 */
const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const SANS = sans.fontFamily;
export const MONO = mono.fontFamily;

export const fontsReady: Promise<void> = Promise.all([
  sans.waitUntilDone(),
  mono.waitUntilDone(),
]).then(() => undefined);
