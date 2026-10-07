import React, { useCallback } from "react";
import type * as THREE from "three";
import { Stage } from "../lib/Stage";
import { TERRAIN_VERSIONS } from "../versions";
import { TerrainRenderer } from "./TerrainRenderer";

export const ParticleTerrain: React.FC<{ versionId: string; loopCheck: boolean }> = ({ versionId }) => {
  const version = TERRAIN_VERSIONS.find((v) => v.id === versionId)!;
  const create = useCallback((gl: THREE.WebGLRenderer) => new TerrainRenderer(gl, version), [version]);
  return <Stage create={create} />;
};
