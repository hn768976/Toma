import React, { useMemo } from "react";
import { makeSprite } from "@lib/canvas/canvas";
import { BloomCanvas } from "@lib/effects/bloom";
import { type RadarColors, drawRadarGrid, makeContacts } from "@lib/scopes/radar-scope";
import { STAGE } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { SEGMENT_RING_PERIOD } from "../timing";
import type { CentreType } from "../variants";
import { drawSegmentRing, drawSegmentRingChrome } from "@lib/rings/segment-ring";
import {
  CRYPTO_HEIGHT,
  CRYPTO_PAD_RATIO,
  CRYPTO_WIDTH_RATIO,
  bitcoinPath,
  drawCentreRadar,
  drawCrypto,
  drawWifi,
} from "./CentreElement";

const SEGMENTS = 30;
const GAP_FRACTION = 0.34;

/**
 * Ring geometry per centre form. The radar scope FILLS the stage rather than
 * sitting inside it, so the ring moves outward to surround the scope's outer
 * edge. Construction and cycle are untouched; only the radius differs.
 */
const RING = {
  wifi: { radius: 360, thickness: 34 },
  crypto: { radius: 360, thickness: 34 },
  radar: { radius: 425, thickness: 30 },
} as const;

const CENTRE_RADAR_RADIUS = 380;

export type CentreStageProps = {
  type: CentreType;
  /** The one value that differs between the three versions. */
  accent: string;
  frame: number;
};

/**
 * The centre stage: the segment ring and the centre element, with the frame's
 * only heavy bloom.
 *
 * Both layers are the SAME pixels — the scene is drawn once into an offscreen
 * buffer and blitted twice, once through a CSS blur screened underneath and
 * once crisp on top. Drawing it twice would double the cost and risk the two
 * copies drifting apart.
 *
 * The stage's bracket frame is NOT here; it lives in <FrameChrome>, which
 * takes no variant. That is what guarantees the framing is identical across
 * all three versions.
 */
export const CentreStage: React.FC<CentreStageProps> = ({ type, accent, frame }) => {
  const { w: W, h: H } = STAGE;
  const cx = W / 2;
  const cy = H / 2;
  const ring = RING[type];

  const radarColors = useMemo<RadarColors>(
    () => ({
      grid: withAlpha(accent, 0.72),
      gridFaint: withAlpha(accent, 0.32),
      sweep: accent,
      trail: accent,
      contact: PALETTE.accentAmber,
      contactHot: PALETTE.textBright,
    }),
    [accent],
  );

  const contacts = useMemo(
    () => makeContacts("centre-scope", 9, CENTRE_RADAR_RADIUS * 0.22, CENTRE_RADAR_RADIUS * 0.93),
    [],
  );

  const cryptoGlyph = useMemo(
    () =>
      bitcoinPath(
        CRYPTO_HEIGHT * CRYPTO_WIDTH_RATIO,
        CRYPTO_HEIGHT,
        CRYPTO_HEIGHT * CRYPTO_PAD_RATIO,
      ),
    [],
  );

  // Static furniture: the ring's tick ring and inner circle, plus (for v3) the
  // scope's polar grid.
  const chrome = useMemo(
    () =>
      makeSprite(W, H, (ctx) => {
        if (type === "radar") {
          ctx.fillStyle = withAlpha(PALETTE.panelFill, 0.55);
          ctx.beginPath();
          ctx.arc(cx, cy, CENTRE_RADAR_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          drawRadarGrid(ctx, {
            cx,
            cy,
            radius: CENTRE_RADAR_RADIUS,
            rings: 5,
            spokeStep: 30,
            colors: radarColors,
            lineWidth: 2,
            // The asymmetry the brief asks for: the upper-left quadrant only.
            // In canvas coordinates that is PI (left) to 1.5*PI (up).
            denseSector: { from: Math.PI, to: Math.PI * 1.5 },
          });
        }
        drawSegmentRingChrome(ctx, {
          cx,
          cy,
          radius: ring.radius,
          thickness: ring.thickness,
          colors: {
            lit: accent,
            unlit: withAlpha(PALETTE.elementDim, 0.85),
            tick: withAlpha(PALETTE.elementDim, 0.9),
            tickMajor: withAlpha(PALETTE.textPale, 0.9),
            innerCircle: withAlpha(PALETTE.elementDim, 0.75),
          },
        });
      }),
    [W, H, cx, cy, type, ring.radius, ring.thickness, accent, radarColors],
  );

  // One draw, composited twice by <BloomCanvas>: blurred and screened
  // underneath, crisp on top. The frame's only heavy bloom.
  const draw = (b: CanvasRenderingContext2D) => {
    if (chrome) b.drawImage(chrome, 0, 0);

    drawSegmentRing(b, {
      cx,
      cy,
      radius: ring.radius,
      thickness: ring.thickness,
      segments: SEGMENTS,
      gapFraction: GAP_FRACTION,
      frame,
      period: SEGMENT_RING_PERIOD,
      colors: {
        lit: accent,
        unlit: withAlpha(PALETTE.elementDim, 0.85),
        tick: withAlpha(PALETTE.elementDim, 0.9),
        tickMajor: withAlpha(PALETTE.textPale, 0.9),
        innerCircle: withAlpha(PALETTE.elementDim, 0.75),
      },
    });

    if (type === "wifi") {
      drawWifi(b, { cx, cy, accent, frame, pale: PALETTE.textBright });
    } else if (type === "crypto") {
      drawCrypto(b, { cx, cy, accent, frame, pale: PALETTE.textBright, path: cryptoGlyph });
    } else {
      drawCentreRadar(b, {
        cx,
        cy,
        radius: CENTRE_RADAR_RADIUS,
        accent,
        frame,
        contacts,
        colors: radarColors,
      });
    }
  };

  const base: React.CSSProperties = {
    position: "absolute",
    left: STAGE.x,
    top: STAGE.y,
    width: W,
    height: H,
  };

  return (
    <BloomCanvas
      width={W}
      height={H}
      draw={draw}
      blurPx={26}
      opacity={0.62}
      style={base}
    />
  );
};
