import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Field } from "./field";
import type { Band } from "./variants";
import { DOT_FRAG, DOT_VERT } from "./shaders";

/**
 * The glowing dot that sits on top of most bars — camera-facing quads with a
 * soft radial falloff, blended additively so overlapping dots pile up into the
 * blown-out clusters the reference is full of.
 */
export const Dots: React.FC<{
  field: Field;
  heights: Float32Array;
  indices: Uint32Array;
  band: Band;
  fov: number;
  compHeight: number;
  minPx: number;
  sizeScale: number;
  exposure: number;
  fadeStart: number;
  fadeEnd: number;
}> = ({
  field,
  heights,
  indices,
  band,
  fov,
  compHeight,
  minPx,
  sizeScale,
  exposure,
  fadeStart,
  fadeEnd,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  // Only bars that were given a dot at build time take part.
  const dotIndices = useMemo(
    () => indices.filter((i) => field.dotSize[i] > 0),
    [indices, field],
  );

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const n = dotIndices.length;
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const i = dotIndices[k];
      // Tip dots read hotter than the shaft they sit on.
      colors[k * 3] = Math.min(1.6, field.color[i * 3] * 1.5 + 0.06);
      colors[k * 3 + 1] = Math.min(1.6, field.color[i * 3 + 1] * 1.5 + 0.06);
      colors[k * 3 + 2] = Math.min(1.6, field.color[i * 3 + 2] * 1.5 + 0.06);
      sizes[k] = field.dotSize[i];
    }
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1));
    return g;
  }, [field, dotIndices]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        uniforms: {
          uBandNear: { value: band.near },
          uBandFar: { value: band.far },
          uBandFade: { value: band.fade },
          uExposure: { value: exposure },
          uFadeStart: { value: fadeStart },
          uFadeEnd: { value: fadeEnd },
          uWorldPerCompPx: { value: 0 },
          uMinPx: { value: minPx * 0.5 },
          uSizeScale: { value: sizeScale },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        premultipliedAlpha: true,
        toneMapped: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
      }),
    [band, exposure, minPx, sizeScale, fadeStart, fadeEnd],
  );

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    // World units covered by one composition pixel, per unit of view depth.
    // Everything screen-relative is derived from this, which is why the render
    // looks the same at --scale=0.5 and --scale=1.
    material.uniforms.uWorldPerCompPx.value =
      (2 * Math.tan((fov * Math.PI) / 360)) / compHeight;

    const mesh = ref.current;
    if (!mesh) return;
    const arr = mesh.instanceMatrix.array as Float32Array;
    for (let k = 0; k < dotIndices.length; k++) {
      const i = dotIndices[k];
      const o = k * 16;
      arr.fill(0, o, o + 16);
      arr[o] = 1;
      arr[o + 5] = 1;
      arr[o + 10] = 1;
      arr[o + 12] = field.x[i];
      arr[o + 13] = heights[i];
      arr[o + 14] = field.z[i];
      arr[o + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (dotIndices.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, dotIndices.length]}
      frustumCulled={false}
    />
  );
};
