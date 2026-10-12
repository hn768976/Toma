import React, { useMemo } from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { makeBladeRing } from "./blade/bladeRing";
import { ChargeIcon } from "./chargeicon/ChargeIcon";
import { ChargeGauge } from "./gauge/ChargeGauge";
import { makePlateArc } from "./plate/plateArc";
import { makeSegmentTorus } from "./torus/segmentTorus";
import { ThreeLook } from "./three/ThreeLook";
import { VERSIONS, VersionRow } from "./versions";

// `tune` lets a render override look parameters (used while matching the
// references); normal renders leave it empty.
type Props = { row: VersionRow; loopCheck?: boolean; tune?: Record<string, number> };

const Look: React.FC<Props> = ({ row, tune }) => {
  const tuneKey = JSON.stringify(tune ?? {});
  const factory = useMemo(() => {
    switch (row.look) {
      case "bladeRing":
        return makeBladeRing(row, JSON.parse(tuneKey));
      case "plateArc":
        return makePlateArc(row, JSON.parse(tuneKey));
      case "segmentTorus":
        return makeSegmentTorus(row, JSON.parse(tuneKey));
      default:
        return null;
    }
  }, [row, tuneKey]);
  if (factory) return <ThreeLook factory={factory} />;
  if (row.look === "chargeIcon") return <ChargeIcon row={row} />;
  if (row.look === "chargeGauge") return <ChargeGauge row={row} />;
  return null;
};

// `--props='{"loopCheck":true}'` adds one frame to a loop so frame 600 can be
// rendered and compared with frame 0.
const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const base = props.row.look === "chargeGauge" ? 300 : 600;
  return { durationInFrames: props.loopCheck && base === 600 ? 601 : base };
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={Look}
        width={3840}
        height={2160}
        fps={30}
        durationInFrames={row.look === "chargeGauge" ? 300 : 600}
        defaultProps={{ row, loopCheck: false }}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
