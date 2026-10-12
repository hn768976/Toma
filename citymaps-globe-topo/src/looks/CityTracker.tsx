// Look 3 — City Tracker (2D). A map window with a yellow location dot that
// travels a closed 2.5 km loop through the street graph (one lap per 600
// frames). The map follows a smoothed dot position and leans into turns.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { getCity, getCityCanvas, makeCityTexture } from "../city/assets";
import { CityStyle } from "../city/draw";
import { followCamera, routeSmooth } from "../city/route";
import { fsMaterial, fullscreenMesh, vec3Of } from "../gl/fullscreen";
import { PostFX } from "../gl/post";
import { Stage, StageFactory } from "../gl/Stage";
import { Bars, Brackets, CodeLines, HudTheme, Rect, SegStrip, Svg, tick, Txt, counterValue, pad, blink } from "../hud/widgets";
import { hash01 } from "../lib/random";
import { LOOP, loopFrame } from "../lib/loop";
import { CityTrackerPalette } from "../versions";

export interface CityTrackerProps {
  citySeed: number;
  palette: CityTrackerPalette;
}

const TEX = 8192;
// map window in composition pixels
const WIN = { x: 790, y: 212, w: 3050, h: 1640 };
const VIEW_W = 0.86; // tiles across the window

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tMap;
uniform vec2 uCenter;   // tile uv at window centre
uniform float uScale;   // tile uv per buffer pixel
uniform float uRot;
uniform vec4 uWin;      // buffer px: x, y(top), w, h
uniform vec2 uRes;
uniform vec2 uDot;      // buffer px (top-left origin)
uniform vec3 uDotCol;
uniform vec3 uPanel;
uniform float uPulse;
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col = uPanel * (0.85 + 0.15 * (1.0 - vUv.y));
  vec2 lo = uWin.xy;
  vec2 hi = uWin.xy + uWin.zw;
  if (px.x >= lo.x && px.y >= lo.y && px.x < hi.x && px.y < hi.y) {
    vec2 p = px - (lo + hi) * 0.5;
    float c = cos(uRot), s = sin(uRot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * uScale + uCenter;
    col = texture(tMap, q).rgb;
    // gentle inner vignette inside the window
    vec2 e = min(px - lo, hi - px) / uRes.y;
    col *= 0.75 + 0.25 * smoothstep(0.0, 0.12, min(e.x, e.y));
    // the dot: core + halo + a soft pulse ring
    float k = uRes.y / 720.0;
    float d = length(px - uDot) / k;
    float core = 1.0 - smoothstep(8.0, 9.2, d);
    float ring = smoothstep(9.6, 10.6, d) * (1.0 - smoothstep(11.2, 12.4, d));
    float halo = exp(-d * d / 260.0) * 0.4;
    float pr = mix(8.0, 26.0, uPulse);
    float pulse = exp(-pow((d - pr) / 1.4, 2.0)) * (1.0 - uPulse) * 0.6;
    col = mix(col, uDotCol * 0.35, clamp(halo, 0.0, 1.0) * 0.6);
    col += uDotCol * (halo * 0.6 + pulse);
    col = mix(col, uDotCol * 0.95, core);
    col = mix(col, vec3(1.0, 0.98, 0.8), (1.0 - smoothstep(3.0, 4.2, d)) * 0.6);
    col = mix(col, uDotCol, ring * 0.9);
  }
  fragColor = vec4(col, 1.0);
}`;

export const cityTrackerStyle = (p: CityTrackerPalette): CityStyle => ({
  size: TEX,
  ground: p.block,
  widths: [10.4, 12, 15],
  colors: [p.local, p.local, p.avenue],
  alphas: [0.55, 0.75, 0.9],
  water: p.water,
  park: p.water,
  lot: p.water,
  rail: p.local,
  halo: { color: p.avenue, width: 70, alpha: 0.3 },
});

const camAt = (props: CityTrackerProps, f: number) => {
  const city = getCity(props.citySeed);
  const r = city.route;
  const s = (r.length * f) / LOOP;
  const cam = followCamera(r, s);
  // dot drawn at a short arc-length average (±18 m): exact on straight
  // streets, eased through corners
  const dot = routeSmooth(r, s, 18, 24);
  return { city, cam, dot };
};

const makeFactory =
  (props: CityTrackerProps): StageFactory =>
  ({ renderer, width, height }) => {
    const city = getCity(props.citySeed);
    const tex = makeCityTexture(renderer, getCityCanvas(props.citySeed, cityTrackerStyle(props.palette)));
    const k = width / 3840;
    const scale = VIEW_W / (WIN.w * k);
    const mat = fsMaterial(FRAG, {
      tMap: { value: tex },
      uCenter: { value: new THREE.Vector2() },
      uScale: { value: scale },
      uRot: { value: 0 },
      uWin: { value: new THREE.Vector4(WIN.x * k, WIN.y * k, WIN.w * k, WIN.h * k) },
      uRes: { value: new THREE.Vector2(width, height) },
      uDot: { value: new THREE.Vector2() },
      uDotCol: { value: vec3Of(props.palette.dot) },
      uPanel: { value: vec3Of(props.palette.panel) },
      uPulse: { value: 0 },
    });
    const scene = new THREE.Scene();
    scene.add(fullscreenMesh(mat));
    const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const post = new PostFX(width, height, { vignette: 0.25, grain: 0.015, bloom: { strength: 0.18, threshold: 0.6, knee: 0.3, radius: 1 } });
    return {
      render(r, f) {
        const { cam, dot } = camAt(props, f);
        const u = mat.uniforms;
        u.uCenter.value.set(cam.center.x / city.W, cam.center.y / city.W);
        u.uRot.value = cam.rot;
        // dot screen position: inverse of the map transform
        const dx = (dot.x - cam.center.x) / city.W / scale;
        const dy = (dot.y - cam.center.y) / city.W / scale;
        const c = Math.cos(-cam.rot);
        const s = Math.sin(-cam.rot);
        u.uDot.value.set((WIN.x + WIN.w / 2) * k + c * dx - s * dy, (WIN.y + WIN.h / 2) * k + s * dx + c * dy);
        u.uPulse.value = (f % 40) / 40;
        post.render(r, f, (rr) => rr.render(scene, ocam));
      },
      dispose() {
        tex.dispose();
        mat.dispose();
        post.dispose();
      },
    };
  };

const Overlay: React.FC<{ p: CityTrackerPalette }> = ({ p }) => {
  const f = loopFrame(useCurrentFrame());
  const theme: HudTheme = { text: p.text, dim: "#6A7676", accent: p.highlight, line: p.text };
  const x0 = 50;
  // glitch line flickers on fixed frames
  const glitchOn = hash01(Math.floor(f / 2), 71) < 0.22;
  return (
    <AbsoluteFill>
      {/* top glitch bar */}
      <Svg>
        {/* continuous glowing grey band */}
        <defs>
          <linearGradient id="topband" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.text} stopOpacity={0.05} />
            <stop offset="0.5" stopColor={p.text} stopOpacity={0.2} />
            <stop offset="1" stopColor={p.text} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <rect x={0} y={30} width={3840} height={150} fill="url(#topband)" />
        <line x1={0} y1={96} x2={3840} y2={96} stroke={p.text} strokeWidth={3} opacity={0.5} />
        {Array.from({ length: 120 }, (_, i) => (
          <line key={`t${i}`} x1={i * 32} y1={86} x2={i * 32} y2={i % 5 === 0 ? 70 : 80} stroke={p.text} strokeWidth={2} opacity={0.45} />
        ))}
        <circle cx={1420} cy={96} r={34} fill="none" stroke={p.text} strokeWidth={3} opacity={0.55} />
        <circle cx={1500} cy={96} r={22} fill="none" stroke={p.text} strokeWidth={3} opacity={0.55} />
        {Array.from({ length: 70 }, (_, i) => {
          const h = hash01(i, 5);
          const x = h * 3840;
          const w = 8 + hash01(i, 6) * (glitchOn ? 220 : 60);
          const on = glitchOn || hash01(i, Math.floor(f / 6), 9) < 0.5;
          return on ? <rect key={i} x={x} y={60 + hash01(i, 7) * 60} width={w} height={2 + hash01(i, 8) * (glitchOn ? 20 : 6)} fill={p.text} opacity={0.15 + 0.4 * hash01(i, 10)} /> : null;
        })}
        <circle cx={600} cy={96} r={26} fill="none" stroke={p.text} strokeWidth={2} opacity={0.4} />
        <Brackets x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} len={60} color={p.text} sw={3} />
      </Svg>

      {/* left panel */}
      <Rect x={x0} y={250} w={260} h={4} fill={p.text} opacity={0.5} />
      <Rect x={x0} y={290} w={180} h={4} fill={p.text} opacity={0.35} />
      <CodeLines f={f} x={x0 + 450} y={240} rows={4} seed={101} size={19} theme={theme} cols={[6, 4]} />
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <Rect x={x0 + i * 230} y={400} w={200} h={34} fill="rgba(200,208,208,0.16)" />
          <Txt x={x0 + 14 + i * 230} y={408} size={19} color={p.text}>{`${pad(counterValue(f, 110 + i, 30, 0, 999), 3)}-${pad(counterValue(f, 120 + i, 50, 0, 99), 2)}`}</Txt>
        </React.Fragment>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <React.Fragment key={i}>
          <Rect x={x0} y={480 + i * 36} w={12} h={12} fill={i === 1 ? p.highlight : p.text} r={6} />
          <Rect x={x0 + 30} y={485 + i * 36} w={360 * (0.3 + 0.7 * tick(f, 130 + i, 25))} h={3} fill={p.text} opacity={0.6} />
          <Txt x={x0 + 560} y={478 + i * 36} size={18} color={p.text} opacity={0.75}>{pad(counterValue(f, 140 + i, 15, 0, 9999), 4)}</Txt>
        </React.Fragment>
      ))}
      <Txt x={x0} y={700} size={28} color={p.text} weight={500}>DATA ANALYSIS +</Txt>
      <CodeLines f={f} x={x0} y={752} rows={4} seed={150} size={18} theme={theme} cols={[6, 6, 10, 5]} colGap={1} />
      <Txt x={x0} y={880} size={28} color={p.text} weight={500}>{`CORE DATA - 0${counterValue(f, 151, 100, 1, 9)}`}</Txt>
      <CodeLines f={f} x={x0} y={932} rows={3} seed={152} size={18} theme={theme} cols={[6, 6, 10, 5]} colGap={1} />
      <SegStrip f={f} x={x0} y={1050} w={680} h={10} seed={153} color={p.text} dim="#3A4444" n={40} hold={10} />
      {[0, 1].map((i) => (
        <React.Fragment key={i}>
          <Rect x={x0 + i * 120} y={1110} w={92} h={110} stroke={p.text} sw={3} />
          <Txt x={x0 + 16 + i * 120} y={1150} size={30} color={p.text} weight={700}>{pad(counterValue(f, 160 + i, 60, 10, 99), 2)}</Txt>
        </React.Fragment>
      ))}
      <Txt x={x0 + 270} y={1120} size={20} color={p.text}>{`DATA PROCESSING ${counterValue(f, 162, 20, 0, 9)}`}</Txt>
      <CodeLines f={f} x={x0 + 270} y={1156} rows={3} seed={163} size={16} theme={theme} cols={[22]} />
      <CodeLines f={f} x={x0} y={1290} rows={6} seed={170} size={18} theme={theme} cols={[5, 3, 3, 3, 3, 3, 3, 3]} colGap={0.9} holds={[6, 10, 15]} />
      <Bars f={f} x={x0} y={1540} w={680} n={2} h={6} gap={16} seed={171} color={p.text} track="rgba(200,208,208,0.12)" />
      <Txt x={x0} y={1620} size={24} color={p.text} weight={500}>ENCODING DATA FEED</Txt>
      <CodeLines f={f} x={x0} y={1666} rows={2} seed={172} size={17} theme={theme} cols={[14, 14]} />
      <Rect x={x0} y={1752} w={680} h={3} fill={p.text} opacity={0.35} />
      {/* bottom-left grid of tiny numbers */}
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <Txt key={`${r}-${c}`} x={x0 + c * 115} y={1900 + r * 52} size={18} color={p.text} opacity={0.75}>
            {pad(counterValue(f, 180 + r * 6 + c, [10, 15, 20, 30][(r + c) % 4], 0, 999), 3)}
          </Txt>
        )),
      )}

      {/* bottom strip */}
      <Rect x={WIN.x} y={1880} w={WIN.w} h={2} fill={p.text} opacity={0.3} />
      {[0, 1, 2, 3].map((i) => (
        <React.Fragment key={i}>
          <Rect x={WIN.x + i * 100} y={1910} w={80} h={80} fill={blink(f, 200 + i, 20, 0.6) ? "rgba(200,208,208,0.22)" : "rgba(200,208,208,0.08)"} stroke={p.text} sw={2} />
          <Txt x={WIN.x + 14 + i * 100} y={1938} size={22} color={p.text}>{pad(counterValue(f, 210 + i, 30, 0, 99), 2)}</Txt>
        </React.Fragment>
      ))}
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <Txt x={WIN.x + 460 + i * 600} y={1910} size={18} color={i === 0 ? p.highlight : p.text}>{`● ${["TRACK", "SECTOR", "SCAN"][i]} - ${pad(counterValue(f, 220 + i, 60, 0, 99), 2)}`}</Txt>
          <CodeLines f={f} x={WIN.x + 460 + i * 600} y={1950} rows={4} seed={230 + i} size={16} theme={theme} cols={[6, 18]} />
        </React.Fragment>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <React.Fragment key={i}>
          <Rect x={2880 + i * 158} y={1905} w={130} h={90} stroke={p.text} sw={2} fill={i === 2 ? "rgba(90,216,200,0.25)" : "none"} />
          <Txt x={2900 + i * 158} y={1925} size={20} color={p.text}>{pad(counterValue(f, 240 + i, 40, 0, 99), 2)}</Txt>
          <Rect x={2900 + i * 158} y={1965} w={90 * (0.2 + 0.8 * tick(f, 250 + i, 20))} h={6} fill={i === 2 ? p.highlight : p.text} />
        </React.Fragment>
      ))}
      <SegStrip f={f} x={2880} y={2050} w={930} h={12} seed={260} color={p.text} dim="#3A4444" n={60} hold={12} />
      <Txt x={WIN.x + WIN.w - 40} y={WIN.y + 30} size={20} color={p.text} align="right" width={900} opacity={0.85}>{`LAT ${(34.05 + tick(f, 270, 10) * 0.01).toFixed(5)}  LON ${(118.24 + tick(f, 271, 10) * 0.01).toFixed(5)}`}</Txt>
      <Txt x={WIN.x + 40} y={WIN.y + 30} size={20} color={p.highlight}>{`▶ TRACKING  ${pad(Math.floor((f / LOOP) * 2500), 4)} M`}</Txt>
    </AbsoluteFill>
  );
};

export const CityTracker: React.FC<CityTrackerProps> = (props) => {
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useMemo(() => makeFactory(props), [key]);
  return (
    <AbsoluteFill style={{ background: props.palette.panel }}>
      <Stage factory={factory} />
      <Overlay p={props.palette} />
    </AbsoluteFill>
  );
};
