import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { useSvgImage } from "../lib/useSvgImage";
import { CoreGlow } from "./CoreGlow";
import { Figure } from "./Figure";
import { Finish } from "./Finish";
import { HorizonLine } from "./HorizonLine";
import { computeLayout, HEIGHT, WIDTH } from "./layout";
import { RadiantBurst } from "./RadiantBurst";
import { SparkField } from "./SparkField";
import { VariantName, VARIANTS } from "./variants";

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
        config={config}
        layout={layout}
        frame={frame}
        seed={seed}
      />
      <SparkField config={config} layout={layout} frame={frame} seed={seed} />
      <Figure config={config} layout={layout} frame={frame} image={image} />
      <HorizonLine
        config={config}
        layout={layout}
        frame={frame}
        image={image}
        seed={seed}
      />
      <Finish layout={layout} frame={frame} />
    </AbsoluteFill>
  );
};
