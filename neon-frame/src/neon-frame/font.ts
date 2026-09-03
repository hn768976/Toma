/**
 * Monospace font loading, gated with delayRender()/continueRender() so no
 * frame is ever captured against a fallback face.
 *
 * The face is Roboto Mono, identified through @remotion/google-fonts. The
 * woff2 for the latin subset is vendored into public/fonts/ and loaded from
 * there first: a render should not depend on reaching a CDN, and self-hosting
 * keeps every frame reproducible offline and inside a CI sandbox. If the
 * vendored file is missing the loader falls back to @remotion/google-fonts'
 * network path, and if that fails too it continues on the system monospace
 * rather than hanging the render.
 */
import { useSyncExternalStore } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { getInfo } from "@remotion/google-fonts/RobotoMono";

export const MONO_FONT_FAMILY = getInfo().fontFamily;
export const MONO_FONT_STACK = `"${MONO_FONT_FAMILY}", "DejaVu Sans Mono", ui-monospace, monospace`;

const LOCAL_FONT = "fonts/RobotoMono-latin.woff2";
const WEIGHTS = ["400", "700"] as const;

let ready = false;
const listeners = new Set<() => void>();

const markReady = () => {
  if (ready) {
    return;
  }
  ready = true;
  listeners.forEach((listener) => listener());
};

const loadLocal = async () => {
  const source = `url(${staticFile(LOCAL_FONT)}) format("woff2")`;
  await Promise.all(
    WEIGHTS.map(async (weight) => {
      const face = new FontFace(MONO_FONT_FAMILY, source, {
        weight,
        style: "normal",
      });
      document.fonts.add(await face.load());
    }),
  );
};

const loadFromGoogle = async () => {
  const { loadFont } = await import("@remotion/google-fonts/RobotoMono");
  await loadFont("normal", {
    weights: [...WEIGHTS],
    subsets: ["latin"],
  }).waitUntilDone();
};

if (typeof document !== "undefined") {
  const handle = delayRender(`Loading ${MONO_FONT_FAMILY}`);
  loadLocal()
    .catch(() => loadFromGoogle())
    .catch((error) => {
      // Never let a font hang or fail a render — fall through to the system
      // monospace, which the atlases are already built against.
      console.warn(`Could not load ${MONO_FONT_FAMILY}:`, error);
    })
    .then(() => {
      // Flip the flag before releasing the render so the glyph atlases are
      // rebuilt against the real face in the same commit.
      markReady();
      continueRender(handle);
    });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => ready;

/** True once the monospace face is usable (or loading has been given up on). */
export const useMonoFontReady = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
