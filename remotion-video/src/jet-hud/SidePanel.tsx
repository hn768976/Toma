import React, { useLayoutEffect, useMemo } from "react";
import { DURATION_IN_FRAMES, FLASH_BUCKET, loopPhase } from "./constants";
import { withAlpha } from "../lib/color";
import { FONT_CONDENSED, FONT_MONO } from "./fonts";
import {
  codeLine,
  fieldLabel,
  groupLabel,
  readoutDecimal,
  readoutValue,
  stateLabel,
  waveSamples,
} from "./hud-content";
import { blitChrome, usePanelChrome } from "../lib/PanelChrome";
import { bucketOf, rndInt, rndRange } from "../lib/seeded";
import type { HudPlane } from "./hud-plane";

/**
 * One bordered panel on the plane. Its chrome is static and pre-rendered by
 * <PanelChrome>; only the values inside it, and the occasional border flash,
 * are recomputed per frame.
 */

export type PanelKind = "numeric" | "waveform" | "table" | "code" | "tickrule";

export type SidePanelProps = {
  plane: HudPlane;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PanelKind;
  seed: string;
  frame: number;
  /** Index and total, used only to schedule border flashes. */
  index: number;
  count: number;
  accent?: boolean;
};

/**
 * 2-3 border flashes per second across the whole HUD: one bucket of 13 frames
 * picks one panel, a second seed picks another, and the flash lasts 2 frames.
 * 390 / 13 = 30 buckets, so the cadence is periodic over the loop.
 */
const flashStrength = (index: number, count: number, frame: number) => {
  const b = bucketOf(frame, FLASH_BUCKET, DURATION_IN_FRAMES);
  const phase =
    ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % FLASH_BUCKET;
  if (phase > 2) return 0;
  const a = rndInt(`flashA:${b}`, 0, count);
  const bb = rndInt(`flashB:${b}`, 0, count);
  if (index !== a && index !== bb) return 0;
  return phase === 0 ? 1 : phase === 1 ? 0.6 : 0.25;
};

export const SidePanel: React.FC<SidePanelProps> = ({
  plane,
  x,
  y,
  w,
  h,
  kind,
  seed,
  frame,
  index,
  count,
  accent = false,
}) => {
  const p = plane.variant.palette;
  const chrome = usePanelChrome({
    w,
    h,
    fill: p.panelFill,
    fillAlpha: p.panelFillAlpha,
    border: accent ? p.accent : p.panelBorder,
    seed,
    header: kind !== "tickrule",
    ticks: kind === "waveform" ? 24 : kind === "tickrule" ? 0 : 12,
    bracket: kind === "tickrule" ? 0 : 22,
  });

  const wave = useMemo(() => waveSamples(seed, 132), [seed]);
  const codeLines = useMemo(() => {
    const n = Math.max(6, Math.floor((h - 60) / 40));
    return Array.from({ length: n }, (_, i) => codeLine(`${seed}:cl:${i}`));
  }, [seed, h]);

  useLayoutEffect(() => {
    const glow = plane.glow;
    const px = x + plane.sway;
    const py = y;
    // The chrome bleeds a little outside the panel, so the paint box is grown
    // by its pad; otherwise a panel straddling a band edge loses its bracket.
    plane.paint(
      {
        u: px - chrome.pad,
        v: py - chrome.pad,
        w: w + chrome.pad * 2,
        h: h + chrome.pad * 2,
      },
      (ctx, isFirstBand) => {
        blitChrome(ctx, chrome, px, py);

        const border = accent ? p.accent : p.panelBorder;
        const flash = flashStrength(index, count, frame);
        if (flash > 0) {
          ctx.strokeStyle = withAlpha(p.textBright, flash);
          ctx.lineWidth = 3.4;
          ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
          // A panel straddling a band edge runs this callback twice; the
          // bloom accumulator must only take the flash once.
          if (isFirstBand) {
            glow.strokeStyle = withAlpha(p.textBright, flash * 0.8);
            glow.lineWidth = 3.4;
            glow.strokeRect(px + 1, py + 1, w - 2, h - 2);
          }
        }

        // Header text.
        if (kind !== "tickrule") {
          ctx.fillStyle = withAlpha(p.textBright, 0.85);
          ctx.font = `600 26px ${FONT_CONDENSED}`;
          ctx.fillText(groupLabel(`${seed}:title`), px + 14, py + 29);
          ctx.fillStyle = withAlpha(p.textPale, 0.8);
          ctx.font = `500 22px ${FONT_CONDENSED}`;
          ctx.textAlign = "right";
          ctx.fillText(stateLabel(`${seed}:st`), px + w - 14, py + 29);
          ctx.textAlign = "left";
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(px + 2, py + 2, w - 4, h - 4);
        ctx.clip();

        if (kind === "numeric") {
          const rows = Math.max(2, Math.floor((h - 56) / 62));
          for (let r = 0; r < rows; r++) {
            const ry = py + 52 + r * 62;
            ctx.fillStyle = withAlpha(p.textPale, 0.8);
            ctx.font = `500 24px ${FONT_CONDENSED}`;
            ctx.fillText(fieldLabel(`${seed}:f:${r}`), px + 14, ry + 26);
            ctx.fillStyle = p.textBright;
            ctx.font = `400 40px ${FONT_MONO}`;
            ctx.textAlign = "right";
            ctx.fillText(
              readoutDecimal(`${seed}:v:${r}`, frame),
              px + w - 14,
              ry + 30,
            );
            ctx.textAlign = "left";
            ctx.strokeStyle = withAlpha(border, 0.22);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px + 12, ry + 44);
            ctx.lineTo(px + w - 12, ry + 44);
            ctx.stroke();
          }
        } else if (kind === "waveform") {
          const top = py + 50;
          const hh = h - 74;
          const mid = top + hh / 2;
          ctx.strokeStyle = withAlpha(border, 0.28);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + 8, mid);
          ctx.lineTo(px + w - 8, mid);
          ctx.stroke();
          ctx.strokeStyle = p.textBright;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          // The trace is fixed; a scan cursor sweeps it once per loop.
          for (let i = 0; i < wave.length; i++) {
            const wx = px + 8 + ((w - 16) * i) / (wave.length - 1);
            const wy = mid - wave[i] * (hh / 2 - 6);
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
          const cursor = px + 8 + (w - 16) * loopPhase(frame);
          ctx.strokeStyle = withAlpha(p.accent, 0.9);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cursor, top);
          ctx.lineTo(cursor, top + hh);
          ctx.stroke();
          if (isFirstBand) {
            glow.strokeStyle = withAlpha(p.accent, 0.7);
            glow.lineWidth = 3;
            glow.beginPath();
            glow.moveTo(cursor, top);
            glow.lineTo(cursor, top + hh);
            glow.stroke();
          }
        } else if (kind === "table") {
          const rows = Math.max(3, Math.floor((h - 56) / 44));
          for (let r = 0; r < rows; r++) {
            const ry = py + 50 + r * 44;
            if (r % 2 === 0) {
              ctx.fillStyle = withAlpha(border, 0.1);
              ctx.fillRect(px + 8, ry, w - 16, 38);
            }
            ctx.fillStyle = withAlpha(p.textPale, 0.85);
            ctx.font = `500 22px ${FONT_CONDENSED}`;
            ctx.fillText(fieldLabel(`${seed}:t:${r}`), px + 16, ry + 27);
            ctx.font = `400 24px ${FONT_MONO}`;
            ctx.fillStyle = withAlpha(p.textBright, 0.8);
            ctx.fillText(
              readoutValue(`${seed}:ta:${r}`, frame, 4),
              px + w * 0.4,
              ry + 27,
            );
            ctx.fillStyle = withAlpha(p.textPale, 0.7);
            ctx.font = `500 22px ${FONT_CONDENSED}`;
            ctx.textAlign = "right";
            ctx.fillText(stateLabel(`${seed}:ts:${r}`), px + w - 16, ry + 27);
            ctx.textAlign = "left";
          }
        } else if (kind === "code") {
          const lineH = 40;
          const tile = codeLines.length * lineH;
          // Scrolls exactly one tile per loop, so the column closes at frame 390.
          const offset = (loopPhase(frame) * tile) % tile;
          const skipped = Math.floor(offset / lineH);
          const within = offset - skipped * lineH;
          ctx.font = `400 26px ${FONT_MONO}`;
          const visible = Math.ceil((h - 46) / lineH) + 2;
          for (let i = -1; i <= visible; i++) {
            const ly = py + 46 + (i + 1) * lineH - within;
            const raw = i + skipped;
            const idx =
              ((raw % codeLines.length) + codeLines.length) % codeLines.length;
            const dim = rndRange(`${seed}:dim:${idx}`, 0.4, 0.95);
            ctx.fillStyle = withAlpha(p.textPale, dim);
            ctx.fillText(codeLines[idx], px + 14, ly);
          }
        } else {
          // A vertical tick rule: major ticks labelled, minors bare.
          const n = Math.floor((h - 20) / 26);
          for (let i = 0; i <= n; i++) {
            const ty = py + 10 + i * 26;
            const major = i % 4 === 0;
            ctx.strokeStyle = withAlpha(border, major ? 0.85 : 0.45);
            ctx.lineWidth = major ? 3 : 1.8;
            ctx.beginPath();
            ctx.moveTo(px + w, ty);
            ctx.lineTo(px + w - (major ? w * 0.8 : w * 0.42), ty);
            ctx.stroke();
            if (major && i % 8 === 0) {
              ctx.fillStyle = withAlpha(p.textPale, 0.8);
              ctx.font = `500 20px ${FONT_MONO}`;
              ctx.fillText(
                readoutValue(`${seed}:tk:${i}`, frame, 2),
                px - 46,
                ty + 7,
              );
            }
          }
        }

        ctx.restore();
      },
    );
  });

  return null;
};
