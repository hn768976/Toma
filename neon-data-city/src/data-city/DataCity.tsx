import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BACKGROUND } from "./constants";
import { buildField, cameraAt, heightsAt } from "./field";
import { BloomLayer, DepthLayer } from "./DepthLayer";
import { Grain } from "./Grain";
import { VARIANTS, type VariantConfig } from "./variants";

/** Extra canvas margin, in composition pixels, that the blur can eat into. */
const OVERSCAN = 96;

/**
 * Backing-store resolution relative to the composition.
 *
 * Remotion's `--scale` sets the device pixel ratio, so at `--scale=0.5` a
 * 3840px-wide canvas is rasterised at 1920 — exactly the output size, no
 * wasted pixels. Capped at 1 so a retina Studio preview does not try to
 * allocate five 7680px framebuffers.
 */
const useDeviceScale = () => {
  return useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Math.max(0.1, Math.min(1, window.devicePixelRatio || 1));
  }, []);
};

export const DataCity: React.FC<{ variant: string }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const dpr = useDeviceScale();

  const cfg: VariantConfig = VARIANTS[variant] ?? VARIANTS["V1-DataCityMagenta"];

  // t walks 0 -> 1 across the composition and is the only time input anywhere
  // in the project. Every animated value is periodic in it, so frame 300 is
  // frame 0 and the loop is seamless.
  const t = frame / durationInFrames;

  const field = useMemo(
    () => buildField(cfg, width / height),
    [cfg, width, height],
  );

  // Heights are solved once per frame for the whole city and shared by every
  // layer, so the bands can never disagree about where a tip is.
  const heights = useMemo(() => {
    const out = new Float32Array(field.count);
    return heightsAt(field, t, out);
  }, [field, t]);

  const cam = useMemo(() => cameraAt(cfg, t), [cfg, t]);

  // Far bands first: nearer layers composite over them, which is also the
  // correct occlusion order once they are blurred.
  const backToFront = useMemo(() => [...cfg.bands].reverse(), [cfg.bands]);

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND, overflow: "hidden" }}>
      {backToFront.map((band) => (
        <DepthLayer
          key={`${band.near}-${band.far}`}
          cfg={cfg}
          band={band}
          field={field}
          heights={heights}
          cam={cam}
          dpr={dpr}
          width={width}
          height={height}
          overscan={OVERSCAN}
        />
      ))}
      <BloomLayer
        cfg={cfg}
        field={field}
        heights={heights}
        cam={cam}
        dpr={dpr}
        width={width}
        height={height}
        overscan={OVERSCAN}
      />
      <Grain strength={cfg.grain} frame={frame} />
    </AbsoluteFill>
  );
};
