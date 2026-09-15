import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import type * as THREE from "three";
import { loadGeometry, type ModelName } from "./model";

export type Geometries = Record<ModelName, THREE.BufferGeometry>;

/**
 * Loads the GLB geometries and holds Remotion's frame capture open until they
 * are in memory, so no frame can ever be rendered against a half-loaded model.
 */
export const useModels = (names: ModelName[]): Geometries | null => {
  const [geometries, setGeometries] = useState<Geometries | null>(null);
  const key = names.join(",");

  useEffect(() => {
    const handle = delayRender(`Loading models: ${key}`);
    let cancelled = false;

    Promise.all(names.map((n) => loadGeometry(n)))
      .then((loaded) => {
        if (cancelled) return;
        const map = {} as Geometries;
        names.forEach((n, i) => {
          map[n] = loaded[i];
        });
        setGeometries(map);
        continueRender(handle);
      })
      .catch((err) => {
        // Surface the real reason in the render log rather than timing out.
        throw err;
      });

    return () => {
      cancelled = true;
      continueRender(handle);
    };
    // `key` is the stable identity of `names`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return geometries;
};
