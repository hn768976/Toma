import "./load-fonts";
import React from "react";
import { Composition, Folder, Still } from "remotion";
import { DIRECTIONS, DURATION, FPS, HEIGHT, WIDTH } from "./constants";
import { compositionId, COUNTRIES } from "./countries";
import { FlagMarket } from "./FlagMarket";
import { FlagAlone, FlagSheet } from "./FlagSheet";

// 10 countries x Up/Down = 20 compositions, generated from the data rows.
// (Remotion ids may not contain "_", so ids are FlagMarket-<Country>-<Dir>;
// rendered files are named FlagMarket_<Country>_<Dir>.mp4.)
export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="FlagMarket">
      {COUNTRIES.flatMap((c) =>
        DIRECTIONS.map((d) => (
          <Composition
            key={compositionId(c.id, d)}
            id={compositionId(c.id, d)}
            component={FlagMarket}
            durationInFrames={DURATION}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
            defaultProps={{ countryId: c.id, direction: d }}
          />
        )),
      )}
    </Folder>
    <Folder name="Flags">
      <Still id="FlagContactSheet" component={FlagSheet} width={1280} height={720} />
      {COUNTRIES.map((c) => (
        <Still
          key={c.id}
          id={`Flag-${c.id}`}
          component={FlagAlone}
          width={1800}
          height={Math.round((1800 * c.flag.height) / c.flag.width)}
          defaultProps={{ countryId: c.id }}
        />
      ))}
    </Folder>
  </>
);
