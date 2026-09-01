/**
 * A clean sans (Inter), gated with delayRender()/continueRender() so no frame is
 * ever captured against the fallback face.
 *
 * The font metadata — family name, version, the exact latin subset file — comes
 * from @remotion/google-fonts, but the woff2 itself is vendored into
 * `public/fonts` and served with `staticFile()` rather than fetched from
 * fonts.gstatic.com at render time. Two reasons: the render then has no network
 * dependency at all (it works offline and in CI), and a TLS-terminating egress
 * proxy — which this project was built behind — makes the headless browser
 * reject the gstatic certificate and fail the render outright.
 *
 * To fetch from Google instead, swap the FontFace block below for:
 *
 *   import { loadFont } from "@remotion/google-fonts/Inter";
 *   const { fontFamily, waitUntilDone } = loadFont("normal", {
 *     weights: ["400", "500", "600", "700"], subsets: ["latin"],
 *   });
 *
 * and await `waitUntilDone()` where `face.load()` is awaited here. Everything
 * downstream — the family name, the cache invalidation, the delayRender gate —
 * is unchanged.
 *
 * Tabular figures are produced by `drawTabular` in paint/utils.ts rather than by
 * a font feature: Canvas 2D exposes no way to switch on `tnum`, so the digits
 * are laid out on a fixed pitch by hand. That is stricter than the font feature
 * would be — the counters cannot jitter whichever face resolves.
 */

import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { getInfo } from "@remotion/google-fonts/Inter";
import { clearChromeCache } from "./paint/ScreenChrome";
import { clearTickerLayoutCache } from "./paint/TickerStrip";
import { clearCounterSizeCache } from "./paint/CounterBlock";

const info = getInfo();

export const FONT_FAMILY = info.fontFamily;

let ready = false;
const listeners = new Set<() => void>();

const handle = delayRender("Loading the dashboard typeface");

// Inter ships as one variable file covering the whole weight axis, so a single
// FontFace serves every weight the dashboard asks for.
const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Inter-latin.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal", display: "block" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    return document.fonts.ready;
  })
  .then(() => {
    ready = true;
    // Anything measured or rasterised against the fallback face is now stale.
    clearChromeCache();
    clearTickerLayoutCache();
    clearCounterSizeCache();
    listeners.forEach((listener) => listener());
    continueRender(handle);
  })
  .catch((error) => {
    cancelRender(error);
  });

/**
 * True once the face is installed. The dashboard repaints when this flips, so
 * the cached static chrome is rebuilt with the real metrics.
 */
export const useFontsReady = (): boolean => {
  const [isReady, setIsReady] = useState(ready);
  useEffect(() => {
    if (isReady) return;
    const listener = () => setIsReady(true);
    listeners.add(listener);
    if (ready) listener();
    return () => {
      listeners.delete(listener);
    };
  }, [isReady]);
  return isReady;
};
