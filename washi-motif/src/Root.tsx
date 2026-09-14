import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { WashiMotif, washiMotifDefaultProps } from "./WashiMotif";
import { ContactSheet, contactSheetSize } from "./ContactSheet";
import { PaperProof, paperProofDefaultProps } from "./PaperProof";
import { WashiSurface, washiSurfaceDefaultProps } from "./WashiSurface";
import { SurfaceSheet, surfaceSheetSize } from "./SurfaceSheet";
import { SurfaceProof, surfaceProofDefaultProps } from "./SurfaceProof";
import {
  TextureProof,
  textureProofDefaultProps,
  textureProofSize,
} from "./TextureProof";

const sheet = contactSheetSize();
const surfaceSheet = surfaceSheetSize();
const textureProof = textureProofSize(9);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/*
        A STILL. durationInFrames is 1: there is no animation, no loop and no
        timing anywhere in this project.
      */}
      <Composition
        id="WashiMotif"
        component={WashiMotif}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={washiMotifDefaultProps}
      />
      {/* The surface set: full-bleed textures, also stills. */}
      <Composition
        id="WashiSurface"
        component={WashiSurface}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={washiSurfaceDefaultProps}
      />
      <Composition
        id="TextureProof"
        component={TextureProof}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={textureProof.width}
        height={textureProof.height}
        defaultProps={textureProofDefaultProps}
      />
      <Composition
        id="SurfaceProof"
        component={SurfaceProof}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1400}
        height={900}
        defaultProps={surfaceProofDefaultProps}
      />
      <Composition
        id="SurfaceSheet"
        component={SurfaceSheet}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={surfaceSheet.width}
        height={surfaceSheet.height}
      />
      {/* A 1:1 crop of the sheet, for judging the fibre texture at actual pixels. */}
      <Composition
        id="PaperProof"
        component={PaperProof}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1400}
        height={900}
        defaultProps={paperProofDefaultProps}
      />
      <Composition
        id="ContactSheet"
        component={ContactSheet}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={sheet.width}
        height={sheet.height}
      />
    </>
  );
};
