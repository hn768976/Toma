import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

// Poly Haven "Studio Small 03" (CC0), shipped in public/hdri.
export const HDRI_FILE = "hdri/studio_small_03_1k.hdr";

/**
 * Soft-knee highlight compression. The studio softboxes peak at ~3400
 * (mean 1.85), which blows out every glossy surface at grazing angles.
 * Compressing luminance with L' = L / (1 + L / KNEE) keeps the shape of
 * the softboxes (silver reflections, soft gradients) at a usable level.
 * Pure function of the file contents, so it is identical on every load.
 */
const KNEE = 6;
const compressHighlights = (data: Float32Array) => {
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (l <= 0) continue;
    const k = 1 / (1 + l / KNEE);
    data[i] *= k;
    data[i + 1] *= k;
    data[i + 2] *= k;
  }
};

let cached: Promise<THREE.DataTexture> | null = null;
const load = () => {
  if (!cached) {
    const loader = new HDRLoader();
    loader.setDataType(THREE.FloatType);
    cached = loader.loadAsync(staticFile(HDRI_FILE)).then((t) => {
      compressHighlights(t.image.data as unknown as Float32Array);
      t.needsUpdate = true;
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    });
  }
  return cached;
};

/**
 * Loads the HDRI behind delayRender / continueRender so no frame is
 * captured before the environment is ready.
 */
export const useHdri = () => {
  const [texture, setTexture] = useState<THREE.DataTexture | null>(null);
  const [handle] = useState(() => delayRender("Loading studio HDRI"));
  useEffect(() => {
    let alive = true;
    load()
      .then((t) => {
        if (!alive) return;
        setTexture(t);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [handle]);
  return texture;
};
