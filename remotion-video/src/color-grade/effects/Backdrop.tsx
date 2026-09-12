import React from "react";
import { gradedSwatch } from "../panels/PreviewMonitor";
import { fbm } from "../noise";
import type { Grade } from "../grade";
import type { Camera } from "../optics";

// A second surface, well behind the UI plane.
//
// This exists because of a hard limit in the reference: the violently
// out-of-focus, colour-saturated area in the corner cannot come from the
// same plane as the sharp panels. One flat plane only spans so much
// depth, and forcing enough defocus out of it would take the panels with
// it. In the real shot that bokeh is a *different object* — the grading
// monitor sitting behind the control surface — so it is modelled as one
// here: its own plane, its own distance, its own fixed blur.
export const Backdrop: React.FC<{
  camera: Camera;
  grade: Grade;
  frame: number;
  /** Mirrors the layout: "a" puts the monitor upper-left. */
  variant: "a" | "b";
}> = ({ camera, grade, frame, variant }) => {
  const flip = variant === "a" ? 1 : -1;
  const drift = fbm(frame * 0.008, 13, 3) - 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 3600,
        height: 2200,
        marginLeft: -1800,
        marginTop: -1100,
        transform: [
          `translate3d(${flip * -620 + drift * 14}px, ${-360 + drift * 10}px, ${-1180}px)`,
          `rotateZ(${camera.rotateZ * 0.72}deg)`,
          `rotateY(${camera.rotateY * 0.85}deg)`,
          `rotateX(${camera.rotateX * 0.7}deg)`,
        ].join(" "),
        filter: "blur(26px) saturate(1.25)",
        background: "#04070c",
      }}
    >
      {/* The graded shot itself, playing on the monitor behind. Because
          it is the same gradedSwatch the panels use, this whole corner
          shifts colour when the wheels move — a big, soft, unmissable
          confirmation that the controls are doing something. */}
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 250,
          width: 2100,
          height: 1180,
          background: gradedSwatch(grade, frame, 1, true),
          filter: "brightness(1.55) saturate(1.3)",
        }}
      />
      {/* Rim light down the far edge of the bezel. */}
      <div
        style={{
          position: "absolute",
          left: 250,
          top: 190,
          width: 2240,
          height: 1300,
          border: "10px solid rgba(120,150,180,0.16)",
          borderRadius: 12,
        }}
      />
      {/* Room practicals, well out of focus. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 12% 84%, rgba(255,150,70,0.34), rgba(255,150,70,0) 26%)," +
            "radial-gradient(circle at 88% 18%, rgba(70,190,255,0.24), rgba(70,190,255,0) 30%)," +
            "radial-gradient(circle at 62% 92%, rgba(90,255,180,0.16), rgba(90,255,180,0) 24%)",
        }}
      />
    </div>
  );
};
