import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, MATTE_SPLIT } from "./constants";
import { getPreset } from "./presets";
import { useBacillusGeometry } from "./geometry";
import { LayerCanvas, MatteCanvas } from "./SwarmLayer";
import { Backdrop } from "./Backdrop";
import { Grade } from "./Grade";

export const bacteriaVersionSchema = z.object({
  presetId: z.string(),
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
 * One version of the series.
 *
 * The timeline mirrors how the reference stock clip is delivered: the
 * colour pass occupies the first half, then the picture cuts to the
 * matte -- the same cells, same motion, replayed from frame 0 as flat
 * white on black. Total length always equals the reference's.
 */
export const BacteriaVersion: React.FC<BacteriaVersionProps> = ({ presetId }) => {
  const preset = getPreset(presetId);
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const geometry = useBacillusGeometry();

  const scale = height / BASE_HEIGHT;


  const colourFrames = Math.round(durationInFrames * MATTE_SPLIT);
  const matte = frame >= colourFrames;
  const localFrame = matte ? frame - colourFrames : frame;
  const passLength = matte ? durationInFrames - colourFrames : colourFrames;

  const seconds = localFrame / fps;
  const progress = passLength > 1 ? localFrame / (passLength - 1) : 0;

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
