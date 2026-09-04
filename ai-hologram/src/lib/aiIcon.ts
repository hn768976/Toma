import { useEffect, useState } from "react";
import * as THREE from "three";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * Rasterises public/ai-chip.svg once and keys the black artwork to alpha
 * against its white ground.
 *
 * 2048² is comfortably more than the card ever occupies on screen, even at 4K,
 * and keeps the one-off keying pass (a full read/write of the pixel buffer)
 * under a tenth of a second. The result is cached at module scope — the SVG is
 * never rasterised per frame.
 *
 * The keyed texture is pure white with a soft alpha ramp, so the card material
 * can tint it to the version's accent rather than inheriting the source black.
 */
export const AI_ICON_TEXTURE_SIZE = 2048;

let cached: THREE.Texture | null = null;
let pending: Promise<THREE.Texture> | null = null;

const rasterise = (): Promise<THREE.Texture> => {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  pending = new Promise<THREE.Texture>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = AI_ICON_TEXTURE_SIZE;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size);
        const px = data.data;
        // Soft luminance ramp: white ground -> 0, black ink -> 1, with the
        // antialiased edge pixels landing in between so the glyph keeps its
        // shape instead of going crunchy.
        const lo = 0.3;
        const hi = 0.82;
        for (let i = 0; i < px.length; i += 4) {
          const lum = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
          let a = (hi - lum) / (hi - lo);
          a = a < 0 ? 0 : a > 1 ? 1 : a;
          a = a * a * (3 - 2 * a); // smoothstep
          px[i] = 255;
          px[i + 1] = 255;
          px[i + 2] = 255;
          px[i + 3] = Math.round(a * 255);
        }
        ctx.putImageData(data, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 8;
        tex.premultiplyAlpha = false;
        tex.needsUpdate = true;
        cached = tex;
        resolve(tex);
      } catch (err) {
        reject(err as Error);
      }
    };
    img.onerror = () => reject(new Error("Could not load ai-chip.svg"));
    img.src = staticFile("ai-chip.svg");
  });

  return pending;
};

/** Suspends the frame (via delayRender) until the keyed icon is ready. */
export const useAiIconTexture = (): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(cached);

  useEffect(() => {
    if (cached) {
      setTex(cached);
      return;
    }
    const handle = delayRender("Rasterising the Ai chip icon");
    let live = true;
    rasterise()
      .then((t) => {
        if (live) setTex(t);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      live = false;
    };
  }, []);

  return tex;
};
