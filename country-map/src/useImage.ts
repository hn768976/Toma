import {useEffect, useState} from 'react';
import {delayRender, continueRender} from 'remotion';

// SVG <image> is outside Remotion's <Img> render-blocking, so hold the frame
// until the relief plate has actually decoded. Without this the first frames of
// a render can go out with no terrain on them.
export const useImageReady = (src: string) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = delayRender(`loading relief plate ${src}`);
    let open = true;
    const done = () => {
      if (!open) return;
      open = false;
      continueRender(handle);
    };

    const img = new Image();
    img.onload = () => {
      setReady(true);
      done();
    };
    img.onerror = done;
    img.src = src;
    return done;
  }, [src]);

  return ready;
};
