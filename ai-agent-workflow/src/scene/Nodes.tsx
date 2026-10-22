import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { drawBrain, drawRings } from "../draw/brain";
import { drawCounter, drawGlass, drawIconTile, drawLabel, drawOutputCard } from "../draw/panels";
import { CARD, T, type IconName, type OutputKind } from "../layout";
import type { Palette } from "../theme";
import { clamp01, easeOut, easeOutBack, hash2, prog, rgba } from "../util";
import { CanvasPlane } from "./CanvasPlane";

const PAD = 0.35; // texture padding around panels so glows aren't clipped

/** Soft additive pool of light on the floor under a raised panel. */
const FloorGlow: React.FC<{ u: number; v: number; w: number; h: number; color: string; k: number }> = ({
  u,
  v,
  w,
  h,
  color,
  k,
}) => (
  <CanvasPlane
    u={u}
    v={v}
    z={0.01}
    width={w}
    height={h}
    ppu={24}
    drawKey={color}
    additive
    opacity={k}
    renderOrder={0}
    draw={(ctx, W, H) => {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) / 2);
      g.addColorStop(0, rgba(color, 0.12));
      g.addColorStop(0.45, rgba(color, 0.04));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }}
  />
);

// ---------------------------------------------------------------------------
// AI Agent card
// ---------------------------------------------------------------------------
export const AgentCard: React.FC<{ pal: Palette }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const S = CARD.size;

  const ghost = prog(frame, T.cardGhost, 8, easeOut);
  const grow = prog(frame, T.cardGrow, 10, easeOutBack);
  const scale = interpolate(grow, [0, 1], [0.14, 1]);
  const alpha = ghost * interpolate(grow, [0, 1], [0.45, 1]);
  const ringsP = prog(frame, T.rings, 48, (x) => x);
  const brainP = prog(frame, T.brain, 42, (x) => x);
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 0.9);

  return (
    <group>
      <FloorGlow u={CARD.u} v={CARD.v} w={S * 1.7} h={S * 1.7} color={pal.primary} k={alpha * 0.6} />
      {/* Lower slab: gives the glass card visible thickness. */}
      <CanvasPlane
        u={CARD.u + 0.05}
        v={CARD.v + 0.05}
        z={CARD.z - 0.35}
        width={S + PAD * 2}
        height={S + PAD * 2}
        ppu={110}
        drawKey="slab"
        opacity={alpha * 0.8}
        scale={scale}
        renderOrder={2}
        draw={(ctx, W) => {
          const ppu = W / (S + PAD * 2);
          drawGlass(ctx, pal, {
            x: PAD * ppu,
            y: PAD * ppu,
            w: S * ppu,
            h: S * ppu,
            r: 0.7 * ppu,
            ppu,
            fill: 0.25,
            border: 0.3,
            gradientBorder: true,
          });
        }}
      />
      <CanvasPlane
        u={CARD.u}
        v={CARD.v}
        z={CARD.z}
        width={S + PAD * 2}
        height={S + PAD * 2}
        ppu={200}
        drawKey="face"
        opacity={alpha}
        scale={scale}
        renderOrder={3}
        draw={(ctx, W) => {
          const ppu = W / (S + PAD * 2);
          const x = PAD * ppu;
          const s = S * ppu;
          const r = 0.7 * ppu;
          // Dark smoked glass with a faint primary tint.
          drawGlass(ctx, pal, { x, y: x, w: s, h: s, r, ppu, fill: 0.45, border: 0.55 });
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, x, s, s, r);
          ctx.fillStyle = rgba(pal.bgEdge, 0.28);
          ctx.fill();
          // Secondary-colour glow pooled along the right and bottom edges.
          const g = ctx.createLinearGradient(x + s * 0.45, x + s * 0.45, x + s, x + s);
          g.addColorStop(0, rgba(pal.secondary, 0));
          g.addColorStop(1, rgba(pal.secondary, 0.32));
          ctx.fillStyle = g;
          ctx.fill();
          ctx.clip();
          ctx.lineWidth = ppu * 0.09;
          ctx.strokeStyle = rgba(pal.secondary, 0.85);
          ctx.shadowColor = pal.secondary;
          ctx.shadowBlur = ppu * 0.35;
          ctx.beginPath();
          ctx.moveTo(x + s, x + s * 0.35);
          ctx.lineTo(x + s, x + s - r);
          ctx.arcTo(x + s, x + s, x + s - r, x + s, r);
          ctx.lineTo(x + s * 0.35, x + s);
          ctx.stroke();
          ctx.restore();
        }}
      />
      {ringsP > 0 && (
        <CanvasPlane
          u={CARD.u}
          v={CARD.v}
          z={CARD.z + 0.08}
          width={8.9}
          height={8.9}
          ppu={220}
          drawKey={frame}
          renderOrder={4}
          draw={(ctx, W) => drawRings(ctx, W, pal, ringsP, t, pulse)}
        />
      )}
      {brainP > 0 && (
        <CanvasPlane
          u={CARD.u}
          v={CARD.v}
          z={CARD.z + 0.2}
          width={5.6}
          height={5.6}
          ppu={240}
          drawKey={`${Math.round(brainP * 200)}-${Math.round(pulse * 30)}`}
          renderOrder={5}
          draw={(ctx, W) => drawBrain(ctx, W, pal, brainP, pulse)}
        />
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Icon tiles
// ---------------------------------------------------------------------------
export const IconTile: React.FC<{
  pal: Palette;
  u: number; // left edge
  v: number; // centre
  w: number;
  h: number;
  icon: IconName;
  accent: string;
  appear: number;
  z?: number;
  lines?: boolean;
}> = ({ pal, u, v, w, h, icon, accent, appear, z = 0.55, lines }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, appear, 14, easeOutBack);
  const a = prog(frame, appear, 8, easeOut);
  if (a <= 0) return null;
  const cu = u + w / 2;
  const tKey = lines ? Math.floor(frame / 6) : 0;
  return (
    <group>
      <FloorGlow u={cu + 0.1} v={v + 0.25} w={w * 2} h={h * 2} color={accent} k={a * 0.9} />
      <CanvasPlane
        u={cu}
        v={v}
        z={z}
        width={w + PAD * 2}
        height={h + PAD * 2}
        ppu={170}
        drawKey={`${icon}-${accent}-${tKey}`}
        opacity={a}
        scale={interpolate(p, [0, 1], [0.6, 1])}
        renderOrder={3}
        draw={(ctx, W, H) => {
          const ppu = W / (w + PAD * 2);
          drawIconTile(ctx, pal, W, H, PAD * ppu, ppu, icon, accent, lines ? { lines: true, t: frame } : undefined);
        }}
      />
    </group>
  );
};

export const OutputCard: React.FC<{
  pal: Palette;
  u: number;
  v: number;
  w: number;
  h: number;
  icon: IconName;
  kind: OutputKind;
  appear: number;
}> = ({ pal, u, v, w, h, icon, kind, appear }) => {
  const frame = useCurrentFrame();
  const a = prog(frame, appear, 10, easeOut);
  if (a <= 0) return null;
  const slide = interpolate(prog(frame, appear, 16, easeOut), [0, 1], [-0.8, 0]);
  const reveal = prog(frame, appear + 6, 24, easeOut);
  return (
    <group>
      <FloorGlow u={u + w / 2} v={v + 0.3} w={w * 1.6} h={h * 2.4} color={pal.primary} k={a * 0.6} />
      <CanvasPlane
        u={u + w / 2 + slide}
        v={v}
        z={0.5}
        width={w + PAD * 2}
        height={h + PAD * 2}
        ppu={150}
        drawKey={`${Math.floor(frame / 2)}`}
        opacity={a}
        renderOrder={3}
        draw={(ctx, W, H) => {
          const ppu = W / (w + PAD * 2);
          drawOutputCard(ctx, pal, W, H, PAD * ppu, ppu, icon, kind, frame, reveal);
        }}
      />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Floor text
// ---------------------------------------------------------------------------
export const FloorLabel: React.FC<{
  pal: Palette;
  u: number; // left edge
  v: number; // baseline-ish
  text: string;
  caption: string;
  start: number;
}> = ({ pal, u, v, text, caption, start }) => {
  const frame = useCurrentFrame();
  const chars = Math.floor(clamp01((frame - start) / (text.length * 3)) * text.length + 0.0001);
  const capA = prog(frame, start + text.length * 3, 12, easeOut);
  if (frame < start) return null;
  const w = 8;
  const h = 1.4;
  return (
    <CanvasPlane
      u={u + w / 2}
      v={v + h / 2}
      z={0.04}
      width={w}
      height={h}
      ppu={190}
      drawKey={`${chars}-${Math.round(capA * 20)}`}
      renderOrder={2}
      draw={(ctx) => drawLabel(ctx, pal, 190, text, caption, chars, capA * 0.8)}
    />
  );
};

export const Counter: React.FC<{ pal: Palette; u: number; v: number; seed: number; dot?: string; start: number }> = ({
  pal,
  u,
  v,
  seed,
  dot,
  start,
}) => {
  const frame = useCurrentFrame();
  const a = prog(frame, start, 15, easeOut);
  if (a <= 0) return null;
  return (
    <group>
      <CanvasPlane
        u={u + 1.6}
        v={v + 0.6}
        z={0.04}
        width={3.2}
        height={1.3}
        ppu={150}
        drawKey={Math.floor(frame / 3)}
        renderOrder={2}
        opacity={a * 0.85}
        draw={(ctx) => drawCounter(ctx, pal, 150, seed, frame, 1)}
      />
      {dot && (
        <CanvasPlane
          u={u - 0.5}
          v={v + 0.35}
          z={0.25}
          width={0.9}
          height={0.9}
          ppu={80}
          drawKey={dot}
          additive
          opacity={a * (0.7 + 0.3 * Math.sin(frame * 0.2 + seed))}
          renderOrder={2}
          draw={(ctx, W) => {
            const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
            g.addColorStop(0, "#ffffff");
            g.addColorStop(0.18, dot);
            g.addColorStop(0.45, rgba(dot, 0.25));
            g.addColorStop(1, rgba(dot, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, W);
          }}
        />
      )}
    </group>
  );
};

/** Dim block of tiny log text etched on the floor (secondary UI filler). */
export const DataBlock: React.FC<{ pal: Palette; u: number; v: number; seed: number; start: number }> = ({
  pal,
  u,
  v,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const a = prog(frame, start, 20, easeOut);
  if (a <= 0) return null;
  const rows = 7;
  const shown = Math.ceil(a * rows);
  return (
    <CanvasPlane
      u={u + 1.8}
      v={v + 1.1}
      z={0.04}
      width={3.6}
      height={2.2}
      ppu={130}
      drawKey={`${shown}-${Math.floor(frame / 8)}`}
      renderOrder={2}
      opacity={0.55}
      draw={(ctx, W) => {
        const ppu = W / 3.6;
        ctx.font = `${Math.round(ppu * 0.16)}px AgentMono`;
        for (let i = 0; i < shown; i++) {
          const n = Math.floor(hash2(seed + i, Math.floor(frame / 8)) * 1e12).toString(16);
          ctx.fillStyle = rgba(i === 0 ? pal.text : pal.textDim, i === 0 ? 0.7 : 0.6);
          ctx.fillText(i === 0 ? "PROCESS LOG" : `${String(i).padStart(2, "0")}  ${n}`, 0, ppu * (0.25 + i * 0.27));
        }
      }}
    />
  );
};
