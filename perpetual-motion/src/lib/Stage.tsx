import React from "react";
import { AbsoluteFill } from "remotion";
import { LOOKS, lookCss, type Look, type LookName } from "./look.ts";
import { iso, type Projection } from "./iso.ts";
import { WIDTH, HEIGHT, cameraAt, cameraTransform, type Camera } from "./camera.ts";
import { Backdrop, Grain, type FloorShadow } from "./Backdrop.tsx";

export interface MachineProps {
  frame: number;
  look: Look;
}

export interface MachineDef {
  id: string;
  P: Projection;
  shadows: FloorShadow[];
  /** floor grid spacing in world units */
  grid: number;
  Body: React.FC<MachineProps>;
}

function gridPath(P: Projection, spacing: number) {
  // invert the floor's affine map at the four frame corners to find the range
  const o = iso([0, 0, 0], P);
  const ex = iso([1, 0, 0], P);
  const ey = iso([0, 1, 0], P);
  const a = ex[0] - o[0];
  const b = ex[1] - o[1];
  const c = ey[0] - o[0];
  const d = ey[1] - o[1];
  const det = a * d - b * c;
  const toFloor = (sx: number, sy: number) => [(d * (sx - o[0]) - c * (sy - o[1])) / det, (-b * (sx - o[0]) + a * (sy - o[1])) / det];
  const corners = [toFloor(-200, -200), toFloor(WIDTH + 200, -200), toFloor(-200, HEIGHT + 200), toFloor(WIDTH + 200, HEIGHT + 200)];
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) / spacing) * spacing;
  const x1 = Math.ceil(Math.max(...xs) / spacing) * spacing;
  const y0 = Math.floor(Math.min(...ys) / spacing) * spacing;
  const y1 = Math.ceil(Math.max(...ys) / spacing) * spacing;
  const seg = (p: [number, number], q: [number, number]) => `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  const parts: string[] = [];
  for (let x = x0; x <= x1; x += spacing) parts.push(seg(iso([x, y0, 0], P), iso([x, y1, 0], P)));
  for (let y = y0; y <= y1; y += spacing) parts.push(seg(iso([x0, y, 0], P), iso([x1, y, 0], P)));
  return parts.join("");
}

const gridCache = new Map<string, string>();
const gridOf = (def: MachineDef) => {
  const key = def.id;
  if (!gridCache.has(key)) gridCache.set(key, gridPath(def.P, def.grid));
  return gridCache.get(key)!;
};

/** The machine as one SVG. `standalone` paints its own background (for SVG export). */
export const MachineSvg: React.FC<{ def: MachineDef; frame: number; look: Look; camera: Camera; standalone?: boolean; width?: number; height?: number }> = ({
  def,
  frame,
  look,
  camera,
  standalone = false,
  width = WIDTH,
  height = HEIGHT,
}) => {
  const Body = def.Body;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="pm" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={width} height={height} style={standalone ? undefined : { position: "absolute", left: 0, top: 0 }}>
      <style>{lookCss(look)}</style>
      {standalone ? <SvgBackground def={def} look={look} camera={camera} /> : null}
      <g transform={cameraTransform(camera)}>
        <path d={gridOf(def)} fill="none" stroke={look.grid} strokeWidth={2.2} />
        <Body frame={frame} look={look} />
      </g>
    </svg>
  );
};

/** SVG-native background for the vector stills (the video uses the dithered canvas). */
const SvgBackground: React.FC<{ def: MachineDef; look: Look; camera: Camera }> = ({ def, look, camera }) => {
  const [vr, vg, vb] = look.vignette;
  const [sr, sg, sb] = look.shadow;
  return (
    <>
      <defs>
        <radialGradient id="pm-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="0.45" stopColor={`rgb(${vr},${vg},${vb})`} stopOpacity={0} />
          <stop offset="1" stopColor={`rgb(${vr},${vg},${vb})`} stopOpacity={look.vignetteStrength} />
        </radialGradient>
        <filter id="pm-shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="60" />
        </filter>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill={look.background} />
      <g transform={cameraTransform(camera)} filter="url(#pm-shadow-blur)">
        {def.shadows.map((s, i) => {
          const pts: string[] = [];
          for (let k = 0; k < 64; k++) {
            const t = (k / 64) * Math.PI * 2;
            const p = s.power ?? 2;
            const c = Math.cos(t);
            const sn = Math.sin(t);
            const x = s.x + s.rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / p);
            const y = s.y + s.ry * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p);
            const q = iso([x, y, 0], def.P);
            pts.push(`${k ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`);
          }
          return <path key={i} d={pts.join("") + "Z"} fill={`rgb(${sr},${sg},${sb})`} opacity={s.strength * look.shadowStrength} />;
        })}
      </g>
      <rect width={WIDTH} height={HEIGHT} fill="url(#pm-vignette)" />
    </>
  );
};

export interface CompProps {
  look: LookName;
  [key: string]: unknown;
}

/** The video composition: dithered canvas backdrop, the machine SVG, grain on top. */
export const MachineVideo: React.FC<{ def: MachineDef; frame: number; look: LookName }> = ({ def, frame, look }) => {
  const L = LOOKS[look];
  const camera = cameraAt(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: L.background }}>
      <Backdrop look={L} frame={frame} camera={camera} P={def.P} shadows={def.shadows} />
      <MachineSvg def={def} frame={frame} look={L} camera={camera} />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};
