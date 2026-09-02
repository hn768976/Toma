import React from "react";
import { LAYOUT } from "../layout";
import { PALETTE } from "../palette";
import { FrameChrome } from "./FrameChrome";
import { WaveformPanel } from "./WaveformPanel";
import { BarPanel } from "./BarPanel";
import { TextPanel } from "./TextPanel";
import { ReadoutPanel } from "./ReadoutPanel";
import { DataTable } from "./DataTable";
import { GaugeColumn } from "./GaugeColumn";
import { BracketPanel } from "./BracketPanel";
import { RadarPanel } from "./RadarPanel";
import { DialPanel } from "./DialPanel";
import { IndicatorRow } from "./IndicatorRow";
import { IconPanel } from "./IconPanel";

// Panel count drives the border-flash scheduler, which picks one panel per
// slot. Keep it equal to the number of <Panel>s below.
const PANEL_COUNT = 16;

/**
 * THE DASHBOARD. Takes no props at all — not even the variant.
 *
 * This is the load-bearing constraint of the whole build: three versions, one
 * dashboard. Because this component cannot see the variant, the panels
 * physically cannot drift between versions. The centre element and the ID
 * label are composed on top by <HudCentre>; nothing in here knows they exist.
 *
 * Frame comes from useCurrentFrame() one level up, already wrapped into the
 * loop, and is threaded down as a plain number so every panel is a pure
 * function of it.
 */
export const Dashboard: React.FC<{ frame: number }> = ({ frame }) => {
  const p = { panelCount: PANEL_COUNT, frame };
  return (
    <>
      <FrameChrome />

      {/* top band */}
      <WaveformPanel {...p} index={0} rect={LAYOUT.waveform} label="wave / ch-a" seed="wave" />
      <BarPanel
        {...p}
        index={1}
        rect={LAYOUT.barStrip}
        label="band load"
        seed="strip"
        count={9}
        orientation="horizontal"
        color={PALETTE.elementCyan}
        highlight={4}
        showValues
      />
      <BarPanel
        {...p}
        index={2}
        rect={LAYOUT.barPanel}
        label="spectrum"
        seed="spec"
        count={16}
        orientation="vertical"
        color={PALETTE.accentBlue}
      />
      <TextPanel {...p} index={3} rect={LAYOUT.textTR} label="stream" seed="tr" fontSize={18} />

      {/* left instrumentation */}
      <ReadoutPanel {...p} index={4} rect={LAYOUT.readout1} label="gain" unit="db" seed="ro1" flagged />
      <ReadoutPanel {...p} index={5} rect={LAYOUT.readout2} label="drift" unit="ppm" seed="ro2" />
      <DataTable {...p} index={6} rect={LAYOUT.dataTable} label="node table" seed="tbl" />
      <BracketPanel {...p} index={7} rect={LAYOUT.bracketEmpty} label="target lock" seed="brk" />
      <GaugeColumn
        {...p}
        index={8}
        rect={LAYOUT.gaugeCol3}
        label="subsystems"
        seed="gc3"
        count={3}
        labels={["core", "flux", "bus"]}
      />

      {/* bottom band */}
      <RadarPanel {...p} index={9} rect={LAYOUT.radar} label="scan s-960" seed="scan" />
      <DialPanel {...p} index={10} rect={LAYOUT.circGauge} label="bearing" seed="dial" />

      {/* centre-right column, below the stage */}
      <TextPanel {...p} index={11} rect={LAYOUT.textBR} label="event log" seed="br" fontSize={20} />
      <IndicatorRow {...p} index={12} rect={LAYOUT.indicators} label="status" seed="ind" />

      {/* far right */}
      <GaugeColumn
        {...p}
        index={13}
        rect={LAYOUT.gaugeCol4}
        label="array"
        seed="gc4"
        count={4}
        labels={["a1", "a2", "a3", "a4"]}
        variant="indicator"
      />
      <IconPanel {...p} index={14} rect={LAYOUT.iconSq1} glyph="aperture" seed="ic1" />
      <IconPanel {...p} index={15} rect={LAYOUT.iconSq2} glyph="sector" seed="ic2" />
    </>
  );
};
