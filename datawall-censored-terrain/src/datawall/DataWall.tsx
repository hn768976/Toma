import React, { useCallback } from "react";
import type * as THREE from "three";
import { Stage } from "../lib/Stage";
import { DATAWALL_VERSIONS } from "../versions";
import { DataWallRenderer } from "./DataWallRenderer";

export const DataWall: React.FC<{ versionId: string; loopCheck: boolean }> = ({ versionId }) => {
  const version = DATAWALL_VERSIONS.find((v) => v.id === versionId)!;
  const create = useCallback((gl: THREE.WebGLRenderer) => new DataWallRenderer(gl, version), [version]);
  return <Stage create={create} />;
};
