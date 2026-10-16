import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { AssetGate } from "./lib/assets";
import { HazardGlitch } from "./hazard/HazardGlitch";
import { BrainBoard } from "./brain/BrainBoard";
import { PhoneHologram } from "./phone/PhoneHologram";
import { MapPanels } from "./map/MapPanels";
import { HUDFlythrough } from "./hud/HUDFlythrough";
import { Version, VERSIONS } from "./versions";

type Props = { id: string; loopCheck?: boolean };

const FPS = 30;
// Remotion composition ids may not contain "_": HazardGlitch_Radiation -> HazardGlitch-Radiation.
export const compositionId = (id: string) => id.replace(/_/g, "-");
const lengthOf = (v: Version) => (v.look === "phone" ? 300 : 600);

const Look: React.FC<Props> = ({ id }) => {
  const v = VERSIONS.find((x) => x.id === id)!;
  let body: React.ReactNode = null;
  switch (v.look) {
    case "hazard":
      body = <HazardGlitch v={v} />;
      break;
    case "brain":
      body = <BrainBoard v={v} />;
      break;
    case "phone":
      body = <PhoneHologram v={v} />;
      break;
    case "map":
      body = <MapPanels v={v} />;
      break;
    case "hud":
      body = <HUDFlythrough v={v} />;
      break;
  }
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "black" }}>
      <AssetGate needLand={v.look === "map"}>{body}</AssetGate>
    </div>
  );
};

// --props='{"loopCheck":true}' makes a loop 601 frames long so frame 600 can be
// rendered and compared with frame 0 (loop-seam check). Visuals never read it.
const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const v = VERSIONS.find((x) => x.id === props.id)!;
  const len = lengthOf(v);
  return { durationInFrames: props.loopCheck && v.look !== "phone" ? len + 1 : len };
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={compositionId(v.id)}
        component={Look}
        width={3840}
        height={2160}
        fps={FPS}
        durationInFrames={lengthOf(v)}
        defaultProps={{ id: v.id, loopCheck: false }}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
