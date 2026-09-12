// "Global Data Network" — an oblique HUD table carrying a halftone world map,
// a live link graph and a field of dashboard widgets, with a slow continuous
// camera drift across it.
//
// Authored in a 1920x1080 design space and scaled to the composition size, so
// the 1080p and 4K compositions are the same picture at two resolutions.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import {
  BASE_WIDTH,
  BOARD_H,
  BOARD_W,
  CAMERA,
  DURATION_IN_FRAMES,
  MAP_H,
  MAP_W,
  MAP_X,
  MAP_Y,
} from "./constants";
import { MODULES, MONO } from "./hud-modules";
import { BOARD_LABELS, buildLayout } from "./layout";
import {
  buildNetwork,
  linkControlPoint,
  pointOnLink,
  type NetworkLink,
} from "./network";
import { THEMES } from "./theme";

export const dataNetworkSchema = z.object({
  theme: z.enum(["blue", "green"]),
});

export type DataNetworkProps = z.infer<typeof dataNetworkSchema>;

export const dataNetworkDefaults: DataNetworkProps = { theme: "blue" };

const linkPath = (link: NetworkLink) => {
  const c = linkControlPoint(link);
  return `M ${link.from.x} ${link.from.y} Q ${c.x} ${c.y} ${link.to.x} ${link.to.y}`;
};

export const DataNetworkBoard: React.FC<DataNetworkProps> = ({ theme: themeName }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const theme = THEMES[themeName];

  /** Design-space -> device-pixel scale. 1 at 1080p, 2 at 4K. */
  const s = width / BASE_WIDTH;
  const t = frame / fps;

  const layout = useMemo(() => buildLayout(), []);
  const network = useMemo(() => buildNetwork(), []);

  const span: [number, number] = [0, DURATION_IN_FRAMES - 1];
  const tilt = interpolate(frame, span, [CAMERA.tiltStart, CAMERA.tiltEnd]);
  const roll = interpolate(frame, span, [CAMERA.rollStart, CAMERA.rollEnd]);
  const pan = interpolate(frame, span, [CAMERA.panStart, CAMERA.panEnd]);
  const dolly = interpolate(frame, span, [CAMERA.dollyStart, CAMERA.dollyEnd]);
  const distance = interpolate(frame, span, [
    CAMERA.distanceStart,
    CAMERA.distanceEnd,
  ]);

  // Specular sweep that crawls across the continents.
  const sweep = ((t * 0.05) % 1) * 240 - 70;

  // Rendered twice per frame: once sharp, once as the bloom pass.
  const stage = (
    <>
      <AbsoluteFill
        style={{
          perspective: CAMERA.perspective * s,
          perspectiveOrigin: CAMERA.perspectiveOrigin,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: BOARD_W * s,
            height: BOARD_H * s,
            marginLeft: (-BOARD_W * s) / 2,
            marginTop: (-BOARD_H * s) / 2,
            transformStyle: "preserve-3d",
            transform: `translateZ(${-distance * s}px) rotateX(${tilt}deg) rotateZ(${roll}deg) translate(${pan * s}px, ${dolly * s}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: BOARD_W,
              height: BOARD_H,
              transform: `scale(${s})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Backlight under the whole table. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse 62% 50% at 50% 40%, ${theme.boardCore} 0%, ${theme.boardEdge} 74%, ${theme.void} 100%)`,
              }}
            />

            {/* Ruled grid + fine dot texture. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(to right, ${theme.grid} 2px, transparent 2px), linear-gradient(to bottom, ${theme.grid} 2px, transparent 2px)`,
                backgroundSize: "168px 168px",
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `radial-gradient(${theme.micro} 1.4px, transparent 1.6px)`,
                backgroundSize: "26px 26px",
                opacity: 0.14,
              }}
            />

            {/* Halftone landmasses: a soft glow pass, a crisp pass, and a
                specular sweep that travels east across the continents. */}
            <MapLayer
              blur={34}
              opacity={0.75}
              background={`radial-gradient(ellipse 70% 130% at 50% 45%, ${theme.landHot} 0%, ${theme.landCool} 75%)`}
            />
            <MapLayer
              blur={0}
              opacity={1}
              background={`radial-gradient(ellipse 74% 150% at 50% 44%, ${theme.landHot} 0%, ${theme.landCool} 58%, ${theme.landCool} 100%)`}
            />
            <MapLayer
              blur={0}
              opacity={0.75}
              blend="screen"
              background={`linear-gradient(100deg, transparent ${sweep - 22}%, ${theme.landHot} ${sweep}%, transparent ${sweep + 22}%)`}
            />

            {/* Link graph. */}
            <svg
              width={MAP_W}
              height={MAP_H}
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              style={{
                position: "absolute",
                left: MAP_X,
                top: MAP_Y,
                overflow: "visible",
              }}
            >
              {network.links.map((link, i) => (
                <path
                  key={`l-${i}`}
                  d={linkPath(link)}
                  fill="none"
                  stroke={theme.link}
                  strokeWidth={link.active ? 5.5 : 3.8}
                  opacity={link.active ? 0.9 : 0.5}
                />
              ))}
              {network.links.map((link, i) =>
                link.active ? (
                  <path
                    key={`p-${i}`}
                    d={linkPath(link)}
                    fill="none"
                    stroke={theme.linkHot}
                    strokeWidth={11}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.07 0.93"
                    strokeDashoffset={-((t / link.speed + link.phase) % 1)}
                    opacity={0.95}
                  />
                ) : null,
              )}
              {network.links.map((link, i) => {
                if (!link.active) return null;
                const p = pointOnLink(link, (t / link.speed + link.phase) % 1);
                return (
                  <circle
                    key={`d-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={9}
                    fill={theme.linkHot}
                  />
                );
              })}
              {network.nodes.map((node) => {
                const pulse =
                  0.5 + 0.5 * Math.sin((t * 0.55 + node.phase) * Math.PI * 2);
                return (
                  <g key={node.name}>
                    {node.hub ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={20 + pulse * 30}
                        fill="none"
                        stroke={theme.node}
                        strokeWidth={4.5}
                        opacity={0.55 * (1 - pulse)}
                      />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.hub ? 13 : 8.5}
                      fill={theme.node}
                      opacity={0.85 + pulse * 0.15}
                    />
                    {node.hub ? (
                      <text
                        x={node.x + 26}
                        y={node.y - 20}
                        fill={theme.textDim}
                        fontFamily={MONO}
                        fontSize={40}
                        letterSpacing={4}
                      >
                        {node.name}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {/* Readable captions. */}
            {BOARD_LABELS.map((label) => (
              <div
                key={label.title}
                style={{
                  position: "absolute",
                  left: label.x,
                  top: label.y,
                  fontFamily: MONO,
                  whiteSpace: "nowrap",
                }}
              >
                <div
                  style={{
                    fontSize: label.size,
                    letterSpacing: label.size * 0.16,
                    color: theme.text,
                    opacity: 0.9,
                    fontWeight: 700,
                  }}
                >
                  {label.title}
                </div>
                <div
                  style={{
                    marginTop: label.size * 0.28,
                    fontSize: label.size * 0.68,
                    letterSpacing: label.size * 0.13,
                    color: theme.textDim,
                  }}
                >
                  {label.sub}
                </div>
                <div
                  style={{
                    marginTop: label.size * 0.3,
                    width: label.size * 9,
                    height: 2,
                    background: theme.panelStroke,
                  }}
                />
              </div>
            ))}

            {/* The widget field. */}
            {layout.map((module) => {
              const Component = MODULES[module.name];
              return (
                <div
                  key={module.key}
                  style={{
                    position: "absolute",
                    left: module.x,
                    top: module.y,
                    width: module.w,
                    height: module.h,
                    opacity: module.opacity,
                  }}
                >
                  <Component
                    w={module.w}
                    h={module.h}
                    seed={module.seed}
                    theme={theme}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: theme.void, overflow: "hidden" }}>
      {stage}
      {/* Bloom: the whole stage again, blurred and screened back over itself.
          Dark areas are unchanged by `screen`, so only the lit HUD blooms. */}
      <AbsoluteFill
        style={{
          filter: `blur(${13 * s}px)`,
          mixBlendMode: "screen",
          opacity: 0.42,
          pointerEvents: "none",
        }}
      >
        {stage}
      </AbsoluteFill>

      {/* --- Atmosphere, all in screen space --- */}

      {/* Haze over the far half of the table. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${theme.hazeStrong} 0%, ${theme.hazeSoft} 13%, transparent 34%)`,
          pointerEvents: "none",
        }}
      />

      {/* Depth of field: soft at the far edge and in the near corner. */}
      <AbsoluteFill
        style={{
          backdropFilter: `blur(${5 * s}px)`,
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 9%, rgba(0,0,0,0) 26%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 9%, rgba(0,0,0,0) 26%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backdropFilter: `blur(${6 * s}px)`,
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 12%, rgba(0,0,0,0) 30%)",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 12%, rgba(0,0,0,0) 30%)",
          pointerEvents: "none",
        }}
      />

      {/* Vignette. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 86% 88% at 50% 48%, transparent 38%, ${theme.void}b3 82%, ${theme.void} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Scanlines and a whisper of grain. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <Grain t={t} scale={s} />
    </AbsoluteFill>
  );
};

const MapLayer: React.FC<{
  blur: number;
  opacity: number;
  background: string;
  blend?: React.CSSProperties["mixBlendMode"];
}> = ({ blur, opacity, background, blend }) => (
  <div
    style={{
      position: "absolute",
      left: MAP_X,
      top: MAP_Y,
      width: MAP_W,
      height: MAP_H,
      background,
      opacity,
      mixBlendMode: blend,
      filter: blur ? `blur(${blur}px)` : undefined,
      WebkitMaskImage: `url(${staticFile("world-dots.png")})`,
      maskImage: `url(${staticFile("world-dots.png")})`,
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
    }}
  />
);

/** Tiled noise bitmap nudged around each frame — cheap film grain. */
const Grain: React.FC<{ t: number; scale: number }> = ({ t, scale }) => {
  const step = Math.floor(t * 24);
  const tile = 256 * scale;
  return (
    <AbsoluteFill
      style={{
        opacity: 0.13,
        mixBlendMode: "overlay",
        pointerEvents: "none",
        // Safe despite the lint rule: data-network/preload.ts holds a
        // delayRender() until grain.png has decoded.
        // eslint-disable-next-line @remotion/no-background-image
        backgroundImage: `url(${staticFile("grain.png")})`,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${(step * 37) % 256}px ${(step * 53) % 256}px`,
      }}
    />
  );
};
