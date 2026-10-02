import React from "react";
import { AbsoluteFill } from "remotion";
import { makeCode } from "../lib/code";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { osc, useLoopFrame, useUnits } from "../lib/loop";
import { mulberry32, range } from "../lib/random";
import { POPS } from "./schedules";
import { CodeText, MiniLogin, ThreatMap, WarningIcon, popState } from "./hud-parts";
import type { HudPalette } from "./palettes";

// ---------------------------------------------------------------------------
// Depth layers, far to near. Every layer is a flat plane, turned by the same
// rotateY/rotateX so the whole field recedes, and pushed to its own z.
// Blur grows with distance from the focus layer (index 2). Each layer is
// pre-scaled by (P - z) / P so its content is authored at screen size.
// ---------------------------------------------------------------------------
const P = 1000;
const LAYERS = [
  { z: -1400, blur: 4.2 },
  { z: -650, blur: 2 },
  { z: 0, blur: 0 },
  { z: 240, blur: 2.8 },
  { z: 430, blur: 7 },
];
const TILT_Y = -22;
const TILT_X = 6;

type Kind = "code" | "login" | "map" | "square" | "frame";
type Item = { layer: number; kind: Kind; x: number; y: number; w: number; h: number; seed: number; flag?: { period: number; phase: number }; hot?: boolean; markers?: boolean };

// Layout: seeded scatter per layer over an area larger than the frame (the
// tilt and the camera drift reveal more on the right and edges).
const buildItems = (): Item[] => {
  const r = mulberry32(0x13320502);
  const items: Item[] = [];
  const counts: Record<Kind, number>[] = [
    { code: 16, login: 6, map: 5, square: 10, frame: 3 },
    { code: 16, login: 6, map: 4, square: 9, frame: 3 },
    { code: 12, login: 6, map: 3, square: 7, frame: 3 },
    { code: 5, login: 2, map: 2, square: 5, frame: 1 },
    { code: 3, login: 1, map: 1, square: 4, frame: 0 },
  ];
  const periods = [60, 75, 100, 120, 150, 200];
  counts.forEach((c, layer) => {
    (Object.keys(c) as Kind[]).forEach((kind) => {
      for (let i = 0; i < c[kind]; i++) {
        const x = range(r, -1000, 2250);
        const y = range(r, -300, 1300);
        const scale = layer >= 3 ? 1.5 : 1;
        let w = 0;
        let h = 0;
        if (kind === "code") {
          w = range(r, 220, 420) * scale;
          h = range(r, 120, 300) * scale;
        } else if (kind === "login") {
          w = range(r, 150, 230) * scale;
          h = w * 0.55;
        } else if (kind === "map") {
          w = range(r, 260, 620) * scale;
          h = w * 0.4;
        } else if (kind === "square") {
          w = range(r, 30, 120) * scale;
          h = w * range(r, 0.6, 1.3);
        } else {
          w = range(r, 160, 300) * scale;
          h = range(r, 120, 220) * scale;
        }
        items.push({
          layer,
          kind,
          x,
          y,
          w,
          h,
          seed: Math.floor(r() * 1e6),
          hot: r() < 0.25,
          markers: kind === "map" && layer === 2,
          flag: kind === "frame" || (kind === "login" && r() < 0.35) ? { period: periods[Math.floor(r() * periods.length)], phase: Math.floor(r() * 60) } : undefined,
        });
      }
    });
  });
  return items;
};
const ITEMS = buildItems();
const CODE = new Map(ITEMS.filter((i) => i.kind === "code").map((i) => [i.seed, makeCode(i.seed, 36 + (i.seed % 3) * 12, 44)]));

const RedFrame: React.FC<{ p: HudPalette; u: number; w: number; h: number; id: string; strength?: number }> = ({ p, u, w, h, id, strength = 1 }) => {
  const m = 30;
  return (
    <svg viewBox={`${-m} ${-m} ${w + 2 * m} ${h + 2 * m}`} style={{ position: "absolute", left: -m * u, top: -m * u, width: (w + 2 * m) * u, height: (h + 2 * m) * u, overflow: "visible" }}>
      <defs>
        <GlowFilter id={id} base={1.2} gain={strength} weights={[0.9, 0.5, 0.25]} />
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={p.alert} fillOpacity={0.06} stroke={p.alert} strokeWidth={2} filter={`url(#${id})`} />
    </svg>
  );
};

const renderItem = (it: Item, p: HudPalette, u: number, f: number, id: string) => {
  switch (it.kind) {
    case "code": {
      const size = it.layer >= 3 ? 13 : 10;
      return (
        <CodeText
          lines={CODE.get(it.seed)!}
          laps={1 + (it.seed % 2)}
          f={f}
          u={u}
          color={p.text}
          dim={p.dim}
          hot={p.alert}
          size={size}
          rows={Math.ceil(it.h / (size * 1.35))}
          hotEvery={it.hot ? 5 : 0}
        />
      );
    }
    case "login":
      return <MiniLogin p={p} u={u} f={f} offset={it.seed % 150} w={it.w} />;
    case "map":
      return <ThreatMap p={p} f={f} mode="fill" labels={it.markers} opacity={0.75} dot={2} />;
    case "square":
      return <div style={{ position: "absolute", inset: 0, background: p.alert, opacity: it.hot ? 0.3 : 0.16 }} />;
    case "frame": {
      // Permanent flagged panel with a warning inside, pulsing a whole number
      // of times per loop, so several warnings are on screen in every frame.
      const tri = Math.min(it.w, it.h) * 0.55;
      const pulse = 0.75 + 0.25 * osc(f, 6 + (it.seed % 5), (it.seed % 100) / 100);
      return (
        <>
          <RedFrame p={p} u={u} w={it.w} h={it.h} id={`rf-${id}`} />
          <div style={{ position: "absolute", left: (it.w - tri) / 2 * u, top: (it.h - tri) / 2 * u, width: tri * u, height: tri * u, opacity: pulse }}>
            <WarningIcon p={p} id={`rw-${id}`} glow={1.1} />
          </div>
        </>
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
  const yaw = 2.2 * osc(f, 1, 0.1);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 45% 50%, ${p.bgCenter} 0%, ${p.bgEdge} 100%)`, overflow: "hidden" }}>
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
                const flagOn = it.flag ? (f + it.flag.phase) % it.flag.period < 24 && Math.floor(((f + it.flag.phase) % it.flag.period) / 4) % 2 === 0 : false;
                return (
                  <div
                    key={k}
                    style={{
                      position: "absolute",
                      left: it.x * u,
                      top: it.y * u,
                      width: it.w * u,
                      height: it.h * u,
                      filter: L.blur ? `blur(${L.blur * u}px)` : undefined,
                    }}
                  >
                    {renderItem(it, p, u, f, id)}
                    {flagOn && it.kind !== "frame" ? <RedFrame p={p} u={u} w={it.w + 16} h={it.h + 16} id={`fl-${id}`} strength={1.3} /> : null}
                    {flagOn && it.kind === "frame" ? <div style={{ position: "absolute", inset: 0, background: p.alert, opacity: 0.18 }} /> : null}
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
                      filter: L.blur ? `blur(${L.blur * u}px)` : undefined,
                    }}
                  >
                    {q.framed ? <RedFrame p={p} u={u} w={box} h={box * 0.8} id={`pf${k}`} /> : null}
                    <div style={{ position: "absolute", left: (box - q.size) / 2 * u, top: (box * 0.4 - q.size / 2) * u, width: q.size * u, height: q.size * u }}>
                      <WarningIcon p={p} id={`pw${k}`} glow={1.2} />
                    </div>
                  </div>
                );
              })}
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)" }} />
      <Grain opacity={0.022} salt={9} />
    </AbsoluteFill>
  );
};
