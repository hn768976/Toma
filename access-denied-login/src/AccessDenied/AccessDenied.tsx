import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { H4K, W4K } from "../engine/dof";
import { FPS, Variant, createAssets, renderScene } from "./scene";

export type AccessDeniedProps = {
  /** "v1" = reference camera; "v2" = alternative low-angle arcing camera with rack focus */
  variant: Variant;
  /** Internal canvas resolution relative to the 4K composition (1 = native 3840x2160). */
  renderScale: number;
};

// Fonts are bundled locally in public/fonts (SIL OFL) so renders never depend on the network.
let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    const faces = [
      new FontFace("Share Tech Mono", `url(${staticFile("fonts/share-tech-mono-latin-400-normal.woff2")})`, { weight: "400" }),
      new FontFace("Rajdhani", `url(${staticFile("fonts/rajdhani-latin-500-normal.woff2")})`, { weight: "500" }),
      new FontFace("Rajdhani", `url(${staticFile("fonts/rajdhani-latin-600-normal.woff2")})`, { weight: "600" }),
    ];
    fontsPromise = Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
    });
  }
  return fontsPromise;
};

export const AccessDenied: React.FC<AccessDeniedProps> = ({ variant, renderScale }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const q = renderScale;
  const assets = useMemo(() => createAssets(q), [q]);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts + first draw"));

  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    const canvas = ref.current;
    if (!canvas) return;
    renderScene(canvas.getContext("2d")!, assets, frame / FPS, frame, variant);
    continueRender(handle);
  }, [frame, assets, ready, variant, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={ref}
        width={Math.round(W4K * q)}
        height={Math.round(H4K * q)}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
