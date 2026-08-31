import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { fontFamily as monoFamily } from "@remotion/google-fonts/JetBrainsMono";
import { fontFamily as sansFamily } from "@remotion/google-fonts/Inter";
import type { FontRole } from "./variants";

/**
 * A clean UI sans for the chrome and the typed term, plus a mono for the
 * terminal version and the result count.
 *
 * The two families are @remotion/google-fonts' Inter and JetBrains Mono, but
 * the woff2 files themselves are served out of public/ rather than fetched
 * from Google at render time: `npx remotion render` must be reproducible, and
 * a render that depends on a network round trip in every worker is neither
 * reproducible nor fast. (It also fails outright behind a TLS-terminating
 * proxy, which is how this was found.) Both are the variable latin subsets, so
 * one file per family covers every weight used here.
 *
 * Canvas text has no fallback story — `fillText` silently draws in the default
 * font if the face has not arrived yet — so nothing is drawn at all until both
 * families are ready, and the frame is held with delayRender() until then.
 */
const FACES: { family: string; file: string }[] = [
  { family: sansFamily, file: "fonts/Inter-latin-variable.woff2" },
  { family: monoFamily, file: "fonts/JetBrainsMono-latin-variable.woff2" },
];

const ready = Promise.all(
  FACES.map(({ family, file }) => {
    const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
      weight: "100 900",
      style: "normal",
    });
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  }),
);

export const SANS = sansFamily;
export const MONO = monoFamily;

export const fontFamilyFor = (role: FontRole): string => (role === "mono" ? MONO : SANS);

/**
 * Returns false until both families are usable. The render is blocked for as
 * long as it returns false, so no frame is ever captured in a fallback face.
 */
export const useFontsReady = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("Loading search bar fonts"));

  useEffect(() => {
    let live = true;
    ready
      .then(() => document.fonts.ready)
      .then(() => {
        if (live) {
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) {
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  // Released only after the commit that mounted the layers, so their draw
  // effects have already run against the real fonts.
  useEffect(() => {
    if (loaded) {
      continueRender(handle);
    }
  }, [loaded, handle]);

  return loaded;
};

/** Shared 1x1 context used purely for text metrics. */
let measureCtx: CanvasRenderingContext2D | null = null;
export const measureText = (text: string, font: string, tracking = 0): number => {
  if (measureCtx === null) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    measureCtx = canvas.getContext("2d");
  }
  if (measureCtx === null) {
    return 0;
  }
  measureCtx.font = font;
  return measureCtx.measureText(text).width + tracking * text.length;
};

/** Canvas shorthand: `600 48px "Inter"`. */
export const fontString = (weight: number, size: number, family: string): string =>
  `${weight} ${size}px "${family}", sans-serif`;

/** Draws text with manual letterspacing, since canvas has no tracking. */
export const fillTracked = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): number => {
  let cursor = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  return cursor - x;
};
