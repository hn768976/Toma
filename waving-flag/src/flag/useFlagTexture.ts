import {useEffect, useState} from 'react';
import {LinearMipmapLinearFilter, SRGBColorSpace, Texture, TextureLoader} from 'three';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

/**
 * Loads a flag texture that was rasterised from SVG once at build time
 * (see scripts/build-textures.mjs) — never per frame.
 */
export const useFlagTexture = (relativePath: string): Texture | null => {
  const [texture, setTexture] = useState<Texture | null>(null);
  const [handle] = useState(() => delayRender(`Loading flag texture ${relativePath}`));

  useEffect(() => {
    let disposed = false;
    new TextureLoader().load(
      staticFile(relativePath),
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 16;
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.needsUpdate = true;
        setTexture(tex);
      },
      undefined,
      (err) => cancelRender(err as Error),
    );
    return () => {
      disposed = true;
    };
  }, [relativePath]);

  // Released only after the texture has been committed, so <ThreeCanvas/> has
  // mounted and registered its own delay before Remotion takes the frame.
  useEffect(() => {
    if (texture) continueRender(handle);
  }, [texture, handle]);

  return texture;
};
