import React from "react";
import { Composition, Folder, Still } from "remotion";
import { DoodlePack } from "./clips/DoodlePack";
import { Handwritten } from "./clips/Handwritten";
import { InkFlourish } from "./clips/InkFlourish";
import { LOOP, NotebookPage } from "./clips/NotebookPage";
import { ScribbleWipe } from "./clips/ScribbleWipe";
import { WORDS } from "./data/words";
import { ClipArtSheet } from "./stills/ClipArtSheet";
import { SHEETS } from "./stills/sheets";
import { BG, FPS, HEIGHT, INK, WIDTH } from "./theme";

const base = { fps: FPS, width: WIDTH, height: HEIGHT };

/**
 * Remotion composition ids may not contain "_", so the ids use "-"
 * (DoodlePack-WhiteOnBlack). Output files keep the "_" names.
 */
const cid = (name: string) => name.replace(/_/g, "-");

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Overlays">
      <Composition
        id={cid("DoodlePack_WhiteOnBlack")}
        component={DoodlePack}
        durationInFrames={12 * FPS}
        {...base}
        defaultProps={{ compId: "DoodlePack_WhiteOnBlack", background: BG.black, color: INK.white }}
      />
      <Composition
        id={cid("DoodlePack_InkOnGreen")}
        component={DoodlePack}
        durationInFrames={12 * FPS}
        {...base}
        defaultProps={{ compId: "DoodlePack_InkOnGreen", background: BG.green, color: INK.dark }}
      />
      <Composition
        id={cid("ScribbleWipe_Marker")}
        component={ScribbleWipe}
        durationInFrames={3 * FPS}
        {...base}
        defaultProps={{ compId: "ScribbleWipe_Marker", color: INK.marker, streak: INK.markerStreak }}
      />
      <Composition
        id={cid("ScribbleWipe_Ink")}
        component={ScribbleWipe}
        durationInFrames={3 * FPS}
        {...base}
        defaultProps={{ compId: "ScribbleWipe_Ink", color: INK.ink, streak: INK.inkStreak }}
      />
      {WORDS.map((row) => (
        <Composition key={row.id} id={cid(row.id)} component={Handwritten} durationInFrames={6 * FPS} {...base} defaultProps={{ row }} />
      ))}
      <Composition id={cid("NotebookPage_Loop")} component={NotebookPage} durationInFrames={LOOP} {...base} defaultProps={{ compId: "NotebookPage_Loop" }} />
      <Composition id={cid("InkFlourish_Black")} component={InkFlourish} durationInFrames={5 * FPS} {...base} defaultProps={{ compId: "InkFlourish_Black" }} />
    </Folder>
    <Folder name="ClipArt">
      {SHEETS.map((s) => (
        <Still key={s.id} id={cid(s.id)} component={ClipArtSheet} width={WIDTH} height={HEIGHT} defaultProps={{ sheetId: s.id }} />
      ))}
    </Folder>
    <Folder name="Checks">
      {/* Same page with 601 frames, to confirm frame 600 === frame 0. */}
      <Composition id={cid("NotebookPage_LoopCheck")} component={NotebookPage} durationInFrames={LOOP + 1} {...base} defaultProps={{ compId: "NotebookPage_Loop" }} />
    </Folder>
  </>
);
