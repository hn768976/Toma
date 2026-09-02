import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

/**
 * Loads an image once and holds the render open until it is ready.
 *
 * Remotion screenshots the page as soon as React settles, so an asset
 * that arrives asynchronously has to be fenced with delayRender or the
 * first frames come out empty.
 */
export const useSvgImage = (src: string): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${src}`));

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      continueRender(handle);
    };
    img.onerror = () => {
      cancelRender(new Error(`Could not load ${src}`));
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, handle]);

  return image;
};
