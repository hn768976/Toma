import React from "react";
import { Img, staticFile } from "remotion";
import {
  BODY_COLUMN_LEFT,
  BODY_FONT,
  BODY_FONT_SIZE,
  COLORS,
  HEADLINE_FONT,
  HEADLINE_LEFT,
  HEADLINE_SIZE,
  HEADLINE_TOP,
  SHEET_TOP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { TiledImage } from "./TiledImage";

const LOREM =
  "lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin tortor metus, pulvinar quis sit amet, fringilla finibus nec mi. Etiam aliquet enim ac orci, at amet orci ex fringilla. Sed et ut amet orci ex efficitur volputate congue. Ut amet ex tellus. Donec vel velit justo, lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

// Printed-paper look: a large soft blotch map plus a fine fiber tile,
// both multiplied over the sheet (and the ink on it).
const PaperTexture: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <>
    <Img
      src={staticFile("textures/paper-blotch.png")}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: "multiply",
        opacity: 0.2 * opacity,
      }}
    />
    <TiledImage
      src={staticFile("textures/paper-fiber.png")}
      tileSize={2048}
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      style={{ mixBlendMode: "multiply", opacity: 0.12 * opacity }}
    />
  </>
);

const Block: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}> = ({ x, y, w, h, color }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: color,
    }}
  />
);

export type HeadlineCopy = {
  lineOneBig: string;
  lineOneSmall: string;
  lineTwo: string;
  kicker: string;
};

// The flat tabletop with two overlapping newspaper sheets. Everything
// is static; the camera rig moves this whole plane in 3D.
export const Page: React.FC<{ copy: HeadlineCopy }> = ({ copy }) => {
  return (
    <div
      style={{
        position: "absolute",
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        backgroundColor: COLORS.desk,
        overflow: "hidden",
      }}
    >
      <PaperTexture opacity={1.4} />

      {/* Back sheet: photo blocks peeking out above the headline sheet. */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 260,
          width: WORLD_WIDTH - 60,
          height: SHEET_TOP - 160,
          backgroundColor: COLORS.paperBack,
          overflow: "hidden",
          transform: "rotate(-0.6deg)",
        }}
      >
        <Block x={180} y={90} w={1500} h={1300} color={COLORS.photoDark} />
        <Block x={1900} y={90} w={2400} h={980} color={COLORS.photo} />
        <Block x={4520} y={300} w={2500} h={1100} color={COLORS.photoDark} />
        <PaperTexture />
      </div>

      {/* Front sheet with the headline. */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: SHEET_TOP,
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT - SHEET_TOP + 200,
          backgroundColor: COLORS.paper,
          boxShadow: "0 -30px 70px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: HEADLINE_LEFT - 60,
            top: HEADLINE_TOP - SHEET_TOP,
            fontFamily: HEADLINE_FONT,
            fontSize: HEADLINE_SIZE,
            fontWeight: 700,
            color: COLORS.ink,
            whiteSpace: "nowrap",
            lineHeight: 1.08,
            letterSpacing: "0.005em",
          }}
        >
          <div>
            {copy.lineOneBig} {copy.lineOneSmall}
          </div>
          <div>{copy.lineTwo}</div>
        </div>

        {/* Lead photo placeholder + kicker label. */}
        <Block
          x={HEADLINE_LEFT - 60}
          y={2780 - SHEET_TOP}
          w={3100}
          h={2000}
          color={COLORS.photo}
        />
        <div
          style={{
            position: "absolute",
            left: HEADLINE_LEFT,
            top: 2860 - SHEET_TOP,
            fontFamily: HEADLINE_FONT,
            fontWeight: 800,
            fontSize: 92,
            letterSpacing: "0.12em",
            color: COLORS.photoDark,
          }}
        >
          {copy.kicker}
        </div>

        {/* Column rule + body copy. */}
        <Block
          x={BODY_COLUMN_LEFT - 60 - 120}
          y={2360 - SHEET_TOP}
          w={8}
          h={2600}
          color={COLORS.rule}
        />
        <div
          style={{
            position: "absolute",
            left: BODY_COLUMN_LEFT - 60,
            top: 2330 - SHEET_TOP,
            width: 2700,
            fontFamily: BODY_FONT,
            fontWeight: 400,
            fontSize: BODY_FONT_SIZE,
            lineHeight: 1.32,
            textAlign: "justify",
            color: COLORS.ink,
            opacity: 0.88,
          }}
        >
          {LOREM} {LOREM}
        </div>

        <PaperTexture />
      </div>
    </div>
  );
};
