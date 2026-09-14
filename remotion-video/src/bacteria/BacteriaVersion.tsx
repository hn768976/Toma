import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, PASSES } from "./constants";
import { getPreset } from "./presets";
import { useBacillusGeometry } from "./geometry";
import { LayerCanvas, MatteCanvas } from "./SwarmLayer";
import { Backdrop } from "./Backdrop";
import { Grade } from "./Grade";

export const bacteriaVersionSchema = z.object({
  presetId: z.string(),
  pass: z.enum(PASSES),
});

export type BacteriaVersionProps = z.infer<typeof bacteriaVersionSchema>;

const hexToRgba = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * One pass of one version.
 *
 * Colour and matte are delivered as two separate clips of identical
 * length, and both run the very same timeline off the very same seed:
 * frame n of the matte is exactly the alpha of frame n of the colour,
 * all the way through. That makes the matte a usable full-length key
 * rather than a sample of one.
 *
 * Length always equals the reference clip's.
 */
export const BacteriaVersion: React.FC<BacteriaVersionProps> = ({
  presetId,
  pass,
}) => {
  const preset = getPreset(presetId);
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const geometry = useBacillusGeometry();

  const scale = height / BASE_HEIGHT;


  const matte = pass === "matte";

  // Identical for both passes -- this is what keeps the matte keyed to
  // the colour frame for frame.
  const seconds = frame / fps;
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;

  if (!geometry) {
    return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }

  if (matte) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000000" }}>
        <MatteCanvas
          preset={preset}
          geometry={geometry}
          width={width}
          height={height}
          seconds={seconds}
          progress={progress}
        />
      </AbsoluteFill>
    );
  }

  const { grade } = preset;
  const bloomColor = hexToRgba(preset.material.rimColor, Math.min(1, grade.bloom));

  return (
    <AbsoluteFill style={{ backgroundColor: preset.backdrop.base }}>
      <AbsoluteFill
        style={{
          filter: `saturate(${grade.saturate}) contrast(${grade.contrast}) brightness(${grade.brightness})`,
        }}
      >
        <Backdrop
          spec={preset.backdrop}
          seed={preset.seed}
          scale={scale}
          seconds={seconds}
          width={width}
          height={height}
        />

        {preset.layers.map((layer, index) => {
          const sharp = layer.blurPx === 0;
          return (
            <AbsoluteFill
              key={index}
              style={{
                opacity: layer.opacity,
                filter: [
                  layer.blurPx > 0 ? `blur(${layer.blurPx * scale}px)` : "",
                  // Cheap bloom: the alpha-aware halo a drop-shadow throws
                  // off the sharp layer reads like the glow every one of
                  // these references has, at a fraction of a real
                  // post-processing pass.
                  sharp && grade.bloom > 0
                    ? `drop-shadow(0 0 ${grade.bloomBlurPx * scale}px ${bloomColor}) drop-shadow(0 0 ${
                        grade.bloomBlurPx * 2.2 * scale
                      }px ${bloomColor})`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              }}
            >
              <LayerCanvas
                preset={preset}
                geometry={geometry}
                layerIndex={index}
                width={width}
                height={height}
                seconds={seconds}
                progress={progress}
                matte={false}
                withSpheres={index === preset.layers.length - 1}
              />
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>

      <Grade grade={grade} scale={scale} seconds={seconds} />
    </AbsoluteFill>
  );
};
