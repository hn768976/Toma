/**
 * Look 4 — Cloud HUD. SVG/HTML for the cloud, rings, icons and arrow;
 * Canvas 2D for the falling binary (clipped to the cloud), bokeh specks
 * and the grain layer; one CSS 3D transform tilts the ring stack into the
 * platform at the end. 450 frames, not a loop.
 */
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { hexToRgb, rgba } from "../lib/color";
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smoothstep, win } from "../lib/ease";
import { drawGrainOverlay } from "../lib/grain2d";
import { hash01, makeRng } from "../lib/random";
import { canvasDpr, sizeCanvas } from "../lib/useCanvas2D";
import type { CloudHudProps } from "../versions";
import { CLOUD_BOX, CLOUD_PATH, cloudAnchor } from "./cloudShape";
import { IconTile, type IconName } from "./icons";

const W = 3840;
const H = 2160;
const CX = W / 2;
const CY = H / 2;

// --------------------------------------------------------------- data
type Ring = {
  r: number;
  w: number;
  dash?: string;
  op: number;
  speed: number; // degrees per frame
  start: number; // draw-on start frame
  platform: boolean; // stays visible as part of the end platform
};

const RINGS: Ring[] = [
  { r: 470, w: 22, dash: "3 16", op: 0.45, speed: 0.22, start: 40, platform: true },
  { r: 640, w: 5, op: 0.55, speed: 0, start: 48, platform: true },
  { r: 780, w: 18, dash: "120 40 30 40", op: 0.5, speed: -0.16, start: 54, platform: true },
  { r: 1060, w: 16, op: 1, speed: 0, start: 60, platform: true },
  { r: 1030, w: 34, dash: "5 26", op: 0.4, speed: 0.1, start: 66, platform: true },
  { r: 1210, w: 46, dash: "260 90 60 90", op: 0.38, speed: -0.08, start: 72, platform: true },
  { r: 1390, w: 6, dash: "40 30", op: 0.5, speed: 0.12, start: 78, platform: true },
  { r: 1560, w: 26, dash: "520 300", op: 0.55, speed: -0.1, start: 84, platform: false },
  { r: 1760, w: 58, dash: "10 46", op: 0.3, speed: 0.06, start: 90, platform: false },
  { r: 1960, w: 44, dash: "5 16", op: 0.38, speed: -0.05, start: 96, platform: false },
  { r: 2250, w: 9, op: 0.35, speed: 0, start: 102, platform: false },
  { r: 2420, w: 50, dash: "4 18", op: 0.3, speed: 0.04, start: 108, platform: false },
  { r: 2750, w: 14, op: 0.6, speed: 0, start: 110, platform: false },
  { r: 3050, w: 60, dash: "220 70 40 70", op: 0.5, speed: 0.03, start: 114, platform: false },
  { r: 3400, w: 10, op: 0.5, speed: 0, start: 118, platform: false },
  // thin circuit-like rings that draw on as the stack tilts into the platform
  { r: 330, w: 5, op: 0.8, speed: 0.3, start: 300, platform: true },
  { r: 560, w: 4, dash: "60 20 8 20", op: 0.7, speed: -0.2, start: 306, platform: true },
  { r: 870, w: 5, dash: "200 40", op: 0.7, speed: 0.12, start: 312, platform: true },
  { r: 1120, w: 4, op: 0.6, speed: 0, start: 318, platform: true },
  { r: 1300, w: 8, dash: "30 14", op: 0.55, speed: -0.1, start: 324, platform: true },
  { r: 1480, w: 4, dash: "300 60 40 60", op: 0.5, speed: 0.08, start: 330, platform: true },
];

// thin layered rings, spaced tighter toward the centre (tunnel depth)
for (let k = 1; k <= 30; k++) {
  const u = k / 30;
  RINGS.push({
    r: 180 + 2300 * Math.pow(u, 1.7),
    w: 2 + (k % 3),
    dash: k % 4 === 0 ? "18 10" : k % 5 === 0 ? "120 30 6 30" : undefined,
    op: 0.1 + 0.32 * u,
    speed: (k % 2 ? 1 : -1) * (0.02 + 0.05 * hash01(k, 41)),
    start: 40 + k * 2.4,
    platform: false,
  });
}

const ICON_ORDER: IconName[] = [
  "document", "database", "image", "lock", "shield", "wifi", "chat",
  "globe", "mail", "link", "gear", "phone", "shield", "database",
];

type Icon = { name: IconName; x: number; y: number; t0: number; angle: number };
const ICONS: Icon[] = (() => {
  const rng = makeRng(0xc10d);
  // pop-up order jumps around the circle, like the reference
  const order = [0, 7, 3, 10, 5, 12, 1, 8, 4, 11, 2, 9, 6, 13];
  return ICON_ORDER.map((name, i) => {
    const half = Math.floor(i / 7);
    const k = i % 7;
    const a = (half === 0 ? -1.2 : Math.PI - 1.2) + (k / 6) * 2.4 + rng.range(-0.06, 0.06);
    const rx = rng.range(1380, 1640);
    const ry = rng.range(760, 900);
    return {
      name,
      angle: a,
      x: CX + Math.cos(a) * rx,
      y: CY + Math.sin(a) * ry,
      t0: 100 + order.indexOf(i) * 13,
    };
  });
})();

type Speck = { a: number; r: number; size: number; speed: number; tw: number; amber: boolean; seed: number };
const SPECKS: Speck[] = (() => {
  const rng = makeRng(0x5bec);
  return Array.from({ length: 260 }, () => ({
    a: rng.range(0, Math.PI * 2),
    r: (rng.chance(0.7) ? Math.sqrt(rng.next()) * 1300 : rng.range(1300, 2300)) + 120,
    size: rng.range(5, 12) * (rng.chance(0.05) ? 2 : 1),
    speed: rng.range(0.6, 2.2),
    tw: rng.range(0, 1),
    amber: rng.chance(0.78),
    seed: rng.int(1, 1e9),
  }));
})();

/** Circuit traces on the end platform: radial runs with a 45-degree jog. */
const PLATFORM_TRACES: string[] = (() => {
  const rng = makeRng(0x7ace5);
  const out: string[] = [];
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const r0 = rng.range(360, 700);
    const r1 = r0 + rng.range(200, 420);
    const r2 = r1 + rng.range(100, 260);
    const jog = rng.range(-0.12, 0.12);
    const pt = (r: number, aa: number) => `${(Math.cos(aa) * r).toFixed(1)} ${(Math.sin(aa) * r).toFixed(1)}`;
    out.push(`M ${pt(r0, a)} L ${pt(r1, a)} L ${pt(r1 + 120, a + jog)} L ${pt(r2, a + jog)}`);
  }
  return out;
})();

type Star = { x: number; y: number; s: number; tw: number };
const STARS: Star[] = (() => {
  const rng = makeRng(0x57a2);
  return Array.from({ length: 40 }, () => ({
    x: rng.range(0, W),
    y: rng.range(0, H * 0.62),
    s: rng.range(2, 5),
    tw: rng.next(),
  }));
})();

// ---------------------------------------------------------- timing
const timeline = (f: number) => {
  const pull = easeInOutCubic(win(f, 0, 64));
  const tilt = easeInOutCubic(win(f, 300, 360));
  return {
    // camera: close on the cloud, pulling back
    zoom: lerp(2.7, 1, pull),
    innerClouds: 1 - smoothstep(18, 62, f),
    binary: smoothstep(40, 90, f),
    hudFade: 1 - smoothstep(300, 336, f),
    tilt,
    arrow: easeOutCubic(win(f, 342, 425)),
    arrowIn: smoothstep(340, 356, f),
  };
};

// ------------------------------------------------------- component
export const CloudHUD: React.FC<CloudHudProps> = ({ background, cyan, amber }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const T = timeline(frame);
  const cyanRgb = hexToRgb(cyan);
  const amberRgb = hexToRgb(amber);

  const specksRef = useRef<HTMLCanvasElement>(null);
  const binaryRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);
  const cloudPath2D = useMemo(() => new Path2D(CLOUD_PATH), []);

  // Cloud placement: zoom about the centre, lift and shrink a little for the end
  const cloudLift = lerp(0, -60, T.tilt);
  const cloudScale = 1.12 * T.zoom * lerp(1, 1.08, T.tilt);
  const cloudTransform = `translate(${CX} ${CY + cloudLift}) scale(${cloudScale})`;

  // HUD rings group: zoomed with the camera; tilts back into the platform
  const platformY = 735;
  const hudScale = T.zoom;

  useLayoutEffect(() => {
    const dpr = canvasDpr(width);
    const pw = width * dpr;
    const ph = height * dpr;
    const k = pw / W;

    // ---- specks (amber bokeh) and end stars
    const sc = specksRef.current!;
    const s = sizeCanvas(sc, pw, ph);
    s.setTransform(k, 0, 0, k, 0, 0);
    s.globalCompositeOperation = "lighter";
    for (const sp of SPECKS) {
      // drift outward, as if flying through
      const rr = (sp.r + frame * sp.speed) * T.zoom;
      const x = CX + Math.cos(sp.a) * rr;
      const y = CY + Math.sin(sp.a) * rr * 0.75;
      const tw = 0.6 + 0.4 * Math.sin((frame / 30) * 2.3 + sp.tw * 6.28);
      const a = tw * T.hudFade * smoothstep(0, 30, frame) * (sp.amber ? 1 : 0.6);
      if (a <= 0.002) continue;
      const c = sp.amber ? amberRgb : cyanRgb;
      const rad = sp.size * 2.4 * Math.sqrt(T.zoom);
      const g = s.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba([255, 240, 220], a));
      g.addColorStop(0.25, rgba(c, a * 0.85));
      g.addColorStop(1, rgba(c, 0));
      s.fillStyle = g;
      s.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const starA = smoothstep(305, 360, frame);
    if (starA > 0) {
      for (const st of STARS) {
        const tw = 0.55 + 0.45 * Math.sin((frame / 30) * 3 + st.tw * 6.28);
        const sg = s.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.s * 2.5);
        sg.addColorStop(0, rgba([210, 240, 255], starA * tw * 0.75));
        sg.addColorStop(0.35, rgba(cyanRgb, starA * tw * 0.35));
        sg.addColorStop(1, rgba(cyanRgb, 0));
        s.fillStyle = sg;
        s.fillRect(st.x - st.s * 2.5, st.y - st.s * 2.5, st.s * 5, st.s * 5);
      }
    }

    // ---- binary rain, clipped to the cloud
    const charH = 60;
    const bc = binaryRef.current!;
    const b = sizeCanvas(bc, pw, ph);
    if (T.binary > 0) {
      b.setTransform(k * cloudScale, 0, 0, k * cloudScale, k * CX, k * (CY + cloudLift));
      b.save();
      b.clip(cloudPath2D);
      b.font = '700 54px "JetBrains Mono"';
      b.shadowColor = rgba(cyanRgb, 0.9);
      b.shadowBlur = 14 * k * cloudScale;
      b.textAlign = "center";
      b.textBaseline = "middle";
      const colW = 84;
      for (let ci = 0, x = CLOUD_BOX.left + 30; x < CLOUD_BOX.right; x += colW, ci++) {
        const speed = 2.2 + hash01(ci, 7) * 3.2; // px per frame
        const off = frame * speed + hash01(ci, 9) * 900;
        const n0 = Math.floor((CLOUD_BOX.top - off) / charH) - 1;
        const n1 = Math.ceil((CLOUD_BOX.bottom - off) / charH) + 1;
        for (let n = n0; n <= n1; n++) {
          const y = n * charH + off;
          // streams: lit segments of 4-9 characters with gaps between
          const seg = Math.floor(n / 7);
          const lit = hash01(ci, seg, 3) > 0.36;
          if (!lit) continue;
          const pos = ((n % 7) + 7) % 7; // 6 = lowest char of the segment (the head)
          const head = pos === 6;
          const a = T.binary * (head ? 1 : 0.5 + 0.5 * (pos / 6));
          const digit = hash01(ci, n, 11 + Math.floor(frame / 9)) > 0.5 ? "1" : "0";
          b.fillStyle = head || pos > 3 ? rgba([235, 252, 255], a) : rgba(cyanRgb, a);
          b.fillText(digit, x, y);
        }
      }
      b.restore();
      // at the end, data keeps streaming down out of the cloud to the platform
      if (T.tilt > 0) {
        const floorLocal = (CY + platformY - (CY + cloudLift)) / cloudScale;
        for (let ci = 0, x = -260; x <= 260; x += 104, ci++) {
          const speed = 4 + hash01(ci, 71) * 3;
          const off = frame * speed;
          for (let n = Math.floor((CLOUD_BOX.bottom - off) / charH) - 1; ; n++) {
            const y = n * charH + off;
            if (y > floorLocal) break;
            if (y < CLOUD_BOX.bottom + 10) continue;
            const fade = 1 - (y - CLOUD_BOX.bottom) / (floorLocal - CLOUD_BOX.bottom);
            if (hash01(ci + 50, Math.floor(n / 5), 3) < 0.35) continue;
            const digit = hash01(ci + 50, n, 11 + Math.floor(frame / 9)) > 0.5 ? "1" : "0";
            b.fillStyle = rgba([220, 250, 255], T.tilt * fade * 0.85);
            b.fillText(digit, x + hash01(ci, 3) * 30, y);
          }
        }
      }
    }

    // ---- grain
    const gc = grainRef.current!;
    const g = sizeCanvas(gc, pw, ph);
    drawGrainOverlay(g, frame, 0.02);
  }, [frame, width, height, T.zoom, T.binary, T.hudFade, cloudScale, cloudLift, cloudPath2D, amberRgb, cyanRgb]);

  // ------------------------------------------------------------ SVG
  // heavy dashed rings give way to the thin ones on the platform
  const hudOpacity = (ring: Ring) => (ring.platform ? (ring.w > 30 ? lerp(1, 0.35, T.tilt) : 1) : T.hudFade);
  const ringNodes = RINGS.map((ring, i) => {
    const circ = 2 * Math.PI * ring.r;
    const draw = easeInOutCubic(win(frame, ring.start, ring.start + 34));
    if (draw <= 0) return null;
    const rot = frame * ring.speed + i * 37;
    return (
      <g key={i} transform={`rotate(${rot})`} opacity={ring.op * hudOpacity(ring)}>
        <mask id={`ringmask-${i}`} maskUnits="userSpaceOnUse" x={-3000} y={-3000} width={6000} height={6000}>
          <circle
            r={ring.r}
            fill="none"
            stroke="#fff"
            strokeWidth={ring.w + 20}
            strokeDasharray={`${draw * circ} ${circ}`}
            transform="rotate(-90)"
          />
        </mask>
        <circle
          r={ring.r}
          fill="none"
          stroke={cyan}
          strokeWidth={ring.w}
          strokeDasharray={ring.dash}
          mask={`url(#ringmask-${i})`}
        />
      </g>
    );
  });

  const arrowTop = lerp(platformY + CY + 40, 470, T.arrow);
  const ARROW_W = 190;
  const HEAD_W = 420;
  const HEAD_H = 250;
  const ARROW_LEN = 1080;
  const arrowPulse = 0.85 + 0.15 * Math.sin((frame / 30) * 4);

  return (
    <AbsoluteFill style={{ background }}>
      {/* background: deep blue, lighter centre; darker top for the end shot */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 72% at 50% 50%, #1a66c8 0%, #0d47a6 30%, ${background} 62%, #031338 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: T.tilt,
          background: `linear-gradient(180deg, #010714 0%, #062058 52%, #0c48a0 74%, #041438 82%, #020a20 100%)`,
        }}
      />
      <canvas ref={specksRef} style={{ position: "absolute", width, height }} />

      {/* ring stack: tilts back (CSS 3D) into the platform */}
      <AbsoluteFill style={{ perspective: `${4000 * (width / W)}px`, perspectiveOrigin: "50% 45%" }}>
        <AbsoluteFill
          style={{
            transform: `translateY(${(platformY * T.tilt * width) / W}px) rotateX(${lerp(0, 85, T.tilt)}deg) scale(${lerp(1, 1.3, T.tilt)})`,
            filter: `blur(${(1.1 * width) / 1280}px)`,
            transformOrigin: "50% 50%",
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} width={width} height={height} style={{ overflow: "visible" }}>
            <defs>
              <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="14" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="b" />
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="platGlow">
                <stop offset="0" stopColor="#bff6ff" stopOpacity="0.95" />
                <stop offset="0.25" stopColor={cyan} stopOpacity="0.55" />
                <stop offset="1" stopColor={cyan} stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`translate(${CX} ${CY}) scale(${hudScale})`} filter="url(#ringGlow)">
              {ringNodes}
              {T.tilt > 0 ? (
                <g opacity={0.55 * T.tilt} stroke={cyan} strokeWidth={4} fill="none">
                  {PLATFORM_TRACES.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
              ) : null}
            </g>
            {/* glowing pool at the platform centre */}
            <circle cx={CX} cy={CY} r={lerp(260, 420, T.arrowIn)} fill="url(#platGlow)" opacity={T.tilt * (0.5 + 0.5 * T.arrowIn)} />
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* connector lines and icons */}
      <svg viewBox={`0 0 ${W} ${H}`} width={width} height={height} style={{ position: "absolute", opacity: T.hudFade }}>
        <defs>
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#lineGlow)">
          {ICONS.map((ic, i) => {
            const lineT = easeOutCubic(win(frame, ic.t0 - 4, ic.t0 + 12));
            if (lineT <= 0) return null;
            const an = cloudAnchor(Math.atan2(ic.y - CY, ic.x - CX));
            const x0 = CX + an.x * cloudScale;
            const y0 = CY + cloudLift + an.y * cloudScale;
            const x1 = lerp(x0, ic.x, lineT);
            const y1 = lerp(y0, ic.y, lineT);
            return (
              <g key={i}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={cyan} strokeWidth={7} opacity={0.95} />
              </g>
            );
          })}
        </g>
        {ICONS.map((ic, i) => {
          const p = win(frame, ic.t0, ic.t0 + 10);
          if (p <= 0) return null;
          const sc = lerp(0.9, 1, easeOutBack(p, 2.2));
          const bob = Math.sin((frame - ic.t0) / 22 + i) * 6;
          return (
            <g key={i} transform={`translate(${ic.x} ${ic.y + bob}) scale(${sc})`} opacity={clamp(p * 1.4)}>
              <IconTile name={ic.name} size={196} cyan={cyan} />
            </g>
          );
        })}
      </svg>

      {/* horizontal light flare through the cloud */}
      <svg viewBox={`0 0 ${W} ${H}`} width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <filter id="flareBlur" x="-20%" y="-300%" width="140%" height="700%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <radialGradient id="flare">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.2" stopColor={cyan} stopOpacity="0.5" />
            <stop offset="1" stopColor={cyan} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="innerGlow">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="0.3" stopColor={cyan} stopOpacity="0.8" />
            <stop offset="1" stopColor={cyan} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cloudFill" x1="0" y1="-350" x2="0" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={cyan} stopOpacity="0.06" />
            <stop offset="0.6" stopColor={cyan} stopOpacity="0.14" />
            <stop offset="1" stopColor="#d8fbff" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <g transform={cloudTransform}>
          <path d={CLOUD_PATH} fill="url(#cloudFill)" opacity={1 - 0.5 * T.tilt} />
          <ellipse cx={0} cy={60} rx={480} ry={300} fill="url(#innerGlow)" opacity={0.5 * T.innerClouds} />
        </g>
        <g transform={`translate(${CX} ${CY + cloudLift + 285 * cloudScale})`} opacity={smoothstep(20, 70, frame)} filter="url(#flareBlur)">
          <ellipse rx={2100} ry={120} fill="url(#flare)" opacity={0.55} />
          <ellipse rx={1500} ry={40} fill="url(#flare)" opacity={1} />
          <ellipse rx={800} ry={12} fill="#fff6e8" opacity={1} />
          <ellipse rx={2000} ry={4} fill="#e8fbff" opacity={0.7 * T.tilt} />
        </g>
        {/* big soft bloom behind the cloud in the end shot */}
        <ellipse cx={CX} cy={CY + cloudLift} rx={1500} ry={900} fill="url(#innerGlow)" opacity={0.22 * T.tilt} />
      </svg>

      <canvas ref={binaryRef} style={{ position: "absolute", width, height }} />

      {/* neon cloud outline (+ nested inner clouds during the opening) */}
      <svg viewBox={`0 0 ${W} ${H}`} width={width} height={height} style={{ position: "absolute" }}>
        <defs>
          <filter id="neon" x="-30%" y="-40%" width="160%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="wide" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="tight" />
            <feMerge>
              <feMergeNode in="wide" />
              <feMergeNode in="wide" />
              <feMergeNode in="tight" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={cloudTransform} filter="url(#neon)">
          <path d={CLOUD_PATH} fill="none" stroke={cyan} strokeWidth={18 / Math.sqrt(cloudScale)} strokeLinejoin="round" />
          <path d={CLOUD_PATH} fill="none" stroke="#f2feff" strokeWidth={6 / Math.sqrt(cloudScale)} strokeLinejoin="round" />
          {T.innerClouds > 0 ? (
            <g opacity={T.innerClouds}>
              <path d={CLOUD_PATH} transform="translate(0 40) scale(0.5)" fill="none" stroke={cyan} strokeWidth={22} />
              <path d={CLOUD_PATH} transform="translate(0 40) scale(0.5)" fill="none" stroke="#f2feff" strokeWidth={8} />
              <path d={CLOUD_PATH} transform="translate(0 50) scale(0.28)" fill={cyan} fillOpacity={0.6} stroke="#ffffff" strokeWidth={10} />
            </g>
          ) : null}
        </g>
      </svg>

      {/* upload arrow, emerging from the platform and rising through the cloud */}
      {T.arrowIn > 0 ? (
        <svg viewBox={`0 0 ${W} ${H}`} width={width} height={height} style={{ position: "absolute" }}>
          <defs>
            <clipPath id="abovePlatform">
              <rect x={0} y={0} width={W} height={CY + platformY + 40} />
            </clipPath>
            <linearGradient id="arrowFill" x1="0" y1={arrowTop} x2="0" y2={arrowTop + ARROW_LEN} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#d8fbff" stopOpacity="0.9" />
              <stop offset="0.3" stopColor={cyan} stopOpacity="0.62" />
              <stop offset="1" stopColor={cyan} stopOpacity="0.12" />
            </linearGradient>
            <filter id="arrowGlow" x="-50%" y="-20%" width="200%" height="140%">
              <feGaussianBlur stdDeviation="26" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g clipPath="url(#abovePlatform)" opacity={T.arrowIn * arrowPulse} filter="url(#arrowGlow)">
            {/* extruded side faces: the arrow reads as a thick glass slab */}
            <path
              d={`M ${CX} ${arrowTop}
                  L ${CX + 56} ${arrowTop - 22}
                  L ${CX + HEAD_W / 2 + 56} ${arrowTop + HEAD_H - 22}
                  L ${CX + HEAD_W / 2} ${arrowTop + HEAD_H} Z
                  M ${CX + ARROW_W / 2} ${arrowTop + HEAD_H}
                  L ${CX + ARROW_W / 2 + 56} ${arrowTop + HEAD_H - 22}
                  L ${CX + ARROW_W / 2 + 56} ${arrowTop + ARROW_LEN - 22}
                  L ${CX + ARROW_W / 2} ${arrowTop + ARROW_LEN} Z`}
              fill={cyan}
              fillOpacity={0.28}
              stroke="#bff6ff"
              strokeOpacity={0.6}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <path
              d={`M ${CX} ${arrowTop}
                  L ${CX + HEAD_W / 2} ${arrowTop + HEAD_H}
                  L ${CX + ARROW_W / 2} ${arrowTop + HEAD_H}
                  L ${CX + ARROW_W / 2} ${arrowTop + ARROW_LEN}
                  L ${CX - ARROW_W / 2} ${arrowTop + ARROW_LEN}
                  L ${CX - ARROW_W / 2} ${arrowTop + HEAD_H}
                  L ${CX - HEAD_W / 2} ${arrowTop + HEAD_H} Z`}
              fill="url(#arrowFill)"
              stroke="#e6fdff"
              strokeWidth={7}
              strokeLinejoin="round"
            />
            <line x1={CX - ARROW_W / 2 + 26} y1={arrowTop + HEAD_H + 10} x2={CX - ARROW_W / 2 + 26} y2={arrowTop + ARROW_LEN} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={10} />
          </g>
        </svg>
      ) : null}

      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,4,20,0) 55%, rgba(0,4,20,0.55) 100%)",
          opacity: 0.6 + 0.4 * T.tilt,
        }}
      />
      <canvas ref={grainRef} style={{ position: "absolute", width, height }} />
    </AbsoluteFill>
  );
};
