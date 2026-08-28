import { useSyncExternalStore } from "react";
import { continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/IBMPlexMono";

/**
 * A mono-spaced grotesque: every digit occupies the same advance, which is
 * what keeps the readout columns in register. Rendering is gated on
 * delayRender() so no frame is captured before the face is available.
 */
const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const READOUT_FONT = fontFamily;

const handle = delayRender("Loading the readout font");

let ready = false;
const listeners = new Set<() => void>();

waitUntilDone()
  .then(() => {
    ready = true;
    listeners.forEach((listener) => listener());
    continueRender(handle);
  })
  .catch((error) => {
    console.error("Readout font failed to load", error);
    ready = true;
    listeners.forEach((listener) => listener());
    continueRender(handle);
  });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Canvas text does not reflow when a font arrives late, so the draw pass
 * subscribes to the load and repaints once the face is in.
 */
export const useFontReady = () =>
  useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
