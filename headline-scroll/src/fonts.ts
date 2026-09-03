/**
 * A serif, a heavy sans and a UI sans, loaded through @remotion/google-fonts
 * and gated with delayRender()/continueRender() so no frame is ever captured
 * against a fallback face — the card layouts are measured from these metrics.
 */
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadHeavySans } from "@remotion/google-fonts/Archivo";
import { loadFont as loadUiSans } from "@remotion/google-fonts/Inter";

const serif = loadSerif("normal", { weights: ["600", "700"], subsets: ["latin"] });
const heavySans = loadHeavySans("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
const uiSans = loadUiSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const SERIF = `"${serif.fontFamily}", Georgia, serif`;
export const SANS = `"${heavySans.fontFamily}", Helvetica, sans-serif`;
export const UI = `"${uiSans.fontFamily}", Helvetica, sans-serif`;

export const fontsReady: Promise<unknown> = Promise.all([
  serif.waitUntilDone(),
  heavySans.waitUntilDone(),
  uiSans.waitUntilDone(),
]);

/** Builds a CSS font shorthand. */
export const font = (weight: number, size: number, family: string): string =>
  `${weight} ${size}px ${family}`;
