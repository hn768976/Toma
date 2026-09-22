import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene } from "./Scene";
import { LOOKS } from "./looks";
import { useDigitTexture } from "./useDigitTexture";

/**
 * Composition props are serialised to JSON by Remotion, so the look is
 * referenced by id and resolved here -- the config holds live Curve objects
 * that would not survive a round trip.
 */
export const DataCable: React.FC<{ lookId: string }> = ({ lookId }) => {
  const config = LOOKS.find((l) => l.id === lookId);
  if (!config) throw new Error(`Unknown look: ${lookId}`);
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const digits = useDigitTexture();

  /**
   * Remotion's --scale sets Chrome's device scale factor but does not resize
   * the WebGL drawing buffer, so without this the scene renders at the full
   * 3840x2160 even for a 1080p preview -- four times the fill rate for pixels
   * that are then thrown away. Tying dpr to devicePixelRatio makes the buffer
   * match the output exactly at any scale.
   */
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {digits ? (
        <ThreeCanvas
          width={width}
          height={height}
          // Tone mapping happens in the post chain, not on the renderer.
          flat
          dpr={dpr}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
          camera={{ fov: config.camera.fov, position: config.camera.position }}
          style={{ backgroundColor: "#000000" }}
        >
          <color attach="background" args={["#000000"]} />
          <Scene config={config} digits={digits} frame={frame} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
