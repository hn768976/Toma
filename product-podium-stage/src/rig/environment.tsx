/**
 * Environment map handling.
 *
 * The HDRI is loaded outside the WebGL canvas and handed in as a prop, gated
 * on delayRender, so Remotion never captures a frame before the reflections
 * exist. Loading it through a suspending loader inside the canvas would let
 * blank or unlit frames slip into the render.
 *
 * The map itself is a smooth analytic gradient (scripts/make-hdri.mjs). It has
 * to be: it shows up in look 3's polished floor and in every plinth bevel, so
 * a captured studio with a recognisable window or softbox in it would be both
 * visibly wrong and a licensing question.
 */

import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { useThree } from "@react-three/fiber";
import { cancelRender, continueRender, delayRender } from "remotion";

/** Loads the .hdr, blocking Remotion's capture until it is decoded. */
export const useHdrTexture = (url: string): THREE.DataTexture | null => {
  const [texture, setTexture] = useState<THREE.DataTexture | null>(null);
  const [handle] = useState(() => delayRender(`Loading HDRI: ${url}`));

  useEffect(() => {
    let disposed = false;
    const loader = new RGBELoader();
    loader.load(
      url,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.mapping = THREE.EquirectangularReflectionMapping;
        setTexture(loaded);
        continueRender(handle);
      },
      undefined,
      (error) => cancelRender(new Error(`Failed to load HDRI ${url}: ${String(error)}`)),
    );
    return () => {
      disposed = true;
    };
  }, [url, handle]);

  return texture;
};

/**
 * Installs the map as the scene's IBL. Pre-filtered with PMREMGenerator so
 * rough materials get the correct blurred mip chain rather than a mirror.
 * Never set as `scene.background` - each look paints its own backdrop.
 */
export const EnvironmentMap: React.FC<{
  texture: THREE.DataTexture;
  intensity: number;
}> = ({ texture, intensity }) => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(texture);
    pmrem.dispose();
    return target.texture;
  }, [gl, texture]);

  useEffect(() => {
    scene.environment = envMap;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
    };
  }, [scene, envMap, intensity]);

  useEffect(() => () => envMap.dispose(), [envMap]);

  return null;
};
