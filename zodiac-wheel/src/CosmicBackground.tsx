import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES, WHEEL, type Palette } from "./config";
import {
  buildConstellations,
  buildNebula,
  buildStars,
  hexToRgb,
  type NebulaSpec,
} from "./cosmos";

type Props = {
  palette: Palette;
  variantKey: string;
  seed: number;
  starCount: number;
  /** Colour ramp for the sparse cool accent cloud. */
  accentRamp: [string, string, string];
};

/** Two cloud layers: a broad soft bed and a finer, brighter filament pass. */
const layerSpecs = (
  seed: number,
  accentRamp: [string, string, string],
): [NebulaSpec, NebulaSpec, NebulaSpec] => [
  {
    seed,
    width: 700,
    height: 394,
    freq: 3.2,
    stretchY: 1.5,
    octaves: 6,
    warp: 2.6,
    masses: [
      { x: 0.87, y: 0.05, rx: 0.55, ry: 0.78, gain: 1.15 },
      { x: 0.58, y: -0.04, rx: 0.3, ry: 0.32, gain: 0.6 },
      { x: 0.02, y: 0.99, rx: 0.32, ry: 0.3, gain: 0.55 },
    ],
    maxAlpha: 0.88,
    dust: 0.45,
    accent: 0.18,
    blur: 1.1,
  },
  {
    seed: seed + 4211,
    width: 1380,
    height: 776,
    freq: 6.2,
    stretchY: 1.8,
    octaves: 6,
    warp: 3.2,
    masses: [
      { x: 0.92, y: 0.02, rx: 0.42, ry: 0.56, gain: 1.15 },
      { x: 0.7, y: -0.02, rx: 0.22, ry: 0.22, gain: 0.75 },
    ],
    maxAlpha: 0.7,
    dust: 0.55,
    accent: 0.18,
    blur: 0.9,
  },
  // A sparse third cloud in the cool accent hue -- the teal patches the
  // reference threads through its warm gas.
  {
    seed: seed + 8123,
    width: 760,
    height: 428,
    freq: 9,
    stretchY: 1.4,
    octaves: 5,
    warp: 3,
    masses: [
      { x: 0.84, y: 0.2, rx: 0.17, ry: 0.24, gain: 1 },
      { x: 0.62, y: 0.34, rx: 0.11, ry: 0.14, gain: 0.9 },
      { x: 0.97, y: 0.52, rx: 0.12, ry: 0.16, gain: 0.85 },
      { x: 0.2, y: 0.86, rx: 0.12, ry: 0.13, gain: 0.7 },
    ],
    maxAlpha: 0.62,
    dust: 0.4,
    accent: 0,
    blur: 0.8,
    colors: accentRamp,
  },
];

export const CosmicBackground: React.FC<Props> = ({
  palette,
  variantKey,
  seed,
  starCount,
  accentRamp,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = React.useRef<HTMLCanvasElement>(null);

  const specs = React.useMemo(
    () => layerSpecs(seed, accentRamp),
    [seed, accentRamp],
  );

  const layers = React.useMemo(
    () => specs.map((s, i) => buildNebula(`${variantKey}-neb-${i}`, palette, s)),
    [specs, palette, variantKey],
  );

  const stars = React.useMemo(
    () => buildStars(`${variantKey}-stars`, seed + 31, starCount),
    [variantKey, seed, starCount],
  );

  const constellations = React.useMemo(() => {
    // Keep the patterns clear of the wheel's dense interior.
    const cx = WHEEL.centerX;
    const cy = WHEEL.centerY;
    const rx = (WHEEL.radiusOfHeight * height) / width;
    const ry = WHEEL.radiusOfHeight * WHEEL.squash;
    return buildConstellations(`${variantKey}-const`, seed + 77, 26, (x, y) => {
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      return d > 0.66;
    });
  }, [variantKey, seed, width, height]);

  React.useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = (frame / DURATION_IN_FRAMES) * Math.PI * 2;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    // --- stars -------------------------------------------------------
    const faint = hexToRgb(palette.star[0]);
    const bright = hexToRgb(palette.star[1]);
    // A whole-field drift, so the sky is never quite still.
    const skyX = Math.sin(t) * height * 0.008;
    const skyY = Math.cos(t * 1) * height * 0.005;

    for (const s of stars) {
      const tw =
        s.base *
        (1 - s.amp * 0.5 +
          s.amp * 0.5 * Math.sin((frame / s.period) * Math.PI * 2 + s.phase));
      if (tw <= 0.02) continue;
      const px = s.x * width + skyX;
      const py = s.y * height + skyY;
      const r = s.r * height;
      const c = [
        faint[0] + (bright[0] - faint[0]) * s.warm,
        faint[1] + (bright[1] - faint[1]) * s.warm,
        faint[2] + (bright[2] - faint[2]) * s.warm,
      ];
      ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${tw.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      if (s.cross) {
        // Soft halo plus a small diffraction cross on the brightest few.
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 7);
        g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(tw * 0.5).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * 7, 0, Math.PI * 2);
        ctx.fill();

        const len = r * 6.5;
        ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(tw * 0.42).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, r * 0.42);
        ctx.beginPath();
        ctx.moveTo(px - len, py);
        ctx.lineTo(px + len, py);
        ctx.moveTo(px, py - len);
        ctx.lineTo(px, py + len);
        ctx.stroke();
      }
    }

    // --- constellations ----------------------------------------------
    const cc = hexToRgb(palette.constellation);
    for (const con of constellations) {
      const pulse =
        0.5 + 0.5 * Math.sin((frame / con.period) * Math.PI * 2 + con.phase);
      const a = 0.1 + 0.13 * pulse;
      ctx.strokeStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${a.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, height * 0.0009);
      ctx.beginPath();
      for (const [i, j] of con.links) {
        ctx.moveTo(con.pts[i].x * width + skyX, con.pts[i].y * height + skyY);
        ctx.lineTo(con.pts[j].x * width + skyX, con.pts[j].y * height + skyY);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(${bright[0]},${bright[1]},${bright[2]},${(a * 2.6).toFixed(3)})`;
      for (const p of con.pts) {
        ctx.beginPath();
        ctx.arc(p.x * width + skyX, p.y * height + skyY, p.r * height, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- nebula ------------------------------------------------------
    // Additive so the starfield keeps showing through the thin edges.
    ctx.globalCompositeOperation = "lighter";
    const drift: [number, number][] = [
      [Math.sin(t) * 0.018, Math.cos(t) * 0.011],
      [Math.sin(t + 1.9) * 0.03, Math.cos(t + 0.6) * 0.018],
      [Math.sin(t + 3.4) * 0.024, Math.cos(t + 2.2) * 0.015],
    ];
    layers.forEach((layer, i) => {
      const [dx, dy] = drift[i];
      const pad = 0.06;
      ctx.globalAlpha = [0.95, 0.55, 0.5][i];
      ctx.drawImage(
        layer,
        -width * pad + dx * width,
        -height * pad + dy * height,
        width * (1 + pad * 2),
        height * (1 + pad * 2),
      );
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [frame, width, height, palette, stars, constellations, layers]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
