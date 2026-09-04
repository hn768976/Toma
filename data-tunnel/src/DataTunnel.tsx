import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import {
  BLOOM_BLUR,
  BLOOM_OPACITY,
  BLOOM_RENDER_SCALE,
  BLOOM_WIDTH_GAIN,
  BUCKET_FEATHERS,
  DEPTH_BUCKETS,
  GRAIN_CELL,
  GRAIN_OPACITY,
  GRAIN_TILE,
  VP_OFFSET_X,
  VP_OFFSET_Y,
  Z_TOTAL,
} from "./constants";
import { grainTileUrl } from "./grain";
import { hexToRgba, PALETTES, scalePx } from "./palette";
import { cameraStateForFrame, travelForFrame, TunnelLayer } from "./TunnelLayer";

export const dataTunnelSchema = z.object({
  variant: z.enum(["blue", "mono"]),
});

export type DataTunnelProps = z.infer<typeof dataTunnelSchema>;

/**
 * Device pixel ratio of the current render. Remotion's `--scale` flag sets
 * this, so reading it here is what lets one 4K composition be rendered as a
 * 1080p preview without over-drawing every layer at four times the pixels.
 */
const useDpr = (): number =>
  useMemo(() => {
    if (typeof window === "undefined") {
      return 1;
    }
    return Math.min(2, Math.max(0.2, window.devicePixelRatio || 1));
  }, []);

export const DataTunnel: React.FC<DataTunnelProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const palette = PALETTES[variant];
  const dpr = useDpr();

  const aspect = width / height;
  const travel = travelForFrame(frame);
  const camera = cameraStateForFrame(frame, aspect);

  // Where the vanishing point actually lands, in percent of the frame. The
  // camera's roll turns the image about the frame centre, so the glow has to
  // follow it or it drifts off the geometry.
  const vp = useMemo(() => {
    const r = -camera.roll;
    const ax = VP_OFFSET_X * aspect;
    const rx = ax * Math.cos(r) - VP_OFFSET_Y * Math.sin(r);
    const ry = ax * Math.sin(r) + VP_OFFSET_Y * Math.cos(r);
    return {
      left: 50 + (rx / aspect) * 50,
      top: 50 - ry * 50,
    };
  }, [camera.roll, aspect]);

  const vpX = `${vp.left}%`;
  const vpY = `${vp.top}%`;

  const grain = grainTileUrl();
  const grainSize = GRAIN_TILE * GRAIN_CELL;

  const layerProps = {
    frame,
    travel,
    palette,
    frameWidth: width,
    frameHeight: height,
    dpr,
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.bgOuter,
        // Keeps the additive layer stack from blending with anything the
        // composition is placed on.
        isolation: "isolate",
        overflow: "hidden",
      }}
    >
      {/* Background: the tunnel opens onto light at the vanishing point. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 75% 95% at ${vpX} ${vpY}, ${palette.bgInner} 0%, ${palette.bgOuter} 72%)`,
        }}
      />

      {/* Vanishing-point glow: a tight core inside a broad haze. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 9% at ${vpX} ${vpY}, ${hexToRgba(
            palette.glow,
            0.34,
          )} 0%, ${hexToRgba(palette.glow, 0)} 100%)`,
          mixBlendMode: "plus-lighter",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 58% at ${vpX} ${vpY}, ${hexToRgba(
            palette.glow,
            0.2,
          )} 0%, ${hexToRgba(palette.glow, 0)} 100%)`,
          filter: `blur(${scalePx(30, height)}px)`,
          mixBlendMode: "plus-lighter",
        }}
      />

      {/*
        Depth-of-field: each bucket is its own WebGL layer with its own blur
        radius, composited additively. Blur radii are authored at 1080p and
        scaled by the frame height, so the 4K master matches the preview.
      */}
      {DEPTH_BUCKETS.map((bucket, i) => {
        const feather = BUCKET_FEATHERS[i];
        return (
          <AbsoluteFill
            key={`bucket-${i}`}
            style={{
              filter:
                bucket.blur > 0
                  ? `blur(${scalePx(bucket.blur, height)}px)`
                  : undefined,
              mixBlendMode: "plus-lighter",
            }}
          >
            <TunnelLayer
              {...layerProps}
              renderScale={bucket.renderScale}
              slab={[bucket.near, feather.near, bucket.far, feather.far]}
              content="all"
            />
          </AbsoluteFill>
        );
      })}

      {/*
        Bloom, restricted to the bright streaks. Blooming the whole dot grid
        would merge the rows into a haze and lose the structure that makes
        this read as data rather than stars.
      */}
      <AbsoluteFill
        style={{
          filter: `blur(${scalePx(BLOOM_BLUR, height)}px)`,
          opacity: BLOOM_OPACITY,
          mixBlendMode: "plus-lighter",
        }}
      >
        <TunnelLayer
          {...layerProps}
          renderScale={BLOOM_RENDER_SCALE}
          slab={[0, 0, Z_TOTAL, 0]}
          content="streaks"
          widthGain={BLOOM_WIDTH_GAIN}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 88% at 50% 50%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {grain ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${grain})`,
            backgroundRepeat: "repeat",
            backgroundSize: `${grainSize}px ${grainSize}px`,
            // Pure function of the frame, so the grain loops with everything
            // else instead of resetting at the seam.
            backgroundPosition: `${(frame * 73) % grainSize}px ${
              (frame * 151) % grainSize
            }px`,
            opacity: GRAIN_OPACITY,
            mixBlendMode: "plus-lighter",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const dataTunnelDefaultProps: DataTunnelProps = { variant: "blue" };
