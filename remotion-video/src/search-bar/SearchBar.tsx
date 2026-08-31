import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Autocomplete } from "./components/Autocomplete";
import { Bar } from "./components/Bar";
import { Cursor } from "./components/Cursor";
import { DataField, LOOP } from "./components/DataField";
import { Finish } from "./components/Finish";
import { MagnifierIcon } from "./components/MagnifierIcon";
import { ResultCount } from "./components/ResultCount";
import { TypedText } from "./components/TypedText";
import { fontString, measureText, SANS, useFontsReady } from "./fonts";
import { getLayout } from "./layout";
import { buildSchedule, cursorOpacity, visibleCount } from "./typing";
import { SEARCH_LABEL, VARIANTS } from "./variants";
import type { VariantName } from "./variants";

export const SEARCH_BAR_DURATION = LOOP;
export const SEARCH_BAR_FPS = 30;
export const SEARCH_BAR_WIDTH = 3840;
export const SEARCH_BAR_HEIGHT = 2160;

export type SearchBarProps = {
  variant: VariantName;
};

/**
 * One component for every version. The variant key selects a palette, a term,
 * a bar style, a background mode and whichever extras that version adds — the
 * typing, the cursor and the cycle are the same code in all three.
 */
export const SearchBar: React.FC<SearchBarProps> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const rawFrame = useCurrentFrame();
  // Everything downstream reads this, so the cycle is closed by construction:
  // frame 480 is frame 0.
  const frame = ((rawFrame % LOOP) + LOOP) % LOOP;

  const config = VARIANTS[variant];
  const { palette, timing } = config;
  const ready = useFontsReady();

  const layout = useMemo(() => {
    // The divider and the typed text sit after the label, so the label has to
    // be measured — which is only meaningful once the real font has arrived,
    // hence the re-measure when `ready` flips.
    const probe = getLayout(width, height, config.barStyle, 0);
    const labelWidth = ready
      ? measureText(
          SEARCH_LABEL,
          fontString(600, probe.labelSize, SANS),
          probe.labelTracking,
        )
      : 0;
    return getLayout(width, height, config.barStyle, labelWidth);
  }, [width, height, config.barStyle, ready]);

  const schedule = useMemo(
    () => buildSchedule(config.term, timing, variant),
    [config.term, timing, variant],
  );

  const visible = visibleCount(frame, config.term, timing, schedule);
  const typed = config.term.slice(0, visible);

  // The panel opens once roughly half the term is down.
  const openFrame = schedule.appear[Math.floor(config.term.length / 2)];

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgDeep }}>
      <DataField
        width={width}
        height={height}
        palette={palette}
        mode={config.fieldMode}
        count={config.fieldCount}
        opacity={config.fieldOpacity}
        additive={!config.fieldDarker}
        washStrength={config.washStrength}
        scanlines={config.scanlines}
        frame={frame}
        seed={variant}
      />

      {ready ? (
        <>
          {config.autocomplete === null ? null : (
            <Autocomplete
              layout={layout}
              palette={palette}
              config={config.autocomplete}
              timing={timing}
              frame={frame}
              openFrame={openFrame}
              typedLength={visible}
            />
          )}
          <Bar
            layout={layout}
            palette={palette}
            barStyle={config.barStyle}
            bloom={config.bloom}
          />
          <MagnifierIcon
            layout={layout}
            color={palette.label}
            kind={config.barStyle === "terminal" ? "chevron" : "magnifier"}
          />
          <TypedText
            layout={layout}
            palette={palette}
            text={typed}
            role={config.termFont}
            bloom={config.bloom}
          />
          <Cursor
            layout={layout}
            palette={palette}
            text={typed}
            role={config.termFont}
            opacity={cursorOpacity(frame, schedule)}
            bloom={config.bloom}
          />
          {config.resultCount === null ? null : (
            <ResultCount
              layout={layout}
              palette={palette}
              config={config.resultCount}
              timing={timing}
              frame={frame}
              seed={variant}
            />
          )}
        </>
      ) : null}

      <Finish
        width={width}
        height={height}
        frame={frame}
        vignette={config.vignette}
        lighten={config.vignetteLighten}
        overexpose={config.overexpose}
        grain={config.grain}
      />
    </AbsoluteFill>
  );
};
