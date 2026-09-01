/**
 * Version 2 — "tilted".
 *
 * This composition authors no dashboard content of its own. It calls the same
 * `useDashboardBuffer` version 1 uses, which paints the complete dashboard into
 * its own offscreen canvas for the current frame, and hands that canvas to a
 * plane as a texture. Everything else here is camera, lens and screen
 * treatment.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Bloom, DepthOfField, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { VARIANTS, type VariantName } from "../variants";
import { useDashboardBuffer } from "../dashboard/useDashboardBuffer";
import { DashboardPlane } from "./DashboardPlane";
import { CameraRig } from "./CameraRig";
import { getCameraState } from "./cameraPath";
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR } from "./scene";

export type AnalyticsTiltedProps = { variant: VariantName };

export const AnalyticsTilted: React.FC<AnalyticsTiltedProps> = ({ variant }) => {
  const config = VARIANTS[variant] ?? VARIANTS.tilted;
  const buffer = useDashboardBuffer(config);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const camera = getCameraState(frame, durationInFrames);

  // A near-black surround, derived from the palette rather than a new colour, so
  // the panel reads as a lit display in an unlit room.
  const surround = new THREE.Color(config.palette.backgroundDeep).multiplyScalar(0.28);

  return (
    <AbsoluteFill style={{ backgroundColor: `#${surround.getHexString()}` }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat
        camera={{ fov: CAMERA_FOV, near: CAMERA_NEAR, far: CAMERA_FAR, position: [0, 0, 14] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ backgroundColor: "transparent" }}
      >
        <CameraRig />
        <DashboardPlane buffer={buffer} sheenColor={config.palette.seriesWhite} />
        <EffectComposer multisampling={4}>
          {/*
            Focused on the plane's mid-distance, computed per frame from the same
            camera path. Both the near and the far edge of the tilted plane fall
            out of focus — the whole reason to do this in 3D rather than with a
            2D skew, which cannot vary blur with depth.
          */}
          <DepthOfField
            focusDistance={camera.focusDistance}
            focalLength={0.012}
            bokehScale={4.2}
            height={720}
          />
          {/*
            Light. The dashboard already has bloom baked into its texture, so a
            heavy pass here would blow the counters out.
          */}
          <Bloom intensity={0.22} luminanceThreshold={0.72} luminanceSmoothing={0.32} mipmapBlur />
        </EffectComposer>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
