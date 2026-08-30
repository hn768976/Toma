import { loadFont as loadSans } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import type { Fonts } from "./paint";

/**
 * A condensed technical sans for labels and a monospace for every numeric
 * readout. The numbers must be monospaced: proportional digits make the
 * readouts jitter as values reroll.
 *
 * Loading is gated with delayRender()/continueRender(), and the faces are
 * explicitly pushed through document.fonts.load() - a face that is merely
 * declared is not necessarily available to canvas fillText().
 */

const sansHandle = loadSans("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const monoHandle = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const HUD_FONTS: Fonts = {
  sans: sansHandle.fontFamily,
  mono: monoHandle.fontFamily,
};

const PROBES = [
  `600 40px "${HUD_FONTS.sans}"`,
  `500 40px "${HUD_FONTS.sans}"`,
  `400 40px "${HUD_FONTS.sans}"`,
  `500 40px "${HUD_FONTS.mono}"`,
  `400 40px "${HUD_FONTS.mono}"`,
];

let fontsReady: Promise<void> | null = null;

export const loadHudFonts = (): Promise<void> => {
  if (fontsReady) return fontsReady;
  fontsReady = Promise.all([
    sansHandle.waitUntilDone(),
    monoHandle.waitUntilDone(),
  ])
    .then(() => Promise.all(PROBES.map((probe) => document.fonts.load(probe))))
    .then(() => undefined);
  return fontsReady;
};

/** Returns the font families once they are actually usable by canvas. */
export const useHudFonts = (): Fonts | null => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender("Loading HUD fonts");
    let cancelled = false;
    loadHudFonts()
      .then(() => {
        if (!cancelled) setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        continueRender(handle);
        throw err;
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready ? HUD_FONTS : null;
};
