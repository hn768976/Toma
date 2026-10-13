import React, { useMemo } from "react";
import { PixiStage } from "../lib/PixiStage";
import { createLightStreams, LightStreamsProps } from "./lightStreams";

export const LightStreams: React.FC<LightStreamsProps> = ({ gradient, seed }) => {
  const create = useMemo(
    () => createLightStreams({ gradient, seed }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradient.join(","), seed],
  );
  return <PixiStage create={create} />;
};
