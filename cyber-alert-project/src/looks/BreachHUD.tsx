import React from "react";
import { AbsoluteFill } from "remotion";
import { makeCode } from "../lib/code";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { osc, useLoopFrame, useUnits } from "../lib/loop";
import { hash01, mulberry32, range } from "../lib/random";
import { CodeText, MiniLogin, ThreatMap, WarningIcon, popState } from "./hud-parts";
import { POPS } from "./schedules";
import type { HudPalette } from "./palettes";

// ---------------------------------------------------------------------------
// Depth layers, far to near. Every layer is a flat plane, turned by the same
// mild rotateY/rotateX and pushed to its own z. Blur grows with distance from
// the focus layer (index 2). Each layer is pre-scaled by (P - z) / P so its
// content is authored at screen size; the camera drift gives the parallax.
// ---------------------------------------------------------------------------
const P = 1000;
const LAYERS = [
  { z: -1400, blur: 3 },
  { z: -650, blur: 1.2 },
  { z: 0, blur: 0 },
  { z: 240, blur: 1.8 },
  { z: 430, blur: 4.5 },
];
const TILT_Y = -12;
const TILT_X = 3;

type Kind = "code" | "login" | "map" | "mosaic" | "frame" | "dust" | "square";
type Item = { layer: number; kind: Kind; x: number; y: number; w: number; h: number; seed: number; alt: boolean; flag?: { period: number; phase: number }; markers?: boolean };

// Even spread: each layer is a jittered grid over an area larger than the
// frame; kinds are dealt to the cells in a seeded shuffle.
const AREA = { x0: -700, x1: 2350, y0: -260, y1: 1300 };
const MIX: Record<Kind, number>[] = [
  { code: 24, login: 5, map: 5, mosaic: 2, frame: 3, dust: 1, square: 4 },
  { code: 24, login: 7, map: 4, mosaic: 2, frame: 3, dust: 0, square: 4 },
  { code: 18, login: 7, map: 3, mosaic: 1, frame: 3, dust: 1, square: 3 },
  { code: 6, login: 1, map: 1, mosaic: 1, frame: 1, dust: 0, square: 2 },
  { code: 3, login: 0, map: 0, mosaic: 1, frame: 0, dust: 0, square: 2 },
];
const PERIODS = [60, 75, 100, 120, 150, 200];
// The field reads as one sheet turned away to the right: blur rises with x.
const rightBlur = (x: number, layer: number) => (layer >= 3 ? 0 : Math.min(1, Math.max(0, (x - 1150) / 750)) * 4.5);

const buildItems = (): Item[] => {
  const r = mulberry32(0x13320502);
  const items: Item[] = [];
  MIX.forEach((mix, layer) => {
    const kinds: Kind[] = [];
    (Object.keys(mix) as Kind[]).forEach((k) => {
      for (let i = 0; i < mix[k]; i++) kinds.push(k);
    });
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const n = kinds.length;
    const cols = Math.ceil(Math.sqrt(n * 2));
    const rows = Math.ceil(n / cols);
    const cw = (AREA.x1 - AREA.x0) / cols;
    const ch = (AREA.y1 - AREA.y0) / rows;
    const near = layer >= 3 ? 1.15 : 1;
    kinds.forEach((kind, i) => {
      const cx = AREA.x0 + ((i % cols) + range(r, 0.15, 0.85)) * cw;
      const cy = AREA.y0 + (Math.floor(i / cols) + range(r, 0.15, 0.85)) * ch;
      let w = 0;
      let h = 0;
      if (kind === "code") [w, h] = [range(r, 190, 360) * near, range(r, 110, 260) * near];
      else if (kind === "login") [w, h] = [range(r, 160, 190) * near, 0];
      else if (kind === "square") [w, h] = [range(r, 120, 320) * near, range(r, 100, 260) * near];
      else if (kind === "map") [w, h] = [range(r, 240, 480) * near, 0];
      else if (kind === "mosaic") [w, h] = [range(r, 220, 420) * near, range(r, 140, 300) * near];
      else if (kind === "frame") [w, h] = [range(r, 120, 200) * near, range(r, 95, 150) * near];
      else [w, h] = [range(r, 500, 800), range(r, 300, 500)];
      if (kind === "login") h = w * 0.62;
      if (kind === "map") h = w * 0.42;
      items.push({
        layer,
        kind,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        seed: Math.floor(r() * 1e6),
        alt: r() < 0.45,
        markers: kind === "map" && layer === 2,
        flag: kind === "frame" || (kind === "login" && r() < 0.3) ? { period: PERIODS[Math.floor(r() * PERIODS.length)], phase: Math.floor(r() * 60) } : undefined,
      });
    });
  });
  return items;
};
const ITEMS = buildItems();
const CODE = new Map(ITEMS.filter((i) => i.kind === "code").map((i) => [i.seed, makeCode(i.seed, 36 + (i.seed % 3) * 12, 46)]));

// Pixel-block mosaics: fixed sets of grid cells per item.
const MOSAIC = new Map(
  ITEMS.filter((i) => i.kind === "mosaic").map((it) => {
    const r = mulberry32(it.seed);
    const cell = 16;
    const cells: { x: number; y: number; a: number; blink: number }[] = [];
    for (let y = 0; y < it.h; y += cell) {
      for (let x = 0; x < it.w; x += cell) {
        const edge = Math.min(x, y, it.w - x, it.h - y) / Math.min(it.w, it.h);
        if (r() < 0.32 + edge * 0.9) cells.push({ x, y, a: range(r, 0.1, 0.42), blink: r() < 0.15 ? Math.floor(r() * 30) : -1 });
      }
    }
    return [it.seed, { cell, cells }];
  }),
);

// Drifting dust particles: closed orbits, whole cycles per loop.
const DUST = new Map(
  ITEMS.filter((i) => i.kind === "dust").map((it) => {
    const r = mulberry32(it.seed);
    return [
      it.seed,
      Array.from({ length: 12 }, () => ({ x: range(r, 0, it.w), y: range(r, 0, it.h), a: range(r, 6, 26), k: 1 + Math.floor(r() * 2), ph: r(), s: range(r, 1, 2), o: range(r, 0.12, 0.35) })),
    ];
  }),
);

// Red glitch streaks along the top-right edge: broken horizontal lines whose
// segments re-shuffle every 3 frames (200 times per loop).
const STREAKS = (() => {
  const r = mulberry32(0x5e7ea4);
  return Array.from({ length: 20 }, () => ({ y: range(r, 0, 330), x0: range(r, 1250, 1700), len: range(r, 120, 700), h: range(r, 1.2, 4), o: range(r, 0.25, 0.8), salt: Math.floor(r() * 9999) }));
})();

const RedFrame: React.FC<{ p: HudPalette; u: number; w: number; h: number; id: string; strength?: number; fill?: number }> = ({ p, u, w, h, id, strength = 0.8, fill = 0 }) => {
  const m = 30;
  return (
    <svg viewBox={`${-m} ${-m} ${w + 2 * m} ${h + 2 * m}`} style={{ position: "absolute", left: -m * u, top: -m * u, width: (w + 2 * m) * u, height: (h + 2 * m) * u, overflow: "visible" }}>
      <defs>
        <GlowFilter id={id} base={1.4} gain={strength} weights={[0.9, 0.6, 0.35]} />
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={p.alert} fillOpacity={fill} stroke={p.alert} strokeOpacity={0.8} strokeWidth={1.8} filter={`url(#${id})`} />
    </svg>
  );
};

const renderItem = (it: Item, p: HudPalette, u: number, f: number, id: string) => {
  switch (it.kind) {
    case "code": {
      const size = it.layer >= 3 ? 9 : 8;
      return (
        <CodeText
          lines={CODE.get(it.seed)!}
          laps={1 + (it.seed % 2)}
          f={f}
          u={u}
          color={it.alt ? p.textAlt : p.text}
          dim={p.dim}
          hot={p.alert}
          size={size}
          rows={Math.ceil(it.h / (size * 1.35))}
        />
      );
    }
    case "login":
      return <MiniLogin p={p} u={u} f={f} offset={it.seed % 150} w={it.w} />;
    case "map":
      return (
        <div style={{ position: "absolute", inset: 0, maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 55%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 55%, transparent 100%)" }}>
          {/* chromatic fringe: cyan and red copies offset either side */}
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${-2.5 * u}px)`, opacity: 0.45, mixBlendMode: "screen", filter: "sepia(1) hue-rotate(150deg) saturate(4)" }}>
            <ThreatMap p={p} f={f} mode="fill" labels={false} opacity={0.6} dot={2.6} />
          </div>
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${2.5 * u}px)`, opacity: 0.35, mixBlendMode: "screen", filter: "sepia(1) hue-rotate(-50deg) saturate(5)" }}>
            <ThreatMap p={p} f={f} mode="fill" labels={false} opacity={0.6} dot={2.6} />
          </div>
          <ThreatMap p={p} f={f} mode="fill" labels={false} opacity={0.9} dot={2.6} />
        </div>
      );
    case "mosaic": {
      const m = MOSAIC.get(it.seed)!;
      return (
        <svg viewBox={`0 0 ${it.w} ${it.h}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {m.cells.map((c, k) => {
            const on = c.blink < 0 || (f + c.blink) % 30 < 20;
            return on ? <rect key={k} x={c.x} y={c.y} width={m.cell - 2} height={m.cell - 2} fill={p.alert} fillOpacity={c.a * 0.4} /> : null;
          })}
        </svg>
      );
    }
    case "frame": {
      // Permanent flagged panel with a warning inside, pulsing a whole number
      // of times per loop, so several warnings are on screen in every frame.
      const tri = Math.min(it.w, it.h) * 0.5;
      const pulse = 0.7 + 0.3 * osc(f, 6 + (it.seed % 5), (it.seed % 100) / 100);
      return (
        <>
          <RedFrame p={p} u={u} w={it.w} h={it.h} id={`rf-${id}`} fill={it.alt ? 0.14 : 0} />
          <div style={{ position: "absolute", left: ((it.w - tri) / 2) * u, top: ((it.h - tri) / 2) * u, width: tri * u, height: tri * u, opacity: pulse }}>
            <WarningIcon p={p} id={`rw-${id}`} glow={0.9} filled />
          </div>
        </>
      );
    }
    case "square":
      return <div style={{ position: "absolute", inset: 0, background: p.alert, opacity: it.alt ? 0.2 : 0.11 }} />;
    case "dust": {
      const pts = DUST.get(it.seed)!;
      return (
        <svg viewBox={`0 0 ${it.w} ${it.h}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          {pts.map((d, k) => (
            <circle key={k} cx={d.x + d.a * osc(f, d.k, d.ph)} cy={d.y + d.a * 0.6 * osc(f, d.k, d.ph + 0.25)} r={d.s} fill={p.map} fillOpacity={d.o} />
          ))}
        </svg>
      );
    }
  }
};

export const BreachHUD: React.FC<{ palette: HudPalette }> = ({ palette: p }) => {
  const f = useLoopFrame();
  const { u } = useUnits();

  // Camera: closed path, one cycle per loop.
  const camX = 90 * osc(f, 1);
  const camY = 36 * osc(f, 1, 0.25);
  const yaw = 2 * osc(f, 1, 0.1);
  const streakStep = Math.floor(f / 3);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 65% at 45% 50%, ${p.bgCenter} 0%, ${p.bgEdge} 100%)`, overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: P * u, perspectiveOrigin: "50% 50%" }}>
        {LAYERS.map((L, li) => {
          const s = (P - L.z) / P;
          return (
            <AbsoluteFill
              key={li}
              style={{
                transform: `rotateY(${TILT_Y + yaw}deg) rotateX(${TILT_X}deg) translate3d(${-camX * u}px, ${-camY * u}px, ${L.z * u}px) scale(${s})`,
                transformOrigin: "50% 50%",
              }}
            >
              {ITEMS.map((it, k) => {
                if (it.layer !== li) return null;
                const id = `i${k}`;
                const t = it.flag ? (f + it.flag.phase) % it.flag.period : 99;
                const flagOn = t < 24 && Math.floor(t / 4) % 2 === 0;
                return (
                  <div
                    key={k}
                    style={{
                      position: "absolute",
                      left: it.x * u,
                      top: it.y * u,
                      width: it.w * u,
                      height: it.h * u,
                      filter: (() => {
                        const b = L.blur + rightBlur(it.x + it.w / 2, li);
                        return b > 0.05 ? `blur(${b * u}px)` : undefined;
                      })(),
                    }}
                  >
                    {renderItem(it, p, u, f, id)}
                    {flagOn && it.kind !== "frame" ? <RedFrame p={p} u={u} w={it.w + 16} h={it.h + 16} id={`fl-${id}`} strength={0.9} /> : null}
                    {flagOn && it.kind === "frame" ? <div style={{ position: "absolute", inset: 0, background: p.alert, opacity: 0.14 }} /> : null}
                  </div>
                );
              })}
              {POPS.map((q, k) => {
                if (q.layer !== li) return null;
                const st = popState(f, q.start, q.len);
                if (!st) return null;
                const box = q.size * 1.9;
                return (
                  <div
                    key={`pop${k}`}
                    style={{
                      position: "absolute",
                      left: (q.x - box / 2) * u,
                      top: (q.y - box / 2) * u,
                      width: box * u,
                      height: box * u,
                      transform: `scale(${st.scale})`,
                      opacity: st.opacity,
                      filter: (() => {
                        const b = L.blur + rightBlur(q.x, li);
                        return b > 0.05 ? `blur(${b * u}px)` : undefined;
                      })(),
                    }}
                  >
                    {q.framed ? <RedFrame p={p} u={u} w={box} h={box * 0.8} id={`pf${k}`} fill={k % 3 === 0 ? 0.12 : 0} /> : null}
                    <div style={{ position: "absolute", left: ((box - q.size) / 2) * u, top: (box * 0.4 - q.size / 2) * u, width: q.size * u, height: q.size * u }}>
                      <WarningIcon p={p} id={`pw${k}`} glow={1.1} filled />
                    </div>
                  </div>
                );
              })}
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
      {/* Red glitch streaks, top-right */}
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: `blur(${0.6 * u}px)` }}>
        {STREAKS.map((s, k) => {
          const segs = [];
          let x = s.x0 + (hash01(streakStep, s.salt) - 0.5) * 120;
          const end = Math.min(1920, s.x0 + s.len);
          let j = 0;
          while (x < end) {
            const L = 10 + hash01(streakStep * 31 + j, s.salt + 1) * 90;
            if (hash01(streakStep * 17 + j, s.salt + 2) < 0.62) segs.push(<rect key={j} x={x} y={s.y} width={L} height={s.h} />);
            x += L + 4 + hash01(streakStep * 13 + j, s.salt + 3) * 30;
            j++;
          }
          return (
            <g key={k} fill={k % 5 === 0 ? p.textAlt : p.alert} fillOpacity={s.o * (k % 5 === 0 ? 0.5 : 1)}>
              {segs}
            </g>
          );
        })}
      </svg>
      {/* Defocused pink-red haze along the top-right and right edge */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 30% 26% at 92% 6%, ${p.alert}66 0%, ${p.alert}00 100%), radial-gradient(ellipse 14% 42% at 100% 55%, ${p.alert}40 0%, ${p.alert}00 100%)`, mixBlendMode: "screen" }} />
      {/* Faint scanlines and vignette */}
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) ${u}px, rgba(0,0,0,0) ${u}px, rgba(0,0,0,0) ${3 * u}px)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)" }} />
      <Grain opacity={0.024} salt={9} />
    </AbsoluteFill>
  );
};
