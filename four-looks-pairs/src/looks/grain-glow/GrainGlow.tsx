import React, { useMemo } from "react";
import * as THREE from "three";
import { FullscreenQuad, rawPass } from "../../lib/gl/post";
import { GLStage, useFrameRender } from "../../lib/gl/GLStage";
import { loopPhase, mod } from "../../lib/loop";
import { hexToRgb } from "../../lib/math";
import { GRAIN_GLOW_FRAG } from "./shader";
import type { GrainGlowVersion } from "./versions";

export const GRAIN_GLOW_LOOP = 600;

const Renderer: React.FC<{ version: GrainGlowVersion }> = ({ version }) => {
  const { quad, material } = useMemo(() => {
    const m = rawPass(GRAIN_GLOW_FRAG, {
      uRes: { value: new THREE.Vector2() },
      uPhase: { value: 0 },
      uGrainFrame: { value: 0 },
      uRampColor: { value: version.ramp.map((s) => new THREE.Vector3(...hexToRgb(s.color))) },
      uRampAt: { value: version.ramp.map((s) => s.at) },
    });
    return { quad: new FullscreenQuad(), material: m };
  }, [version]);

  useFrameRender((frame, gl) => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    material.uniforms.uRes.value.copy(size);
    material.uniforms.uPhase.value = loopPhase(frame, 1, GRAIN_GLOW_LOOP);
    material.uniforms.uGrainFrame.value = mod(frame, GRAIN_GLOW_LOOP);
    quad.draw(gl, material, null);
  });
  return null;
};

export const GrainGlow: React.FC<{ version: GrainGlowVersion }> = ({ version }) => (
  <GLStage>
    <Renderer version={version} />
  </GLStage>
);
