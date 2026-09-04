import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { COMP_HEIGHT } from "./constants";
import type { CameraState, Field } from "./field";
import type { Band, VariantConfig } from "./variants";
import { Bars } from "./Bars";
import { Dots } from "./Dots";
import { GridPlane } from "./GridPlane";

/** Drives the shared camera. Runs on every render so it tracks the frame. */
const CameraRig: React.FC<{ cam: CameraState; fov: number }> = ({
  cam,
  fov,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.fov = fov;
    camera.near = 0.4;
    camera.far = 4000;
    camera.up.set(0, 1, 0);
    camera.position.copy(cam.position);
    camera.lookAt(cam.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  });
  return null;
};

/**
 * One slice of the scene by camera distance, rendered to its own canvas so the
 * compositor can blur it. Stacking these back-to-front is the depth-of-field.
 *
 * The canvas is larger than the frame by `overscan` on every side and the
 * camera's field of view is widened to match, so the blur has real content to
 * pull from at the edges instead of smearing into transparency.
 */
export const DepthLayer: React.FC<{
  cfg: VariantConfig;
  band: Band;
  field: Field;
  heights: Float32Array;
  cam: CameraState;
  dpr: number;
  width: number;
  height: number;
  overscan: number;
}> = ({ cfg, band, field, heights, cam, dpr, width, height, overscan }) => {
  const canvasW = width + overscan * 2;
  const canvasH = height + overscan * 2;
  const overscanFov =
    (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (canvasH / height)) *
      180) /
    Math.PI;

  const indices = field.bandLists[cfg.bands.indexOf(band)];

  return (
    <ThreeCanvas
      width={canvasW}
      height={canvasH}
      dpr={dpr}
      flat
      style={{
        position: "absolute",
        left: -overscan,
        top: -overscan,
        filter: band.blur > 0 ? `blur(${band.blur}px)` : undefined,
      }}
      gl={{
        // Only the in-focus band pays for multisampling; the rest are about to
        // be blurred anyway, and skipping it keeps 4K renders within memory.
        antialias: band.blur === 0,
        alpha: true,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ fov: overscanFov, near: 0.4, far: 4000 }}
    >
      <CameraRig cam={cam} fov={overscanFov} />
      <GridPlane cfg={cfg} band={band} pxPerCompPx={dpr} />
      <Bars
        field={field}
        heights={heights}
        indices={indices}
        band={band}
        width={cfg.bars.width}
        exposure={cfg.bars.exposure}
        fadeStart={cfg.bars.fadeStart}
        fadeEnd={cfg.bars.fadeEnd}
      />
      <Dots
        field={field}
        heights={heights}
        indices={indices}
        band={band}
        fov={cam.fov}
        compHeight={COMP_HEIGHT}
        minPx={cfg.bars.dotMinPx}
        sizeScale={1}
        exposure={cfg.bars.exposure}
        fadeStart={cfg.bars.fadeStart}
        fadeEnd={cfg.bars.fadeEnd}
      />
    </ThreeCanvas>
  );
};

/**
 * Bloom. Only the tips and caps glow, so this layer draws nothing but the dots
 * — at every depth, enlarged — and hands them to a CSS blur to be screened
 * back over the stack.
 */
export const BloomLayer: React.FC<{
  cfg: VariantConfig;
  field: Field;
  heights: Float32Array;
  cam: CameraState;
  dpr: number;
  width: number;
  height: number;
  overscan: number;
}> = ({ cfg, field, heights, cam, dpr, width, height, overscan }) => {
  const canvasW = width + overscan * 2;
  const canvasH = height + overscan * 2;
  const overscanFov =
    (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (canvasH / height)) *
      180) /
    Math.PI;

  const allBand: Band = { near: -1e6, far: 1e6, blur: 0, fade: 1 };
  const all = React.useMemo(
    () => Uint32Array.from({ length: field.count }, (_, i) => i),
    [field.count],
  );

  return (
    <ThreeCanvas
      width={canvasW}
      height={canvasH}
      dpr={dpr}
      flat
      style={{
        position: "absolute",
        left: -overscan,
        top: -overscan,
        filter: `blur(${cfg.bloom.blur}px)`,
        opacity: cfg.bloom.opacity,
        mixBlendMode: "screen",
      }}
      gl={{
        antialias: false,
        alpha: true,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ fov: overscanFov, near: 0.4, far: 4000 }}
    >
      <CameraRig cam={cam} fov={overscanFov} />
      {/* Bars are drawn first so they write depth: their tips contribute the
          glow, and a near bar correctly hides the dots behind it. */}
      <Bars
        field={field}
        heights={heights}
        indices={all}
        band={allBand}
        width={cfg.bars.width}
        exposure={cfg.bars.exposure}
        fadeStart={cfg.bars.fadeStart}
        fadeEnd={cfg.bars.fadeEnd}
        tipOnly
      />
      <Dots
        field={field}
        heights={heights}
        indices={all}
        band={allBand}
        fov={cam.fov}
        compHeight={COMP_HEIGHT}
        minPx={cfg.bars.dotMinPx * cfg.bloom.sizeScale}
        sizeScale={cfg.bloom.sizeScale}
        exposure={cfg.bars.exposure}
        fadeStart={cfg.bars.fadeStart}
        fadeEnd={cfg.bars.fadeEnd}
      />
    </ThreeCanvas>
  );
};
