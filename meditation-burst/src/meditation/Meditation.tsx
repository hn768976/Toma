import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { RadiantBurst } from "../lib/RadiantBurst";
import { SparkField } from "../lib/SparkField";
import { useSvgImage } from "../lib/useSvgImage";
import { CoreGlow } from "./CoreGlow";
import { Figure } from "./Figure";
import { Finish } from "./Finish";
import { HorizonLine } from "./HorizonLine";
import { layerStyle } from "./layers";
import { cameraDrift, computeLayout, HEIGHT, LOOP, WIDTH } from "./layout";
import { angularWeight, VariantName, VARIANTS } from "./variants";

/**
 * A 20-second seamless loop: a seated figure in silhouette against a
 * dense field of radiating (or converging) filaments.
 *
 * Everything is a pure function of `useCurrentFrame()`. There is no
 * `Date.now()`, no `requestAnimationFrame`, no CSS animation and no
 * component state that changes over time, so `npx remotion render`
 * produces the same bytes however the frames are distributed across
 * worker processes.
 *
 * The layers stack back to front: core glow, filament field, sparks,
 * then the silhouettes that occlude them, then the lens treatment.
 */
export const Meditation: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const config = VARIANTS[variant];
  // Geometry is defined against the 4K backing store regardless of the
  // resolution the frames are captured at, so a --scale preview and a
  // full-size render are the same picture.
  const layout = useMemo(() => computeLayout(config, WIDTH, HEIGHT), [config]);
  const image = useSvgImage(staticFile("lotus.svg"));
  const seed = `meditation:${variant}`;
  const drift = cameraDrift(frame);

  // Memoised together so <RadiantBurst> and <SparkField> see stable
  // object and function identities: both rebuild their whole field when
  // any of these change, and a fresh literal every frame would rebuild
  // hundreds of recursive curves 30 times a second.
  const field = useMemo(
    () => ({
      angularWeight: (phi: number) => angularWeight(config.angular, phi),
      colors: {
        core: config.palette.coreWhite,
        inner: config.palette.coreMid,
        mid: config.palette.filamentMid,
        outer: config.palette.filamentDeep,
      },
      reach: config.reach,
    }),
    [config],
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.palette.backgroundDeep,
        // Confine the layers' blend modes to this subtree so they
        // composite against the background colour and nothing else.
        isolation: "isolate",
      }}
    >
      <CoreGlow config={config} layout={layout} frame={frame} />
      <RadiantBurst
        width={layout.width}
        height={layout.height}
        originX={layout.originX}
        originY={layout.originY}
        frame={frame}
        loopLength={LOOP}
        seed={seed}
        colors={field.colors}
        direction={config.burstDirection}
        count={config.filamentCount}
        filamentWidth={config.filamentWidth}
        opacity={config.filamentOpacity}
        reach={field.reach}
        angularWeight={field.angularWeight}
        offset={drift}
        style={layerStyle("screen")}
      />
      <SparkField
        width={layout.width}
        height={layout.height}
        originX={layout.originX}
        originY={layout.originY}
        frame={frame}
        seed={seed}
        color={config.palette.sparkPale}
        count={config.sparkCount}
        direction={config.burstDirection}
        angularWeight={field.angularWeight}
        offset={drift}
        style={layerStyle("screen")}
      />
      <Figure config={config} layout={layout} frame={frame} image={image} />
      <HorizonLine
        config={config}
        layout={layout}
        frame={frame}
        image={image}
        seed={seed}
      />
      <Finish config={config} layout={layout} frame={frame} />
    </AbsoluteFill>
  );
};
