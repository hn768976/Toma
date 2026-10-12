// Look 1 — City HUD (2D). A satellite-like aerial city under HUD panels; the
// map pans exactly one tile period in 600 frames with a closed ±6% zoom.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { getCity, getCityCanvas, makeCityTexture } from "../city/assets";
import { CityStyle } from "../city/draw";
import { fsMaterial, fullscreenMesh, vec3Of } from "../gl/fullscreen";
import { PostFX } from "../gl/post";
import { Stage, StageFactory } from "../gl/Stage";
import { Bars, BarChart, Brackets, CodeLines, Dial, HudTheme, Rect, SegStrip, Svg, tick, Txt, blink, pad, counterValue } from "../hud/widgets";
import { loopFrame, LOOP, phase } from "../lib/loop";
import { CityHudPalette } from "../versions";

export interface CityHUDProps {
  citySeed: number;
  palette: CityHudPalette;
}

const TEX = 8192;
// visible map width in tiles (tile = 3 km)
const VIEW_W = 0.56;
const ROT = -0.42;

const MAP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tMap;
uniform vec2 uCenter;
uniform float uViewH;
uniform float uRot;
uniform float uAspect;
uniform vec2 uRes;
uniform vec3 uGrid;
uniform float uScanA;
uniform float uScanB;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  p.y = -p.y;
  float c = cos(uRot), s = sin(uRot);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * uViewH + uCenter;
  vec3 col = texture(tMap, q).rgb;

  // fine screen grid every 1/24 of the width
  float cellPx = uRes.x / 24.0;
  vec2 g = abs(fract(gl_FragCoord.xy / cellPx + 0.5) - 0.5) * cellPx;
  float lw = max(1.5, uRes.y / 720.0 * 1.4);
  float d = min(g.x, g.y);
  float line = 1.0 - smoothstep(lw * 0.5 - 0.5, lw * 0.5 + 0.5, d);
  col = mix(col, uGrid, line * 0.22);

  // slow sweeping scanlines (bright edge with a soft trail above)
  float y = 1.0 - vUv.y;
  float px = uRes.y;
  for (int i = 0; i < 2; i++) {
    float sy = i == 0 ? uScanA : uScanB;
    float dy = (y - sy) * px;
    float edge = exp(-dy * dy / (2.0 * pow(lw * 0.8, 2.0)));
    float trail = dy < 0.0 ? exp(dy / (px * 0.05)) : 0.0;
    col += uGrid * (edge * 0.28 + trail * 0.05);
  }
  fragColor = vec4(col, 1.0);
}`;

export const cityHudStyle = (p: CityHudPalette): CityStyle => ({
  size: TEX,
  ground: p.ground,
  widths: [6, 8.5, 12],
  colors: [p.local, p.avenue, p.arterial],
  alphas: [0.85, 0.9, 0.95],
  water: p.water,
  park: p.park,
  lot: p.park,
  rail: p.local,
  buildings: { shades: p.buildings },
  noise: { fine: 0.1, coarse: 0.55 },
});

const makeFactory =
  (props: CityHUDProps): StageFactory =>
  ({ renderer, width, height }) => {
    const city = getCity(props.citySeed);
    const tex = makeCityTexture(renderer, getCityCanvas(props.citySeed, cityHudStyle(props.palette)));
    const start = city.districts[0].seed;
    const mat = fsMaterial(MAP_FRAG, {
      tMap: { value: tex },
      uCenter: { value: new THREE.Vector2() },
      uViewH: { value: 1 },
      uRot: { value: ROT },
      uAspect: { value: width / height },
      uRes: { value: new THREE.Vector2(width, height) },
      uGrid: { value: vec3Of(props.palette.grid) },
      uScanA: { value: 0 },
      uScanB: { value: 0 },
    });
    const scene = new THREE.Scene();
    scene.add(fullscreenMesh(mat));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const post = new PostFX(width, height, { vignette: 0.45, grain: 0.015 });
    return {
      render(r, f) {
        const u = mat.uniforms;
        // pan exactly one tile period along the map x axis; the map is rotated
        // on screen so this reads as a diagonal drift
        u.uCenter.value.set(start.x / city.W + f / LOOP, start.y / city.W + 0.04 * Math.sin(phase(f, 1)));
        const zoom = 1 + 0.06 * Math.sin(phase(f, 1) + 0.6);
        u.uViewH.value = (VIEW_W * (height / width)) / zoom;
        u.uScanA.value = (f / LOOP) % 1;
        u.uScanB.value = ((f * 3) / LOOP + 0.37) % 1;
        post.render(r, f, (rr) => rr.render(scene, cam));
      },
      dispose() {
        tex.dispose();
        mat.dispose();
        post.dispose();
      },
    };
  };

const LABELS = ["DATA ANALYSIS", "CORE DATA", "ENCODING DATA FEED", "POWER OUTPUT", "TARGET", "SECTOR", "SCAN"];

const Overlay: React.FC<{ p: CityHudPalette }> = ({ p }) => {
  const f = loopFrame(useCurrentFrame());
  const theme: HudTheme = { text: p.text, dim: p.dim, accent: p.accent, line: p.text };
  const lx = 70;
  return (
    <AbsoluteFill>
      {/* soft darkening behind the side columns */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1250, height: 2160, background: "linear-gradient(90deg, rgba(2,8,12,0.42), rgba(2,8,12,0.0))" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: 760, height: 2160, background: "linear-gradient(270deg, rgba(2,8,12,0.38), rgba(2,8,12,0.0))" }} />

      {/* top strip */}
      <Rect x={40} y={176} w={1460} h={22} fill={p.text} opacity={0.18} />
      <Rect x={1620} y={176} w={2180} h={22} fill={p.text} opacity={0.12} />
      <CodeLines f={f} x={lx} y={40} rows={3} seed={11} size={22} theme={theme} cols={[6, 18, 6]} />
      <CodeLines f={f} x={1260} y={52} rows={2} seed={12} size={20} theme={theme} cols={[4, 10]} />
      <CodeLines f={f} x={2380} y={40} rows={3} seed={13} size={20} theme={theme} cols={[8, 14, 3]} />
      <Txt x={1640} y={210} size={20} color={p.text} opacity={0.8}>{`SCAN ${pad(counterValue(f, 5, 10, 0, 9999), 4)}  //  SECTOR 7G`}</Txt>

      <Svg>
        {/* left: three dials */}
        {[0, 1, 2].map((i) => (
          <Dial key={i} f={f} x={lx + 40 + i * 150} y={650} r={30} seed={20 + i} theme={theme} cycles={i + 1} />
        ))}
        {/* right: four dials bottom right */}
        {[0, 1, 2, 3].map((i) => (
          <Dial key={i} f={f} x={3270 + i * 150} y={1935} r={42} seed={40 + i} theme={theme} cycles={i % 2 === 0 ? 1 : -2} showNum />
        ))}
        <Brackets x={3220} y={1860} w={620} h={190} len={26} color={p.dim} sw={3} />
        {/* centre crosshair + ring */}
        <g opacity={0.85}>
          <circle cx={1920} cy={1080} r={64} fill="none" stroke={p.text} strokeWidth={3} />
          <circle cx={1920} cy={1080} r={64} fill="none" stroke={p.accent} strokeWidth={5} strokeDasharray="40 361" transform={`rotate(${(f / LOOP) * 360 * 2} 1920 1080)`} />
          <line x1={1920 - 170} y1={1080} x2={1920 - 84} y2={1080} stroke={p.text} strokeWidth={3} />
          <line x1={1920 + 84} y1={1080} x2={1920 + 170} y2={1080} stroke={p.text} strokeWidth={3} />
          <line x1={1920} y1={1080 - 170} x2={1920} y2={1080 - 84} stroke={p.text} strokeWidth={3} />
          <line x1={1920} y1={1080 + 84} x2={1920} y2={1080 + 170} stroke={p.text} strokeWidth={3} />
          <circle cx={1920} cy={1080} r={6} fill={p.accent} />
        </g>
        {/* bottom strip */}
        <line x1={40} y1={2058} x2={3800} y2={2058} stroke={p.text} strokeWidth={2} opacity={0.5} />
      </Svg>
      <Txt x={1920 + 90} y={1080 - 120} size={22} color={p.accent}>{`TARGET ${pad(counterValue(f, 77, 20, 100, 999), 3)}`}</Txt>
      <Txt x={1920 + 90} y={1080 - 90} size={18} color={p.text} opacity={0.8}>{`${(34 + tick(f, 78, 12) * 0.9).toFixed(4)}N  ${(118 + tick(f, 79, 12) * 0.9).toFixed(4)}W`}</Txt>

      {/* left column (30% width) */}
      {[0, 1, 2].map((i) => (
        <Txt key={i} x={lx + 90 + i * 150} y={630} size={20} color={p.text}>{pad(counterValue(f, 30 + i, 15, 0, 99), 2)}</Txt>
      ))}
      <Txt x={lx} y={760} size={30} color={p.text} weight={500}>{`OCS - 0${pad(counterValue(f, 3, 60, 10, 99), 2)}`}</Txt>
      <CodeLines f={f} x={lx} y={810} rows={5} seed={31} size={19} theme={theme} cols={[4, 22]} />
      <Bars f={f} x={lx + 640} y={810} w={300} n={5} h={10} gap={19.5} seed={32} color={p.text} track="rgba(138,232,240,0.12)" />
      <Rect x={lx} y={1100} w={150} h={36} fill={p.text} opacity={0.85} />
      <Rect x={lx + 170} y={1100} w={150} h={36} fill={p.text} opacity={0.55} />
      <Txt x={lx + 14} y={1108} size={20} color="#06161A" weight={700}>{`SCN ${pad(counterValue(f, 8, 30, 0, 99), 2)}`}</Txt>
      <Txt x={lx + 184} y={1108} size={20} color="#06161A" weight={700}>{`AUX ${pad(counterValue(f, 9, 50, 0, 99), 2)}`}</Txt>
      <BarChart f={f} x={lx} y={1170} w={360} h={90} n={18} seed={33} color={p.text} hold={12} />
      <Txt x={lx} y={1300} size={22} color={p.accent}>{"▶"}</Txt>
      <CodeLines f={f} x={lx + 40} y={1300} rows={2} seed={34} size={19} theme={theme} cols={[12, 10]} />

      <Txt x={lx} y={1390} size={26} color={p.text} weight={500}>{`${LABELS[0]} +`}</Txt>
      <Rect x={lx + 320} y={1402} w={700} h={2} fill={p.text} opacity={0.4} />
      <CodeLines f={f} x={lx} y={1440} rows={3} seed={35} size={19} theme={theme} cols={[6, 6, 8, 12]} />
      <Txt x={lx} y={1550} size={26} color={p.text} weight={500}>{`${LABELS[1]} - 04`}</Txt>
      <Rect x={lx + 290} y={1562} w={730} h={2} fill={p.text} opacity={0.4} />
      <CodeLines f={f} x={lx} y={1600} rows={3} seed={36} size={19} theme={theme} cols={[6, 6, 8, 12]} />
      <Txt x={lx} y={1712} size={22} color={p.accent}>{"▲"}</Txt>
      <SegStrip f={f} x={lx + 40} y={1716} w={940} h={14} seed={37} color={p.text} dim={p.dim} n={48} hold={6} />
      <CodeLines f={f} x={lx} y={1770} rows={5} seed={38} size={18} theme={theme} cols={[5, 5, 5, 5, 5, 5]} colGap={1.6} holds={[10, 15, 25]} />
      <Txt x={lx} y={1990} size={20} color={p.text} opacity={0.85}>{`${LABELS[2]}  ${pad(counterValue(f, 39, 6, 0, 99999), 5)}`}</Txt>

      {/* right column (16% width) */}
      <Txt x={3240} y={300} size={24} color={p.text} weight={500}>{`${LABELS[5]} 07-G`}</Txt>
      <CodeLines f={f} x={3240} y={346} rows={6} seed={51} size={18} theme={theme} cols={[5, 14]} />
      <Bars f={f} x={3240} y={560} w={520} n={4} h={8} gap={14} seed={52} color={p.text} track="rgba(138,232,240,0.1)" hold={25} />
      <Txt x={3240} y={700} size={24} color={p.text} weight={500}>{LABELS[3]}</Txt>
      <CodeLines f={f} x={3240} y={746} rows={7} seed={53} size={18} theme={theme} cols={[5, 8, 5]} />
      <Txt x={3240} y={1050} size={24} color={p.text} weight={500}>{`${LABELS[6]} // 2`}</Txt>
      <BarChart f={f} x={3240} y={1100} w={520} h={110} n={26} seed={54} color={p.text} hold={10} />
      {[0, 1, 2, 3, 4].map((i) => {
        const on = blink(f, 60 + i, 30, 0.7);
        return (
          <React.Fragment key={i}>
            <Rect x={3240} y={1300 + i * 92} w={96} h={60} fill={on ? p.text : "none"} stroke={p.text} sw={2} opacity={on ? 0.85 : 0.6} />
            <Txt x={3254} y={1318 + i * 92} size={20} color={on ? "#06161A" : p.text} weight={700}>{`A-${i + 1}`}</Txt>
            <CodeLines f={f} x={3360} y={1306 + i * 92} rows={2} seed={70 + i} size={17} theme={theme} cols={[6, 12]} />
          </React.Fragment>
        );
      })}
      <Txt x={3240} y={1790} size={20} color={p.accent}>{`▶ ${pad(counterValue(f, 88, 20, 0, 9999), 4)} / ${pad(counterValue(f, 89, 30, 0, 9999), 4)}`}</Txt>

      {/* bottom strip */}
      <SegStrip f={f} x={1260} y={2030} w={1900} h={18} seed={90} color={p.text} dim={p.dim} n={90} hold={12} />
      <Txt x={1260} y={2076} size={18} color={p.text} opacity={0.7}>{`${pad(counterValue(f, 91, 30, 0, 999999), 6)}  SEQ ${pad(counterValue(f, 92, 5, 0, 99), 2)}  //  LINK OK`}</Txt>
    </AbsoluteFill>
  );
};

export const CityHUD: React.FC<CityHUDProps> = (props) => {
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useMemo(() => makeFactory(props), [key]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage factory={factory} />
      <Overlay p={props.palette} />
    </AbsoluteFill>
  );
};
