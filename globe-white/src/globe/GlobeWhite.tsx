import { z } from "zod";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE_BLUE, PALETTE_MONO } from "./palette";
import { Shell } from "./Shell";
import { ContinentDots } from "./ContinentDots";
import { Chords } from "./Chords";
import { NetworkNodes } from "./NetworkNodes";
import { Travellers } from "./Travellers";
import { Grain } from "./Grain";

// Colours are authored as literal sRGB values and written straight to the
// framebuffer. No colour management, no tone mapping: what the palette says is
// what lands in the file.
THREE.ColorManagement.enabled = false;

const DEG = Math.PI / 180;
/** Gentle perspective - enough that the near cap reads forward of the rim. */
const FOV = 30;

export const globeWhiteSchema = z.object({
  variant: z.enum(["mono", "blue"]),
  /**
   * Sphere silhouette diameter as a multiple of frame height. Above 1 the poles
   * are cropped. The reference clip sits near 1.40; the default here is the
   * brief's "cropped very slightly".
   */
  globeDiameter: z.number().min(0.5).max(1.8),
  /** Axial tilt in degrees, so it does not read as a perfect vertical spin. */
  tiltDeg: z.number().min(-45).max(45),
  /** Near-side continent dot diameter, in px at 4K. */
  dotSizePx: z.number().min(0.5).max(20),
  /** Node diameter, in px at 4K. */
  nodeSizePx: z.number().min(0.5).max(30),
  /** Chord weight, in px at 4K. */
  chordWidthPx: z.number().min(0.5).max(10),
  /**
   * Far-side strength as a fraction of near-side, measured in the finished
   * frame. Never zero: hiding the back flattens the globe completely.
   */
  farFactor: z.number().min(0.1).max(1),
  shellOpacity: z.number().min(0).max(1),
  grainOpacity: z.number().min(0).max(0.2),
  showTravellers: z.boolean(),
});

export type GlobeWhiteProps = z.infer<typeof globeWhiteSchema>;

export const globeWhiteDefaults: GlobeWhiteProps = {
  variant: "mono",
  globeDiameter: 1.08,
  tiltDeg: -15,
  dotSizePx: 5,
  nodeSizePx: 11,
  chordWidthPx: 2,
  farFactor: 0.34,
  shellOpacity: 0.55,
  grainOpacity: 0.025,
  showTravellers: true,
};

export const GlobeWhite: React.FC<GlobeWhiteProps> = ({
  variant,
  globeDiameter,
  tiltDeg,
  dotSizePx,
  nodeSizePx,
  chordWidthPx,
  farFactor,
  shellOpacity,
  grainOpacity,
  showTravellers,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const palette = variant === "blue" ? PALETTE_BLUE : PALETTE_MONO;

  // Every animated value is a pure function of the frame - no clock, no delta
  // accumulation - because Remotion renders frames out of order across threads.
  const loopT = frame / durationInFrames;
  // Exactly one turn over the loop, constant speed, no easing.
  const spin = loopT * Math.PI * 2;

  // Place the camera so the silhouette lands at the requested fraction of frame
  // height: the projected radius is (H/2) * tan(theta) / tan(fov/2).
  const theta = Math.atan(globeDiameter * Math.tan((FOV / 2) * DEG));
  const camDist = 1 / Math.sin(theta);

  // Far-side content is drawn before the shell, so the shell attenuates it a
  // second time. Divide that back out, so farFactor means the fraction of
  // near-side strength that actually survives into the frame rather than the
  // fraction we happened to ask the shader for.
  const farAlphaScale = Math.min(
    1,
    farFactor / Math.max(0.05, 1 - shellOpacity),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        camera={{ fov: FOV, position: [0, 0, camDist], near: 0.01, far: 100 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <color attach="background" args={[1, 1, 1]} />
        {/* Tilt first, then spin about the polar axis inside it. */}
        <group rotation={[0, 0, tiltDeg * DEG]}>
          <group rotation={[0, spin, 0]}>
            <Chords
              palette={palette}
              widthPx={chordWidthPx}
              nearAlpha={0.55}
              farAlpha={0.55 * farAlphaScale}
            />
            <ContinentDots
              palette={palette}
              sizePx={dotSizePx}
              nearAlpha={0.95}
              farAlpha={0.95 * farAlphaScale}
              camDist={camDist}
            />
            <NetworkNodes
              palette={palette}
              sizePx={nodeSizePx}
              nearAlpha={0.92}
              farAlpha={0.92 * farAlphaScale}
              camDist={camDist}
              loopT={loopT}
            />
            {showTravellers ? (
              <Travellers
                palette={palette}
                sizePx={nodeSizePx * 0.62}
                nearAlpha={0.85}
                farAlpha={0.85 * farAlphaScale}
                camDist={camDist}
                loopT={loopT}
              />
            ) : null}
            <Shell palette={palette} opacity={shellOpacity} />
          </group>
        </group>
      </ThreeCanvas>
      <Grain opacity={grainOpacity} frame={frame} />
    </AbsoluteFill>
  );
};
