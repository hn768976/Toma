import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Direction, LINE_END, PRESETS } from "../constants";
import { INTER } from "../load-fonts";
import { lineProgress, SceneData } from "./scene-data";

export const LineChart: React.FC<{ data: SceneData; dir: Direction; uid: string }> = ({
  data,
  dir,
  uid,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = H / 2160;
  const preset = PRESETS[dir];

  const geo = useMemo(() => {
    const pts = data.points.map((p) => ({ x: p.x * W, y: p.y * H }));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("");
    return { pts, cum, d, total: cum[cum.length - 1] };
  }, [data.points, W, H]);

  // Head position: progress is along x (constant horizontal sweep).
  const p = lineProgress(frame);
  const n = geo.pts.length;
  const fi = p * (n - 1);
  const j = Math.min(n - 2, Math.floor(fi));
  const f = fi - j;
  const a = geo.pts[j];
  const b = geo.pts[j + 1];
  const head = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  const drawn = geo.cum[j] + (geo.cum[j + 1] - geo.cum[j]) * f;
  const dash = `${drawn.toFixed(2)} ${(geo.total + 10).toFixed(0)}`;

  const pulse = frame > LINE_END ? 1 + 0.28 * Math.sin(((frame - LINE_END) / 30) * Math.PI * 2) ** 2 : 1;
  const headVisible = p > 0.0005;

  const common = {
    d: geo.d,
    fill: "none",
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    strokeDasharray: dash,
    strokeDashoffset: 0,
  };

  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <filter id={`glow-${uid}`} x="-5%" y="-10%" width="110%" height="120%">
            <feGaussianBlur stdDeviation={16 * u} />
          </filter>
          <radialGradient id={`head-${uid}`}>
            <stop offset="0%" stopColor={preset.core} stopOpacity={1} />
            <stop offset="25%" stopColor={preset.line} stopOpacity={0.8} />
            <stop offset="100%" stopColor={preset.line} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* dark outline / shadow so the line reads on any flag (red on red) */}
        <path {...common} stroke="rgba(0,0,0,0.6)" strokeWidth={46 * u} />
        {/* soft glow */}
        <path {...common} stroke={preset.line} strokeWidth={44 * u} opacity={0.75} filter={`url(#glow-${uid})`} />
        {/* coloured body */}
        <path {...common} stroke={preset.line} strokeWidth={25 * u} />
        {/* near-white core */}
        <path {...common} stroke={preset.core} strokeWidth={8 * u} opacity={0.92} />
        {headVisible ? (
          <g transform={`translate(${head.x.toFixed(2)} ${head.y.toFixed(2)})`}>
            <circle r={110 * u * pulse} fill={`url(#head-${uid})`} opacity={0.75} />
            <circle r={20 * u * pulse} fill={preset.core} stroke="rgba(0,0,0,0.5)" strokeWidth={5 * u} />
          </g>
        ) : null}
      </svg>
      {data.labels.map((l, i) => {
        if (frame < l.appearFrame) return null;
        const pt = geo.pts[l.index];
        const t = frame - l.appearFrame;
        const s = interpolate(t, [0, 12], [0, 1], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(2.2)),
        });
        const o = interpolate(t, [0, 6], [0, 1], { extrapolateRight: "clamp" });
        const valueSize = (l.big ? 88 : 52) * u;
        const flip = pt.x > W * 0.86; // keep text inside the frame on the right edge
        const offY = (l.above ? -1 : 1) * (l.big ? 70 : 46) * u;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pt.x,
              top: pt.y,
              opacity: o,
              transform: `scale(${s.toFixed(4)})`,
              transformOrigin: "0 0",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -11 * u,
                top: -11 * u,
                width: 22 * u,
                height: 22 * u,
                borderRadius: "50%",
                background: "#FFFFFF",
                boxShadow: `0 0 ${18 * u}px ${preset.line}, 0 0 0 ${4 * u}px rgba(0,0,0,0.55)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: flip ? undefined : 26 * u,
                right: flip ? 26 * u : undefined,
                top: offY,
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: valueSize,
                lineHeight: 1.05,
                color: "#FFFFFF",
                textAlign: flip ? "right" : "left",
                textShadow: `0 0 ${10 * u}px rgba(0,0,0,0.9), 0 0 ${3 * u}px rgba(0,0,0,0.9)`,
              }}
            >
              {l.value}
              <div
                style={{
                  fontFamily: INTER,
                  fontWeight: 600,
                  fontSize: valueSize * 0.68,
                  color: preset.line,
                }}
              >
                {l.pct}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
