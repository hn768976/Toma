import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background, Grain } from "./components/defs";
import { Disc } from "./components/Discs";
import { Gear, MeshGear } from "./components/Gears";
import { Ring } from "./components/Orbits";
import { Sweep, Wave } from "./components/Sweeps";
import { TextLayer } from "./components/TextLayer";
import { DISCS, GEARS, MESH_GEAR, RINGS, SWEEPS, WAVE } from "./layout";
import { BLUE, GOLD, type Theme } from "./theme";

export type CorporateGearsProps = {
  /** Colourway. */
  palette: "gold" | "blue";
  /** Word held dead centre. */
  centreWord: string;
  /** The four keyword labels, in order: upper, mid-left, lower-left, mid-right. */
  labels: string[];
};

const PALETTES: Record<CorporateGearsProps["palette"], Theme> = {
  gold: GOLD,
  blue: BLUE,
};

export const corporateGearsGoldProps: CorporateGearsProps = {
  palette: "gold",
  centreWord: "BUSINESS",
  labels: ["MISSION", "INNOVATION", "STRATEGY", "GROWTH"],
};

export const corporateGearsBlueProps: CorporateGearsProps = {
  palette: "blue",
  centreWord: "STRATEGY",
  // "STRATEGY" is the centre word here, so the lower-left label becomes VISION.
  labels: ["MISSION", "INNOVATION", "VISION", "GROWTH"],
};

export const CorporateGears: React.FC<CorporateGearsProps> = ({
  palette,
  centreWord,
  labels,
}) => {
  const frame = useCurrentFrame();
  const { width: w, height: h, durationInFrames } = useVideoConfig();
  const theme = PALETTES[palette];

  // The unit for every size in the scene, so the layout is resolution-free.
  const u = h;

  // Loop position in [0, 1). Every motion below is written against this, so
  // frame 0 and frame `durationInFrames` are identical by construction.
  const t = frame / durationInFrames;
  const tau = t * Math.PI * 2;

  // Integer turns per loop, constant angular velocity, no easing.
  const spin = (turns: number) => t * turns * 360;
  // Sway that leaves and returns to exactly its starting value.
  const sway = (amount: number, phase: number) => Math.sin(tau + phase) * amount;

  const frameProps = { w, h, u, theme };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.gradient[1] }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Background theme={theme} w={w} h={h} />

        {GEARS.map((def, i) => (
          <Gear
            key={i}
            def={def}
            id={`gear-${i}`}
            rotation={spin(def.turns)}
            {...frameProps}
          />
        ))}
        <MeshGear def={MESH_GEAR} rotation={spin(MESH_GEAR.turns)} {...frameProps} />

        <Wave def={WAVE} offset={sway(WAVE.drift * w, 0.7)} {...frameProps} />

        {RINGS.map((def, i) => (
          <Ring key={i} def={def} rotation={sway(def.swing, def.phase)} {...frameProps} />
        ))}

        {SWEEPS.map((def, i) => (
          <Sweep
            key={i}
            def={def}
            offset={sway(def.drift * w, def.phase)}
            {...frameProps}
          />
        ))}

        {DISCS.map((def, i) => (
          <Disc
            key={i}
            def={def}
            index={i}
            angle={
              def.laps
                ? def.angle + t * def.laps * 360
                : def.angle + sway(def.swing, def.phase)
            }
            {...frameProps}
          />
        ))}

        <TextLayer centreWord={centreWord} labels={labels} {...frameProps} />

        <Grain w={w} h={h} />
      </svg>
    </AbsoluteFill>
  );
};
