import React, { useCallback, useMemo, useState } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ThreeLayer } from "../components/ThreeLayer";
import { PixiLayer } from "../components/PixiLayer";
import { createBokehStage } from "../components/bokeh";
import { FilmGrain } from "../components/FilmGrain";
import { V1 } from "../core/palette";
import { BANDS, type BandId } from "./field";
import { buildV1Band, V1_BAND_BLUR } from "./scene";

export const neuralFiberFlowSchema = z.object({
  /** Turns off the depth-of-field blurs, which makes tuning the layout easier. */
  debugSharp: z.boolean(),
  showBackend: z.boolean(),
});

export const neuralFiberFlowDefaults: z.infer<typeof neuralFiberFlowSchema> = {
  debugSharp: false,
  showBackend: false,
};

/**
 * V1 -- "Abstract AI neural network concept".
 *
 * Layer order, back to front: background haze, far bokeh, the three fibre
 * slices at increasing depth, then the near bokeh. Everything above the
 * background is composited with `screen` so the slices add together as light
 * rather than occluding one another.
 */
export const NeuralFiberFlow: React.FC<
  z.infer<typeof neuralFiberFlowSchema>
> = ({ debugSharp, showBackend }) => {
  const frame = useCurrentFrame();
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
        seed: 0xb0ce01,
        count: 210,
        sizeMin: 0.005,
        sizeMax: 0.03,
        colors: [V1.bokehWarm, V1.bokehCool, V1.bokehWhite, V1.bokehWarm],
        alphaMin: 0.22,
        alphaMax: 0.72,
        driftX: -0.011,
        driftY: 0.004,
        softness: 1.7,
        rim: 0.3,
        twinkle: 0.35,
        fadeInSeconds: 2.2,
      }),
    [],
  );

  const nearBokeh = useMemo(
    () =>
      createBokehStage({
        seed: 0xb0ce02,
        count: 44,
        sizeMin: 0.04,
        sizeMax: 0.19,
        colors: [V1.bokehWarm, V1.bokehCool, V1.bokehWarm, V1.bokehWhite],
        alphaMin: 0.14,
        alphaMax: 0.46,
        driftX: -0.026,
        driftY: -0.009,
        // A near-flat disc with a bright rim: that is what a real defocused
        // highlight looks like, and it survives the blur below as a shape
        // rather than dissolving into haze.
        softness: 0.8,
        rim: 0.35,
        twinkle: 0.2,
        fadeInSeconds: 3,
      }),
    [],
  );

  const buildBand = useCallback(
    (band: BandId) => (w: number, h: number) => buildV1Band(band, w, h),
    [],
  );

  // The reference opens on black; this keeps the first few frames clean
  // while the first bundle is still ramping in.
  const openFade = interpolate(frame, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: V1.background,
        isolation: "isolate",
        opacity: openFade,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(105% 80% at 44% 54%, ${V1.haze} 0%, ${V1.background} 55%, #000105 100%)`,
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
            filter: `blur(${blur(V1_BAND_BLUR[band])}px)`,
            mixBlendMode: "screen",
          }}
        >
          <ThreeLayer build={buildBand(band)} onBackendResolved={noteBackend} />
        </AbsoluteFill>
      ))}

      <AbsoluteFill
        style={{ filter: `blur(${blur(9)}px)`, mixBlendMode: "screen" }}
      >
        <PixiLayer build={nearBokeh} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 100% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
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
