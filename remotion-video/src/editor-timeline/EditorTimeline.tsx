import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  SPAN_SECONDS,
  UI_HEIGHT,
  UI_WIDTH,
  VIGNETTE,
} from "./constants";
import {
  CAMERA_A,
  CAMERA_B,
  DOF_A,
  DOF_B,
  cameraTransform,
  dofMask,
} from "./camera";
import { Screen } from "./Screen";
import { Cursor } from "./Cursor";
import {
  clickPulse,
  cursorAt,
  evaluateTimeline,
  sampleKeys,
} from "./model";
import { SCRIPT_A } from "./script-a";
import { SCRIPT_B } from "./script-b";
import { noise1d, seeded } from "./random";

export const editorTimelineSchema = z.object({
  /** "a" mirrors the reference framing; "b" re-stages it from the far side. */
  variant: z.enum(["a", "b"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width and
  // height the Composition is registered with in Root.tsx: every length
  // in the scene is a 1x value multiplied by this, so the two
  // resolutions are the same projection at different raster densities.
  resolutionScale: z.number().positive(),
});

export type EditorTimelineProps = z.infer<typeof editorTimelineSchema>;

export const editorTimelineDefaults: EditorTimelineProps = {
  variant: "a",
  resolutionScale: 1,
};

/** Soft out-of-focus discs over the near end of the shot. */
const Bokeh: React.FC<{ scale: number; frame: number; flip: boolean }> = ({
  scale,
  frame,
  flip,
}) => {
  const discs = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        x: seeded(i, 11) * 0.15 + 0.004,
        y: seeded(i, 23) * 1.04 - 0.03,
        r: 14 + seeded(i, 37) * 34,
        warm: seeded(i, 53) > 0.68,
        alpha: 0.07 + seeded(i, 71) * 0.2,
        phase: seeded(i, 97) * 100,
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      {discs.map((d, i) => {
        const breathe = noise1d(frame / 55 + d.phase, i + 3) - 0.5;
        const x = flip ? 1 - d.x : d.x;
        const tint = d.warm
          ? "rgba(255, 198, 126, ALPHA)"
          : "rgba(176, 228, 252, ALPHA)";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (x + breathe * 0.004) * BASE_WIDTH * scale - d.r * scale,
              top: (d.y + breathe * 0.006) * BASE_HEIGHT * scale - d.r * scale,
              width: d.r * 2 * scale,
              height: d.r * 2 * scale,
              borderRadius: "50%",
              // A real defocused highlight is a disc with a slightly
              // brighter rim, not a Gaussian blob - the falloff below
              // holds near-flat to 62% then drops.
              background: `radial-gradient(circle, ${tint.replace(
                "ALPHA",
                String(d.alpha),
              )} 0%, ${tint.replace("ALPHA", String(d.alpha))} 58%, ${tint.replace(
                "ALPHA",
                String(d.alpha * 1.5),
              )} 76%, ${tint.replace("ALPHA", "0")} 100%)`,
              filter: `blur(${6 * scale}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const EditorTimeline: React.FC<EditorTimelineProps> = ({
  variant,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const script = variant === "a" ? SCRIPT_A : SCRIPT_B;
  const camera = variant === "a" ? CAMERA_A : CAMERA_B;
  const dof = variant === "a" ? DOF_A : DOF_B;
  const flip = variant === "b";
  const s = resolutionScale;

  const state = useMemo(
    () => evaluateTimeline(script, frame),
    [script, frame],
  );
  const scroll = sampleKeys(script.scroll, frame);
  const playheadSeconds = sampleKeys(script.playhead, frame);
  const pointer = cursorAt(script.cursor, frame);
  const click = clickPulse(script.clicks, frame);

  // Cut positions feeding the audio beds, so razoring the video track
  // visibly slices the waveform underneath it the way a linked edit does.
  const cuts = useMemo(
    () =>
      state.clips
        .filter((c) => c.track === script.tracks[1].id)
        .map((c) => c.start)
        .sort((a, b) => a - b),
    [state.clips, script.tracks],
  );

  // Handheld breathing. Tiny - the reference is tripod-locked - but a
  // dead-still frame reads as CG immediately.
  const driftX = (noise1d(frame / 47, 1) - 0.5) * camera.driftPx * 2;
  const driftY = (noise1d(frame / 61, 2) - 0.5) * camera.driftPx * 2;
  const driftR = (noise1d(frame / 83, 3) - 0.5) * camera.driftDeg * 2;

  const audioTracks = useMemo(
    () =>
      script.tracks
        .filter((t) => t.kind === "audio")
        .map((track, i) => ({
          track,
          seed: script.seed + i * 13,
          // The lead music bed is the loud one; the beds under it are
          // stems and FX, progressively quieter and differently seeded.
          amplitudeScale: [1, 0.62, 0.84, 0.44, 0.72][i % 5],
          waveFraction: [0.3, 0.58, 0.68, 0.7, 0.6][i % 5],
          cuts: i === 0 ? cuts : [],
        })),
    [script.tracks, script.seed, cuts],
  );

  const stage = (
    <AbsoluteFill
      style={{
        perspective: camera.perspective * s,
        perspectiveOrigin: `${camera.originX * 100}% ${camera.originY * 100}%`,
      }}
    >
      {/* Zero-size anchor: the camera's focus point lands exactly here,
          and every rotation pivots about it. */}
      <div
        style={{
          position: "absolute",
          left: (camera.frameX * BASE_WIDTH + driftX) * s,
          top: (camera.frameY * BASE_HEIGHT + driftY) * s,
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: UI_WIDTH,
            height: UI_HEIGHT,
            transformOrigin: "0px 0px",
            transform: cameraTransform(
              { ...camera, roll: camera.roll + driftR },
              s,
            ),
            backfaceVisibility: "hidden",
          }}
        >
          <Screen
            tracks={script.tracks}
            clips={state.clips}
            audioTracks={audioTracks}
            scroll={scroll}
            playheadSeconds={playheadSeconds}
            hotRange={state.hotRange}
            tooltip={state.tooltip}
            marquee={state.marquee}
            rubberBand={script.rubberBand}
            spanSeconds={SPAN_SECONDS}
          />
          <Cursor x={pointer.x} y={pointer.y} tool={pointer.tool} click={click} />
          {/* LCD subpixel structure. Inside the plane so it takes the
              same perspective and the same defocus as the UI - only the
              in-focus band ever resolves it, exactly like the real shot. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: UI_WIDTH,
              height: UI_HEIGHT,
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,40,40,0.07) 0 1px, rgba(40,255,60,0.07) 1px 2px, rgba(50,60,255,0.07) 2px 3px), repeating-linear-gradient(0deg, rgba(0,0,0,0.11) 0 2.4px, rgba(0,0,0,0) 2.4px 3px)",
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#010306", overflow: "hidden" }}>
      {dof.map((layer, i) => (
        <AbsoluteFill
          key={i}
          style={{
            filter: layer.blur > 0 ? `blur(${layer.blur * s}px)` : undefined,
            maskImage: dofMask(layer, flip),
            WebkitMaskImage: dofMask(layer, flip),
          }}
        >
          {stage}
        </AbsoluteFill>
      ))}

      <Bokeh scale={s} frame={frame} flip={flip} />

      {/* Lens vignette + a faint veiling glare off the panel glass. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 110% at ${
            flip ? 62 : 38
          }% 46%, rgba(0,0,0,0) 38%, ${VIGNETTE} 100%)`,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${
            flip ? 118 : 62
          }deg, rgba(120, 190, 225, 0.05) 0%, rgba(120, 190, 225, 0) 42%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
