import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Field } from "./field";
import type { Band } from "./variants";
import { BAR_FRAG, BAR_VERT } from "./shaders";

/**
 * The city itself: one InstancedMesh per depth band.
 *
 * Individually meshed bars would never render at 4K in reasonable time, so all
 * of a band's bars share one draw call and differ only by instance matrix and
 * two instanced attributes.
 */
export const Bars: React.FC<{
  field: Field;
  heights: Float32Array;
  indices: Uint32Array;
  band: Band;
  width: number;
  exposure: number;
  fadeStart: number;
  fadeEnd: number;
  /** Bloom pass: draw only the glowing top of each bar. */
  tipOnly?: boolean;
}> = ({
  field,
  heights,
  indices,
  band,
  width,
  exposure,
  fadeStart,
  fadeEnd,
  tipOnly = false,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    // Move the origin to the foot of the bar so scaling y grows it upward and
    // the shader can read local y as a 0..1 gradient coordinate.
    g.translate(0, 0.5, 0);

    const n = indices.length;
    const colors = new Float32Array(n * 3);
    const hot = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const i = indices[k];
      colors[k * 3] = field.color[i * 3];
      colors[k * 3 + 1] = field.color[i * 3 + 1];
      colors[k * 3 + 2] = field.color[i * 3 + 2];
      hot[k] = field.hot[i];
    }
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    g.setAttribute("aHot", new THREE.InstancedBufferAttribute(hot, 1));
    return g;
  }, [field, indices]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BAR_VERT,
        fragmentShader: BAR_FRAG,
        uniforms: {
          uBandNear: { value: band.near },
          uBandFar: { value: band.far },
          uBandFade: { value: band.fade },
          uExposure: { value: exposure },
          uFadeStart: { value: fadeStart },
          uFadeEnd: { value: fadeEnd },
          uTipOnly: { value: tipOnly ? 1 : 0 },
        },
        transparent: true,
        depthTest: true,
        depthWrite: true,
        premultipliedAlpha: true,
        toneMapped: false,
      }),
    [band, exposure, fadeStart, fadeEnd, tipOnly],
  );

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  // Instance matrices are rewritten from scratch every frame from
  // useCurrentFrame-derived heights — never accumulated — so Remotion can
  // render frames out of order across threads and still get identical output.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const arr = mesh.instanceMatrix.array as Float32Array;
    const w = width;
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const o = k * 16;
      arr.fill(0, o, o + 16);
      arr[o] = w;
      arr[o + 5] = heights[i];
      arr[o + 10] = w;
      arr[o + 12] = field.x[i];
      arr[o + 13] = 0;
      arr[o + 14] = field.z[i];
      arr[o + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (indices.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, indices.length]}
      frustumCulled={false}
    />
  );
};
