import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, MATTE_TAIL_SECONDS } from "./constants";
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
 * The colour pass runs almost the whole clip, then the picture cuts to
 * a short white-on-black matte tail -- the same cells, the same motion,
 * carrying straight on from where the colour left off, so the cut reads
 * as an ending rather than a restart. Total length always equals the
 * reference clip's.
 */
export const BacteriaVersion: React.FC<BacteriaVersionProps> = ({ presetId }) => {
  const preset = getPreset(presetId);
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const geometry = useBacillusGeometry();

  const scale = height / BASE_HEIGHT;


  // Never let the tail eat more than a third of a short clip.
  const matteFrames = Math.min(
    Math.round(MATTE_TAIL_SECONDS * fps),
    Math.floor(durationInFrames / 3),
  );
  const colourFrames = durationInFrames - matteFrames;
  const matte = frame >= colourFrames;

  // One continuous timeline across both passes, so the swarm keeps
  // drifting and the camera keeps moving through the cut.
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
