import React, { createContext, useContext } from "react";
import type * as THREE from "three";
import { MODELS } from "./config";
import {
  useBarycentricGeometry,
  useToothGeometry,
  useToothPoints,
  type PointCloud,
} from "./loaders";

export type ToothAssets = {
  /** 188k triangles - the hero mesh. */
  readonly full: THREE.BufferGeometry;
  /** 5k triangles, plus a barycentric copy for the low-poly wireframes. */
  readonly low: THREE.BufferGeometry;
  readonly lowBary: THREE.BufferGeometry;
  /** 24k pre-shuffled surface samples. */
  readonly points: PointCloud;
};

const AssetContext = createContext<ToothAssets | null>(null);

export const useToothAssets = (): ToothAssets => {
  const assets = useContext(AssetContext);
  if (!assets) {
    throw new Error("useToothAssets must be used inside <WithToothAssets>");
  }
  return assets;
};

/**
 * Loads every geometry variant and only then renders its children.
 *
 * The gate matters: <ThreeCanvas/> draws the scene once per Remotion frame, in
 * an effect keyed on the frame number. If a mesh arrived after that effect had
 * already run, the canvas would keep showing the frame it drew without it - so
 * nothing that the WebGL scene needs may load underneath the canvas.
 */
export const WithToothAssets: React.FC<{
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
}> = ({ children, fallback = null }) => {
  // MODELS.mid is deliberately not loaded: nothing currently uses it, and
  // every rendering tab would pay the fetch and the non-indexed expansion.
  const full = useToothGeometry(MODELS.full);
  const low = useToothGeometry(MODELS.low);
  const points = useToothPoints(MODELS.points);
  const lowBary = useBarycentricGeometry(low);

  if (!full || !low || !points || !lowBary) {
    return <>{fallback}</>;
  }

  return (
    <AssetContext.Provider value={{ full, low, lowBary, points }}>
      {children}
    </AssetContext.Provider>
  );
};
