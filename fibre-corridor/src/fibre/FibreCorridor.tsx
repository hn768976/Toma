import React, { useCallback, useMemo, useState } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { HEIGHT, LOOP, WIDTH } from "./constants";
import { buildStrands, laneDensity } from "./geometry";
import { TAU } from "../lib";
import { VARIANTS, type VariantName } from "./variants";
import type { Ctx } from "../lib";
import type { Scene } from "./scene";
import { BackgroundWash } from "./BackgroundWash";
import { FloorSheen } from "./FloorSheen";
import { HorizonGlow } from "./HorizonGlow";
import { BokehLayer } from "./BokehLayer";
import { StrandField } from "./StrandField";
import { RingPulses } from "./RingPulses";
import { PostFx } from "./PostFx";

/** Ambient camera drift: +-8px on a closed Lissajous path. */
const CAM_AMP = 8;

export type FibreCorridorProps = {
  variant: VariantName;
};

/**
 * The corridor. Every version of the piece is this component with a different
 * entry from VARIANTS — the palette, the signed bend direction, the horizon
 * height, the strand density, the packet behaviour and the floor treatment
 * all come from that object and nothing else.
 *
 * Every value below is a pure function of useCurrentFrame(), so a render is
 * deterministic and frame 0 and frame 375 are identical.
 */
export const FibreCorridor: React.FC<FibreCorridorProps> = ({
  variant: variantName,
}) => {
  const frame = useCurrentFrame();
  const variant = VARIANTS[variantName];

  // Geometry is generated once, seeded, and never regenerated. Only the
  // undulation offset is applied per frame.
  const strands = useMemo(() => buildStrands(variant), [variant]);
  const density = useMemo(() => laneDensity(strands, 64), [strands]);

  const [ctx, setCtx] = useState<Ctx | null>(null);
  const attach = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return;
    el.width = WIDTH;
    el.height = HEIGHT;
    setCtx(el.getContext("2d", { alpha: false }));
  }, []);

  const p = (((frame % LOOP) + LOOP) % LOOP) / LOOP;
  const vpx = WIDTH / 2;
  const vpy = HEIGHT * variant.horizonY;

  const scene: Scene | null = ctx
    ? {
        main: ctx,
        variant,
        frame,
        p,
        camX: CAM_AMP * Math.sin(TAU * p),
        camY: CAM_AMP * Math.sin(TAU * 2 * p),
        vpx,
        vpy,
        nearEdgeY: variant.bendDir > 0 ? HEIGHT : 0,
        spread: WIDTH * variant.laneSpread,
        strands,
        density,
      }
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: variant.palette.bgDeep }}>
      <canvas
        ref={attach}
        style={{ width: WIDTH, height: HEIGHT, display: "block" }}
      />
      {scene ? (
        <>
          <BackgroundWash scene={scene} />
          <FloorSheen scene={scene} />
          <HorizonGlow scene={scene} />
          <BokehLayer scene={scene} front={false} />
          <StrandField scene={scene} />
          <RingPulses scene={scene} />
          <BokehLayer scene={scene} front />
          <PostFx scene={scene} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
