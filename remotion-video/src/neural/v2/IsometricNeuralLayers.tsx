import React, { useCallback, useMemo, useState } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { ThreeLayer } from "../components/ThreeLayer";
import { PixiLayer } from "../components/PixiLayer";
import { createBokehStage } from "../components/bokeh";
import { FilmGrain } from "../components/FilmGrain";
import { V2 } from "../core/palette";
import { BANDS, V2_DURATION_IN_FRAMES, type BandId } from "./field";
import { buildV2Band, V2_BAND_BLUR } from "./scene";

export const isometricNeuralLayersSchema = z.object({
  debugSharp: z.boolean(),
  showBackend: z.boolean(),
});

export const isometricNeuralLayersDefaults: z.infer<
  typeof isometricNeuralLayersSchema
> = {
  debugSharp: false,
  showBackend: false,
};

/**
 * V2 -- "Loopable isometric branching neural network".
 *
 * Same layer stack as V1, but every element is driven by a periodic function
 * of the loop phase, so the composition can be repeated end to end without a
 * visible cut. There is no opening fade for the same reason.
 */
export const IsometricNeuralLayers: React.FC<
  z.infer<typeof isometricNeuralLayersSchema>
> = ({ debugSharp, showBackend }) => {
  const { height } = useVideoConfig();
  const scale = height / 1080;

  const [backends, setBackends] = useState<string[]>([]);
  const noteBackend = useCallback((label: string) => {
    setBackends((prev) => (prev.includes(label) ? prev : [...prev, label]));
  }, []);

  const blur = (px: number) => (debugSharp ? 0 : px * scale);

  const farBokeh = useMemo(
    () =>
      createBokehStage({
        seed: 0xb0ce11,
        count: 170,
        sizeMin: 0.004,
        sizeMax: 0.026,
        colors: [V2.bokehCool, V2.bokehWhite, V2.bokehCool, V2.bokehWarm],
        alphaMin: 0.18,
        alphaMax: 0.62,
        driftX: 0.03,
        driftY: 0.022,
        softness: 1.7,
        rim: 0.3,
        twinkle: 0.4,
        loopFrames: V2_DURATION_IN_FRAMES,
      }),
    [],
  );

  const nearBokeh = useMemo(
    () =>
      createBokehStage({
        seed: 0xb0ce12,
        count: 34,
        sizeMin: 0.045,
        sizeMax: 0.2,
        colors: [V2.bokehCool, V2.bokehWhite, V2.bokehWarm, V2.bokehCool],
        alphaMin: 0.12,
        alphaMax: 0.38,
        driftX: 0.05,
        driftY: 0.035,
        softness: 0.8,
        rim: 0.35,
        twinkle: 0.25,
        loopFrames: V2_DURATION_IN_FRAMES,
      }),
    [],
  );

  const buildBand = useCallback(
    (band: BandId) => (w: number, h: number) => buildV2Band(band, w, h),
    [],
  );

  return (
    <AbsoluteFill
      style={{ backgroundColor: V2.background, isolation: "isolate" }}
    >
      {/* Light pools on the left, leaving the right side of frame dark. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(95% 85% at 28% 42%, ${V2.haze} 0%, ${V2.background} 58%, #01030a 100%)`,
        }}
      />

      <AbsoluteFill
        style={{ filter: `blur(${blur(2.5)}px)`, mixBlendMode: "screen" }}
      >
        <PixiLayer build={farBokeh} onBackendResolved={noteBackend} />
      </AbsoluteFill>

      {BANDS.map((band) => (
        <AbsoluteFill
          key={band}
          style={{
            filter: `blur(${blur(V2_BAND_BLUR[band])}px)`,
            mixBlendMode: "screen",
          }}
        >
          <ThreeLayer build={buildBand(band)} onBackendResolved={noteBackend} />
        </AbsoluteFill>
      ))}

      <AbsoluteFill
        style={{ filter: `blur(${blur(11)}px)`, mixBlendMode: "screen" }}
      >
        <PixiLayer build={nearBokeh} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(125% 100% at 42% 48%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.62) 100%)",
          pointerEvents: "none",
        }}
      />

      <FilmGrain opacity={0.035} />

      {showBackend ? (
        <AbsoluteFill
          style={{
            color: "#8fc4ff",
            fontFamily: "monospace",
            fontSize: 26 * scale,
            padding: 40 * scale,
            whiteSpace: "pre-line",
          }}
        >
          {backends.join("\n")}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
