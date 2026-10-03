import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { AICube } from "./aicube/AICube";
import { RisingArrows } from "./arrows/RisingArrows";
import { CloudHUD } from "./cloudhud/CloudHUD";
import { DataCenter } from "./datacenter/DataCenter";
import { PadlockGrid } from "./padlock/PadlockGrid";
import { loadCssFonts } from "./lib/assets";
import { VERSIONS, type VersionRow } from "./versions";

loadCssFonts();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOOKS: Record<VersionRow["look"], React.FC<any> | null> = {
  datacenter: DataCenter,
  arrows: RisingArrows,
  padlock: PadlockGrid,
  cloudhud: CloudHUD,
  aicube: AICube,
};

/** `--props='{"loopCheck":true}'` adds one frame to a loop for the seam test. */
const loopMetadata =
  (row: VersionRow): CalculateMetadataFunction<Record<string, unknown>> =>
  ({ props }) => ({
    durationInFrames:
      row.loop && props.loopCheck ? row.durationInFrames + 1 : row.durationInFrames,
  });

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => {
      const Comp = LOOKS[row.look];
      if (!Comp) return null;
      return (
        <Composition
          key={row.id}
          id={row.id}
          component={Comp}
          durationInFrames={row.durationInFrames}
          fps={30}
          width={3840}
          height={2160}
          defaultProps={row.props as Record<string, unknown>}
          calculateMetadata={loopMetadata(row)}
        />
      );
    })}
  </>
);
