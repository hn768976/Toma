import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Autocomplete } from "./components/Autocomplete"; // @only light
import { Bar } from "./components/Bar";
import { CircleWipe } from "./components/CircleWipe"; // @only cleanLight cleanLightAlt
import { PointerCursor } from "./components/PointerCursor"; // @only aiOverview cleanLight cleanLightAlt
import { ResultsPanel } from "./components/ResultsPanel"; // @only aiOverview
import { Cursor } from "./components/Cursor";
import { DataField, LOOP } from "./components/DataField";
import { Finish } from "./components/Finish";
import { MagnifierIcon } from "./components/MagnifierIcon";
import { ResultCount } from "./components/ResultCount"; // @only green
import { TypedText } from "./components/TypedText";
import { fontString, measureText, SANS, useFontsReady } from "./fonts";
import { getLayout } from "./layout";
import { stageState } from "./stages";
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
  const { width, height, fps } = useVideoConfig();
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
    const probe = getLayout(width, height, config.barStyle, 0, config.chrome);
    const labelWidth = ready
      ? measureText(
          SEARCH_LABEL,
          fontString(600, probe.labelSize, SANS),
          probe.labelTracking,
        )
      : 0;
    return getLayout(width, height, config.barStyle, labelWidth, config.chrome);
  }, [width, height, config.barStyle, config.chrome, ready]);

  const schedule = useMemo(
    () => buildSchedule(config.term, timing, variant),
    [config.term, timing, variant],
  );

  const visible = visibleCount(frame, config.term, timing, schedule);
  const typed = config.term.slice(0, visible);
  const stage = stageState(frame, config.stages, fps);
  // The in-pill mark rides the same transform as the bar, dimmed while the
  // border is still stroking itself on. Reusing the frozen entrance object
  // when there is nothing to fade keeps the icon's memo intact.
  const markEntrance =
    stage.chromeFade === 1
      ? stage.entrance
      : {
          scale: stage.entrance.scale,
          opacity: stage.entrance.opacity * stage.chromeFade,
        };

  // @only-start light
  // The panel opens once roughly half the term is down.
  const openFrame = schedule.appear[Math.floor(config.term.length / 2)];
  // @only-end

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
          {/* @only-start light */}
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
          {/* @only-end */}
          <Bar
            layout={layout}
            palette={palette}
            barStyle={config.barStyle}
            chrome={config.chrome}
            bloom={config.bloom}
            reveal={stage.reveal}
            focused={stage.focused}
            buttonHot={stage.buttonHot}
            chromeFade={stage.chromeFade}
            entrance={stage.entrance}
          />
          <MagnifierIcon
            layout={layout}
            color={palette.ui === null ? palette.label : palette.ui.icon}
            kind={config.chrome.icon === "chevron" ? "chevron" : "magnifier"}
            entrance={markEntrance}
          />
          <TypedText
            layout={layout}
            palette={palette}
            text={typed}
            role={config.termFont}
            weight={config.termWeight}
            bloom={config.bloom}
            placeholder={config.chrome.placeholder}
            placeholderOpacity={stage.placeholderOpacity}
            entrance={stage.entrance}
          />
          <Cursor
            layout={layout}
            palette={palette}
            text={typed}
            role={config.termFont}
            weight={config.termWeight}
            opacity={stage.caretVisible ? cursorOpacity(frame, schedule) : 0}
            bloom={config.bloom}
            entrance={stage.entrance}
          />
          {/* @only-start aiOverview */}
          {config.stages === null || config.stages.panel === null ? null : (
            <ResultsPanel
              layout={layout}
              palette={palette}
              config={config.stages.panel}
              frame={frame}
            />
          )}
          {/* @only-end */}
          {/* @only-start green */}
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
          {/* @only-end */}
          {/* @only-start aiOverview cleanLight cleanLightAlt */}
          {config.stages === null ||
          config.stages.pointer === null ||
          palette.ui === null ? null : (
            <PointerCursor
              layout={layout}
              ui={palette.ui}
              script={config.stages.pointer}
              frame={frame}
              height={height}
              seed={variant}
            />
          )}
          {/* @only-end */}
          {/* @only-start cleanLight cleanLightAlt */}
          {config.stages === null ||
          config.stages.wipe === null ||
          palette.wipe === null ? null : (
            <CircleWipe
              layout={layout}
              width={width}
              height={height}
              color={palette.wipe}
              start={config.stages.wipe.start}
              end={config.stages.wipe.end}
              frame={frame}
            />
          )}
          {/* @only-end */}
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
        fade={stage.fade > 0 ? { color: palette.bgDeep, amount: stage.fade } : null}
      />
    </AbsoluteFill>
  );
};
