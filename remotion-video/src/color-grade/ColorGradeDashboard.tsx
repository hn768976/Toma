import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { cameraFor, type Variant } from "./camera";
import { evaluateScript } from "./cursor";
import { gradeFromControls } from "./grade";
import { Stage } from "./Stage";
import { LayoutA, SCRIPT_A } from "./LayoutA";
import { LayoutB, SCRIPT_B } from "./LayoutB";
import { ScreenSurface } from "./effects/ScreenSurface";
import { FilmLook } from "./effects/FilmLook";
import { Backdrop } from "./effects/Backdrop";

export const colorGradeSchema = z.object({
  /** "a" = reference framing, "b" = mirrored node-first rig. */
  variant: z.enum(["a", "b"]),
  /**
   * 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width and
   * height the Composition is registered with in Root.tsx — the whole
   * scene is authored at 1x and scaled, so this is the only knob.
   */
  resolutionScale: z.number().positive(),
});

export type ColorGradeProps = z.infer<typeof colorGradeSchema>;

export const colorGradeDefaults: ColorGradeProps = {
  variant: "a",
  resolutionScale: 1,
};

// Macro shot of a colour-grading suite.
//
// Assembly order matters and mirrors a real shot: the UI plane first,
// then the physical surface of the display over it (pixel grid, glass
// sheen) still inside the 3D transform, then the lens/film response in
// screen space on top. Anything that belongs to the monitor goes inside
// the plane; anything that belongs to the camera goes outside it.
export const ColorGradeDashboard: React.FC<ColorGradeProps> = ({
  variant,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const camera = cameraFor(variant as Variant, frame);
  const script = variant === "a" ? SCRIPT_A : SCRIPT_B;
  const cursor = evaluateScript(script, frame);
  const grade = gradeFromControls(cursor.controls);

  return (
    <AbsoluteFill style={{ background: "#02040a" }}>
      <Stage
        camera={camera}
        resolutionScale={resolutionScale}
        backdrop={
          <Backdrop camera={camera} grade={grade} frame={frame} variant={variant} />
        }
      >
        {variant === "a" ? (
          <LayoutA camera={camera} frame={frame} cursor={cursor} grade={grade} />
        ) : (
          <LayoutB camera={camera} frame={frame} cursor={cursor} grade={grade} />
        )}
        <ScreenSurface camera={camera} />
      </Stage>
      <FilmLook
        frame={frame}
        vignette={variant === "a" ? 1 : 0.9}
        grain={0.11}
        corner={variant === "a" ? "bottom-left" : "bottom-right"}
      />
    </AbsoluteFill>
  );
};
