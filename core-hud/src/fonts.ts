import { loadFont } from "@remotion/fonts";
import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * A monospace and a condensed sans, served from public/fonts so the project
 * renders with no network access. Roboto Mono is monospaced, which gives every
 * numeric readout tabular figures — without them the percentage jitters as its
 * digits change.
 */
export const MONO = "Roboto Mono";
export const CONDENSED = "Barlow Semi Condensed";

const FACES = [
  {
    family: MONO,
    file: "fonts/RobotoMono-Variable-latin.woff2",
    weight: "400 700",
  },
  {
    family: CONDENSED,
    file: "fonts/BarlowSemiCondensed-Regular-latin.woff2",
    weight: "400",
  },
  {
    family: CONDENSED,
    file: "fonts/BarlowSemiCondensed-Medium-latin.woff2",
    weight: "500",
  },
] as const;

let pending: Promise<void> | null = null;

const loadHudFonts = () => {
  if (!pending) {
    pending = Promise.all(
      FACES.map((face) =>
        loadFont({
          family: face.family,
          url: staticFile(face.file),
          weight: face.weight,
          format: "woff2",
        }),
      ),
    ).then(() => undefined);
  }
  return pending;
};

export const monoFont = (size: number, weight: 400 | 500 = 400) =>
  `${weight} ${size}px "${MONO}", monospace`;

export const condensedFont = (size: number, weight: 400 | 500 = 400) =>
  `${weight} ${size}px "${CONDENSED}", sans-serif`;

/**
 * Canvas cannot measure or draw a webfont that has not finished loading, so the
 * render is held until both faces are in `document.fonts` and nothing is drawn
 * before then.
 */
export const useHudFonts = () => {
  const [handle] = useState(() => delayRender("loading HUD fonts"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadHudFonts()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) {
      continueRender(handle);
    }
  }, [ready, handle]);

  return ready;
};
