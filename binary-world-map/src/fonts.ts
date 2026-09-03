import {useEffect, useState} from "react";
import {getInfo} from "@remotion/google-fonts/ShareTechMono";
import {continueRender, delayRender, staticFile} from "remotion";

/**
 * The monospace used for the digit field and the callout type.
 *
 * The family name and the CDN URL both come from `@remotion/google-fonts`, so
 * there is one source of truth for which face this is. The face is then
 * registered by hand rather than through that package's `loadFont()` for one
 * reason: a byte-identical copy of the same woff2 is shipped in
 * `public/fonts/`, and we want the local copy used automatically whenever the
 * CDN is unreachable — an offline machine, a locked-down CI runner, a sandbox
 * whose proxy certificate the render browser does not trust. `loadFont()`
 * would surface that as a failed render instead.
 *
 * Loading is gated with an explicit `delayRender()` / `continueRender()` pair
 * so no frame is captured against a substituted system monospace, and a
 * timeout releases the render rather than hanging if neither source resolves.
 */
const INFO = getInfo();
const REMOTE_URL = INFO.fonts.normal["400"].latin;
const LOCAL_URL = staticFile("fonts/ShareTechMono-Regular.woff2");

export const MONO_FONT_FAMILY = `"${INFO.fontFamily}", "DejaVu Sans Mono", "Liberation Mono", monospace`;

const FONT_TIMEOUT_MS = 12000;

const register = (url: string): Promise<void> => {
  if (typeof FontFace === "undefined") return Promise.reject(new Error("No FontFace"));
  const face = new FontFace(INFO.fontFamily, `url(${url}) format("woff2")`, {
    weight: "400",
    style: "normal",
  });
  return face.load().then((loaded) => {
    document.fonts.add(loaded);
  });
};

let ready = false;
const settled: Promise<void> = Promise.race([
  register(REMOTE_URL).catch(() => register(LOCAL_URL)),
  new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
])
  .catch((err) => {
    console.warn("Monospace font unavailable, falling back to the system face", err);
  })
  .then(() => {
    ready = true;
  });

/**
 * True once the face is available. The glyph atlas keys its `useMemo` on this
 * so it is rasterised with the intended font rather than a substitute.
 */
export const useMonoFontReady = (): boolean => {
  const [isReady, setIsReady] = useState(ready);
  const [handle] = useState(() => (ready ? null : delayRender("Loading monospace font")));

  useEffect(() => {
    let live = true;
    settled.then(() => {
      if (live) setIsReady(true);
      if (handle !== null) continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [handle]);

  return isReady;
};
