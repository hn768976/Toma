/**
 * Falling columns of monospace glyphs.
 *
 * The mechanics — depth bucketing, the three blur buffers, the glyph atlases,
 * the irregular column spacing — live in the shared library's
 * <CharacterRain>. This is the variant-aware adapter, which also holds the
 * font-readiness token so the atlases are rebuilt once the real monospace
 * face has loaded.
 */
import React, { useMemo } from "react";
import { CharacterRain as LibCharacterRain } from "../lib/components/CharacterRain";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH, layerStyle } from "./constants";
import { MONO_FONT_STACK, useMonoFontReady } from "./font";
import type { VariantConfig } from "./variants";

export const CharacterRain: React.FC<{
  variant: VariantConfig;
  seedKey: string;
}> = ({ variant, seedKey }) => {
  const fontReady = useMonoFontReady();
  const { palette, rain } = variant;

  const colors = useMemo(
    () => ({
      bright: palette.rainBright,
      mid: palette.rainMid,
      dim: palette.rainDim,
    }),
    [palette.rainBright, palette.rainMid, palette.rainDim],
  );

  return (
    <LibCharacterRain
      width={WIDTH}
      height={HEIGHT}
      loopLength={DURATION_IN_FRAMES}
      columns={rain.columns}
      minGlyphSize={rain.minGlyphSize}
      maxGlyphSize={rain.maxGlyphSize}
      colors={colors}
      seedKey={seedKey}
      fontStack={MONO_FONT_STACK}
      fontGeneration={fontReady ? "mono" : "fallback"}
      style={layerStyle}
    />
  );
};
