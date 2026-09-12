import React, { useId } from "react";
import { useCurrentFrame } from "remotion";
import {
  BASE_H,
  BASE_W,
  DOWNLOAD_DIAL,
  PING_DIAL,
  UPLOAD_DIAL,
} from "./constants";
import { remap } from "./geometry";
import { Dial } from "./Dial";
import { TogglePill } from "./TogglePill";
import { DotStrip } from "./DotStrip";
import { NeonGlow } from "./NeonGlow";
import {
  REVEAL,
  downloadValue,
  meterLevel,
  pingValue,
  toggleProgress,
  uploadValue,
} from "./motion";

/**
 * The board itself, in 768 x 432 design units drawn into an SVG viewBox, so one
 * source renders crisp at any output size. The flat and neon versions render
 * exactly this markup and differ only in the theme and the wrapper around it.
 */
export type DashboardProps = {
  /** Wrap the board in the neon bloom filter. */
  glow?: boolean;
};

export const Dashboard: React.FC<DashboardProps> = ({ glow = false }) => {
  const frame = useCurrentFrame();
  const glowId = useId();

  const reveal = (window: { from: number; to: number }) =>
    remap(frame, window.from, window.to, 0, 1);

  const download = downloadValue(frame);
  const upload = uploadValue(frame);

  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width="100%"
      height="100%"
      shapeRendering="geometricPrecision"
      style={{ display: "block" }}
    >
      {glow ? (
        <defs>
          <NeonGlow id={glowId} />
        </defs>
      ) : null}
      <g filter={glow ? `url(#${glowId})` : undefined}>
        <Dial
          spec={DOWNLOAD_DIAL}
          value={download}
          reveal={reveal(REVEAL.download)}
        />
        <Dial
          spec={UPLOAD_DIAL}
          value={upload}
          reveal={reveal(REVEAL.upload)}
        />
        <Dial
          spec={PING_DIAL}
          value={pingValue(frame)}
          reveal={reveal(REVEAL.ping)}
        />

        <TogglePill
          progress={toggleProgress(frame)}
          reveal={reveal(REVEAL.pill)}
        />

        <DotStrip
          side="left"
          reveal={reveal(REVEAL.dots)}
          level={meterLevel(frame, download, 0)}
        />
        <DotStrip
          side="right"
          reveal={reveal(REVEAL.dots)}
          level={meterLevel(frame, upload, 2.6)}
        />
      </g>
    </svg>
  );
};
