/**
 * <ScanReveal> — this project's binding of the shared library component.
 *
 * The library component is subject- and palette-agnostic: it takes two
 * pre-tinted copies of a bitmap plus a line position. All this adapter does is
 * tint the print mask with the variant's ridge colours, turn the variant's scan
 * config into the library's geometry, and place the canvas over the print.
 */
import React, { useMemo } from "react";
import { PRINT_HEIGHT, PRINT_WIDTH, PRINT_X, PRINT_Y } from "../layout";
import { tintMask } from "../shared/bitmapMask";
import { ScanReveal as LibScanReveal } from "../shared/ScanReveal";
import { scanState } from "../lib/scan";
import type { PrintMask as Mask } from "../lib/mask";
import type { Palette, ScanConfig } from "../variants";

export const ScanReveal: React.FC<{
  mask: Mask;
  palette: Palette;
  scan: ScanConfig;
  frame: number;
  /** Multiplies the resting/revealed ridge brightness (the hold pulse). */
  pulse: number;
  /** Whole-frame flash from the outcome stamp, 0..1. */
  flash: number;
}> = ({ mask, palette, scan, frame, pulse, flash }) => {
  const base = useMemo(() => tintMask(mask, palette.ridge), [mask, palette.ridge]);
  const bright = useMemo(
    () => tintMask(mask, palette.ridgeBright),
    [mask, palette.ridgeBright],
  );
  const state = scanState(scan, frame);

  return (
    <LibScanReveal
      base={base}
      bright={bright}
      width={PRINT_WIDTH}
      height={PRINT_HEIGHT}
      reveals={scan.reveals}
      direction={scan.direction}
      geometry={{
        y: state.y,
        yTrail: state.yTrail,
        gain: state.gain,
        active: state.active,
        revealed: state.revealed,
      }}
      colors={{ core: palette.scanCore, glow: palette.scanGlow }}
      edgeSoftness={scan.mode === "acquire" ? scan.edgeSoftness : undefined}
      pulse={pulse}
      flash={flash}
      style={{
        position: "absolute",
        left: PRINT_X,
        top: PRINT_Y,
        width: PRINT_WIDTH,
        height: PRINT_HEIGHT,
        // Additive over the resting print, so the flare adds light rather than
        // covering the ridges.
        mixBlendMode: "screen",
      }}
    />
  );
};
