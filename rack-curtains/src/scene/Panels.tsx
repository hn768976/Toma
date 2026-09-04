import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  DOF_BUCKETS,
  DOF_FOCUS,
  DOF_RANGE,
  DOT_COLS,
  DOT_ROWS,
  PANEL_COUNT,
  PANEL_HEIGHT,
  PANEL_WIDTH,
} from "../constants";
import { hexToRgb, type Palette } from "../palette";
import { buildPanels } from "./layout";
import { panelFragmentShader, panelVertexShader } from "./panelShader";

type Props = {
  palette: Palette;
  /** 0 -> 1 across the loop. */
  time: number;
  seed: number;
  gain: number;
  /** Pushes the whole set further into the blur, used for the reflection. */
  blurBias?: number;
};

export const Panels: React.FC<Props> = ({
  palette,
  time,
  seed,
  gain,
  blurBias = 0,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const panels = useMemo(() => buildPanels(seed), [seed]);

  const { panelIds, brightnesses } = useMemo(() => {
    const ids = new Float32Array(PANEL_COUNT);
    const br = new Float32Array(PANEL_COUNT);
    panels.forEach((p, i) => {
      ids[i] = p.id;
      br[i] = p.brightness;
    });
    return { panelIds: ids, brightnesses: br };
  }, [panels]);

  // The panels themselves never move, so the instance matrices are written
  // once rather than per frame.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    panels.forEach((p, i) => {
      m.makeTranslation(p.position[0], p.position[1], p.position[2]);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [panels]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCols: { value: DOT_COLS },
      uRows: { value: DOT_ROWS },
      uDim: { value: new THREE.Vector3(...hexToRgb(palette.dotDim)) },
      uBright: { value: new THREE.Vector3(...hexToRgb(palette.dotBright)) },
      uGain: { value: gain },
      uFocus: { value: DOF_FOCUS },
      uRange: { value: DOF_RANGE },
      uBuckets: { value: DOF_BUCKETS },
      uHazeStart: { value: 11.0 },
      uHazeFalloff: { value: 0.062 },
    }),
    // Colours and gain are static per composition; only uTime animates.
    [palette.dotDim, palette.dotBright, gain],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as never, undefined as never, PANEL_COUNT]}
      frustumCulled={false}
    >
      <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]}>
        <instancedBufferAttribute
          attach="attributes-aPanelId"
          args={[panelIds, 1]}
        />
        <instancedBufferAttribute
          attach="attributes-aBright"
          args={[brightnesses, 1]}
        />
      </planeGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={panelVertexShader}
        fragmentShader={panelFragmentShader}
        uniforms-uTime-value={time}
        uniforms-uRange-value={DOF_RANGE / (1 + blurBias)}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
