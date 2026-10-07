import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import type * as THREE from "three";
import { useFontsReady } from "../lib/fonts";
import { Stage } from "../lib/Stage";
import { TERMINAL_VERSIONS } from "../versions";
import { TerminalRenderer } from "./TerminalRenderer";

export const CensoredTerminal: React.FC<{ versionId: string }> = ({ versionId }) => {
  const version = TERMINAL_VERSIONS.find((v) => v.id === versionId)!;
  // The canvas text must never draw in a fallback font: hold the render until fonts are ready.
  const fontsReady = useFontsReady();
  const create = useCallback((gl: THREE.WebGLRenderer) => new TerminalRenderer(gl, version), [version]);
  if (!fontsReady) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  return <Stage create={create} />;
};
