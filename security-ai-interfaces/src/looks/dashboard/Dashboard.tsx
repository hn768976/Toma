import React from "react";
import { useCurrentFrame } from "remotion";
import { WORLD_PATH } from "../../data/world";
import { Icon, IconName } from "../../lib/icons";
import {
  blink,
  bump,
  clamp,
  cyc,
  cycFrame,
  cycIndex,
  lerp,
  smooth,
  stepF,
  t01,
  wave01,
} from "../../lib/loop";
import { makeDrift } from "../../lib/random";
import { GLOW, GLOW_SOFT, GLOW_STRONG, Stage } from "../../lib/Stage";
import { Clip, PanelRect, RingGauge, Txt, windowSeries } from "../../lib/ui";
import {
  FP_RIDGES,
  L,
  LOG_LINES,
  MAP_ARCS,
  MAP_DOTS,
  SERIES_NET,
  SERIES_THREATS,
  SERIES_TRAFFIC,
  STATUS_BARS,
} from "./data";
import { DashTheme } from "./theme";

// Module-level periodic drifts (seeded once).
const D_CPU = makeDrift(11, [1, 2, 3]);
const D_MEM = makeDrift(12, [1, 2, 4]);
const D_NET = makeDrift(13, [2, 3, 5]);
const D_ATT = makeDrift(14, [1, 3]);
const D_LAT = makeDrift(15, [2, 5]);
const D_DOWN = makeDrift(16, [3, 4, 6]);
const D_UP = makeDrift(17, [2, 5, 7]);
const D_INTEL = [21, 22, 23, 24, 25].map((s) => makeDrift(s, [1, 2, 3]));
const D_MATCH = makeDrift(26, [1, 2]);

type Ctx = { f: number; th: DashTheme };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// --------------------------------------------------------------- panel --
const Panel: React.FC<
  Ctx & {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    titleColor?: string;
    fill?: string;
    stroke?: string;
    strokeOpacity?: number;
    filter?: string;
    right?: React.ReactNode;
    children?: React.ReactNode;
  }
> = ({ th, x, y, w, h, title, titleColor, fill, stroke, strokeOpacity, filter, right, children }) => {
  const c = 14; // corner bracket length
  const bk = stroke ?? th.bracket;
  return (
    <g>
      <PanelRect
        x={x}
        y={y}
        w={w}
        h={h}
        r={10}
        fill={fill ?? th.panel}
        stroke={stroke ?? th.border}
        sw={1}
        filter={th.shadow ? "url(#dash-shadow)" : undefined}
      />
      {stroke ? (
        <PanelRect x={x} y={y} w={w} h={h} r={10} fill="none" stroke={stroke} sw={1.5} opacity={strokeOpacity} filter={filter} />
      ) : null}
      <path
        d={`M${x + 1} ${y + c + 6}V${y + 9}Q${x + 1} ${y + 1} ${x + 9} ${y + 1}H${x + c + 6}M${x + w - c - 6} ${y + h - 1}H${x + w - 9}Q${x + w - 1} ${y + h - 1} ${x + w - 1} ${y + h - 9}V${y + h - c - 6}`}
        fill="none"
        stroke={bk}
        strokeWidth={2}
        opacity={0.75}
      />
      <Txt x={x + 18} y={y + 28} size={12.5} weight={600} ls={1.4} fill={titleColor ?? th.text}>
        {title}
      </Txt>
      {right ?? <Icon name="dots" x={x + w - 34} y={y + 14} size={16} color={th.textDim} opacity={0.7} />}
      {children}
    </g>
  );
};

const Bar: React.FC<Ctx & { x: number; y: number; w: number; h: number; v: number; color: string; opacity?: number }> = ({
  th,
  x,
  y,
  w,
  h,
  v,
  color,
  opacity = 1,
}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={th.track} />
    <rect x={x} y={y} width={Math.max(0, w * v)} height={h} rx={h / 2} fill={color} opacity={opacity} />
  </g>
);

// -------------------------------------------------------------- header --
const Header: React.FC<Ctx> = ({ f, th }) => {
  // active nav item: 4 x 150 frames, underline slides over 20 frames
  const idx = cycIndex(f, 150);
  const local = cycFrame(f, 150);
  const slide = smooth(130, 150, local);
  const xs = [520, 660, 800, 940];
  const ux = lerp(xs[idx], xs[(idx + 1) % 4], slide);
  const lvl = 3;
  const live = blink(f, 60, 0, 1);
  return (
    <g>
      <Icon name="shieldCheck" x={26} y={16} size={34} color={th.accent} sw={2} filter={th.glow ? GLOW_SOFT : undefined} />
      <Txt x={72} y={41} size={26} weight={700} ls={2.5} fill={th.accent} filter={th.glow ? GLOW_SOFT : undefined}>
        {L.title}
      </Txt>
      <Txt x={73} y={57} size={9.5} ls={2} fill={th.textDim}>
        {L.subtitle}
      </Txt>
      {L.nav.map((n, i) => {
        const on = i === idx ? 1 - slide : i === (idx + 1) % 4 ? slide : 0;
        return (
          <Txt key={n} x={xs[i]} y={40} size={13} weight={600} ls={2} anchor="middle" fill={on > 0.5 ? th.accent : th.textDim}>
            {n}
          </Txt>
        );
      })}
      {idx === 3 && slide > 0 ? (
        // wrap-around: underline fades out at the last item and in at the first
        <>
          <rect x={xs[3] - 40} y={50} width={80} height={2} fill={th.accent} opacity={1 - slide} />
          <rect x={xs[0] - 40} y={50} width={80} height={2} fill={th.accent} opacity={slide} />
        </>
      ) : (
        <rect x={ux - 40} y={50} width={80} height={2} fill={th.accent} />
      )}
      <line x1={24} y1={66} x2={1896} y2={66} stroke={th.border} strokeWidth={1} />
      <Txt x={1430} y={38} size={11} weight={600} ls={1.5} fill={th.textDim}>
        {L.threatLevel}
      </Txt>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={1540 + i * 26}
          y={28}
          width={22}
          height={10}
          rx={2}
          fill={i < lvl ? (i < 2 ? th.accent : th.amber) : th.track}
          opacity={i === lvl - 1 ? 0.6 + 0.4 * blink(f, 40) : 1}
        />
      ))}
      <circle cx={1696} cy={33} r={4.5} fill={th.red} opacity={0.35 + 0.65 * live} filter={th.glow ? GLOW_SOFT : undefined} />
      <Txt x={1708} y={38} size={12} weight={600} ls={1.5} fill={th.text} mono>
        {L.live}
      </Txt>
    </g>
  );
};

// --------------------------------------------------------------- rings --
const RingTicks: React.FC<{ cx: number; cy: number; r: number; color: string; rot: number; n?: number }> = ({
  cx,
  cy,
  r,
  color,
  rot,
  n = 60,
}) => (
  <g transform={`rotate(${rot} ${cx} ${cy})`}>
    {Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const len = i % 5 === 0 ? 7 : 3.5;
      return (
        <line
          key={i}
          x1={cx + Math.cos(a) * r}
          y1={cy + Math.sin(a) * r}
          x2={cx + Math.cos(a) * (r + len)}
          y2={cy + Math.sin(a) * (r + len)}
          stroke={color}
          strokeWidth={1}
          opacity={i % 5 === 0 ? 0.8 : 0.4}
        />
      );
    })}
  </g>
);

const Rings: React.FC<Ctx> = ({ f, th }) => {
  const x = 460;
  const y = 80;
  const cy = y + 158;
  const cxs = [627, 960, 1293];
  const R = 86;
  const pulse = blink(f, 60, 0, 2);
  const ripple = cyc(f, 60);
  // scan: 0..120 count up, 120..138 hold, 138..150 fade, repeat 4x
  const sf = cycFrame(f, 150);
  const prog = clamp(sf / 120);
  const scanEase = 1 - Math.pow(1 - prog, 1.6);
  const scanVis = 1 - smooth(138, 150, sf);
  const scanIn = smooth(0, 8, sf);
  const pct = Math.round(scanEase * 100);
  const rot = t01(f) * 360;
  return (
    <Panel f={f} th={th} x={x} y={y} w={1000} h={300} title="SECURITY OVERVIEW">
      {/* secure */}
      <RingTicks cx={cxs[0]} cy={cy} r={R + 14} color={th.accent} rot={rot} />
      <circle cx={cxs[0]} cy={cy} r={R - 13} fill="none" stroke={th.accent} strokeWidth={1} opacity={0.35} />
      <circle cx={cxs[0]} cy={cy} r={R} fill="none" stroke={th.accent} strokeWidth={6} filter={th.glow ? GLOW : undefined} />
      <Icon name="lock" x={cxs[0] - 22} y={cy - 54} size={44} color={th.accent} sw={2.4} filter={th.glow ? GLOW_SOFT : undefined} />
      <Txt x={cxs[0]} y={cy + 20} size={12.5} weight={700} ls={1.2} anchor="middle" fill={th.accent}>
        {L.ringSecure[0]}
      </Txt>
      <Txt x={cxs[0]} y={cy + 37} size={9.5} anchor="middle" fill={th.textDim}>
        {L.ringSecure[1]}
      </Txt>
      {/* threat */}
      <circle
        cx={cxs[1]}
        cy={cy}
        r={R + 4 + ripple * 26}
        fill="none"
        stroke={th.red}
        strokeWidth={2}
        opacity={(1 - ripple) * 0.6}
      />
      <RingTicks cx={cxs[1]} cy={cy} r={R + 14} color={th.red} rot={-rot} n={40} />
      <circle cx={cxs[1]} cy={cy} r={R - 13} fill="none" stroke={th.red} strokeWidth={1} opacity={0.35} />
      <circle
        cx={cxs[1]}
        cy={cy}
        r={R}
        fill="none"
        stroke={th.red}
        strokeWidth={6}
        opacity={0.55 + 0.45 * pulse}
        filter={th.glow ? (pulse > 0.5 ? GLOW_STRONG : GLOW) : undefined}
      />
      <Icon
        name="warning"
        x={cxs[1] - 23}
        y={cy - 56}
        size={46}
        color={th.red}
        sw={2.4}
        opacity={0.7 + 0.3 * pulse}
        filter={th.glow ? GLOW_SOFT : undefined}
      />
      <Txt x={cxs[1]} y={cy + 20} size={12.5} weight={700} ls={1.2} anchor="middle" fill={th.red}>
        {L.ringThreat[0]}
      </Txt>
      <Txt x={cxs[1]} y={cy + 37} size={9.5} anchor="middle" fill={th.textDim}>
        {L.ringThreat[1]}
      </Txt>
      {/* scan */}
      <RingTicks cx={cxs[2]} cy={cy} r={R + 14} color={th.accent} rot={rot * 2} n={30} />
      <g opacity={scanVis * scanIn}>
        <RingGauge cx={cxs[2]} cy={cy} r={R} w={6} value={scanEase} color={th.accent} track="none" filter={th.glow ? GLOW : undefined} />
      </g>
      <circle cx={cxs[2]} cy={cy} r={R} fill="none" stroke={th.track} strokeWidth={6} opacity={0.6} />
      <Icon name="shieldCheck" x={cxs[2] - 20} y={cy - 58} size={40} color={th.accent} sw={2.2} />
      <Txt x={cxs[2]} y={cy + 4} size={13} weight={700} ls={1.2} anchor="middle" fill={th.accent}>
        {L.ringScan[0]}
      </Txt>
      <Txt
        x={cxs[2]}
        y={cy + 34}
        size={26}
        weight={700}
        anchor="middle"
        fill={th.text}
        mono
        opacity={Math.max(0.15, scanVis * (0.3 + 0.7 * scanIn))}
      >
        {`${pct}%`}
      </Txt>
      {/* scan progress strip under ring 3 */}
      <Bar f={f} th={th} x={cxs[2] - 90} y={y + 272} w={180} h={5} v={scanEase} color={th.accent} opacity={scanVis} />
      <Txt x={cxs[0]} y={y + 280} size={10} anchor="middle" ls={1} fill={th.textDim} mono>
        {`UPTIME 99.98%`}
      </Txt>
      <Txt x={cxs[1]} y={y + 280} size={10} anchor="middle" ls={1} fill={th.red} mono opacity={0.6 + 0.4 * pulse}>
        {`ISOLATING NODE 07`}
      </Txt>
    </Panel>
  );
};

// --------------------------------------------------------- status list --
const StatusList: React.FC<Ctx> = ({ f, th }) => {
  const x = 24;
  const y = 80;
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={246} title={L.statusTitle}>
      {L.status.map((s, i) => {
        const ry = y + 52 + i * 64;
        const dot = 0.4 + 0.6 * blink(f, 100, i * 33, 1);
        return (
          <g key={s.name}>
            <rect x={x + 18} y={ry} width={44} height={44} rx={8} fill={th.panelAlt} stroke={th.border} />
            <Icon name={s.icon as IconName} x={x + 28} y={ry + 10} size={24} color={th.accent} sw={1.6} />
            <Txt x={x + 76} y={ry + 18} size={13} weight={500} fill={th.text}>
              {s.name}
            </Txt>
            <circle cx={x + 80} cy={ry + 33} r={3.5} fill={th.green} opacity={dot} />
            <Txt x={x + 90} y={ry + 37} size={11} weight={700} ls={1.2} fill={th.green}>
              {s.state}
            </Txt>
            {STATUS_BARS[i].map((b, k) => {
              const v = clamp(b.base + (1 - b.base) * wave01(f, b.cycles, b.phase));
              const bh = 6 + v * 30;
              return (
                <rect
                  key={k}
                  x={x + 268 + k * 9.6}
                  y={ry + 40 - bh}
                  width={5.4}
                  height={bh}
                  rx={1}
                  fill={th.accent}
                  opacity={0.45 + 0.55 * v}
                />
              );
            })}
          </g>
        );
      })}
    </Panel>
  );
};

// ------------------------------------------------------ access control --
const Access: React.FC<Ctx> = ({ f, th }) => {
  const x = 24;
  const y = 342;
  const rowH = 29;
  // highlight sweeps rows: 6 rows x 100 frames
  const idx = cycIndex(f, 100);
  const local = cycFrame(f, 100);
  const s = smooth(84, 100, local);
  const hy = lerp(idx, (idx + 1) % 6, s);
  const wrap = idx === 5 && s > 0;
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={236} title={L.accessTitle}>
      <Txt x={x + 360} y={y + 28} size={10} anchor="end" ls={1} fill={th.textDim} mono>
        6 ZONES
      </Txt>
      {wrap ? (
        <>
          <rect x={x + 12} y={y + 46 + 5 * rowH} width={396} height={rowH - 3} rx={5} fill={th.accentSoft} opacity={0.1 * (1 - s)} />
          <rect x={x + 12} y={y + 46} width={396} height={rowH - 3} rx={5} fill={th.accentSoft} opacity={0.1 * s} />
        </>
      ) : (
        <rect x={x + 12} y={y + 46 + hy * rowH} width={396} height={rowH - 3} rx={5} fill={th.accentSoft} opacity={0.1} />
      )}
      {L.access.map((a, i) => {
        const ry = y + 46 + i * rowH;
        const col = a.state === "GRANTED" ? th.green : a.state === "DENIED" ? th.red : th.amber;
        const op = a.state === "GRANTED" ? 0.85 : 0.35 + 0.65 * blink(f, a.state === "DENIED" ? 40 : 75, i * 7, 1.5);
        return (
          <g key={a.name}>
            <circle cx={x + 30} cy={ry + 13} r={4.5} fill={col} opacity={op} filter={th.glow ? GLOW_SOFT : undefined} />
            <Icon name="key" x={x + 44} y={ry + 5} size={16} color={th.textDim} sw={1.2} />
            <Txt x={x + 68} y={ry + 17.5} size={12.5} fill={th.text}>
              {a.name}
            </Txt>
            <Txt x={x + 400} y={ry + 17.5} size={10.5} weight={700} ls={1.2} anchor="end" fill={col}>
              {a.state}
            </Txt>
          </g>
        );
      })}
    </Panel>
  );
};

// ---------------------------------------------------------- encryption --
const Encryption: React.FC<Ctx> = ({ f, th }) => {
  const x = 24;
  const y = 594;
  const lf2 = cycFrame(f, 200);
  const v = clamp(lf2 / 170);
  const vis = 1 - smooth(186, 200, lf2);
  const file = L.encFiles[cycIndex(f, 200)];
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={118} title={L.encTitle}>
      <Txt x={x + 360} y={y + 28} size={10.5} weight={600} anchor="end" ls={1} fill={th.accent} mono>
        {L.encCipher}
      </Txt>
      <rect x={x + 18} y={y + 44} width={52} height={56} rx={8} fill={th.panelAlt} stroke={th.border} />
      <Icon name="fileLock" x={x + 28} y={y + 56} size={32} color={th.accent} sw={1.6} />
      <Txt x={x + 84} y={y + 60} size={12} fill={th.text}>
        Encrypting files…
      </Txt>
      <Txt x={x + 84} y={y + 96} size={10} fill={th.textDim} mono opacity={vis}>
        {file}
      </Txt>
      <Bar f={f} th={th} x={x + 84} y={y + 70} w={258} h={8} v={v} color={th.accent} opacity={vis} />
      <Txt x={x + 400} y={y + 79} size={14} weight={700} anchor="end" fill={th.text} mono opacity={0.25 + 0.75 * vis}>
        {`${Math.round(v * 100)}%`}
      </Txt>
    </Panel>
  );
};

// ----------------------------------------------------------- event log --
const EventLog: React.FC<Ctx> = ({ f, th }) => {
  const x = 24;
  const y = 728;
  const lh = 24;
  const n = LOG_LINES.length;
  const off = t01(f) * n * lh; // exactly one block per loop
  const top = y + 46;
  const h = 328 - 58;
  const live = blink(f, 30, 0, 1);
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={328} title={L.logTitle}>
      <circle cx={x + 330} cy={y + 24} r={3.5} fill={th.red} opacity={0.3 + 0.7 * live} />
      <Txt x={x + 340} y={y + 28} size={10} weight={700} ls={1.2} fill={th.textDim}>
        LIVE
      </Txt>
      <Clip id={`log-${th.name}`} x={x + 8} y={top} w={404} h={h}>
        {Array.from({ length: n * 2 }, (_, i) => {
          const ln = LOG_LINES[i % n];
          const ly = top + 16 + i * lh - off;
          if (ly < top - lh || ly > top + h + lh) return null;
          const col = ln.tag === "INFO" ? th.accent : ln.tag === "WARN" ? th.amber : th.red;
          return (
            <g key={i}>
              <circle cx={x + 24} cy={ly - 4} r={3} fill={col} />
              <Txt x={x + 36} y={ly} size={11} fill={th.textDim} mono>
                {ln.time}
              </Txt>
              <Txt x={x + 104} y={ly} size={11} weight={700} fill={col} mono>
                {ln.tag}
              </Txt>
              <Txt x={x + 152} y={ly} size={11.5} fill={th.text}>
                {ln.msg}
              </Txt>
            </g>
          );
        })}
      </Clip>
      <defs>
        <linearGradient id={`logfade-${th.name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={th.panel} stopOpacity={1} />
          <stop offset="1" stopColor={th.panel} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={x + 8} y={top} width={404} height={22} fill={`url(#logfade-${th.name})`} />
      <rect x={x + 8} y={top + h - 22} width={404} height={22} fill={`url(#logfade-${th.name})`} transform={`rotate(180 ${x + 210} ${top + h - 11})`} />
    </Panel>
  );
};

// ---------------------------------------------------------- threat map --
const MAP = { x: 476, y: 470, w: 568 };
const MAP_K = MAP.w / 360;
const proj = (lon: number, lat: number): [number, number] => [MAP.x + (lon + 180) * MAP_K, MAP.y + (84 - lat) * MAP_K];

const ThreatMap: React.FC<Ctx> = ({ f, th }) => {
  const x = 460;
  const y = 396;
  const kindCol = [th.red, th.amber, th.accent];
  const attacks = 2184 + Math.round(D_ATT(stepF(f, 10)) * 60);
  return (
    <Panel f={f} th={th} x={x} y={y} w={600} h={400} title={L.mapTitle}>
      {L.mapLegend.map((l, i) => (
        <g key={l}>
          <circle cx={x + 290 + i * 102} cy={y + 24} r={4} fill={kindCol[i]} />
          <Txt x={x + 299 + i * 102} y={y + 28} size={10} fill={th.textDim}>
            {l}
          </Txt>
        </g>
      ))}
      <Clip id={`map-${th.name}`} x={x + 10} y={y + 44} w={580} h={290}>
        {/* graticule */}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={MAP.x + i * 30 * MAP_K} y1={y + 44} x2={MAP.x + i * 30 * MAP_K} y2={y + 334} stroke={th.grid} strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1={x + 10} y1={MAP.y + (4 + i * 30) * MAP_K} x2={x + 590} y2={MAP.y + (4 + i * 30) * MAP_K} stroke={th.grid} strokeWidth={1} />
        ))}
        <path
          d={WORLD_PATH}
          transform={`translate(${MAP.x} ${MAP.y - 6 * MAP_K}) scale(${MAP_K})`}
          fill={th.mapLand}
          stroke={th.mapEdge}
          strokeWidth={0.6 / MAP_K}
          strokeLinejoin="round"
        />
        {/* attack arcs: a bright dash travels along each arc */}
        {MAP_ARCS.map((a, i) => {
          const A = MAP_DOTS[a.a];
          const B = MAP_DOTS[a.b];
          const [x1, y1] = proj(A.lon, A.lat);
          const [x2, y2] = proj(B.lon, B.lat);
          const mx = (x1 + x2) / 2;
          const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.3 - 10;
          const d = `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`;
          const p = cyc(f, a.period, a.offset);
          const head = p * 130; // dash travels 0..130 over a 100-length path, then gone
          const impact = clamp((head - 100) / 30);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={th.red} strokeWidth={1} opacity={0.18} />
              <path
                d={d}
                fill="none"
                stroke={th.red}
                strokeWidth={1.8}
                pathLength={100}
                strokeDasharray="14 200"
                strokeDashoffset={14 - head}
                strokeLinecap="round"
                filter={th.glow ? GLOW_SOFT : undefined}
              />
              {impact > 0 && impact < 1 ? (
                <circle cx={x2} cy={y2} r={3 + impact * 14} fill="none" stroke={th.red} strokeWidth={1.4} opacity={1 - impact} />
              ) : null}
            </g>
          );
        })}
        {MAP_DOTS.map((d, i) => {
          const [px, py] = proj(d.lon, d.lat);
          const b = blink(f, d.period, d.offset, 2);
          const col = kindCol[d.kind];
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={2 + b * 7} fill={col} opacity={0.25 * b} />
              <circle cx={px} cy={py} r={2.4} fill={col} opacity={0.25 + 0.75 * b} filter={th.glow && b > 0.4 ? GLOW_SOFT : undefined} />
            </g>
          );
        })}
      </Clip>
      <line x1={x + 18} y1={y + 344} x2={x + 582} y2={y + 344} stroke={th.border} />
      {[
        ["ATTACKS TODAY", fmt(attacks), th.text],
        ["BLOCKED", `${(99.1 + 0.3 * wave01(f, 2)).toFixed(1)}%`, th.green],
        ["ACTIVE SOURCES", String(47 + Math.round(3 * D_ATT(stepF(f, 20)))), th.amber],
        ["REGIONS", "12", th.text],
      ].map(([k, v, c], i) => (
        <g key={k as string}>
          <Txt x={x + 20 + i * 145} y={y + 364} size={9.5} ls={1} fill={th.textDim}>
            {k}
          </Txt>
          <Txt x={x + 20 + i * 145} y={y + 386} size={16} weight={700} fill={c as string} mono>
            {v}
          </Txt>
        </g>
      ))}
    </Panel>
  );
};

// ----------------------------------------------------------- analytics --
const Analytics: React.FC<Ctx> = ({ f, th }) => {
  const x = 1076;
  const y = 396;
  const cx = x + 44;
  const cw = 320;
  const cy0 = y + 56;
  const ch = 130;
  const count = 32;
  const pos = t01(f) * SERIES_TRAFFIC.length; // one whole series per loop
  const vals = windowSeries(SERIES_TRAFFIC, pos, count).map((v) => 0.15 + 0.8 * v);
  const thr = windowSeries(SERIES_THREATS, pos, count).map((v) => 0.05 + 0.35 * v);
  // keep x positions fixed per sample, shift by fractional part for smooth scroll
  const frac = pos - Math.floor(pos);
  const step = cw / count;
  const pts = (arr: number[]) =>
    arr.map((v, i) => `${(cx + (i - frac) * step).toFixed(2)},${(cy0 + ch - v * ch).toFixed(2)}`).join(" ");
  const gid = `ana-${th.name}`;
  const gauges = [
    { v: 0.44 + 0.12 * D_CPU(f), c: th.accent },
    { v: 0.68 + 0.08 * D_MEM(f), c: th.accent2 },
    { v: 0.63 + 0.16 * D_NET(f), c: th.amber },
  ];
  return (
    <Panel
      f={f}
      th={th}
      x={x}
      y={y}
      w={384}
      h={400}
      title={L.analyticsTitle}
      right={
        <g>
          <rect x={x + 290} y={y + 13} width={76} height={20} rx={4} fill="none" stroke={th.border} />
          <Txt x={x + 328} y={y + 27} size={9.5} anchor="middle" ls={1} fill={th.textDim}>
            {L.analyticsRange}
          </Txt>
        </g>
      }
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={th.accentSoft} stopOpacity={th.name === "dark" ? 0.32 : 0.18} />
          <stop offset="1" stopColor={th.accentSoft} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <line x1={cx} y1={cy0 + (i * ch) / 3} x2={cx + cw} y2={cy0 + (i * ch) / 3} stroke={th.grid} strokeWidth={1} />
          <Txt x={cx - 8} y={cy0 + (i * ch) / 3 + 3.5} size={9} anchor="end" fill={th.textDim} mono>
            {["3K", "2K", "1K", "0"][i]}
          </Txt>
        </g>
      ))}
      <Clip id={`anaclip-${th.name}`} x={cx} y={cy0 - 4} w={cw} h={ch + 8}>
        <polygon points={`${cx - step},${cy0 + ch} ${pts(vals)} ${cx + cw + step},${cy0 + ch}`} fill={`url(#${gid})`} />
        <polyline points={pts(vals)} fill="none" stroke={th.accent} strokeWidth={1.8} strokeLinejoin="round" />
        <polyline points={pts(thr)} fill="none" stroke={th.red} strokeWidth={1.4} strokeLinejoin="round" opacity={0.85} />
      </Clip>
      {["00:00", "06:00", "12:00", "18:00", "24:00"].map((t, i) => (
        <Txt key={t} x={cx + (i * cw) / 4} y={cy0 + ch + 16} size={9} anchor="middle" fill={th.textDim} mono>
          {t}
        </Txt>
      ))}
      {gauges.map((g, i) => {
        const gx = x + 64 + i * 128;
        const gy = y + 300;
        return (
          <g key={i}>
            <RingGauge cx={gx} cy={gy} r={40} w={7} value={g.v} color={g.c} track={th.track} filter={th.glow ? GLOW_SOFT : undefined} />
            <Txt x={gx} y={gy + 7} size={19} weight={700} anchor="middle" fill={th.text} mono>
              {`${Math.round(g.v * 100)}%`}
            </Txt>
            <Txt x={gx} y={gy + 68} size={11} weight={600} ls={1.4} anchor="middle" fill={g.c}>
              {L.gauges[i]}
            </Txt>
          </g>
        );
      })}
    </Panel>
  );
};

// --------------------------------------------------------- intel table --
const Intel: React.FC<Ctx> = ({ f, th }) => {
  const x = 460;
  const y = 812;
  const sf = stepF(f, 10);
  return (
    <Panel f={f} th={th} x={x} y={y} w={330} h={244} title={L.intelTitle}>
      <Txt x={x + 18} y={y + 54} size={9.5} ls={1} fill={th.textDim}>
        TYPE
      </Txt>
      <Txt x={x + 230} y={y + 54} size={9.5} ls={1} anchor="end" fill={th.textDim}>
        COUNT
      </Txt>
      <Txt x={x + 312} y={y + 54} size={9.5} ls={1} anchor="end" fill={th.textDim}>
        24H
      </Txt>
      {L.intel.map((r, i) => {
        const ry = y + 66 + i * 34;
        const d = D_INTEL[i](sf);
        const count = r.base + Math.round(d * r.base * 0.02);
        const up = i % 3 !== 2;
        const ch = (Math.abs(8 + d * 14 + i * 3) % 30) + 1;
        const col = up ? th.red : th.green;
        return (
          <g key={r.name}>
            <line x1={x + 16} y1={ry} x2={x + 314} y2={ry} stroke={th.grid} />
            <Icon name={r.icon as IconName} x={x + 18} y={ry + 7} size={18} color={i === 0 || i === 2 ? th.red : th.accent} sw={1.4} />
            <Txt x={x + 46} y={ry + 21} size={12.5} fill={th.text}>
              {r.name}
            </Txt>
            <Txt x={x + 230} y={ry + 21} size={12.5} weight={600} anchor="end" fill={th.text} mono>
              {fmt(count)}
            </Txt>
            <Icon name={up ? "arrowUp" : "arrowDown"} x={x + 252} y={ry + 9} size={12} color={col} sw={1.6} />
            <Txt x={x + 312} y={ry + 21} size={11.5} weight={600} anchor="end" fill={col} mono>
              {`${ch.toFixed(0)}%`}
            </Txt>
          </g>
        );
      })}
    </Panel>
  );
};

// ---------------------------------------------------- network activity --
const Network: React.FC<Ctx> = ({ f, th }) => {
  const x = 806;
  const y = 812;
  const n = 30;
  const pos = t01(f) * SERIES_NET.length;
  const base = Math.floor(pos);
  const frac = pos - base;
  const bw = 296 / n;
  return (
    <Panel f={f} th={th} x={x} y={y} w={330} h={244} title={L.netTitle}>
      <Clip id={`net-${th.name}`} x={x + 17} y={y + 44} w={296} h={124}>
        {Array.from({ length: n + 1 }, (_, i) => {
          const v = SERIES_NET[(base + i) % SERIES_NET.length];
          const bh = 10 + v * 108;
          return (
            <rect
              key={i}
              x={x + 17 + (i - frac) * bw + 1.5}
              y={y + 168 - bh}
              width={bw - 3.5}
              height={bh}
              rx={1.5}
              fill={th.accent}
              opacity={0.35 + 0.65 * v}
            />
          );
        })}
      </Clip>
      <line x1={x + 17} y1={y + 169} x2={x + 313} y2={y + 169} stroke={th.border} />
      <Icon name="arrowDown" x={x + 20} y={y + 186} size={16} color={th.accent} sw={1.6} />
      <Txt x={x + 42} y={y + 192} size={9.5} ls={1} fill={th.textDim}>
        DOWNLOAD
      </Txt>
      <Txt x={x + 42} y={y + 216} size={17} weight={700} fill={th.text} mono>
        {`${(11.6 + 2.2 * D_DOWN(stepF(f, 6))).toFixed(1)}`}
        <tspan fontSize={10} fill={th.textDim}> Mbps</tspan>
      </Txt>
      <Icon name="arrowUp" x={x + 172} y={y + 186} size={16} color={th.amber} sw={1.6} />
      <Txt x={x + 194} y={y + 192} size={9.5} ls={1} fill={th.textDim}>
        UPLOAD
      </Txt>
      <Txt x={x + 194} y={y + 216} size={17} weight={700} fill={th.text} mono>
        {`${(84.2 + 9.5 * D_UP(stepF(f, 6))).toFixed(1)}`}
        <tspan fontSize={10} fill={th.textDim}> Mbps</tspan>
      </Txt>
    </Panel>
  );
};

// ---------------------------------------------------------- fingerprint --
const Fingerprint: React.FC<Ctx> = ({ f, th }) => {
  const x = 1152;
  const y = 812;
  const cx = x + 72;
  const cy = y + 138;
  const p = cyc(f, 100); // 6 sweeps per loop
  const sweep = 0.5 - 0.5 * Math.cos(Math.PI * 2 * p);
  const top = cy - 66;
  const bot = cy + 70;
  const sy = lerp(top, bot, sweep);
  const id = `fp-${th.name}`;
  const match = 98.2 + 0.6 * D_MATCH(stepF(f, 15));
  return (
    <Panel f={f} th={th} x={x} y={y} w={308} h={244} title={L.fpTitle}>
      <rect x={cx - 56} y={top - 6} width={112} height={bot - top + 12} rx={8} fill={th.panelAlt} stroke={th.border} />
      {/* corner brackets of the scan window */}
      <path
        d={`M${cx - 48} ${top + 8}v-8h8M${cx + 48} ${top + 8}v-8h-8M${cx - 48} ${bot - 8}v8h8M${cx + 48} ${bot - 8}v8h-8`}
        fill="none"
        stroke={th.accent}
        strokeWidth={1.6}
      />
      <g transform={`translate(${cx} ${cy - 6})`} fill="none" stroke={th.accent} strokeWidth={1.7} strokeLinecap="round" opacity={0.35}>
        {FP_RIDGES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <defs>
        <clipPath id={id}>
          <rect x={cx - 56} y={sy - 18} width={112} height={36} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(${cx} ${cy - 6})`} fill="none" stroke={th.accent} strokeWidth={1.9} strokeLinecap="round" filter={th.glow ? GLOW_SOFT : undefined}>
          {FP_RIDGES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
      <line x1={cx - 54} y1={sy} x2={cx + 54} y2={sy} stroke={th.accent} strokeWidth={2} filter={th.glow ? GLOW : undefined} />
      {L.fpChecks.map((c, i) => {
        const ry = y + 62 + i * 34;
        return (
          <g key={c}>
            <rect x={x + 148} y={ry - 14} width={144} height={26} rx={5} fill={th.panelAlt} />
            <Txt x={x + 158} y={ry + 3} size={11} fill={th.text}>
              {c}
            </Txt>
            <Icon name="check" x={x + 236} y={ry - 7} size={12} color={th.green} sw={1.8} />
            <Txt x={x + 286} y={ry + 3} size={10} weight={600} anchor="end" fill={th.green}>
              OK
            </Txt>
          </g>
        );
      })}
      <Txt x={x + 148} y={y + 214} size={9.5} ls={1} fill={th.textDim}>
        MATCH
      </Txt>
      <Txt x={x + 292} y={y + 216} size={16} weight={700} anchor="end" fill={th.accent} mono>
        {`${match.toFixed(1)}%`}
      </Txt>
    </Panel>
  );
};

// ---------------------------------------------------------------- auth --
const Auth: React.FC<Ctx> = ({ f, th }) => {
  const x = 1476;
  const y = 80;
  const lf2 = cycFrame(f, 200);
  const dots = Math.floor(clamp((lf2 - 6) / 54) * 10);
  const press = bump(lf2, 72, 78, 92, 100);
  const granted = bump(lf2, 97, 104, 174, 186);
  const loginOp = 1 - smooth(89, 96, lf2) + smooth(188, 196, lf2);
  const fieldVis = 1 - smooth(184, 198, lf2);
  const fx = x + 136;
  const caret = blink(f, 30, 0, 1) > 0.5 ? 1 : 0.15;
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={300} title={L.authTitle}>
      <circle cx={x + 70} cy={y + 122} r={40} fill={th.panelAlt} stroke={th.accent} strokeWidth={1.6} />
      <circle cx={x + 70} cy={y + 122} r={48} fill="none" stroke={th.accent} strokeWidth={1} strokeDasharray="3 5" opacity={0.6} transform={`rotate(${t01(f) * 360} ${x + 70} ${y + 122})`} />
      <Icon name="user" x={x + 46} y={y + 98} size={48} color={th.accent} sw={2} />
      <Icon name="lock" x={x + 56} y={y + 196} size={28} color={granted > 0.5 ? th.green : th.textDim} sw={1.6} />
      <Txt x={fx} y={y + 62} size={9.5} ls={1.2} fill={th.textDim}>
        USERNAME
      </Txt>
      <rect x={fx} y={y + 70} width={262} height={32} rx={5} fill={th.panelAlt} stroke={th.border} />
      <Txt x={fx + 12} y={y + 91} size={12.5} fill={th.text} mono>
        {L.authUser}
      </Txt>
      <Txt x={fx} y={y + 124} size={9.5} ls={1.2} fill={th.textDim}>
        PASSWORD
      </Txt>
      <rect x={fx} y={y + 132} width={262} height={32} rx={5} fill={th.panelAlt} stroke={dots > 0 && dots < 10 ? th.accent : th.border} />
      <g opacity={fieldVis}>
        {Array.from({ length: dots }, (_, i) => (
          <circle key={i} cx={fx + 16 + i * 13} cy={y + 148} r={3.6} fill={th.text} />
        ))}
      </g>
      {dots < 10 && lf2 < 66 ? <rect x={fx + 12 + dots * 13} y={y + 140} width={1.6} height={16} fill={th.accent} opacity={caret} /> : null}
      <rect
        x={fx}
        y={y + 182}
        width={262}
        height={36}
        rx={6}
        fill={granted > 0.01 ? th.green : th.accent}
        fillOpacity={0.12 + 0.25 * press + 0.1 * granted}
        stroke={granted > 0.01 ? th.green : th.accent}
        strokeWidth={1.5}
        filter={th.glow && press > 0.3 ? GLOW_SOFT : undefined}
      />
      <Txt x={fx + 131} y={y + 205} size={13} weight={700} ls={2} anchor="middle" fill={th.accent} opacity={loginOp}>
        LOGIN
      </Txt>
      <Txt x={fx + 131} y={y + 205} size={12.5} weight={700} ls={1.6} anchor="middle" fill={th.green} opacity={granted}>
        ACCESS GRANTED
      </Txt>
      <line x1={x + 18} y1={y + 244} x2={x + 402} y2={y + 244} stroke={th.border} />
      <Icon name="shieldCheck" x={x + 18} y={y + 256} size={22} color={th.accent} sw={1.5} />
      <Txt x={x + 48} y={y + 272} size={11} fill={th.textDim}>
        Multi-factor authentication
      </Txt>
      <Txt x={x + 400} y={y + 272} size={10.5} weight={700} ls={1.2} anchor="end" fill={th.green}>
        ENABLED
      </Txt>
    </Panel>
  );
};

// ----------------------------------------------------------------- vpn --
const Vpn: React.FC<Ctx> = ({ f, th }) => {
  const x = 1476;
  const y = 396;
  const cx = x + 82;
  const cy = y + 112;
  const R = 52;
  const rot = t01(f) * Math.PI; // meridians repeat every half turn
  const orbit = t01(f) * Math.PI * 4;
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={196} title={L.vpnTitle}>
      <circle cx={cx} cy={cy} r={R + 10} fill="none" stroke={th.accent} strokeWidth={1} opacity={0.25} />
      <circle cx={cx} cy={cy} r={R} fill={th.panelAlt} stroke={th.accent} strokeWidth={1.6} filter={th.glow ? GLOW_SOFT : undefined} />
      {[-0.66, -0.33, 0, 0.33, 0.66].map((k) => {
        const yy = cy + k * R;
        const rx = Math.sqrt(1 - k * k) * R;
        return <ellipse key={k} cx={cx} cy={yy} rx={rx} ry={rx * 0.12} fill="none" stroke={th.accent} strokeWidth={1} opacity={0.55} />;
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const a = rot + (i * Math.PI) / 6;
        return <ellipse key={i} cx={cx} cy={cy} rx={Math.abs(Math.cos(a)) * R} ry={R} fill="none" stroke={th.accent} strokeWidth={1} opacity={0.55} />;
      })}
      <ellipse cx={cx} cy={cy} rx={R + 22} ry={14} fill="none" stroke={th.accent} strokeWidth={1} opacity={0.5} transform={`rotate(-20 ${cx} ${cy})`} />
      <g transform={`rotate(-20 ${cx} ${cy})`}>
        <circle cx={cx + Math.cos(orbit) * (R + 22)} cy={cy + Math.sin(orbit) * 14} r={3.5} fill={th.accent} filter={th.glow ? GLOW : undefined} />
      </g>
      <Txt x={x + 178} y={y + 76} size={15} weight={700} ls={1.2} fill={th.accent}>
        VPN CONNECTED
      </Txt>
      <Txt x={x + 178} y={y + 100} size={11} fill={th.textDim}>
        Tunnel endpoint
      </Txt>
      <Txt x={x + 290} y={y + 100} size={11.5} fill={th.text} mono>
        {L.vpnIp}
      </Txt>
      <Txt x={x + 178} y={y + 122} size={11} fill={th.textDim}>
        Latency
      </Txt>
      <Txt x={x + 290} y={y + 122} size={11.5} fill={th.text} mono>
        {`${Math.round(18 + 4 * D_LAT(stepF(f, 15)))} ms`}
      </Txt>
      <rect x={x + 178} y={y + 140} width={110} height={28} rx={5} fill={th.accent} fillOpacity={0.12} stroke={th.accent} />
      <Txt x={x + 233} y={y + 158} size={11} weight={700} ls={1.6} anchor="middle" fill={th.accent}>
        PROTECTED
      </Txt>
    </Panel>
  );
};

// ----------------------------------------------------------- file scan --
const FileScan: React.FC<Ctx> = ({ f, th }) => {
  const x = 1476;
  const y = 608;
  const lf2 = cycFrame(f, 150);
  const v = clamp(lf2 / 128);
  const vis = 1 - smooth(138, 150, lf2);
  const files = Math.round(v * 1194);
  const path = L.scanPaths[Math.floor(v * 3.999)];
  return (
    <Panel f={f} th={th} x={x} y={y} w={420} h={128} title={L.scanTitle}>
      <Txt x={x + 360} y={y + 28} size={11} weight={600} anchor="end" fill={th.text} mono>
        {`${fmt(files)} files`}
      </Txt>
      <rect x={x + 18} y={y + 46} width={52} height={60} rx={8} fill={th.panelAlt} stroke={th.border} />
      <Icon name="fileSearch" x={x + 28} y={y + 60} size={32} color={th.accent} sw={1.6} />
      <Txt x={x + 84} y={y + 62} size={12} fill={th.text}>
        Scanning…
      </Txt>
      <Txt x={x + 84} y={y + 80} size={10.5} fill={th.textDim} mono opacity={vis}>
        {path}
      </Txt>
      <Bar f={f} th={th} x={x + 84} y={y + 92} w={258} h={8} v={v} color={th.accent} opacity={vis} />
      <Txt x={x + 400} y={y + 101} size={14} weight={700} anchor="end" fill={th.text} mono opacity={0.25 + 0.75 * vis}>
        {`${Math.round(v * 100)}%`}
      </Txt>
    </Panel>
  );
};

// --------------------------------------------------------------- alert --
const Alert: React.FC<Ctx> = ({ f, th }) => {
  const x = 1476;
  const y = 752;
  const pulse = blink(f, 40, 0, 2);
  const cx = x + 84;
  const cy = y + 150;
  const sc = 1 + 0.05 * pulse;
  const blocked = 3 + cycIndex(f, 200);
  return (
    <Panel
      f={f}
      th={th}
      x={x}
      y={y}
      w={420}
      h={304}
      title="SECURITY ALERT"
      titleColor={th.red}
      fill={th.redPanel}
      stroke={th.red}
      strokeOpacity={0.4 + 0.6 * pulse}
      filter={th.glow ? GLOW : undefined}
      right={<Icon name="bell" x={x + 384} y={y + 13} size={18} color={th.red} sw={1.6} opacity={0.5 + 0.5 * pulse} />}
    >
      <circle cx={cx} cy={cy} r={58 + pulse * 6} fill={th.red} opacity={0.08 + 0.1 * pulse} />
      <circle cx={cx} cy={cy} r={50} fill="none" stroke={th.red} strokeWidth={2} opacity={0.6 + 0.4 * pulse} filter={th.glow ? GLOW : undefined} />
      <g transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
        <Icon name="skull" x={cx - 34} y={cy - 36} size={68} color={th.red} bg={th.redPanel} sw={1.5} filter={th.glow ? (pulse > 0.4 ? GLOW_STRONG : GLOW) : undefined} />
      </g>
      <Txt x={x + 160} y={y + 108} size={18} weight={700} ls={1} fill={th.red} filter={th.glow ? GLOW_SOFT : undefined}>
        {L.alertTitle}
      </Txt>
      <Txt x={x + 160} y={y + 132} size={11.5} fill={th.text}>
        {`Blocked ${blocked} intrusion attempts`}
      </Txt>
      {[
        ["SOURCE", "198.51.100.73"],
        ["PORT", "22 / TCP"],
        ["ACTION", "NODE ISOLATED"],
      ].map(([k, v], i) => (
        <g key={k}>
          <Txt x={x + 160} y={y + 162 + i * 22} size={10} ls={1} fill={th.textDim}>
            {k}
          </Txt>
          <Txt x={x + 228} y={y + 162 + i * 22} size={11} fill={th.text} mono>
            {v}
          </Txt>
        </g>
      ))}
      <rect x={x + 160} y={y + 230} width={130} height={30} rx={5} fill="none" stroke={th.red} strokeWidth={1.4} />
      <Txt x={x + 225} y={y + 249} size={10.5} weight={700} ls={1.5} anchor="middle" fill={th.red}>
        VIEW DETAILS
      </Txt>
      {/* hazard stripe */}
      <defs>
        <pattern id={`haz-${th.name}`} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={7} height={14} fill={th.red} />
        </pattern>
      </defs>
      <rect x={x + 18} y={y + 276} width={384} height={10} rx={2} fill={`url(#haz-${th.name})`} opacity={0.25 + 0.35 * pulse} />
    </Panel>
  );
};

// ---------------------------------------------------------------- root --
export const SecurityDashboard: React.FC<{ th: DashTheme }> = ({ th }) => {
  const f = useCurrentFrame();
  const ctx = { f, th };
  // subtle full-frame scan line drifting down, 2 passes per loop (dark only)
  const scanY = ((t01(f) * 2) % 1) * 1140;
  return (
    <Stage bg={th.bg} drift={10} grain={th.grain}>
      <defs>
        <filter id="dash-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx={0} dy={2} stdDeviation={5} floodColor="#1d3439" floodOpacity={0.08} />
        </filter>
      </defs>
      {/* background dot grid */}
      <g opacity={th.name === "dark" ? 0.5 : 0.7}>
        {Array.from({ length: 51 }, (_, i) =>
          Array.from({ length: 30 }, (_, j) => <circle key={`${i}-${j}`} cx={i * 40 - 20} cy={j * 40 - 20} r={0.9} fill={th.grid} />),
        )}
      </g>
      <Header {...ctx} />
      <StatusList {...ctx} />
      <Access {...ctx} />
      <Encryption {...ctx} />
      <EventLog {...ctx} />
      <Rings {...ctx} />
      <ThreatMap {...ctx} />
      <Analytics {...ctx} />
      <Intel {...ctx} />
      <Network {...ctx} />
      <Fingerprint {...ctx} />
      <Auth {...ctx} />
      <Vpn {...ctx} />
      <FileScan {...ctx} />
      <Alert {...ctx} />
      {th.glow ? <rect x={0} y={scanY - 60} width={1920} height={60} fill={th.accent} opacity={0.025} /> : null}
    </Stage>
  );
};
