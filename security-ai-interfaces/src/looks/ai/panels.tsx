import React from "react";
import { Icon, IconName } from "../../lib/icons";
import { blink, bump, clamp, cyc, cycFrame, cycIndex, lerp, smooth, stepF, t01 } from "../../lib/loop";
import { makeDrift } from "../../lib/random";
import { GLOW, GLOW_SOFT, GLOW_STRONG } from "../../lib/Stage";
import { Clip, PanelRect, RingGauge, Txt } from "../../lib/ui";
import {
  AI_LOG,
  AL,
  BUILD_LOG,
  CODE_TOKENS,
  GLOBE_POINTS,
  makeNet,
  QA,
  SPARKS,
  STOP_GROUP,
  TREE,
  TREE_STOPS,
  wrap,
} from "./data";
import { AiTheme } from "./theme";

// Shared panels for looks 3 and 5 so both layouts read as one product.

export type Ctx = { f: number; th: AiTheme };
type Box = { x: number; y: number; w: number; h: number; uid: string };

const D = {
  cpu: makeDrift(4001, [1, 2, 3]),
  mem: makeDrift(4002, [1, 2]),
  gpu: makeDrift(4003, [1, 3, 4]),
  net: makeDrift(4004, [2, 3, 5]),
  lat: makeDrift(4005, [1, 4]),
  tok: makeDrift(4006, [1, 2, 5]),
  ctx: makeDrift(4007, [1]),
  conf: makeDrift(4008, [1, 2]),
};

// ----------------------------------------------------------- chrome --
export const Panel: React.FC<
  Ctx & Box & { title: React.ReactNode; controls?: boolean; children?: React.ReactNode; head?: number }
> = ({ th, x, y, w, h, title, controls = true, children, head = 36 }) => (
  <g>
    <PanelRect x={x} y={y} w={w} h={h} r={7} fill={th.panel} stroke={th.border} sw={1} />
    <line x1={x + 1} y1={y + head} x2={x + w - 1} y2={y + head} stroke={th.border} strokeWidth={1} />
    {typeof title === "string" ? (
      <Txt x={x + 14} y={y + 23} size={12} weight={600} ls={1} fill={th.text}>
        {title}
      </Txt>
    ) : (
      title
    )}
    {controls ? (
      <g>
        <Icon name="minus" x={x + w - 64} y={y + 12} size={12} color={th.textFaint} sw={1.2} />
        <Icon name="square" x={x + w - 46} y={y + 12} size={12} color={th.textFaint} sw={1.2} />
        <Icon name="close" x={x + w - 28} y={y + 12} size={12} color={th.textFaint} sw={1.2} />
      </g>
    ) : null}
    {children}
  </g>
);

export const AppChrome: React.FC<Ctx & { active: number }> = ({ f, th, active }) => (
  <g>
    <Txt x={30} y={38} size={22} weight={600} ls={0.5} fill={th.text}>
      {AL.appTitle}
    </Txt>
    {AL.nav.map((n, i) => {
      const x = 360 + [0, 92, 220, 290, 420, 580][i];
      return (
        <g key={n}>
          <Txt x={x} y={36} size={11.5} weight={i === active ? 600 : 500} ls={0.8} fill={i === active ? th.text : th.textDim}>
            {n}
          </Txt>
          {i === active ? <rect x={x} y={44} width={n.length * 8.2} height={2} fill={th.accent} /> : null}
        </g>
      );
    })}
    <Txt x={1600} y={36} size={11} weight={500} ls={0.8} fill={th.textDim}>
      {AL.status}
    </Txt>
    <circle cx={1712} cy={32} r={5} fill={th.green} opacity={0.6 + 0.4 * blink(f, 60, 0, 1)} filter={GLOW_SOFT} />
    <Txt x={1724} y={37} size={13} weight={600} fill={th.green}>
      {AL.online}
    </Txt>
    <Icon name="minus" x={1812} y={22} size={18} color={th.textDim} sw={1.4} />
    <Icon name="square" x={1840} y={22} size={18} color={th.textDim} sw={1.4} />
    <Icon name="close" x={1868} y={22} size={18} color={th.textDim} sw={1.4} />
    <line x1={-60} y1={56} x2={1980} y2={56} stroke={th.border} />
    {/* sidebar */}
    {(["file", "search"] as IconName[]).map((n, i) => (
      <Icon key={n} name={n} x={14} y={76 + i * 46} size={26} color={i === 0 ? th.text : th.textDim} sw={1.5} />
    ))}
    {(["sliders", "layers", "gear"] as IconName[]).map((n, i) => (
      <Icon key={n} name={n} x={14} y={880 + i * 46} size={26} color={th.textDim} sw={1.5} />
    ))}
    {/* footer */}
    <line x1={-60} y1={1040} x2={1980} y2={1040} stroke={th.border} />
    {AL.footer.map(([k, v], i) => (
      <g key={k}>
        <Txt x={30 + i * 300} y={1065} size={11.5} fill={th.textDim}>
          {k}
          <tspan fill={th.text} dx={6}>
            {v}
          </tspan>
        </Txt>
      </g>
    ))}
    <circle cx={1560} cy={1061} r={4} fill={th.green} />
    <Txt x={1572} y={1065} size={11} fill={th.textDim}>
      All services running
    </Txt>
  </g>
);

// ------------------------------------------------------ folder tree --
export const FolderTree: React.FC<Ctx & Box> = (p) => {
  const { f, th, x, y, w, h } = p;
  const rowH = Math.min(40, (h - 60) / TREE.length);
  const idx = cycIndex(f, 75);
  const s = smooth(60, 75, cycFrame(f, 75));
  const a = TREE_STOPS[idx];
  const b = TREE_STOPS[(idx + 1) % TREE_STOPS.length];
  const sel = lerp(a, b, s);
  const top = y + 52;
  return (
    <Panel
      {...p}
      title={
        <g>
          <Txt x={x + 14} y={y + 23} size={13} weight={600} ls={1} fill={th.text}>
            {AL.folders}
          </Txt>
        </g>
      }
    >
      <rect x={x + 8} y={top + sel * rowH} width={w - 16} height={rowH - 4} rx={5} fill={th.accent} opacity={th.accentSoftOpacity + 0.04} />
      <rect x={x + 8} y={top + sel * rowH} width={3} height={rowH - 4} rx={1.5} fill={th.accent} />
      {TREE.map((r, i) => {
        const ry = top + i * rowH;
        const ix = x + 22 + r.depth * 32;
        const selected = Math.abs(sel - i) < 0.5;
        return (
          <g key={i}>
            {r.depth > 0 ? (
              <path d={`M${ix - 14} ${ry - 4}V${ry + rowH / 2 - 2}H${ix - 4}`} fill="none" stroke={th.border} strokeWidth={1} />
            ) : null}
            {r.open ? <path d={`M${ix - 2} ${ry + rowH / 2 - 5}l4 4 4-4`} fill="none" stroke={th.textDim} strokeWidth={1.4} /> : null}
            <Icon
              name="folder"
              x={ix + (r.open ? 10 : 0)}
              y={ry + rowH / 2 - 12}
              size={22}
              color={selected ? th.accent : r.depth < 2 ? th.text : th.textDim}
              sw={1.4}
            />
            <Txt
              x={ix + (r.open ? 40 : 30)}
              y={ry + rowH / 2 + 3}
              size={13}
              weight={r.depth < 2 ? 500 : 400}
              fill={selected || r.depth < 2 ? th.text : th.textDim}
            >
              {r.name}
            </Txt>
          </g>
        );
      })}
    </Panel>
  );
};

// ------------------------------------------------------- code editor --
export const CodeEditor: React.FC<Ctx & Box> = (p) => {
  const { f, th, x, y, w, h, uid } = p;
  const lh = 19;
  const n = CODE_TOKENS.length;
  const off = t01(f) * n * lh; // one block per loop
  const top = y + 46;
  const bodyH = h - 46 - 34;
  const cursorRow = Math.floor(bodyH * 0.42 / lh);
  const firstIdx = Math.floor(off / lh);
  const lineAtCursor = ((firstIdx + cursorRow) % n) + 1;
  const caret = blink(f, 30, 0, 1) > 0.5 ? 1 : 0.15;
  const cw = 0.6 * 12; // JetBrains Mono advance at 12 units
  return (
    <Panel
      {...p}
      title={
        <g>
          <rect x={x + 10} y={y + 6} width={118} height={30} rx={5} fill={th.panelAlt} stroke={th.border} />
          <Txt x={x + 24} y={y + 26} size={13} weight={600} fill={th.text}>
            {AL.file}
          </Txt>
          <Icon name="close" x={x + 104} y={y + 15} size={12} color={th.textDim} sw={1.4} />
        </g>
      }
    >
      <Clip id={`code-${uid}`} x={x + 1} y={top} w={w - 2} h={bodyH}>
        {Array.from({ length: Math.ceil(bodyH / lh) + 2 }, (_, k) => {
          const i = firstIdx + k;
          const ly = top + 14 + i * lh - off;
          const tokens = CODE_TOKENS[i % n];
          return (
            <g key={k}>
              <Txt x={x + 44} y={ly} size={11} anchor="end" fill={th.textFaint} mono>
                {(i % n) + 1}
              </Txt>
              <text x={x + 58} y={ly} fontSize={12} style={{ fontFamily: "JetBrains Mono", fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "calt" 0' }}>
                {tokens.map((t, j) => (
                  <tspan key={j} fill={th.code[t.k]}>
                    {t.t.replace(/ /g, " ")}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </Clip>
      {/* current-line marker stays fixed while code scrolls under it */}
      <rect x={x + 1} y={top + 3 + cursorRow * lh} width={w - 2} height={lh} fill={th.accent} opacity={th.accentSoftOpacity * 0.7} />
      <rect x={x + 1} y={top + 3 + cursorRow * lh} width={2} height={lh} fill={th.accent} />
      <rect x={x + 58 + 9 * cw} y={top + 5 + cursorRow * lh} width={1.6} height={lh - 4} fill={th.accent} opacity={caret} />
      <line x1={x + 50} y1={top} x2={x + 50} y2={top + bodyH} stroke={th.border} />
      {/* status bar */}
      <line x1={x + 1} y1={y + h - 34} x2={x + w - 1} y2={y + h - 34} stroke={th.border} />
      <Txt x={x + 14} y={y + h - 13} size={11} fill={th.textDim} mono>
        {`Ln ${lineAtCursor}, Col 9`}
      </Txt>
      {["Spaces: 4", "UTF-8", "LF", "C++"].map((s, i) => (
        <Txt key={s} x={x + w - 14 - [196, 116, 62, 30][i] + 0} y={y + h - 13} size={11} fill={th.textDim} mono anchor="start">
          {s}
        </Txt>
      ))}
    </Panel>
  );
};

// ---------------------------------------------------- particle globe --
export const Globe: React.FC<Ctx & Box & { framed?: boolean }> = (p) => {
  const { f, th, x, y, w, h, uid } = p;
  const cx = x + w / 2;
  const cy = y + h / 2 + 4;
  const R = Math.min(w, h) * 0.37;
  const rot = t01(f) * Math.PI * 2; // one full turn per loop
  const tilt = 0.32;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const gid = `globe-halo-${uid}`;
  const pts = GLOBE_POINTS.map((q) => {
    const x1 = q.x * cr + q.z * sr;
    const z1 = -q.x * sr + q.z * cr;
    const y2 = q.y * ct - z1 * st;
    const z2 = q.y * st + z1 * ct;
    return { px: cx + x1 * R, py: cy - y2 * R, z: z2, land: q.land, s: q.s };
  });
  const ring = t01(f) * 360;
  return (
    <Panel {...p} title="" controls={false} head={0}>
      <defs>
        <radialGradient id={gid}>
          <stop offset="0" stopColor={th.globeLand} stopOpacity={0.16} />
          <stop offset="0.6" stopColor={th.globeLand} stopOpacity={0.05} />
          <stop offset="1" stopColor={th.globeLand} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R * 1.5} fill={`url(#${gid})`} />
      {/* back hemisphere first, faint */}
      {pts
        .filter((q) => q.z < 0)
        .map((q, i) => (
          <circle key={`b${i}`} cx={q.px} cy={q.py} r={0.9 * q.s} fill={q.land ? th.globeLand : th.globeSea} opacity={0.08 + 0.1 * (1 + q.z)} />
        ))}
      <g filter={GLOW_SOFT}>
        {pts
          .filter((q) => q.z >= 0)
          .map((q, i) => (
            <circle
              key={`f${i}`}
              cx={q.px}
              cy={q.py}
              r={(q.land ? 1.7 : 1.1) * q.s * (0.75 + 0.35 * q.z)}
              fill={q.land ? th.globeLand : th.globeSea}
              opacity={(q.land ? 0.45 : 0.18) + (q.land ? 0.5 : 0.25) * q.z}
            />
          ))}
      </g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={th.globeLand} strokeWidth={1} opacity={0.2} />
      <ellipse cx={cx} cy={cy} rx={R * 1.28} ry={R * 0.3} fill="none" stroke={th.globeLand} strokeWidth={1} opacity={0.25} transform={`rotate(-14 ${cx} ${cy})`} />
      <circle
        cx={cx}
        cy={cy}
        r={R * 1.12}
        fill="none"
        stroke={th.globeLand}
        strokeWidth={1.2}
        strokeDasharray="2 10"
        opacity={0.35}
        transform={`rotate(${ring} ${cx} ${cy})`}
      />
      {/* upright plain sans "AI" mark in front of the globe */}
      <Txt x={cx} y={cy + R * 0.22} size={R * 0.62} weight={600} anchor="middle" fill="#ffffff" filter={GLOW_STRONG}>
        AI
      </Txt>
      {/* frame corners */}
      <path
        d={`M${x + 16} ${y + 40}v-24h24M${x + w - 16} ${y + 40}v-24h-24M${x + 16} ${y + h - 40}v24h24M${x + w - 16} ${y + h - 40}v24h-24`}
        fill="none"
        stroke={th.borderHi}
        strokeWidth={1.4}
      />
      <Txt x={x + 22} y={y + h - 22} size={10} fill={th.textDim} mono>
        {`NODES ${GLOBE_POINTS.length}`}
      </Txt>
      <Txt x={x + w - 22} y={y + h - 22} size={10} anchor="end" fill={th.textDim} mono>
        {`ROT ${String(Math.round(ring)).padStart(3, "0")}°`}
      </Txt>
    </Panel>
  );
};

// ---------------------------------------------------------- metrics --
const sparkPath = (series: number[], pos: number, count: number, x: number, y: number, w: number, h: number) => {
  const base = Math.floor(pos);
  const fr = pos - base;
  const step = w / (count - 1);
  let d = "";
  for (let i = 0; i <= count; i++) {
    const v = series[(base + i) % series.length];
    const px = x + (i - fr) * step;
    d += `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${(y + h - v * h).toFixed(2)}`;
  }
  return d;
};

export const Metrics: React.FC<Ctx & Box & { rows?: number; ringSize?: number }> = (p) => {
  const { f, th, x, y, w, h, uid, rows = 5 } = p;
  const items = [
    { k: "CPU USAGE", v: 0.414 + 0.1 * D.cpu(f), unit: "%", ring: true },
    { k: "MEMORY USAGE", v: 0.702 + 0.06 * D.mem(f), unit: "%", ring: true },
    { k: "GPU USAGE", v: 0.57 + 0.14 * D.gpu(f), unit: "%", ring: true },
    { k: "NETWORK", v: 176.18 + 22 * D.net(stepF(f, 6)), unit: " KB/s", ring: false },
    { k: "LATENCY", v: 39.52 + 6 * D.lat(stepF(f, 6)), unit: " ms", ring: false },
  ].slice(0, rows);
  const rh = (h - 46) / rows;
  const pos = t01(f) * 60;
  return (
    <Panel {...p} title={AL.metrics}>
      <Clip id={`met-${uid}`} x={x + 1} y={y + 37} w={w - 2} h={h - 38}>
        {items.map((it, i) => {
          const ry = y + 46 + i * rh;
          const rr = Math.min(rh * 0.32, 26);
          const sx = x + 14;
          const sw = w - (it.ring ? rr * 2 + 44 : 28);
          const val = it.unit === "%" ? `${(it.v * 100).toFixed(1)}%` : `${it.v.toFixed(2)}${it.unit}`;
          return (
            <g key={it.k}>
              <Txt x={sx} y={ry + 14} size={10} weight={600} ls={0.8} fill={th.textDim}>
                {it.k}
              </Txt>
              <Txt x={sx} y={ry + 36} size={16} weight={600} fill={th.text} mono>
                {val}
              </Txt>
              <path
                d={sparkPath(SPARKS[i], pos * (i % 2 === 0 ? 1 : 2), 30, sx + (it.ring ? 96 : 120), ry + 6, sw - (it.ring ? 96 : 120), rh - 22)}
                fill="none"
                stroke={i < 3 ? th.accent : th.textDim}
                strokeWidth={1.2}
                opacity={0.9}
              />
              {it.ring ? (
                <g>
                  <RingGauge cx={x + w - 16 - rr} cy={ry + rh / 2 - 6} r={rr} w={3.5} value={it.v} color={th.accent} track={th.panelAlt} />
                  <Txt x={x + w - 16 - rr} y={ry + rh / 2 - 2.5} size={10} anchor="middle" fill={th.text} mono>
                    {`${Math.round(it.v * 100)}%`}
                  </Txt>
                </g>
              ) : null}
              {i < rows - 1 ? <line x1={x + 12} y1={ry + rh - 6} x2={x + w - 12} y2={ry + rh - 6} stroke={th.border} /> : null}
            </g>
          );
        })}
      </Clip>
    </Panel>
  );
};

// ------------------------------------------------------------ AI core --
export const AiCore: React.FC<Ctx & Box & { compact?: boolean }> = (p) => {
  const { f, th, x, y, w, h, compact } = p;
  const s = stepF(f, 6);
  const rows: [string, React.ReactNode, boolean?][] = [
    ["MODEL", AL.model],
    ["VERSION", AL.version],
    ["MODE", "INFERENCE"],
    ["STATUS", "ACTIVE", true],
    ["TOKENS / SEC", `${(16.38 + 2.1 * D.tok(s)).toFixed(2)} K/s`],
    ["CONTEXT WINDOW", `${(81.4 + 6 * D.ctx(stepF(f, 30))).toFixed(1)} K`],
    ["LATENCY", `${(40.71 + 5 * D.lat(s)).toFixed(2)} ms`],
    ["CONFIDENCE", `${(96.0 + 1.6 * D.conf(stepF(f, 10))).toFixed(1)}%`],
  ];
  const rh = (h - 52) / rows.length;
  const size = compact ? 11 : 13;
  return (
    <Panel
      {...p}
      title={
        <g>
          <Icon name="chip" x={x + 12} y={y + 8} size={20} color={th.accent} sw={1.4} />
          <Txt x={x + 40} y={y + 24} size={13} weight={600} ls={1} fill={th.text}>
            {AL.core}
          </Txt>
        </g>
      }
    >
      {rows.map(([k, v, live], i) => {
        const ry = y + 50 + i * rh + rh * 0.55;
        return (
          <g key={k}>
            <Txt x={x + 16} y={ry} size={size - 1} weight={500} ls={0.6} fill={th.textDim}>
              {k}
            </Txt>
            {live ? <circle cx={x + w - 16 - (compact ? 50 : 62)} cy={ry - 4} r={3.6} fill={th.green} opacity={0.5 + 0.5 * blink(f, 40, 0, 1)} /> : null}
            <Txt x={x + w - 16} y={ry} size={size} weight={600} anchor="end" fill={live ? th.green : th.text} mono>
              {v}
            </Txt>
            {i === 3 ? <line x1={x + 12} y1={ry + rh * 0.45} x2={x + w - 12} y2={ry + rh * 0.45} stroke={th.border} /> : null}
          </g>
        );
      })}
    </Panel>
  );
};

// -------------------------------------------------- project structure --
export const Structure: React.FC<Ctx & Box> = (p) => {
  const { f, th, x, y, w } = p;
  const kids = ["01_Source", "02_Code", "03_Data", "04_Docs", "05_Build"];
  const group = STOP_GROUP[cycIndex(f, 75)];
  const rootX = x + w / 2;
  const rootY = y + 64;
  const ky = y + 130;
  const kw = (w - 40) / 5;
  const pulse = cyc(f, 75);
  return (
    <Panel {...p} title={AL.structure}>
      <rect x={rootX - 62} y={rootY - 16} width={124} height={32} rx={5} fill={th.panelAlt} stroke={th.borderHi} />
      <Icon name="folder" x={rootX - 54} y={rootY - 9} size={18} color={th.text} sw={1.3} />
      <Txt x={rootX - 30} y={rootY + 4} size={11} weight={600} fill={th.text}>
        Cyber_Project
      </Txt>
      <line x1={rootX} y1={rootY + 16} x2={rootX} y2={ky - 34} stroke={th.borderHi} />
      <line x1={x + 20 + kw / 2} y1={ky - 34} x2={x + 20 + kw * 4.5} y2={ky - 34} stroke={th.borderHi} />
      {kids.map((k, i) => {
        const kx = x + 20 + kw * (i + 0.5);
        const on = i === group;
        return (
          <g key={k}>
            <line x1={kx} y1={ky - 34} x2={kx} y2={ky - 16} stroke={on ? th.accent : th.borderHi} />
            {on ? <circle cx={lerp(rootX, kx, clamp(pulse * 2))} cy={ky - 34} r={2.6} fill={th.accent} opacity={1 - smooth(0.5, 0.9, pulse)} /> : null}
            <rect x={kx - kw / 2 + 4} y={ky - 16} width={kw - 8} height={44} rx={5} fill={on ? th.accent : th.panelAlt} fillOpacity={on ? th.accentSoftOpacity + 0.08 : 1} stroke={on ? th.accent : th.border} />
            <Icon name="folder" x={kx - 9} y={ky - 11} size={18} color={on ? th.accent : th.textDim} sw={1.3} />
            <Txt x={kx} y={ky + 21} size={9} anchor="middle" fill={on ? th.text : th.textDim}>
              {k}
            </Txt>
            {[0, 1].map((j) => (
              <g key={j}>
                <line x1={kx} y1={ky + 28} x2={kx} y2={ky + 40 + j * 22} stroke={th.border} />
                <rect x={kx - kw / 2 + 12} y={ky + 40 + j * 22} width={kw - 24} height={14} rx={3} fill="none" stroke={th.border} />
                <rect x={kx - kw / 2 + 16} y={ky + 45 + j * 22} width={(kw - 32) * (0.4 + 0.15 * ((i + j) % 3))} height={4} rx={2} fill={th.textFaint} />
              </g>
            ))}
          </g>
        );
      })}
    </Panel>
  );
};

// --------------------------------------------------------- data flow --
const FLOW_ICONS: IconName[] = ["user", "gear", "cube", "database", "chip", "message"];
export const DataFlow: React.FC<Ctx & Box> = (p) => {
  const { f, th, x, y, w, h } = p;
  const step = cycIndex(f, 100);
  const lf2 = cycFrame(f, 100);
  const sw = (w - 28) / 6;
  return (
    <Panel {...p} title={AL.flow}>
      {FLOW_ICONS.map((ic, i) => {
        const cx = x + 14 + sw * (i + 0.5);
        const cy = y + 36 + (h - 36) * 0.42;
        const on = i === step ? bump(lf2, 0, 10, 88, 100) : 0;
        return (
          <g key={ic}>
            <circle cx={cx} cy={cy} r={20} fill={th.panelAlt} stroke={on > 0.5 ? th.accent : th.border} strokeWidth={1.2} />
            {on > 0 ? <circle cx={cx} cy={cy} r={20} fill="none" stroke={th.accent} strokeWidth={2} opacity={on} filter={GLOW_SOFT} /> : null}
            <Icon name={ic} x={cx - 10} y={cy - 10} size={20} color={on > 0.5 ? th.accent : th.textDim} sw={1.4} />
            <Txt x={cx} y={cy + 38} size={8.5} anchor="middle" ls={0.4} fill={on > 0.5 ? th.text : th.textDim}>
              {AL.flowSteps[i]}
            </Txt>
            {i < 5 ? <path d={`M${cx + 25} ${cy}h${sw - 50}`} stroke={th.border} strokeWidth={1} /> : null}
            {i === step && i < 5 ? (
              <circle cx={cx + 25 + (sw - 50) * clamp((lf2 - 40) / 50)} cy={cy} r={2.4} fill={th.accent} opacity={smooth(40, 46, lf2) * (1 - smooth(88, 96, lf2))} />
            ) : null}
          </g>
        );
      })}
    </Panel>
  );
};

// ---------------------------------------------------- neural network --
// Nets are generated once per (seed, layers) and cached at module level.
const NETS = new Map<string, ReturnType<typeof makeNet>>();
const netFor = (seed: number, layers: number[], pulses: number) => {
  const k = `${seed}|${layers.join(",")}|${pulses}`;
  if (!NETS.has(k)) NETS.set(k, makeNet(seed, layers, pulses));
  return NETS.get(k)!;
};
export const NeuralNet: React.FC<Ctx & Box & { layers: number[]; seed: number; big?: boolean }> = (p) => {
  const { f, th, x, y, w, h, layers, seed, big } = p;
  const net = netFor(seed, layers, big ? 70 : 46);
  const top = y + (big ? 76 : 66);
  const bot = y + h - 22;
  const lx = (l: number) => x + 50 + ((w - 100) * l) / (layers.length - 1);
  const ny = (l: number, i: number) => top + ((bot - top) * (i + 0.5)) / layers[l];
  const T = 60 / (layers.length - 1);
  // node activation: when a pulse arrives
  const act = layers.map((n) => new Array(n).fill(0));
  const pulses = net.pulses.map((pp, k) => {
    const local = cycFrame(f, 60, pp.offset);
    const prog = (local - pp.l * T) / T;
    if (prog >= 0.85 && prog < 1.2) act[pp.l + 1][pp.b] = Math.max(act[pp.l + 1][pp.b], 1 - Math.abs(prog - 1) * 3);
    if (prog >= -0.2 && prog < 0.15) act[pp.l][pp.a] = Math.max(act[pp.l][pp.a], 1 - Math.abs(prog) * 4);
    return { ...pp, prog, k };
  });
  const labelY = y + (big ? 56 : 52);
  return (
    <Panel {...p} title={AL.network}>
      <Txt x={lx(0)} y={labelY} size={big ? 10.5 : 9} weight={600} ls={0.8} anchor="middle" fill={th.textDim}>
        {AL.layers[0]}
      </Txt>
      <Txt x={(lx(1) + lx(layers.length - 2)) / 2} y={labelY} size={big ? 10.5 : 9} weight={600} ls={0.8} anchor="middle" fill={th.textDim}>
        {AL.layers[1]}
      </Txt>
      <Txt x={lx(layers.length - 1)} y={labelY} size={big ? 10.5 : 9} weight={600} ls={0.8} anchor="middle" fill={th.textDim}>
        {AL.layers[2]}
      </Txt>
      {net.edges.map((e, i) => (
        <line key={i} x1={lx(e.l)} y1={ny(e.l, e.a)} x2={lx(e.l + 1)} y2={ny(e.l + 1, e.b)} stroke={th.textDim} strokeWidth={0.8} opacity={0.28} />
      ))}
      <g filter={GLOW}>
        {pulses.map((pp) => {
          if (pp.prog < 0 || pp.prog > 1) return null;
          const x1 = lx(pp.l);
          const y1 = ny(pp.l, pp.a);
          const x2 = lx(pp.l + 1);
          const y2 = ny(pp.l + 1, pp.b);
          const t = pp.prog;
          const tail = Math.max(0, t - 0.25);
          return (
            <g key={pp.k}>
              <line x1={lerp(x1, x2, tail)} y1={lerp(y1, y2, tail)} x2={lerp(x1, x2, t)} y2={lerp(y1, y2, t)} stroke={th.accent} strokeWidth={1.6} opacity={0.8} />
              <circle cx={lerp(x1, x2, t)} cy={lerp(y1, y2, t)} r={2.6} fill={th.accent} />
            </g>
          );
        })}
      </g>
      {layers.map((n, l) =>
        Array.from({ length: n }, (_, i) => {
          const a = act[l][i];
          return (
            <g key={`${l}-${i}`}>
              <circle cx={lx(l)} cy={ny(l, i)} r={big ? 7 : 5.5} fill={th.panel} stroke={th.text} strokeWidth={1.3} />
              <circle cx={lx(l)} cy={ny(l, i)} r={big ? 4.5 : 3.5} fill={a > 0.05 ? th.accent : th.text} opacity={0.55 + 0.45 * a} filter={a > 0.3 ? GLOW_SOFT : undefined} />
            </g>
          );
        }),
      )}
    </Panel>
  );
};

// ------------------------------------------------------------- logs --
export const LogPanel: React.FC<Ctx & Box & { kind: "ai" | "build" }> = (p) => {
  const { f, th, x, y, w, h, uid, kind } = p;
  const lh = 20;
  const lines = kind === "ai" ? AI_LOG.map((l) => `${l.time}  >  ${l.msg}`) : BUILD_LOG;
  const n = lines.length;
  const off = t01(f) * n * lh;
  const top = y + 44;
  const bodyH = h - 52;
  return (
    <Panel {...p} title={kind === "ai" ? AL.logs : AL.terminal}>
      <Clip id={`log-${uid}`} x={x + 1} y={top} w={w - 2} h={bodyH}>
        {Array.from({ length: n * 2 }, (_, i) => {
          const ly = top + 14 + i * lh - off;
          if (ly < top - lh || ly > top + bodyH + lh) return null;
          const s = lines[i % n];
          const ok = /passed|succeeded|ready/.test(s);
          return (
            <Txt key={i} x={x + 14} y={ly} size={10.5} fill={ok ? th.text : th.textDim} mono>
              {s.replace(/ /g, " ")}
            </Txt>
          );
        })}
      </Clip>
      <rect x={x + 14} y={top + bodyH - 14} width={7} height={12} fill={th.textDim} opacity={blink(f, 30, 0, 1) > 0.5 ? 0.8 : 0.1} />
    </Panel>
  );
};

// -------------------------------------------------------- processing --
const STEP_ICONS: IconName[] = ["search", "cube", "database", "target", "nodes", "checkCircle"];
export const Processing: React.FC<Ctx & Box & { big?: boolean }> = (p) => {
  const { f, th, x, y, w, h, big } = p;
  const lf2 = cycFrame(f, 120); // 5 runs per loop
  const cur = Math.floor(lf2 / 20); // 6 steps x 20 frames
  const local = lf2 % 20;
  const sw = (w - 32) / 6;
  const box = big ? 64 : 46;
  const cy = y + 36 + (h - 36) * (big ? 0.42 : 0.4);
  return (
    <Panel
      {...p}
      title={
        <g>
          <Txt x={x + 14} y={y + 23} size={big ? 14 : 12} weight={600} ls={1} fill={th.text}>
            {AL.processing}
          </Txt>
          <Txt x={x + (big ? 170 : 140)} y={y + 23} size={10} weight={600} ls={0.8} fill={th.accent}>
            {`STATUS: PROCESSING${".".repeat(1 + (Math.floor(lf2 / 10) % 3))}`}
          </Txt>
        </g>
      }
    >
      <rect x={x + 16} y={y + h - 14} width={w - 32} height={3} rx={1.5} fill={th.panelAlt} />
      <rect x={x + 16} y={y + h - 14} width={(w - 32) * (lf2 / 120)} height={3} rx={1.5} fill={th.accent} />
      {STEP_ICONS.map((ic, i) => {
        const cx = x + 16 + sw * (i + 0.5);
        const on = i === cur ? smooth(0, 5, local) : i === cur - 1 ? 1 - smooth(0, 6, local) : 0;
        const done = i < cur;
        return (
          <g key={ic}>
            <rect x={cx - box / 2} y={cy - box / 2} width={box} height={box} rx={8} fill={th.panelAlt} stroke={on > 0.5 ? th.accent : th.border} strokeWidth={1.3} />
            {on > 0.01 ? <rect x={cx - box / 2} y={cy - box / 2} width={box} height={box} rx={8} fill="none" stroke={th.accent} strokeWidth={2} opacity={on} filter={GLOW_SOFT} /> : null}
            <Icon
              name={ic}
              x={cx - box * 0.28}
              y={cy - box * 0.28}
              size={box * 0.56}
              color={on > 0.5 ? th.accent : done ? th.text : th.textDim}
              sw={big ? 1.8 : 1.5}
            />
            {AL.steps[i].split(" ").map((wd, j) => (
              <Txt key={j} x={cx} y={cy + box / 2 + 16 + j * 11} size={big ? 9.5 : 8} anchor="middle" ls={0.4} fill={on > 0.5 ? th.text : th.textDim}>
                {wd}
              </Txt>
            ))}
            {i < 5 ? <Icon name="arrowRight" x={cx + box / 2 + (sw - box) / 2 - 8} y={cy - 8} size={16} color={done ? th.text : th.textFaint} sw={1.3} /> : null}
          </g>
        );
      })}
    </Panel>
  );
};

// ---------------------------------------------------------- AI chip --
export const AiChip: React.FC<Ctx & { cx: number; cy: number; s: number; glow?: boolean }> = ({ th, cx, cy, s, glow }) => (
  <g>
    {Array.from({ length: 5 }, (_, i) => {
      const o = (i - 2) * s * 0.16;
      return (
        <path
          key={i}
          d={`M${cx + o} ${cy - s * 0.5}v${-s * 0.14}M${cx + o} ${cy + s * 0.5}v${s * 0.14}M${cx - s * 0.5} ${cy + o}h${-s * 0.14}M${cx + s * 0.5} ${cy + o}h${s * 0.14}`}
          stroke={th.textDim}
          strokeWidth={1.2}
        />
      );
    })}
    <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={s * 0.12} fill={th.panelAlt} stroke={th.text} strokeWidth={1.6} filter={glow ? GLOW_SOFT : undefined} />
    <rect x={cx - s * 0.38} y={cy - s * 0.38} width={s * 0.76} height={s * 0.76} rx={s * 0.08} fill="none" stroke={th.borderHi} strokeWidth={1} />
    <Txt x={cx} y={cy + s * 0.16} size={s * 0.44} weight={600} anchor="middle" fill="#ffffff" filter={glow ? GLOW : undefined}>
      AI
    </Txt>
  </g>
);

// --------------------------------------------------- chat timeline --
// 200-frame cycle (3 per loop). Returns what to show at this frame.
export const chatState = (f: number) => {
  const c = cycIndex(f, 200);
  const t = cycFrame(f, 200);
  const qa = QA[c];
  const qChars = Math.floor(clamp((t - 8) / 40) * qa.q.length);
  const sent = smooth(50, 56, t);
  const thinking = bump(t, 56, 58, 74, 78);
  const aChars = Math.floor(clamp((t - 78) / 70) * qa.a.length);
  const fade = 1 - smooth(186, 198, t);
  const listen = bump(t, 6, 12, 46, 54);
  return { c, t, qa, qChars, sent, thinking, aChars, fade, listen };
};

/** Chat window: optional menu column, messages, input bar. */
export const ChatWindow: React.FC<Ctx & Box & { menu?: boolean; title?: string; maxChars?: number; size?: number }> = (p) => {
  const { f, th, x, y, w, h, menu = true, maxChars = 46, size = 12 } = p;
  const st = chatState(f);
  const mx = menu ? x + 190 : x;
  const mw = w - (mx - x);
  const qLines = wrap(st.qa.q, maxChars);
  const aLines = wrap(st.qa.a, maxChars);
  const lh = size * 1.45;
  const cw = size * 0.53;
  // typed text so far, spread across wrapped lines
  const typed = (lines: string[], n: number) => {
    const out: string[] = [];
    let left = n;
    for (const l of lines) {
      if (left <= 0) break;
      out.push(l.slice(0, left));
      left -= l.length + 1;
    }
    return out;
  };
  const qw = Math.max(...qLines.map((l) => l.length)) * cw + 28;
  const aw = Math.max(...aLines.map((l) => l.length)) * cw + 28;
  const qy = y + 52 + (1 - st.sent) * 10;
  const ay = qy + qLines.length * lh + 28;
  const caret = blink(f, 24, 0, 1) > 0.5;
  const inputY = y + h - 52;
  return (
    <Panel {...p} title={p.title ?? AL.assistant}>
      {menu ? (
        <g>
          <line x1={mx - 10} y1={y + 37} x2={mx - 10} y2={y + h - 1} stroke={th.border} />
          <Txt x={x + 18} y={y + 66} size={size + 4} weight={600} fill={th.text}>
            {AL.assistant}
          </Txt>
          <circle cx={x + 23} cy={y + 86} r={4} fill={th.green} />
          <Txt x={x + 34} y={y + 90} size={size - 1} weight={600} fill={th.green}>
            {AL.online}
          </Txt>
          {AL.menu.map((m, i) => (
            <g key={m}>
              <Icon name={(["plus", "history", "gear", "help"] as IconName[])[i]} x={x + 18} y={y + 106 + i * 26} size={15} color={th.textDim} sw={1.4} />
              <Txt x={x + 42} y={y + 118 + i * 26} size={size - 0.5} fill={th.textDim}>
                {m}
              </Txt>
            </g>
          ))}
          {h > 260 ? <AiChip f={f} th={th} cx={x + 90} cy={y + h - 62} s={48} glow /> : null}
        </g>
      ) : null}
      <g opacity={st.fade}>
        {/* question bubble (user, right) */}
        {st.sent > 0 ? (
          <g opacity={st.sent}>
            <rect x={mx + mw - 18 - qw} y={qy} width={qw} height={qLines.length * lh + 14} rx={8} fill={th.panelAlt} stroke={th.borderHi} />
            {qLines.map((l, i) => (
              <Txt key={i} x={mx + mw - 18 - qw + 14} y={qy + 7 + (i + 0.78) * lh} size={size} fill={th.text}>
                {l}
              </Txt>
            ))}
          </g>
        ) : null}
        {/* reply bubble (assistant, left) */}
        {st.thinking > 0 || st.aChars > 0 ? (
          <g>
            <rect
              x={mx + 8}
              y={ay}
              width={st.aChars > 0 ? aw : 64}
              height={(st.aChars > 0 ? aLines.length : 1) * lh + 14}
              rx={8}
              fill={th.accent}
              fillOpacity={th.accentSoftOpacity}
              stroke={th.border}
            />
            {st.aChars === 0
              ? [0, 1, 2].map((k) => (
                  <circle key={k} cx={mx + 26 + k * 13} cy={ay + 7 + lh * 0.55} r={3} fill={th.textDim} opacity={st.thinking * (0.3 + 0.7 * blink(f, 30, k * 6, 2))} />
                ))
              : typed(aLines, st.aChars).map((l, i) => (
                  <Txt key={i} x={mx + 22} y={ay + 7 + (i + 0.78) * lh} size={size} fill={th.text}>
                    {l}
                  </Txt>
                ))}
          </g>
        ) : null}
      </g>
      {/* input bar */}
      <rect x={mx + 8} y={inputY} width={mw - 18} height={38} rx={19} fill={th.panelAlt} stroke={th.border} />
      <Icon name="mic" x={mx + 20} y={inputY + 10} size={18} color={th.textDim} sw={1.4} />
      {st.sent < 0.5 && st.qChars > 0 ? (
        <Txt x={mx + 48} y={inputY + 24} size={size} fill={th.text}>
          {st.qa.q.slice(0, st.qChars)}
        </Txt>
      ) : (
        <Txt x={mx + 48} y={inputY + 24} size={size} fill={th.textFaint}>
          {AL.inputPlaceholder}
        </Txt>
      )}
      {st.t > 6 && st.t < 50 && caret ? (
        <rect x={mx + 48 + st.qChars * cw + 1} y={inputY + 11} width={1.5} height={16} fill={th.accent} />
      ) : null}
      <circle cx={mx + mw - 30} cy={inputY + 19} r={14} fill={th.accent} opacity={0.9} />
      <Icon name="send" x={mx + mw - 38} y={inputY + 11} size={16} color={th.accentText} sw={1.5} />
    </Panel>
  );
};

/** Voice waveform bars; amplitude follows the listening envelope. */
export const Waveform: React.FC<Ctx & { x: number; y: number; w: number; h: number; amp: number }> = ({ f, th, x, y, w, h, amp }) => {
  const n = 36;
  const bw = w / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const env = Math.sin((Math.PI * (i + 0.5)) / n);
        const v =
          0.5 + 0.5 * Math.sin((i * 0.9 + t01(f) * Math.PI * 2 * 15) * 1) * Math.cos(i * 0.37 + t01(f) * Math.PI * 2 * 7);
        const hh = 2 + h * env * (0.08 + 0.92 * amp) * (0.25 + 0.75 * v);
        return <rect key={i} x={x + i * bw + bw * 0.25} y={y + h / 2 - hh / 2} width={bw * 0.5} height={hh} rx={bw * 0.25} fill={th.accent} opacity={0.5 + 0.5 * amp} />;
      })}
    </g>
  );
};

