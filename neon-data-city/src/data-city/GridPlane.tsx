import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { CELL } from "./constants";
import { GRID_FRAG, GRID_VERT } from "./shaders";
import type { VariantConfig, Band } from "./variants";

/**
 * The ground plane — a single quad with a procedural lattice in the fragment
 * shader rather than thousands of line segments.
 *
 * Screen-space derivatives give the lines a constant, properly anti-aliased
 * width at any distance and any output resolution, which is the only way the
 * far field stays clean instead of dissolving into moire. It also means the
 * grid can cross-fade smoothly between depth bands, since the band window is
 * evaluated per fragment rather than per object.
 */
export const GridPlane: React.FC<{
  cfg: VariantConfig;
  band: Band;
  pxPerCompPx: number;
}> = ({ cfg, band, pxPerCompPx }) => {
  const { plane, palette } = cfg;

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      plane.maxX - plane.minX,
      plane.maxZ - plane.minZ,
      24,
      24,
    );
    // Authored in XY, rotated onto XZ by the mesh below: local (x, y) becomes
    // world (x, -z). Bake the offset into the geometry so local coordinates
    // stay aligned with the bar lattice.
    g.translate(
      (plane.minX + plane.maxX) / 2,
      -(plane.minZ + plane.maxZ) / 2,
      0,
    );
    return g;
  }, [plane]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GRID_VERT,
        fragmentShader: GRID_FRAG,
        uniforms: {
          uBandNear: { value: band.near },
          uBandFar: { value: band.far },
          uBandFade: { value: band.fade },
          uFine: { value: new THREE.Color(palette.gridFine) },
          uBold: { value: new THREE.Color(palette.gridBold) },
          uBed: { value: new THREE.Color(palette.bed) },
          uCell: { value: CELL },
          uBoldEvery: { value: plane.boldEvery },
          uFineOpacity: { value: plane.fineOpacity },
          uBoldOpacity: { value: plane.boldOpacity },
          uBedOpacity: { value: plane.bedOpacity },
          uFineWidthPx: { value: plane.fineWidthPx },
          uBoldWidthPx: { value: plane.boldWidthPx },
          uPxPerCompPx: { value: pxPerCompPx },
          uFadeStart: { value: plane.fadeStart },
          uFadeEnd: { value: plane.fadeEnd },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        premultipliedAlpha: true,
        toneMapped: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
      }),
    [band, palette, plane, pxPerCompPx],
  );

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      renderOrder={-1}
    />
  );
};
