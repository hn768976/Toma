import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {CONFIG, HEIGHT, WIDTH} from "./config";
import {BinaryLandFill} from "./components/BinaryLandFill";
import {ConnectionLayer} from "./components/ConnectionLayer";
import {ContourLayer} from "./components/ContourLayer";
import {OverlayLayer} from "./components/OverlayLayer";
import {StarField} from "./components/StarField";
import {FilmGrain} from "./lib/FilmGrain";
import {createMaskField} from "./lib/mask-field";
import {useLand} from "./lib/natural-earth";
import {createEquirectangular} from "./lib/projection";
import {Vignette} from "./lib/Vignette";
import {buildCallouts, buildLines, buildNodes} from "./scene/geometry";
import {getTheme, type Variant} from "./theme";

/**
 * A 4K binary world map: continents rendered as a field of ones and zeroes,
 * crossed by straight sightlines and annotated with invented technical
 * callouts, drifting slowly forward across fifteen seconds.
 *
 * This is a one-shot composition, not a loop: the push-in progresses for the
 * whole duration and frames 0 and 450 differ by design.
 *
 * Everything here is a pure function of `useCurrentFrame()` — no Date.now(),
 * no requestAnimationFrame, no component state driving motion — so
 * `npx remotion render` is deterministic across workers and re-runs.
 */
export const BinaryMap: React.FC<{variant?: Variant}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const theme = getTheme(variant);

  const land = useLand("land-110m.json", CONFIG.map.southLimit);

  const projection = useMemo(
    () =>
      createEquirectangular({
        width: WIDTH,
        height: HEIGHT,
        centerLon: CONFIG.map.centerLon,
        centerLat: CONFIG.map.centerLat,
        scale: CONFIG.map.scale,
      }),
    [],
  );

  // Rasterised once. Every one of the ~20k digit cells is tested against this,
  // and it doubles as the clip used to cut the glyphs at the coastline.
  const mask = useMemo(
    () =>
      land
        ? createMaskField(WIDTH, HEIGHT, (ctx) => {
            ctx.beginPath();
            projection.trace(ctx, land);
            ctx.fill();
          })
        : null,
    [land, projection],
  );

  const lines = useMemo(() => buildLines("sightline"), []);
  const nodes = useMemo(() => buildNodes("node", lines), [lines]);
  const callouts = useMemo(() => buildCallouts("callout", nodes), [nodes]);

  // The push-in. Nearly linear with a slight ease at both ends, anchored
  // off-centre so the framing shifts as well as tightens — it has to read as
  // drift, not as a zoom.
  const scale = interpolate(
    frame,
    [0, durationInFrames - 1],
    [CONFIG.pushIn.from, CONFIG.pushIn.to],
    {
      easing: Easing.bezier(0.32, 0.12, 0.68, 0.88),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{backgroundColor: theme.background, overflow: "hidden"}}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: `${CONFIG.pushIn.originX * 100}% ${CONFIG.pushIn.originY * 100}%`,
        }}
      >
        <StarField theme={theme} />
        <ContourLayer theme={theme} />
        {land && mask ? (
          <BinaryLandFill theme={theme} land={land} projection={projection} mask={mask} />
        ) : null}
        <ConnectionLayer theme={theme} lines={lines} />
        <OverlayLayer theme={theme} nodes={nodes} callouts={callouts} />
      </AbsoluteFill>

      <Vignette strength={CONFIG.finish.vignette} color={theme.background} />
      <FilmGrain
        frame={frame}
        alpha={CONFIG.finish.grainAlpha}
        tileSize={CONFIG.finish.grainTile}
        variants={CONFIG.finish.grainVariants}
        scale={CONFIG.finish.grainScale}
      />
    </AbsoluteFill>
  );
};
