import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { INTER, loadInter } from "../shared/fonts";
import { bodiesAt, lightYears, makeCamera, pixelRadius, projectToPx } from "./timeline";

// Label text — exactly as specified.
const LABEL_TEXT: Record<string, string> = {
  Sun: "Sun",
  "Alpha Centauri A": "Alpha Centauri A",
  "Alpha Centauri B": "Alpha Centauri B",
  "Proxima Centauri": "Proxima Centauri",
};

type LabelSpec = {
  body: string;
  fadeIn: [number, number];
  fadeOut?: [number, number];
  /** leader direction: unit-ish vector in screen px (y down) */
  dir: [number, number];
};

const SPECS: LabelSpec[] = [
  { body: "Sun", fadeIn: [18, 38], fadeOut: [100, 122], dir: [1, -0.7] },
  { body: "Alpha Centauri A", fadeIn: [432, 456], dir: [-1, -0.75] },
  { body: "Alpha Centauri B", fadeIn: [468, 492], dir: [1, -0.75] },
  { body: "Proxima Centauri", fadeIn: [504, 528], dir: [1, 0.75] },
];

const ease = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Labels: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  // registers a delayRender on first use; rendering waits until Inter is loaded
  loadInter();

  const u = H / 2160; // design units are 4K pixels
  const cam = makeCamera(frame, W / H);
  const bodies = bodiesAt(frame);

  const counterOpacity = interpolate(frame, [8, 30], [0, 1], ease);
  const ly = lightYears(frame).toFixed(2);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: INTER, color: "white" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {SPECS.map((s) => {
          const b = bodies.find((x) => x.name === s.body)!;
          const scr = projectToPx(cam, b.pos, W, H);
          if (!scr) return null;
          let o = interpolate(frame, s.fadeIn, [0, 1], ease);
          if (s.fadeOut) o *= interpolate(frame, s.fadeOut, [1, 0], ease);
          if (o <= 0) return null;
          const r = Math.max(pixelRadius(b.radius, scr.depth, H), 4 * u);
          const len = 150 * u;
          const n = Math.hypot(s.dir[0], s.dir[1]);
          const dx = s.dir[0] / n;
          const dy = s.dir[1] / n;
          const gap = r * (b.name === "Sun" ? 1.25 : 2.2) + 22 * u;
          const x0 = scr.x + dx * gap;
          const y0 = scr.y + dy * gap;
          const x1 = x0 + dx * len;
          const y1 = y0 + dy * len;
          const tail = 70 * u * Math.sign(dx);
          const right = dx > 0;
          return (
            <g key={s.body} opacity={o}>
              <polyline
                points={`${x0},${y0} ${x1},${y1} ${x1 + tail},${y1}`}
                fill="none"
                stroke="white"
                strokeOpacity={0.8}
                strokeWidth={3 * u}
              />
              <text
                x={x1 + tail + (right ? 18 : -18) * u}
                y={y1}
                dominantBaseline="central"
                textAnchor={right ? "start" : "end"}
                fill="white"
                style={{ fontFamily: INTER, fontWeight: 400, fontSize: 46 * u, letterSpacing: 0.4 * u }}
              >
                {LABEL_TEXT[s.body]}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 150 * u,
          bottom: 130 * u,
          opacity: counterOpacity,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ fontSize: 30 * u, fontWeight: 500, letterSpacing: 5 * u, opacity: 0.7 }}>
          DISTANCE FROM THE SUN
        </div>
        <div style={{ height: 3 * u, width: 380 * u, background: "rgba(255,255,255,0.55)", margin: `${16 * u}px 0` }} />
        <div style={{ fontSize: 68 * u, fontWeight: 300, letterSpacing: 0.5 * u }}>
          {ly} <span style={{ fontSize: 40 * u, fontWeight: 400, opacity: 0.85 }}>light-years</span>
        </div>
      </div>
    </div>
  );
};
