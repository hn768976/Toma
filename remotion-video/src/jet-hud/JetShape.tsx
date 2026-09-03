import React, { useMemo } from "react";
import {
  JET_GEOMETRY,
  tracePath,
  type Facet,
  type JetGeometry,
  type Tone,
  type Wire,
} from "./jet-geometry";
import type { Palette, Variant } from "./variants";
import { mixHex, withAlpha } from "../lib/color";

/**
 * The aircraft is rasterised ONCE to an offscreen canvas and thereafter
 * blitted with a transform — re-tracing twenty-odd paths on every one of 390
 * frames would be pure waste, and nothing about the geometry animates.
 *
 * Two renderers, one geometry. v1's "solid" mode fills each facet with one of
 * four flat tonal steps; v2's "wireframe" mode strokes the identical facets.
 * If you ever find yourself editing jet-geometry.ts to add a variant, the
 * separation has failed.
 */

export type JetSprite = {
  canvas: HTMLCanvasElement;
  geo: JetGeometry;
};

const solidFill = (tone: Tone, p: Palette): string => {
  switch (tone) {
    case "darkest":
      return p.jetDarkest;
    case "dark":
      return p.jetDark;
    case "mid":
      return p.jetMid;
    case "light":
      return p.jetLight;
    case "canopy":
      return p.canopyPale;
    case "band":
      return p.storeBand;
  }
};

const wireStroke = (wire: Wire, p: Palette): string => {
  switch (wire) {
    case "bright":
      return p.jetLine;
    case "mid":
      return mixHex(p.jetLineDim, p.jetLine, 0.5);
    case "dim":
      return p.jetLineDim;
  }
};

const WIRE_WIDTH: Record<Wire, number> = { bright: 3.6, mid: 3, dim: 2.4 };

const renderSolid = (
  ctx: CanvasRenderingContext2D,
  geo: JetGeometry,
  p: Palette,
) => {
  ctx.lineJoin = "round";
  const fill = (f: Facet) => {
    tracePath(ctx, f.cmds);
    ctx.fillStyle = solidFill(f.tone, p);
    ctx.fill();
  };
  geo.facets.forEach(fill);
  geo.panels.forEach(fill);
  // Highlight strips last: they read as light catching a curve, so they sit
  // over the facets rather than being clipped by them.
  geo.strips.forEach(fill);

  ctx.strokeStyle = withAlpha(p.jetMid, 0.85);
  ctx.lineWidth = 4;
  tracePath(ctx, geo.canopyBow);
  ctx.stroke();

  ctx.strokeStyle = p.jetLight;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  tracePath(ctx, geo.probe);
  ctx.stroke();
};

const renderWireframe = (
  ctx: CanvasRenderingContext2D,
  geo: JetGeometry,
  p: Palette,
) => {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // A soft glow on every stroke, so the aircraft reads as a projection
  // rather than as a solid object.
  ctx.shadowColor = withAlpha(p.jetLine, 0.5);
  ctx.shadowBlur = 16;

  const facetFill = withAlpha(p.jetWireFill, p.jetWireFillAlpha);

  const draw = (f: Facet, widthScale = 1) => {
    tracePath(ctx, f.cmds);
    // The translucent fill is what keeps facets occluding one another now
    // that the flat tonal steps are gone.
    ctx.fillStyle = f.tone === "band" ? withAlpha(p.storeBand, 0.5) : facetFill;
    ctx.fill();
    ctx.strokeStyle = wireStroke(f.wire, p);
    ctx.lineWidth = WIRE_WIDTH[f.wire] * widthScale;
    ctx.stroke();
  };

  for (const f of geo.facets) {
    if (f.id === "canopy") continue;
    draw(f);
  }

  // Internal frames and ribs — absent from v1, and the main thing that
  // preserves the sense of form without fills.
  for (const s of geo.structure) {
    tracePath(ctx, s.cmds);
    ctx.strokeStyle = withAlpha(wireStroke(s.wire, p), 0.75);
    ctx.lineWidth = WIRE_WIDTH[s.wire] * 0.62;
    ctx.stroke();
  }

  // The highlight strips are kept, but faintly: at full weight they double
  // every leading edge and the projection turns into a thicket.
  for (const s of geo.strips) {
    tracePath(ctx, s.cmds);
    ctx.strokeStyle = withAlpha(wireStroke(s.wire, p), 0.24);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  for (const pn of geo.panels) {
    tracePath(ctx, pn.cmds);
    ctx.strokeStyle = withAlpha(p.jetLineDim, 0.7);
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // The canopy: a brighter outline over a faint fill.
  const cockpit = geo.facets.find((f) => f.id === "canopy");
  if (cockpit) {
    tracePath(ctx, cockpit.cmds);
    ctx.fillStyle = withAlpha(p.canopyPale, 0.18);
    ctx.fill();
    ctx.shadowBlur = 26;
    ctx.shadowColor = withAlpha(p.canopyPale, 0.7);
    ctx.strokeStyle = p.canopyPale;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    tracePath(ctx, geo.canopyBow);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.shadowBlur = 16;
    ctx.shadowColor = withAlpha(p.jetLine, 0.5);
  }

  ctx.strokeStyle = p.jetLine;
  ctx.lineWidth = 4;
  tracePath(ctx, geo.probe);
  ctx.stroke();
  ctx.shadowBlur = 0;
};

export const useJetSprite = (variant: Variant): JetSprite =>
  useMemo(() => {
    const geo = JET_GEOMETRY;
    const canvas = document.createElement("canvas");
    canvas.width = geo.spriteW;
    canvas.height = geo.spriteH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (variant.jetMode === "solid") renderSolid(ctx, geo, variant.palette);
      else renderWireframe(ctx, geo, variant.palette);
    }
    return { canvas, geo };
  }, [variant]);

/**
 * Render-prop wrapper so the sprite's lifetime is owned by a component rather
 * than by whoever happens to need it.
 */
export const JetShape: React.FC<{
  variant: Variant;
  children: (sprite: JetSprite) => React.ReactNode;
}> = ({ variant, children }) => <>{children(useJetSprite(variant))}</>;
