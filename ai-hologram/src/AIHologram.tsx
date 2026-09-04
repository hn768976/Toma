import { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Scene, configureRenderer } from "./three/Scene";
import { getGrainDataUri, grainOffset } from "./lib/grain";
import { PALETTES, type PaletteId } from "./palettes";
import { useAiIconTexture } from "./lib/aiIcon";
import { CAMERA } from "./three/CameraRig";

export type AIHologramProps = {
  palette: PaletteId;
};

/**
 * "AI Hologram Platform" — a circuit-board plane in perspective with a glowing
 * HUD platform at its centre, a holographic card bearing the Ai chip icon
 * rising above it, orbiting icon nodes and floating UI panels.
 *
 * The three.js canvas is opaque: additive blending only reads correctly against
 * a real backdrop, so the background gradient is a scene background rather than
 * a DOM layer behind a transparent canvas. Grain and vignette sit on top as DOM
 * overlays, both sized in percentages so the 1080p preview matches the 4K
 * render exactly.
 */
export const AIHologram: React.FC<AIHologramProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const pal = PALETTES[palette] ?? PALETTES["dark-blue"];

  const onCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    configureRenderer(state.gl);
  }, []);

  const [gx, gy] = grainOffset(frame);

  // The chip artwork is rasterised outside the canvas and the canvas is not
  // mounted until it is ready. @remotion/three drives the three renderer once
  // per Remotion frame and never again, so anything that arrives after that
  // single advance() would silently miss the capture.
  const iconTexture = useAiIconTexture();
  if (!iconTexture) {
    return <AbsoluteFill style={{ backgroundColor: pal.bgCorner }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: pal.bgCorner }}>
      <ThreeCanvas
        width={width}
        height={height}
        orthographic={false}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 400, position: [0, 11, 19] }}
        gl={{ antialias: false, alpha: false, stencil: false, depth: true }}
        onCreated={onCreated}
        style={{ backgroundColor: pal.bgCorner }}
      >
        <Scene
          palette={pal}
          frame={frame}
          fps={fps}
          duration={durationInFrames}
          iconTexture={iconTexture}
        />
      </ThreeCanvas>

      {/* Vignette. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 74% 74% at 50% 52%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 78%, rgba(0,0,0,0.86) 100%)",
        }}
      />

      {/* Fine grain, ~2%: the dark gradient bands in H.264 without it. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.02,
          backgroundImage: `url(${getGrainDataUri()})`,
          backgroundRepeat: "repeat",
          backgroundPosition: `${gx}px ${gy}px`,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
