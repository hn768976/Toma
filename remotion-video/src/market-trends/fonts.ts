import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Inter (variable weight, latin subset), self-hosted so a render never
// depends on a network fetch. Loaded once per page; the hook reports
// readiness so canvas text is only drawn once the face is available.
const FONT_NAME = "Inter";

type Status = "idle" | "loading" | "ready";
let status: Status = "idle";
const listeners = new Set<() => void>();

const finish = () => {
  status = "ready";
  for (const l of listeners) l();
  listeners.clear();
};

const startLoading = () => {
  if (status !== "idle") return;
  status = "loading";
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    finish();
    return;
  }
  const face = new FontFace(
    FONT_NAME,
    `url(${staticFile("fonts/Inter-latin.woff2")}) format("woff2")`,
    { weight: "100 900", style: "normal" },
  );
  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
    })
    .catch((err) => {
      console.error("Failed to load Inter font", err);
    })
    .finally(finish);
};

export const useInterFont = (): boolean => {
  const [ready, setReady] = useState(status === "ready");

  useEffect(() => {
    if (status === "ready") {
      setReady(true);
      return;
    }
    const handle = delayRender("Loading Inter font");
    const onReady = () => {
      setReady(true);
      continueRender(handle);
    };
    listeners.add(onReady);
    startLoading();
    return () => {
      listeners.delete(onReady);
    };
  }, []);

  return ready;
};
