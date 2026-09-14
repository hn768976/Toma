import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  Backdrop,
  Bloom,
  Dust,
  Grain,
  NearBokeh,
  NetworkGraph,
  useScale,
  Vignette,
} from "./fx/Plate";
import { getLook } from "./looks";
import { CAMERA_Z, HeroLayer, SwarmLayer } from "./three/Layers";
import { useVirusGeometry } from "./three/useVirusGeometry";

/**
 * One shot. Composited back-to-front:
 *
 *   plate → defocused swarm (half-res WebGL + CSS blur) → hero (full-res WebGL)
 *   → foreground bokeh → dust → graph → bloom → vignette → grain → grade
 *
 * Two WebGL contexts rather than three: the near layer is pure out-of-focus
 * bokeh, which CSS draws identically for a fraction of the render cost.
 */
export const VirusVideo: React.FC<{ lookId: string }> = ({ lookId }) => {
  const look = getLook(lookId);
  const { width, height } = useVideoConfig();
  const s = useScale();

  // Loaded here rather than inside the canvases: <ThreeCanvas> only draws when
  // the Remotion frame changes, so geometry that arrives after mount would
  // never be painted. Gating the canvases on it guarantees a drawn first frame.
  const geometry = useVirusGeometry();

  // Half-res canvas for the blurred layer — invisible in the blur, ~4x cheaper.
  const swarmW = Math.round(width / 2);
  const swarmH = Math.round(height / 2);

  const grade = look.grade;

  return (
    <AbsoluteFill style={{ backgroundColor: look.bg.fog }}>
      <AbsoluteFill
        style={{
          filter: `contrast(${grade.contrast}) saturate(${grade.saturate}) brightness(${grade.brightness})`,
        }}
      >
        <Backdrop look={look} />

        {geometry && look.swarm.count > 0 ? (
          <AbsoluteFill
            style={{
              filter: `blur(${look.swarm.blur * s}px)`,
              opacity: look.swarm.opacity,
            }}
          >
            <div
              style={{
                width,
                height,
                transform: `scale(2)`,
                transformOrigin: "top left",
              }}
            >
              <ThreeCanvas
                width={swarmW}
                height={swarmH}
                camera={{ position: [0, 0, CAMERA_Z], fov: look.cam.fov }}
                gl={{ antialias: false, alpha: true }}
                style={{ background: "transparent" }}
              >
                <SwarmLayer look={look} geometry={geometry} />
              </ThreeCanvas>
            </div>
          </AbsoluteFill>
        ) : null}

        <NetworkGraph look={look} />

        {geometry ? (
          <AbsoluteFill>
            <ThreeCanvas
              width={width}
              height={height}
              camera={{ position: [0, 0, CAMERA_Z], fov: look.cam.fov }}
              gl={{ antialias: true, alpha: true }}
              style={{ background: "transparent" }}
            >
              <HeroLayer look={look} pixelScale={height / 2} geometry={geometry} />
            </ThreeCanvas>
          </AbsoluteFill>
        ) : null}

        <Dust look={look} />
        <NearBokeh look={look} />
        <Bloom look={look} />
        <Vignette look={look} />
      </AbsoluteFill>
      <Grain look={look} />
    </AbsoluteFill>
  );
};
