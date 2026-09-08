import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useVideoConfig,
} from "remotion";
import {AccentCells} from "./components/AccentCells";
import {BackgroundPass} from "./components/BackgroundPass";
import {DotMapSurface} from "./components/DotMapSurface";
import {FocusPass} from "./components/FocusPass";
import {GrainPass} from "./components/GrainPass";
import {LightSource} from "./components/LightSource";
import {WaveField} from "./components/WaveField";
import {COMPOSITIONS} from "./lib/compositions";
import type {CountryTopology} from "./lib/map";
import {isPaletteName, type PaletteName} from "./lib/palettes";
import {buildStage} from "./lib/stage";

export type WaveMapProps = {
  /** Drives every random value in the piece. */
  seed: string;
  /** One of the six palettes. */
  palette: PaletteName;
  /** One of the twelve compositions, c01..c12. */
  composition: string;
};

/** Natural Earth 110m land polygons, fetched once from public/. */
const useTopology = () => {
  const [topo, setTopo] = useState<CountryTopology | null>(null);
  const [handle] = useState(() => delayRender("wave-map: load Natural Earth"));
  useEffect(() => {
    let alive = true;
    fetch(staticFile("ne-countries-110m.json"))
      .then((r) => r.json())
      .then((json: CountryTopology) => {
        if (alive) {
          setTopo(json);
          continueRender(handle);
        }
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [handle]);
  return topo;
};

/**
 * A single still: a dot map of the world laid over a rippling wave surface,
 * lit from one point, thrown out of focus everywhere but one band.
 *
 * The passes below run in the order they appear — React flushes sibling layout
 * effects in tree order — and all of them draw into the one canvas.
 */
export const WaveMap: React.FC<WaveMapProps> = ({
  seed,
  palette,
  composition,
}) => {
  const {width, height} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topo = useTopology();

  const comp = COMPOSITIONS[composition] ?? COMPOSITIONS.c01;
  const pal: PaletteName = isPaletteName(palette) ? palette : "blue";

  // The base dot set is generated once per composition.
  const stage = useMemo(
    () =>
      topo
        ? buildStage({topo, comp, palette: pal, seed, width, height})
        : null,
    [topo, comp, pal, seed, width, height],
  );

  const [paintHandle] = useState(() => delayRender("wave-map: paint"));
  useEffect(() => {
    if (stage) {
      continueRender(paintHandle);
    }
  }, [stage, paintHandle]);

  const passProps = stage ? {stage, canvasRef} : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: "100%", height: "100%", display: "block"}}
      />
      {passProps ? (
        <>
          <BackgroundPass {...passProps} />
          <WaveField {...passProps} />
          <AccentCells {...passProps} />
          <DotMapSurface {...passProps} />
          <LightSource {...passProps} />
          <FocusPass {...passProps} />
          <GrainPass {...passProps} />
        </>
      ) : null}
    </>
  );
};
