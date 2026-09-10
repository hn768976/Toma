import React from "react";
import { AbsoluteFill } from "remotion";
import { type Accent } from "../theme";
import { CodePanel } from "./CodePanel";
import {
  BoxGridPanel,
  HeaderPanel,
  ReadoutPanel,
  RowsPanel,
  SerialPanel,
  Spine,
} from "./DataPanels";

/**
 * The technical field behind the dialog: a 24 x 16 grid the panels are
 * placed onto with irregular spans, so the frame reads like a dense
 * desktop rather than a tidy dashboard.
 *
 * The centre columns sit behind the dialog and are mostly covered — they
 * exist so the dialog has something to be *on top of* at its edges.
 */
export const Background: React.FC<{ accent: Accent }> = ({ accent }) => (
  <AbsoluteFill
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(24, 1fr)",
      gridTemplateRows: "repeat(16, 1fr)",
      gap: 18,
      padding: 26,
      boxSizing: "border-box",
    }}
  >
    <HeaderPanel
      id="hdr-main"
      accent={accent}
      col={[1, 15]}
      row={[1, 3]}
      title="SIGNAL PROGRAM"
      subtitle="PROGRAM INITIATED"
    />
    <ReadoutPanel
      id="hdr-source"
      accent={accent}
      col={[17, 25]}
      row={[1, 3]}
      header="DATA SOURCE"
    />

    <Spine id="spine" accent={accent} col={[15, 17]} row={[1, 17]} />

    <RowsPanel
      id="left-rows"
      accent={accent}
      col={[1, 5]}
      row={[3, 10]}
      columns={3}
      rows={16}
      fontSize={26}
    />
    <CodePanel
      id="left-code"
      accent={accent}
      col={[1, 5]}
      row={[10, 17]}
      lines={22}
      fontSize={28}
      speed={0.22}
      header="SEGMENT MAP"
    />

    <BoxGridPanel
      id="centre-grid"
      accent={accent}
      col={[5, 15]}
      row={[3, 11]}
      columns={6}
      rows={5}
    />
    <CodePanel
      id="centre-code"
      accent={accent}
      col={[5, 11]}
      row={[11, 17]}
      lines={18}
      fontSize={30}
      speed={0.34}
    />
    <RowsPanel
      id="centre-rows"
      accent={accent}
      col={[11, 15]}
      row={[11, 17]}
      columns={2}
      rows={13}
      fontSize={28}
    />

    <CodePanel
      id="right-code"
      accent={accent}
      col={[17, 22]}
      row={[3, 10]}
      lines={20}
      fontSize={28}
      speed={0.18}
      header="VECTOR TABLE"
    />
    <SerialPanel
      id="right-serial"
      accent={accent}
      col={[22, 25]}
      row={[3, 10]}
      count={11}
      header="SIGNAL BOOST"
    />
    <RowsPanel
      id="right-rows"
      accent={accent}
      col={[17, 22]}
      row={[10, 17]}
      columns={3}
      rows={15}
      fontSize={26}
    />
    <SerialPanel
      id="right-serial-low"
      accent={accent}
      col={[22, 25]}
      row={[10, 17]}
      count={11}
      header="CHANNEL INDEX"
    />
  </AbsoluteFill>
);
