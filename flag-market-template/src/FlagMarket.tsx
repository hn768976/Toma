import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Direction, FADE_IN_END, PRESETS } from "./constants";
import { COUNTRIES } from "./countries";
import { Arrows } from "./scene/Arrows";
import { FlagBackground, flagLayout, useCamera, Vignette } from "./scene/FlagBackground";
import { Grain } from "./scene/Grain";
import { LineChart } from "./scene/LineChart";
import { SCENE_DATA } from "./scene/scene-data";
import { Tickers } from "./scene/Tickers";

export type FlagMarketProps = {
  countryId: string;
  direction: Direction;
  /** debug only: layer names to hide (flag, ripple, tickers, vignette, arrows, line, grain) */
  hide?: string[];
};

export const FlagMarket: React.FC<FlagMarketProps> = ({ countryId, direction, hide = [] }) => {
  const frame = useCurrentFrame();
  const country = COUNTRIES.find((c) => c.id === countryId);
  if (!country) throw new Error(`Unknown country ${countryId}`);
  const data = SCENE_DATA[`${country.id}-${direction}`];
  const preset = PRESETS[direction];
  // anchor only depends on the row, so a dummy frame size is fine here
  const camera = useCamera(flagLayout(country, 16, 9).anchor);
  const fadeIn = interpolate(frame, [0, FADE_IN_END], [0, 1], { extrapolateRight: "clamp" });
  const uid = `${country.id}${direction}`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <AbsoluteFill style={camera}>
          {hide.includes("flag") ? null : <FlagBackground country={country} dim={preset.flagDim} hide={hide} />}
          {hide.includes("tickers") ? null : <Tickers rows={data.rows} color={preset.ticker} />}
        </AbsoluteFill>
        {hide.includes("vignette") ? null : <Vignette />}
      </AbsoluteFill>
      {hide.includes("arrows") ? null : <Arrows arrows={data.arrows} dir={direction} uid={uid} />}
      {hide.includes("line") ? null : <LineChart data={data} dir={direction} uid={uid} />}
      {hide.includes("grain") ? null : <Grain />}
    </AbsoluteFill>
  );
};
