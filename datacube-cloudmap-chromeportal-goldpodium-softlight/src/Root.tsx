import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Composition, staticFile, useDelayRender } from "remotion";
import { ThreeLook } from "./lib/ThreeLook";
import { createChromePortal } from "./looks/chromePortal";
import { createCloudMap, LandGeoJSON } from "./looks/cloudMap";
import { createDataCube } from "./looks/dataCube";
import { createGoldPodium } from "./looks/goldPodium";
import { createSoftLight } from "./looks/softLight";
import { Version, VERSIONS } from "./versions";

type Props = { version: Version; extraFrames: number };


/** Natural Earth land, loaded once before the first frame. */
const CloudMapComp: React.FC<{ params: Extract<Version, { look: "cloudMap" }>["params"] }> = ({ params }) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading Natural Earth land"));
  const [geo, setGeo] = useState<LandGeoJSON | null>(null);
  useEffect(() => {
    fetch(staticFile("data/ne_110m_land.geojson"))
      .then((r) => r.json())
      .then((j: LandGeoJSON) => {
        setGeo(j);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle, continueRender, cancelRender]);
  const create = useMemo(() => (geo ? createCloudMap(params, geo) : null), [geo, params]);
  if (!create) return <AbsoluteFill style={{ backgroundColor: "black" }} />;
  return <ThreeLook create={create} />;
};

const LookComp: React.FC<Props> = ({ version }) => {
  if (version.look === "cloudMap") return <CloudMapComp params={version.params} />;
  return <SimpleLook version={version} />;
};

const SimpleLook: React.FC<{ version: Version }> = ({ version }) => {
  const create = useMemo(() => {
    switch (version.look) {
      case "softLight":
        return createSoftLight(version.params);
      case "dataCube":
        return createDataCube(version.params);
      case "chromePortal":
        return createChromePortal(version.params);
      case "goldPodium":
        return createGoldPodium(version.params);
      default:
        return createSoftLight({ edge: "#000000", glow: "#ff00ff", streak: "#ffffff" });
    }
  }, [version]);
  return <ThreeLook create={create} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookComp}
        width={3840}
        height={2160}
        fps={30}
        durationInFrames={v.frames}
        defaultProps={{ version: v, extraFrames: 0 } as Props}
        // Loop check: --props='{"extraFrames":1}' renders a 601st frame.
        calculateMetadata={({ props }) => ({ durationInFrames: v.frames + (props.extraFrames ?? 0) })}
      />
    ))}
  </>
);
