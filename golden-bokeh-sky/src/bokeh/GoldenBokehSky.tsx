import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { BOKEH_FRAGMENT_SHADER } from "./bokehShader";
import { craneRise, TILT_END, tiltUp } from "./camera";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const goldenBokehSkySchema = z.object({
  camera: z.enum(["tilt-up", "crane-rise"]),
  goldTop: z.number(),
  skyLight: rgb,
  skyMid: rgb,
  skyDeep: rgb,
  warmHi: rgb,
  warmMid: rgb,
  warmLow: rgb,
  haze: rgb,
});

export type GoldenBokehSkyProps = z.infer<typeof goldenBokehSkySchema>;

export const GoldenBokehSky: React.FC<GoldenBokehSkyProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const cam = props.camera === "tilt-up" ? tiltUp(t) : craneRise(t);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ShaderCanvas
        fragmentShader={BOKEH_FRAGMENT_SHADER}
        width={width}
        height={height}
        uniforms={{
          uTime: t,
          uCam: [cam.x, cam.y],
          uZoom: cam.zoom,
          uRoll: cam.roll,
          uParallax: cam.parallax,
          uGoldTop: props.goldTop,
          uSkyY0: TILT_END,
          uSkyLight: props.skyLight,
          uSkyMid: props.skyMid,
          uSkyDeep: props.skyDeep,
          uWarmHi: props.warmHi,
          uWarmMid: props.warmMid,
          uWarmLow: props.warmLow,
          uHaze: props.haze,
        }}
      />
    </AbsoluteFill>
  );
};
