import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";

export const LABEL_FONT = "KeyLabel";

// Loads the bundled font once; resolves to true when canvas text can be drawn.
export const useLabelFont = () => {
  const [handle] = useState(() => delayRender("Loading keycap font"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const face = new FontFace(
      LABEL_FONT,
      `url(${staticFile("fonts/LiberationSans-Bold.ttf")})`,
    );
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);

  return ready;
};

export const createLabelTexture = (
  text: string,
  color: string,
  fontSize: number,
) => {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${LABEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2 + fontSize * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};
