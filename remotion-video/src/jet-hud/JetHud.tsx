import React, { useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { BackgroundGrid } from "./BackgroundGrid";
import { DataStrip } from "./DataStrip";
import { FlightPath } from "./FlightPath";
import { JetShape } from "./JetShape";
import { PlaneMarks } from "./PlaneMarks";
import { PostFx } from "./PostFx";
import { SidePanel } from "./SidePanel";
import { TiltedPlane } from "../lib/TiltedPlane";
import { GLOW_SCALE, useSurfaces } from "./surfaces";
import { asHudPlane, planeConfig } from "./hud-plane";
import { HEIGHT, WIDTH } from "./constants";
import { buildLayout } from "./hud-layout";
import { VARIANTS, type VariantName } from "./variants";
import "./fonts";

/**
 * A jet on a tilted HUD.
 *
 * Everything is drawn into one 3840x2160 canvas. Each layer is a component
 * that paints in a layout effect, and React's effect ordering — children
 * before parents, siblings in order — IS the compositing order:
 *
 *   BackgroundGrid  clears every surface, lays the background and the grid
 *   DataStrip x2    top and bottom readout strips
 *   SidePanel xN    the panel banks
 *   PlaneMarks      the centre reticle, crosshairs, brackets, dashed rules
 *   TiltedPlane     composites the three depth-of-field bands
 *   FlightPath      contrail, exhaust bloom, then the aircraft
 *   PostFx          bloom, vignette, scanlines, grain
 *
 * The aircraft is a LATER SIBLING of <TiltedPlane>, not a child: it flies in
 * front of the plane, frontally and untilted, and is the one layer exempt
 * from depth of field. That separation is the whole point of the piece.
 *
 * Nothing reads a clock, holds state or schedules a frame: every pixel is a
 * pure function of useCurrentFrame(), so `npx remotion render` is
 * deterministic across workers and frames can be produced out of order.
 */
export const JetHud: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const v = VARIANTS[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaces = useSurfaces();
  const layout = useMemo(() => buildLayout(v), [v]);
  const config = useMemo(() => planeConfig(v, frame), [v, frame]);
  const extra = useMemo(
    () => ({ glow: { canvas: surfaces.glow, scale: GLOW_SCALE } }),
    [surfaces],
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: v.palette.bgDeep,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <TiltedPlane
        config={config}
        buffers={surfaces.dof}
        extra={extra}
        target={canvasRef}
      >
        {(raw) => {
          const plane = asHudPlane(raw, v, frame);
          return (
            <>
              <BackgroundGrid
                plane={plane}
                surfaces={surfaces}
                target={canvasRef}
              />
              {layout.strips.map((s) => (
                <DataStrip
                  key={s.seed}
                  plane={plane}
                  frame={frame}
                  y={s.y}
                  height={s.height}
                  seed={s.seed}
                  rows={s.rows}
                />
              ))}
              {layout.panels.map((p, i) => (
                <SidePanel
                  key={p.seed}
                  plane={plane}
                  frame={frame}
                  index={i}
                  count={layout.panels.length}
                  x={p.u}
                  y={p.v}
                  w={p.w}
                  h={p.h}
                  kind={p.kind}
                  seed={p.seed}
                  accent={p.accent}
                />
              ))}
              <PlaneMarks plane={plane} frame={frame} seed="marks" />
            </>
          );
        }}
      </TiltedPlane>
      <JetShape variant={v}>
        {(sprite) => (
          <FlightPath
            variant={v}
            frame={frame}
            sprite={sprite}
            target={canvasRef}
            glow={surfaces.glow}
          />
        )}
      </JetShape>
      <PostFx
        variant={v}
        frame={frame}
        surfaces={surfaces}
        target={canvasRef}
      />
    </div>
  );
};
