import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/RobotoMono";

const FAMILY = "Roboto Mono";
const STACK = `"${FAMILY}", monospace`;
const PROBE = "https://fonts.googleapis.com/css2?family=Roboto+Mono";

/** Is the font CDN actually reachable from this browser? */
const cdnReachable = async (): Promise<boolean> => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    await fetch(PROBE, { mode: "no-cors", signal: abort.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** The same face, vendored under public/, for hosts with no CDN access. */
const loadVendoredFace = async (): Promise<void> => {
  const face = new FontFace(
    FAMILY,
    `url(${staticFile("fonts/RobotoMono-latin.woff2")}) format("woff2")`,
  );
  await face.load();
  document.fonts.add(face);
};

/**
 * Loads the monospace face and holds the render until the browser reports it
 * ready, so canvas text never measures against a fallback.
 *
 * The Google Fonts face is used whenever the CDN can be reached. It is probed
 * first because @remotion/google-fonts fails its own delayRender handle if the
 * fetch is refused — on a sandboxed or offline render host that aborts the
 * whole render, so there we load a vendored copy of the same face instead.
 * Either way the family name, and therefore every text metric, is identical.
 */
export const useMonoFont = (): string => {
  const [handle] = useState(() => delayRender("loading monospace face"));
  const [family, setFamily] = useState("monospace");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let settled = false;
    const settle = (name: string) => {
      if (settled) return;
      settled = true;
      setFamily(name);
      setReady(true);
    };
    const timeout = setTimeout(() => settle("monospace"), 20000);

    (async () => {
      if (await cdnReachable()) {
        await loadFont("normal", {
          weights: ["400", "700"],
          subsets: ["latin"],
        }).waitUntilDone();
      } else {
        await loadVendoredFace();
      }
      await document.fonts.load(`400 24px ${STACK}`);
      await document.fonts.ready;
      settle(STACK);
    })()
      .catch(() => settle("monospace"))
      .finally(() => clearTimeout(timeout));

    return () => {
      settled = true;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);

  return family;
};
