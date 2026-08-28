import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BackgroundWash } from "./BackgroundWash";
import { Compositor } from "./Compositor";
import { DotBlock } from "./DotBlock";
import { SecurityIcon } from "./SecurityIcon";
import { TilePlane } from "./TilePlane";
import { computeFrameState, createEnv } from "./env";
import { CANVAS_H, CANVAS_W } from "./plane";
import { VARIANT, VARIANT_KEY } from "./variants";

/**
 * A 4K field of security icons on one tilted, faked-perspective plane.
 * Everything is drawn to a canvas once per React render; every frame is a
 * pure function of useCurrentFrame(), and the 450-frame loop is seamless.
 *
 * Draw order = child order: BackgroundWash begins the frame, the content
 * components paint into the three depth buffers, and Compositor (last)
 * blurs and assembles them onto the visible canvas.
 */
export const IconField: React.FC = () => {
  const frame = useCurrentFrame();
  const cfg = VARIANT;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const env = useMemo(() => createEnv(VARIANT_KEY, cfg), [cfg]);
  const fs = useMemo(
    () => computeFrameState(cfg, env.layout, frame),
    [cfg, env, frame],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: cfg.palette.bgDeep }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <BackgroundWash env={env} fs={fs} canvasRef={canvasRef} />
      <TilePlane env={env} fs={fs} />
      {env.layout.icons.map((spec, i) => (
        <SecurityIcon
          key={`icon-${i}`}
          env={env}
          fs={fs}
          spec={spec}
          index={i}
          name={spec.name}
          state={cfg.iconState}
        />
      ))}
      {env.layout.dotBlocks.map((spec) => (
        <DotBlock key={`dots-${spec.id}`} env={env} fs={fs} spec={spec} />
      ))}
      <Compositor env={env} fs={fs} canvasRef={canvasRef} />
    </AbsoluteFill>
  );
};
