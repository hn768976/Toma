/**
 * Environment map handling.
 *
 * The HDRI is loaded outside the WebGL canvas and handed in as a prop, gated
 * on delayRender, so Remotion never captures a frame before the reflections
 * exist.
 *
 * The gate is held open until the map is actually *installed on the scene*,
 * not merely decoded - and that distinction is the whole point of the shape
 * of this file. Releasing it when the file finishes loading is not enough:
 * scene.environment is assigned from an effect, and if that effect is a
 * passive one it runs after Remotion has already captured the first frame.
 * The result is a render whose first frame has no image-based lighting and
 * whose remaining 299 do, which is both a visible jump at the loop point and
 * - far worse - means `npx remotion still` and the studio, which only ever
 * render frame 0, show a completely different lighting setup from the one
 * the clip actually uses. Every look in this project was originally tuned
 * against that wrong image.
 *
 * So: the loader does not release the gate. EnvironmentMap installs the map
 * in a layout effect and releases it there, once the scene really is lit.
 *
 * The map itself is a smooth analytic gradient (scripts/make-hdri.mjs). It
 * has to be: it shows up in look 3's polished floor and in every plinth
 * bevel, so a captured studio with a recognisable window or softbox in it
 * would be both visibly wrong and a licensing question.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { useThree } from "@react-three/fiber";
import { cancelRender, continueRender, delayRender } from "remotion";

export interface HdrHandle {
  texture: THREE.DataTexture | null;
  /** Released by EnvironmentMap once the map is on the scene. */
  renderHandle: number;
}

/** Loads the .hdr. Deliberately does NOT release the delayRender handle. */
export const useHdrTexture = (url: string): HdrHandle => {
  const [texture, setTexture] = useState<THREE.DataTexture | null>(null);
  const [renderHandle] = useState(() => delayRender(`Loading HDRI: ${url}`));

  useEffect(() => {
    let disposed = false;
    new RGBELoader().load(
      url,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.mapping = THREE.EquirectangularReflectionMapping;
        setTexture(loaded);
      },
      undefined,
      (error) => cancelRender(new Error(`Failed to load HDRI ${url}: ${String(error)}`)),
    );
    return () => {
      disposed = true;
    };
  }, [url]);

  return { texture, renderHandle };
};

/**
 * Installs the map as the scene's IBL. Pre-filtered with PMREMGenerator so
 * rough materials get the correct blurred mip chain rather than a mirror.
 * Never set as scene.background - each look paints its own backdrop.
 */
export const EnvironmentMap: React.FC<{
  texture: THREE.DataTexture;
  intensity: number;
  renderHandle: number;
}> = ({ texture, intensity, renderHandle }) => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const released = useRef(false);

  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(texture);
    pmrem.dispose();
    return target.texture;
  }, [gl, texture]);

  // Layout effect, not a passive one: this must be on the scene before the
  // frame is painted, and the gate below must not open until it is.
  React.useLayoutEffect(() => {
    scene.environment = envMap;
    scene.environmentIntensity = intensity;
    if (!released.current) {
      released.current = true;
      continueRender(renderHandle);
    }
    return () => {
      scene.environment = null;
    };
  }, [scene, envMap, intensity, renderHandle]);

  useEffect(() => () => envMap.dispose(), [envMap]);

  return null;
};
