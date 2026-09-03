/**
 * <MinutiaeMarkers> — this project's binding of the shared library component.
 *
 * The library owns the point placement, the mask snapping and the irregular
 * connector web. This adapter only says *when* a marker at a given height is
 * reached (the first scan pass travels upward, so a marker arrives as the line
 * rises past it) and how far through the web-drawing pass we are.
 */
import React, { useCallback } from "react";
import { PRINT_HEIGHT, PRINT_WIDTH, PRINT_X, PRINT_Y } from "../layout";
import { MinutiaeMarkers as LibMinutiaeMarkers } from "../shared/MinutiaeMarkers";
import { passProgress } from "../lib/scan";
import type { PrintMask as Mask } from "../lib/mask";
import type { MinutiaeConfig, ScanConfig } from "../variants";

export const MinutiaeMarkers: React.FC<{
  mask: Mask;
  config: MinutiaeConfig;
  scan: ScanConfig;
  frame: number;
  /** 0..1 — every marker flashes together with the outcome stamp. */
  flash: number;
}> = ({ mask, config, scan, frame, flash }) => {
  const pass = scan.mode === "verify" ? scan.passes[config.appearPass] : null;

  const appearAt = useCallback(
    (yFraction: number) =>
      pass ? pass.start + (1 - yFraction) * (pass.end - pass.start) : 0,
    [pass],
  );

  return (
    <LibMinutiaeMarkers
      mask={mask}
      count={config.count}
      color={config.color}
      frame={frame}
      appearAt={appearAt}
      webProgress={passProgress(scan, config.connectPass, frame)}
      radius={config.radius}
      tickLength={config.tickLength}
      maxLinkDistance={config.maxLinkDistance}
      linksPerMarker={config.linksPerMarker}
      flash={flash}
      style={{
        position: "absolute",
        left: PRINT_X,
        top: PRINT_Y,
        width: PRINT_WIDTH,
        height: PRINT_HEIGHT,
      }}
    />
  );
};
