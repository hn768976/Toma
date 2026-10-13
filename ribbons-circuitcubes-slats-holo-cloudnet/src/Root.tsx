import React, { useEffect, useState } from "react";
import { Composition, useDelayRender } from "remotion";
import { Stage } from "./engine/Stage";
import { VERSIONS } from "./versions";

type Props = { versionId: string; loopTest: boolean };

const Look: React.FC<Props> = ({ versionId }) => {
  const v = VERSIONS.find((r) => r.id === versionId);
  if (!v) throw new Error(`Unknown version ${versionId}`);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  // Static data (e.g. the world map) is loaded once; frames wait for it.
  const [params, setParams] = useState<unknown>(v.load ? null : v.params);
  const [handle] = useState(() => (v.load ? delayRender(`Loading data for ${v.id}`) : null));
  useEffect(() => {
    if (!v.load || handle === null) return;
    v.load()
      .then((extra) => {
        setParams({ ...(v.params as object), ...extra });
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [v, handle, continueRender, cancelRender]);
  if (params === null) return null;
  return <Stage factory={v.factory} params={params} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Look}
        width={3840}
        height={2160}
        fps={30}
        durationInFrames={600}
        defaultProps={{ versionId: v.id, loopTest: false } as Props}
        // --props='{"loopTest":true}' renders 601 frames so frame 600 can be compared with frame 0.
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopTest ? 601 : 600 })}
      />
    ))}
  </>
);
