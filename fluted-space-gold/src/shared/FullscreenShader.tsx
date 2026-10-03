import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { FULLSCREEN_VERT } from "./glsl";

/**
 * A single full-screen triangle pair drawn with a fragment shader. Uniform
 * values are pushed in a layout effect (before Remotion's ThreeCanvas calls
 * advance() for the frame), so the picture depends only on the props.
 */
export const FullscreenShader: React.FC<{
  fragmentShader: string;
  uniforms: Record<string, unknown>;
}> = ({ fragmentShader, uniforms }) => {
  const { gl } = useThree();
  const material = useMemo(() => {
    const u: Record<string, THREE.IUniform> = {
      uRes: { value: new THREE.Vector2(1, 1) },
    };
    for (const k of Object.keys(uniforms)) u[k] = { value: uniforms[k] };
    return new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader,
      uniforms: u,
      depthTest: false,
      depthWrite: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragmentShader]);

  useLayoutEffect(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    material.uniforms.uRes.value.copy(size);
    for (const k of Object.keys(uniforms)) {
      if (!material.uniforms[k]) material.uniforms[k] = { value: uniforms[k] };
      else material.uniforms[k].value = uniforms[k];
    }
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
