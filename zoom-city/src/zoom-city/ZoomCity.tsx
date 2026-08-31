/**
 * Zoom-blur city.
 *
 * One component, three versions — the differences all live in VARIANTS. The
 * layers are stacked canvases; JSX order is also the order their draw effects
 * run, so the field is always on the buffer before the reflection and the
 * bloom read it back. z-index puts them on screen in the intended order.
 */

import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BackgroundWash } from "./components/BackgroundWash";
import { BloomPass } from "./components/BloomPass";
import { BurstLayer } from "./components/BurstLayer";
import { CoreFlare } from "./components/CoreFlare";
import { FilmFinish } from "./components/FilmFinish";
import { FloorReflection } from "./components/FloorReflection";
import { StreakField } from "./components/StreakField";
import { HEIGHT, sceneAt, WIDTH } from "./geometry";
import { hexToRgb, rgba } from "./colour";
import { DEFAULT_VARIANT, VARIANTS, type VariantName } from "./variants";

export type ZoomCityProps = {
  variant: VariantName;
};

export const ZoomCity: React.FC<ZoomCityProps> = ({ variant: variantName }) => {
  const frame = useCurrentFrame();
  const variant = VARIANTS[variantName] ?? VARIANTS[DEFAULT_VARIANT];
  const scene = useMemo(() => sceneAt(variant, frame), [variant, frame]);

  // The field canvas doubles as the buffer the floor and the bloom reuse.
  const fieldRef = useRef<HTMLCanvasElement | null>(null);
  const hasFloor = variant.floor.mode !== "none";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: rgba(hexToRgb(variant.palette.backgroundDeep), 1),
        width: WIDTH,
        height: HEIGHT,
        overflow: "hidden",
      }}
    >
      <BackgroundWash variant={variant} scene={scene} z={1} />
      {/*
        Drawn (and buffered) before the layers that read it back, but sits
        above the floor on screen.
      */}
      <StreakField
        variant={variant}
        scene={scene}
        z={3}
        bufferRef={fieldRef}
        clipBelow={hasFloor ? scene.horizonY : undefined}
      />
      {hasFloor ? (
        <FloorReflection
          variant={variant}
          scene={scene}
          z={2}
          sourceRef={fieldRef}
        />
      ) : null}
      <BloomPass z={4} sourceRef={fieldRef} strength={hasFloor ? 0.55 : 0.7} />
      <BurstLayer
        variant={variant}
        scene={scene}
        z={5}
        clipBelow={hasFloor ? scene.horizonY : undefined}
      />
      <CoreFlare variant={variant} scene={scene} z={6} />
      <FilmFinish scene={scene} z={7} />
    </AbsoluteFill>
  );
};
