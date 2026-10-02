import React from "react";
import { useCurrentFrame } from "remotion";
import { blink, clamp, cyc, cycFrame, lf, smooth, stepF, t01, wave, wave01 } from "../../lib/loop";
import { flicker, makeDrift, makeSeries, mulberry32, rInt, rRange } from "../../lib/random";
import { GLOW, GLOW_SOFT, Stage } from "../../lib/Stage";
import { Clip, Txt } from "../../lib/ui";

// Look 2: minimal sci-fi HUD. Thin single-colour lines and small text on
// PURE #000000 (no grain, no panels) so it works as a screen-blend overlay.

export type HudTheme = { name: string; c: string };
export const HUD_WHITE: HudTheme = { name: "white", c: "#f4f7fa" };
export const HUD_AMBER: HudTheme = { name: "amber", c: "#ffa52a" };

// ---- text labels (edit here) -----------------------------------------
export const HUD_LABELS = {
  indicators: "INDICATORS INFO",
  indicatorsSub: ["STATISTIC OF", "INDICATORS", "DURING VELOCITY"],
  loading: "DATA LOADING",
  control: "CONTROL PANEL",
  sensors: "SENSORS",
  calc: "CALCULATION",
  denied: "ACCESS DENIED",
  location: "LOCATION",
};

// ---- module-level tables (seeded once) ---------------------------------
const CODE = [
  "if (grid->cells[0] != grid->cells[n]) {",
  "    for (k = 0; k < grid->count; k++)",
  "        flush_cell(grid, k);",
  "    reset_index(&grid->head);",
  "}",
  "",
  "static int map_sector(sector_t *s)",
  "{",
  "    int band = s->id & 0x0f;",
  "    if (!s->online)",
  "        return -EIDLE;",
  "    s->gain = calc_gain(band, s->ref);",
  "    return band;",
  "}",
  "",
  "/* push the frame to the relay */",
  "void relay_push(frame_t *fr)",
  "{",
  "    lock_bus(fr->bus);",
  "    fr->seq = next_seq();",
  "    write_bus(fr->bus, fr->data);",
  "    unlock_bus(fr->bus);",
  "}",
  "",
];

const LINE_SERIES = makeSeries(2001, 40, [1, 2, 4, 7]);
const EQ = (() => {
  const r = mulberry32(2002);
  return Array.from({ length: 12 }, () => ({ k: rInt(r, 2, 9), p: r() }));
})();
const BARS = (() => {
  const r = mulberry32(2003);
  return Array.from({ length: 14 }, () => ({ k: rInt(r, 1, 4), p: r(), base: rRange(r, 0.25, 0.85), amp: rRange(r, 0.1, 0.35) }));
})();
const TOGGLES = (() => {
  const r = mulberry32(2004);
  return Array.from({ length: 24 }, () => ({ k: rInt(r, 1, 3), p: r() }));
})();
const D_MARK = makeDrift(2005, [1, 2]);
const D_MARK2 = makeDrift(2006, [1, 3]);
const D_COUNT = makeDrift(2007, [1, 2, 3]);
const D_PCT = [2008, 2009, 2010].map((s) => makeDrift(s, [1, 2, 4]));
const SPARK2 = makeSeries(2011, 30, [1, 3, 5]);
const SPARK3 = makeSeries(2012, 50, [2, 3, 7, 9]);

// ------------------------------------------------------------------------
type Ctx = { f: number; c: string };

const Btn: React.FC<Ctx & { x: number; y: number; w: number; h: number; a: string; b: string; lit?: number }> = ({
  c,
  x,
  y,
  w,
  h,
  a,
  b,
  lit = 0,
}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill="none" stroke={c} strokeWidth={1} opacity={0.75} />
    <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill="none" stroke={c} strokeWidth={1} opacity={0.2 + 0.6 * lit} />
    <Txt x={x + w / 2} y={y + 18} size={10} ls={1.4} anchor="middle" fill={c} weight={600}>
      {a}
    </Txt>
    <line x1={x + 12} y1={y + h / 2} x2={x + w - 12} y2={y + h / 2} stroke={c} strokeWidth={1} opacity={0.35} />
    <Txt x={x + w / 2} y={y + h - 12} size={10} ls={1.4} anchor="middle" fill={c} opacity={0.85}>
      {b}
    </Txt>
  </g>
);

const Toggle: React.FC<Ctx & { x: number; y: number; i: number; label?: string }> = ({ f, c, x, y, i, label }) => {
  const t = TOGGLES[i % TOGGLES.length];
  const on = smooth(0.35, 0.65, wave01(f, t.k, t.p));
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill="none" stroke={c} strokeWidth={1} opacity={0.8} />
      <circle cx={x} cy={y} r={4.5} fill={c} opacity={on} />
      {label ? (
        <Txt x={x} y={y - 15} size={8} anchor="middle" fill={c} opacity={0.75} mono>
          {label}
        </Txt>
      ) : null}
    </g>
  );
};

const Corner: React.FC<{ c: string; x: number; y: number; sx: number; sy: number }> = ({ c, x, y, sx, sy }) => (
  <path d={`M${x} ${y + 26 * sy}V${y}H${x + 26 * sx}`} fill="none" stroke={c} strokeWidth={1.5} />
);

// ---------------------------------------------------------------- left --
const TopLeft: React.FC<Ctx> = ({ f, c }) => {
  const cols = [
    ["T", "1", "CC", "J6 L.Y"],
    ["G", "ON", "825", "F2 HU"],
    ["N", "0", "OFF", "N/A"],
  ];
  const flip = cyc(f, 120) > 0.5;
  return (
    <g>
      {cols.map((col, i) => (
        <g key={i}>
          <path d={`M${60 + i * 92} 44h-6v14h6M${112 + i * 92} 44h6v14h-6`} fill="none" stroke={c} strokeWidth={1} opacity={0.6} />
          {col.map((v, j) => (
            <Txt key={j} x={60 + i * 92} y={56 + j * 34 + (j > 0 ? 18 : 0)} size={j === 0 ? 13 : 14} fill={c} weight={500} mono>
              {i === 1 && j === 1 ? (flip ? "ON" : "OFF") : i === 2 && j === 2 ? (flip ? "OFF" : "ON") : v}
            </Txt>
          ))}
        </g>
      ))}
      {["STOP", "START", "RESET"].map((b, i) => (
        <g key={b}>
          <rect x={52 + i * 92} y={206} width={66} height={18} fill="none" stroke={c} strokeWidth={1} opacity={0.6} />
          <Txt x={85 + i * 92} y={219} size={8.5} ls={1.2} anchor="middle" fill={c} opacity={0.85}>
            {`${i + 1} | ${b}`}
          </Txt>
        </g>
      ))}
      <line x1={40} y1={244} x2={330} y2={244} stroke={c} strokeWidth={1} opacity={0.4} />
      <Txt x={40} y={262} size={8} fill={c} opacity={0.65} mono>
        {flicker("AAAA 999 99A 9999 AA 999A9 999", 31, f, 30)}
      </Txt>
    </g>
  );
};

const AccessDenied: React.FC<Ctx> = ({ f, c }) => {
  const p = 0.55 + 0.45 * blink(f, 50, 0, 2);
  return (
    <g>
      <Txt x={60} y={300} size={8} fill={c} opacity={0.6} mono>
        {flicker("999 9AAA A999 99999 AAA 9999 AA9", 41, f, 20)}
      </Txt>
      <line x1={40} y1={312} x2={430} y2={312} stroke={c} strokeWidth={1} opacity={0.5} strokeDasharray="2 3" />
      <rect x={60} y={326} width={350} height={34} fill="none" stroke={c} strokeWidth={1.2} opacity={p} filter={GLOW_SOFT} />
      <path d="M60 334v-8h8M410 334v-8h-8M60 352v8h8M410 352v8h-8" fill="none" stroke={c} strokeWidth={2.2} />
      <Txt x={235} y={348.5} size={15} ls={7} anchor="middle" fill={c} weight={500} opacity={p} filter={GLOW_SOFT}>
        {HUD_LABELS.denied}
      </Txt>
      <Txt x={60} y={384} size={8.5} fill={c} opacity={0.7} mono>
        {flicker("9.99999999", 42, f, 15)}
      </Txt>
      <Txt x={190} y={384} size={8.5} fill={c} opacity={0.7} mono>
        {flicker("9.99999999", 43, f, 15)}
      </Txt>
      <Txt x={320} y={384} size={8.5} fill={c} opacity={0.7} mono>
        {flicker("9.99999999", 44, f, 15)}
      </Txt>
    </g>
  );
};

const Sliders: React.FC<Ctx> = ({ f, c }) => (
  <g>
    {[0, 1, 2].map((i) => {
      const y = 420 + i * 22;
      const p = wave01(f, i + 1, i * 0.3);
      const x0 = 150;
      const w = 180 - i * 30;
      return (
        <g key={i}>
          <line x1={x0} y1={y} x2={x0 + w} y2={y} stroke={c} strokeWidth={1} opacity={0.45} />
          <rect x={x0 + p * (w - 30)} y={y - 3} width={30} height={6} fill={c} opacity={0.9} />
          <Txt x={x0 + w + 10} y={y + 3} size={8} fill={c} opacity={0.7} mono>
            {["OBJECT", "SUBJECT", "LINK"][i]}
          </Txt>
        </g>
      );
    })}
    <Txt x={110} y={480} size={9} fill={c} opacity={0.75}>
      A
    </Txt>
    <path d="M124 476h12M130 470v12" stroke={c} strokeWidth={1} opacity={0.75} />
  </g>
);

const ButtonsAndEq: React.FC<Ctx> = ({ f, c }) => {
  const lit = smooth(0.4, 0.6, wave01(f, 3));
  return (
    <g>
      <Btn f={f} c={c} x={48} y={508} w={104} h={74} a="ACTIVATE" b="PRESS" lit={lit} />
      <Btn f={f} c={c} x={168} y={508} w={104} h={74} a="CALL" b="PRESS" lit={1 - lit} />
      {["H2", "G6", "H7", "E6", "T5", "K1"].map((l, i) => (
        <Txt key={l} x={300 + i * 22} y={512} size={7.5} anchor="middle" fill={c} opacity={0.7} mono>
          {l}
        </Txt>
      ))}
      {EQ.map((e, i) => {
        const v = 0.2 + 0.8 * wave01(f, e.k, e.p);
        const h = 8 + v * 56;
        return <rect key={i} x={292 + i * 11} y={584 - h} width={6} height={h} fill="none" stroke={c} strokeWidth={1} opacity={0.85} />;
      })}
      <line x1={288} y1={586} x2={428} y2={586} stroke={c} strokeWidth={1} opacity={0.6} />
      {/* range slider */}
      <line x1={110} y1={620} x2={330} y2={620} stroke={c} strokeWidth={1} opacity={0.5} />
      <circle cx={110 + wave01(f, 2, 0.1) * 220} cy={620} r={5} fill={c} />
      <line x1={110} y1={612} x2={110} y2={628} stroke={c} opacity={0.6} />
      <line x1={330} y1={612} x2={330} y2={628} stroke={c} opacity={0.6} />
    </g>
  );
};

const BottomLeft: React.FC<Ctx> = ({ f, c }) => {
  const n1 = String(10 + Math.round(4 * wave(stepF(f, 20), 2))).padStart(2, "0");
  const n2 = String(58 - Math.round(6 * wave(stepF(f, 30), 1, 0.3))).padStart(2, "0");
  const n3 = String(25 + Math.round(9 * wave(stepF(f, 15), 3, 0.6))).padStart(2, "0");
  return (
    <g>
      <rect x={48} y={660} width={130} height={110} fill="none" stroke={c} strokeWidth={1} opacity={0.5} />
      <path d="M58 680l10 10M68 680l-10 10" stroke={c} strokeWidth={1.2} />
      {[n1, n2, n3].map((n, i) => (
        <g key={i}>
          <line x1={86} y1={678 + i * 30} x2={86} y2={694 + i * 30} stroke={c} opacity={0.7} />
          <Txt x={98} y={692 + i * 30} size={17} fill={c} weight={500} mono>
            {n}
          </Txt>
        </g>
      ))}
      <rect x={196} y={660} width={60} height={20} fill="none" stroke={c} strokeWidth={1} opacity={0.5} />
      <Txt x={226} y={674} size={7.5} ls={1} anchor="middle" fill={c} opacity={0.8}>
        SIGNAL
      </Txt>
      <rect x={196} y={750} width={60} height={20} fill="none" stroke={c} strokeWidth={1} opacity={0.5} />
      <Txt x={226} y={764} size={7.5} ls={1} anchor="middle" fill={c} opacity={0.8}>
        CONNECT
      </Txt>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={286 + i * 30} y={700} width={22} height={6} fill={c} opacity={0.25 + 0.75 * smooth(0.3, 0.7, wave01(f, i + 1, i * 0.2))} />
      ))}
      <line x1={196} y1={720} x2={420} y2={720} stroke={c} opacity={0.4} />
      <Txt x={120} y={830} size={18} ls={3} fill={c} weight={500} mono>
        {flicker("KL 999 999L 99N", 51, f, 25)}
      </Txt>
      <line x1={40} y1={850} x2={430} y2={850} stroke={c} opacity={0.4} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Toggle key={i} f={f} c={c} x={64 + i * 46} y={890} i={i + 10} />
      ))}
      <Txt x={48} y={930} size={8} fill={c} opacity={0.6} mono>
        {flicker("CH-9 / CH-9 / CH-9 / CH-9 / CH-9 / CH-9", 52, f, 40)}
      </Txt>
    </g>
  );
};

// -------------------------------------------------------- tick scale ---
const TickScale: React.FC<Ctx & { x: number; y: number; h: number; from: number; to: number; marker: number; big?: boolean }> = ({
  c,
  x,
  y,
  h,
  from,
  to,
  marker,
  big = true,
}) => {
  const n = (to - from) / 5;
  const my = y + ((marker - from) / (to - from)) * h;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + h} stroke={c} strokeWidth={1} opacity={0.8} />
      {Array.from({ length: n + 1 }, (_, i) => {
        const v = from + i * 5;
        const yy = y + (i / n) * h;
        const major = v % 10 === 0;
        return (
          <g key={i}>
            <line x1={x} y1={yy} x2={x + (major ? 14 : 7)} y2={yy} stroke={c} strokeWidth={1} opacity={major ? 0.9 : 0.5} />
            {major && big ? (
              <Txt x={x + 22} y={yy + 4.5} size={13} fill={c} mono opacity={0.95}>
                {v}
              </Txt>
            ) : null}
          </g>
        );
      })}
      <path d={`M${x - 4} ${my}l-10 -6v12z`} fill={c} />
      <line x1={x - 30} y1={my} x2={x - 4} y2={my} stroke={c} strokeWidth={1} opacity={0.7} />
      <Txt x={x - 34} y={my + 3.5} size={9} anchor="end" fill={c} mono>
        {marker.toFixed(1)}
      </Txt>
    </g>
  );
};

// ------------------------------------------------------------ centre ---
const CodeColumn: React.FC<Ctx> = ({ f, c }) => {
  const lh = 21;
  const n = CODE.length;
  const off = t01(f) * n * lh;
  const top = 292;
  const h = 370;
  return (
    <g>
      <line x1={576} y1={top - 12} x2={576} y2={top + h + 8} stroke={c} opacity={0.35} />
      <Clip id="hudcode" x={584} y={top} w={290} h={h}>
        {Array.from({ length: n * 2 }, (_, i) => {
          const ly = top + 14 + i * lh - off;
          if (ly < top - lh || ly > top + h + lh) return null;
          return (
            <Txt key={i} x={592} y={ly} size={11.5} fill={c} opacity={0.9} mono>
              {CODE[i % n].replace(/ /g, " ")}
            </Txt>
          );
        })}
      </Clip>
    </g>
  );
};

const TopCentre: React.FC<Ctx> = ({ f, c }) => {
  const pos = t01(f) * LINE_SERIES.length;
  const base = Math.floor(pos);
  const fr = pos - base;
  const pts = Array.from({ length: 17 }, (_, i) => {
    const v = LINE_SERIES[(base + i) % LINE_SERIES.length];
    const v2 = LINE_SERIES[(base + i + 1) % LINE_SERIES.length];
    return [596 + i * 16.5, 222 - (v + (v2 - v) * fr) * 50] as const;
  });
  const count = 1432 + Math.round(D_COUNT(stepF(f, 6)) * 260);
  return (
    <g>
      <Txt x={650} y={84} size={11} ls={1.5} fill={c} weight={600}>
        HIGH
      </Txt>
      <Txt x={650} y={100} size={8} fill={c} opacity={0.75} mono>
        {flicker("9999 99999999999", 61, f, 10)}
      </Txt>
      <Txt x={780} y={84} size={11} ls={1.5} fill={c} weight={600}>
        LOW
      </Txt>
      <Txt x={780} y={100} size={8} fill={c} opacity={0.75} mono>
        {flicker("9999 99999999999", 62, f, 12)}
      </Txt>
      <rect x={590} y={150} width={290} height={84} fill="none" stroke={c} strokeWidth={1} opacity={0.35} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={590} y1={150 + i * 21} x2={880} y2={150 + i * 21} stroke={c} strokeWidth={1} opacity={0.12} />
      ))}
      <Clip id="hudline" x={592} y={140} w={286} h={96}>
        <polyline points={pts.map(([x, y]) => `${(x - fr * 16.5).toFixed(2)},${y.toFixed(2)}`).join(" ")} fill="none" stroke={c} strokeWidth={1.4} />
        {pts.map(([x, y], i) => (
          <rect key={i} x={x - fr * 16.5 - 2.5} y={y - 2.5} width={5} height={5} fill={c} />
        ))}
      </Clip>
      <Txt x={960} y={86} size={34} anchor="middle" fill={c} weight={500} mono filter={GLOW_SOFT}>
        {String(count).padStart(4, "0")}
      </Txt>
      <line x1={910} y1={98} x2={1010} y2={98} stroke={c} opacity={0.5} />
      <Txt x={960} y={114} size={8} anchor="middle" fill={c} opacity={0.7} mono ls={1}>
        {flicker("SEQ 99 / 99", 63, f, 30)}
      </Txt>
    </g>
  );
};

const BracketColumn: React.FC<Ctx> = ({ f, c }) => {
  const x = 900;
  const top = 168;
  const bot = 760;
  const ry = 470 + 190 * wave(f, 2, 0.1);
  return (
    <g>
      <path d={`M${x + 18} ${top}H${x}V${bot}H${x + 18}`} fill="none" stroke={c} strokeWidth={1.4} />
      <path d={`M${x + 162} ${top}H${x + 180}V${bot}H${x + 162}`} fill="none" stroke={c} strokeWidth={1.4} />
      {Array.from({ length: 14 }, (_, i) => {
        const b = BARS[i];
        const yy = top + 30 + i * 40;
        const len = clamp(b.base + b.amp * wave(f, b.k, b.p), 0.1, 1) * 130;
        const left = i % 2 === 0;
        return (
          <g key={i}>
            <line x1={x + 10} y1={yy} x2={x + 170} y2={yy} stroke={c} strokeWidth={1} opacity={0.14} />
            <line x1={left ? x + 14 : x + 166 - len} y1={yy} x2={left ? x + 14 + len : x + 166} y2={yy} stroke={c} strokeWidth={3} opacity={0.85} />
          </g>
        );
      })}
      {/* diamond reticle on the right line */}
      <g transform={`translate(${x + 276} ${ry})`} filter={GLOW}>
        <path d="M0 -34L34 0 0 34 -34 0Z" fill="none" stroke={c} strokeWidth={1.4} />
        <path d="M0 -20L20 0 0 20 -20 0Z" fill="none" stroke={c} strokeWidth={1.2} />
        <path d="M-40 0h-14M40 0h14" stroke={c} strokeWidth={1.2} />
        <circle r={2.5} fill={c} />
      </g>
      <Txt x={x + 276} y={ry - 44} size={9} anchor="middle" fill={c} mono>
        {(ry / 10).toFixed(2)}
      </Txt>
      <line x1={x + 276} y1={top - 10} x2={x + 276} y2={bot + 10} stroke={c} strokeWidth={1} opacity={0.6} />
      {Array.from({ length: 30 }, (_, i) => (
        <line key={i} x1={x + 270} y1={top + i * 20} x2={x + 282} y2={top + i * 20} stroke={c} strokeWidth={1} opacity={i % 5 === 0 ? 0.8 : 0.35} />
      ))}
    </g>
  );
};

// ------------------------------------------------------------- right ---
const RightCentre: React.FC<Ctx> = ({ f, c }) => {
  const segs = Math.floor(cyc(f, 120) * 24);
  const loadVis = 1 - smooth(110, 120, cycFrame(f, 120));
  return (
    <g>
      <Txt x={1236} y={80} size={9} fill={c} opacity={0.75} mono>
        {flicker("999 AA 99 AA", 71, f, 20)}
      </Txt>
      <line x1={1236} y1={92} x2={1440} y2={92} stroke={c} opacity={0.4} />
      <Txt x={1236} y={182} size={14} ls={2} fill={c} weight={500}>
        {HUD_LABELS.loading}
      </Txt>
      <circle cx={1378} cy={177} r={2} fill={c} opacity={blink(f, 30)} />
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={i} x={1236 + i * 8} y={194} width={5} height={7} fill={c} opacity={i < segs ? loadVis : 0.15} />
      ))}
      <Txt x={1236} y={252} size={18} ls={2} fill={c} weight={500} mono>
        {flicker("A999 99AA 99AA 99AA", 72, f, 30)}
      </Txt>
      <Txt x={1236} y={268} size={8} fill={c} opacity={0.6} ls={1}>
        OBJECT
      </Txt>
      <rect x={1236} y={290} width={30} height={30} fill="none" stroke={c} strokeWidth={1} />
      <Txt x={1251} y={311} size={15} anchor="middle" fill={c} weight={600}>
        E
      </Txt>
      <Txt x={1259} y={302} size={7} fill={c}>
        5
      </Txt>
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={1282} y={292 + i * 5} width={40 + ((i * 37) % 60)} height={2} fill={c} opacity={0.7} />
      ))}
      <Txt x={1360} y={300} size={8} fill={c} opacity={0.8} mono>
        {flicker("NZZ 999", 73, f, 30)}
      </Txt>
      <Txt x={1420} y={300} size={8} fill={c} opacity={0.8} mono>
        {flicker("VT' 999", 74, f, 30)}
      </Txt>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={1360 + i * 13} y={310} width={9} height={9} fill={i % 2 ? c : "none"} stroke={c} strokeWidth={1} opacity={0.8} />
      ))}
      {["T1", "1.5", "0.6", "Q", "11"].map((l, i) => {
        const on = smooth(0.4, 0.6, wave01(f, (i % 3) + 1, i * 0.21));
        return (
          <g key={l}>
            <rect x={1236 + i * 46} y={352} width={34} height={34} fill="none" stroke={c} strokeWidth={1} opacity={0.75} />
            <rect x={1241 + i * 46} y={357} width={24} height={24} fill="none" stroke={c} strokeWidth={1} opacity={on} />
            <Txt x={1253 + i * 46} y={373} size={9} anchor="middle" fill={c} mono>
              {l}
            </Txt>
          </g>
        );
      })}
      {/* location readout */}
      <Txt x={1236} y={440} size={10} ls={2} fill={c} weight={500}>
        {HUD_LABELS.location}
      </Txt>
      <Txt x={1236} y={468} size={10} fill={c}>
        N
      </Txt>
      <Txt x={1256} y={470} size={20} ls={1.5} fill={c} weight={500} mono filter={GLOW_SOFT}>
        {`20.675.${flicker("9999", 75, f, 6)}.${flicker("AAA", 76, f, 15)}`}
      </Txt>
      <line x1={1236} y1={482} x2={1520} y2={482} stroke={c} opacity={0.5} />
      {Array.from({ length: 29 }, (_, i) => (
        <line key={i} x1={1236 + i * 10} y1={482} x2={1236 + i * 10} y2={i % 4 === 0 ? 492 : 487} stroke={c} opacity={0.6} />
      ))}
      <path d={`M${1236 + wave01(f, 1, 0.2) * 280} 496l-5 8h10z`} fill={c} />
      {/* small buttons */}
      <Btn f={f} c={c} x={1236} y={540} w={110} h={72} a="ENTER" b="PRESS" lit={smooth(0.4, 0.6, wave01(f, 2, 0.4))} />
      <Btn f={f} c={c} x={1362} y={540} w={110} h={72} a="SEARCH" b="PRESS" lit={smooth(0.4, 0.6, wave01(f, 2, 0.9))} />
    </g>
  );
};

const FarRight: React.FC<Ctx> = ({ f, c }) => {
  const rows = ["32.0", "50.0", "98.0", "09.0", "18.5", "21.0", "77.2", "09.0"];
  const lab = ["{ ent ;", "%d\\n", "\\n\\r\\'", "for (i;", "H 67", "A 479", "i+ ;", "print"];
  return (
    <g>
      <Txt x={1520} y={74} size={8} fill={c} opacity={0.75} mono>
        {flicker("999 AA 99 AA", 81, f, 20)}
      </Txt>
      <rect x={1560} y={110} width={100} height={8} fill="none" stroke={c} strokeWidth={1} opacity={0.6} />
      <rect x={1560} y={110} width={100 * wave01(f, 1)} height={8} fill={c} opacity={0.8} />
      <Txt x={1670} y={118} size={8} fill={c} opacity={0.8} ls={1}>
        LEVEL
      </Txt>
      <Txt x={1560} y={160} size={14} ls={2.5} fill={c} weight={500} mono>
        {flicker("I J 999 A 999A 99A", 82, f, 30)}
      </Txt>
      {/* column of numbers at the right edge */}
      {Array.from({ length: 9 }, (_, i) => (
        <Txt key={i} x={1876} y={100 + i * 26} size={8.5} anchor="end" fill={c} opacity={0.8} mono>
          {flicker("9.99 999", 83 + i, f, 30)}
        </Txt>
      ))}
      <line x1={1820} y1={86} x2={1820} y2={330} stroke={c} opacity={0.35} />
      {/* bar meters */}
      {D_PCT.map((d, i) => {
        const v = clamp(0.45 + 0.3 * d(stepF(f, 5)), 0.05, 0.98);
        return (
          <g key={i}>
            <rect x={1560} y={232 + i * 26} width={130} height={14} fill="none" stroke={c} strokeWidth={1} opacity={0.7} />
            <rect x={1563} y={235 + i * 26} width={124 * v} height={8} fill={c} opacity={0.85} />
            <Txt x={1700} y={243 + i * 26} size={11} fill={c} mono>
              {`${Math.round(v * 100)}%`}
            </Txt>
          </g>
        );
      })}
      <Txt x={1560} y={330} size={8} fill={c} opacity={0.65} mono>
        {flicker("SEC_A9 > GROUP_99 // 9A", 90, f, 40)}
      </Txt>
      {/* control panel */}
      <Txt x={1600} y={432} size={14} ls={2.5} fill={c} weight={500}>
        {HUD_LABELS.control}
      </Txt>
      <Txt x={1660} y={448} size={8} fill={c} opacity={0.7} mono>
        {flicker("A.A. 999", 91, f, 30)}
      </Txt>
      <Toggle f={f} c={c} x={1580} y={472} i={3} />
      {rows.map((v, i) => {
        const yy = 492 + i * 30;
        const alt = Math.floor(lf(f) / 60 + i) % 3 === 0;
        return (
          <g key={i}>
            <Txt x={1600} y={yy + 4} size={10} fill={c} opacity={0.85} mono>
              {lab[i]}
            </Txt>
            <Txt x={1872} y={yy + 5} size={15} anchor="end" fill={c} weight={500} mono>
              {alt ? flicker("99.9", 100 + i, f, 60) : v}
            </Txt>
            <line x1={1700} y1={yy} x2={1800} y2={yy} stroke={c} opacity={0.18} />
          </g>
        );
      })}
    </g>
  );
};

const BottomCentre: React.FC<Ctx> = ({ f, c }) => {
  const sp2 = SPARK2;
  const pos = t01(f) * sp2.length;
  const sp3pos = t01(f) * SPARK3.length * 2;
  return (
    <g>
      {/* code tags */}
      {[0, 1, 2].map((i) =>
        [0, 1].map((j) => (
          <g key={`${i}${j}`}>
            <rect x={620 + i * 92} y={862 + j * 24} width={84} height={18} fill="none" stroke={c} strokeWidth={1} opacity={0.6} />
            <Txt x={662 + i * 92} y={875 + j * 24} size={9} anchor="middle" fill={c} mono>
              {flicker("AA AA AAA", 110 + i * 2 + j, f, 50)}
            </Txt>
          </g>
        )),
      )}
      {/* auto button + small scales */}
      <circle cx={980} cy={884} r={22} fill="none" stroke={c} strokeWidth={1} />
      <circle cx={980} cy={884} r={16} fill="none" stroke={c} strokeWidth={1} strokeDasharray="2 3" transform={`rotate(${t01(f) * 360} 980 884)`} />
      <Txt x={980} y={888} size={9} anchor="middle" fill={c} weight={600}>
        AUTO
      </Txt>
      {/* sensors */}
      <Txt x={1060} y={740} size={13} ls={2.5} fill={c} weight={500}>
        {HUD_LABELS.sensors}
      </Txt>
      {[0, 1, 2].map((i) => {
        const v = 0.25 + 0.6 * wave01(f, i + 1, i * 0.33);
        const cx = 1084 + i * 64;
        return (
          <g key={i}>
            <circle cx={cx} cy={790} r={22} fill="none" stroke={c} strokeWidth={1} opacity={0.35} />
            <circle
              cx={cx}
              cy={790}
              r={22}
              fill="none"
              stroke={c}
              strokeWidth={2.4}
              pathLength={100}
              strokeDasharray={`${v * 100} 100`}
              transform={`rotate(-90 ${cx} 790)`}
            />
            <Txt x={cx} y={794} size={9} anchor="middle" fill={c} mono>
              {`${Math.round(v * 100)}`}
            </Txt>
          </g>
        );
      })}
      <Txt x={1060} y={840} size={8} fill={c} opacity={0.65} mono>
        {flicker("0% / 99% / 99%", 120, f, 30)}
      </Txt>
      {/* calculation */}
      <Txt x={1340} y={740} size={13} ls={2.5} fill={c} weight={500}>
        {HUD_LABELS.calc}
      </Txt>
      <line x1={1340} y1={770} x2={1560} y2={770} stroke={c} strokeWidth={1} opacity={0.7} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={1340 + i * 20} y1={765} x2={1340 + i * 20} y2={775} stroke={c} opacity={0.6} />
      ))}
      <rect x={1340 + wave01(f, 2) * 196} y={762} width={24} height={16} fill="none" stroke={c} strokeWidth={1.4} />
      <rect x={1340} y={790} width={220} height={36} fill="none" stroke={c} strokeWidth={1} opacity={0.35} />
      <polyline
        points={windowPts(sp2, pos, 22, 1340, 790, 220, 36)}
        fill="none"
        stroke={c}
        strokeWidth={1.2}
      />
      {/* wide waveform */}
      <Clip id="hudwave" x={1060} y={890} w={500} h={80}>
        <polyline points={windowPts(SPARK3, sp3pos, 50, 1060, 896, 500, 64)} fill="none" stroke={c} strokeWidth={1} opacity={0.85} />
      </Clip>
      <line x1={1060} y1={970} x2={1560} y2={970} stroke={c} opacity={0.4} />
      {Array.from({ length: 26 }, (_, i) => (
        <line key={i} x1={1060 + i * 20} y1={970} x2={1060 + i * 20} y2={975} stroke={c} opacity={0.5} />
      ))}
      {/* small scale + toggles at right bottom */}
      <TickScale f={f} c={c} x={1650} y={760} h={180} from={0} to={60} marker={30 + 20 * D_MARK2(f)} big={false} />
      {[0, 1, 2, 3].map((i) => (
        <Toggle key={i} f={f} c={c} x={1720 + (i % 2) * 40} y={800 + Math.floor(i / 2) * 50} i={i + 20} label={["A1", "A2", "B1", "B2"][i]} />
      ))}
      <Txt x={1872} y={960} size={8} anchor="end" fill={c} opacity={0.7} mono>
        {flicker("H.L 999", 121, f, 30)}
      </Txt>
    </g>
  );
};

const Extras: React.FC<Ctx> = ({ f, c }) => {
  // scope with a sweeping line (4 turns per loop)
  const cx = 730;
  const cy = 768;
  const a = t01(f) * Math.PI * 2 * 4;
  const bx = 1494 + 72 * (0.5 + 0.5 * wave(f, 2));
  const by = 534 + 72 * (0.5 + 0.5 * wave(f, 3, 0.25));
  return (
    <g>
      {[70, 48, 26].map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={1} opacity={r === 70 ? 0.8 : 0.35} />
      ))}
      <path d={`M${cx - 80} ${cy}h160M${cx} ${cy - 80}v160`} stroke={c} strokeWidth={1} opacity={0.3} />
      <line x1={cx} y1={cy} x2={cx + Math.cos(a) * 70} y2={cy + Math.sin(a) * 70} stroke={c} strokeWidth={1.6} />
      {[0.7, 2.1, 3.9, 5.2].map((p, i) => {
        const d = ((a - p) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const r = 22 + i * 13;
        return <circle key={i} cx={cx + Math.cos(p) * r} cy={cy + Math.sin(p) * r} r={2.6} fill={c} opacity={Math.max(0.1, 1 - d / 3)} />;
      })}
      <Txt x={cx + 78} y={cy + 66} size={8} fill={c} opacity={0.7} mono>
        {flicker("RNG 999", 140, f, 20)}
      </Txt>
      {/* xy plot */}
      <rect x={1490} y={530} width={80} height={80} fill="none" stroke={c} strokeWidth={1} opacity={0.5} />
      <path d="M1530 530v80M1490 570h80" stroke={c} strokeWidth={1} opacity={0.18} />
      <path d={`M${bx} 530v80M1490 ${by}h80`} stroke={c} strokeWidth={1} opacity={0.5} strokeDasharray="2 3" />
      <rect x={bx - 4} y={by - 4} width={8} height={8} fill="none" stroke={c} strokeWidth={1.4} />
      <Txt x={1490} y={626} size={8} fill={c} opacity={0.7} mono>
        {`X ${(bx - 1490).toFixed(1)} Y ${(by - 530).toFixed(1)}`}
      </Txt>
      {/* small level list */}
      {Array.from({ length: 8 }, (_, i) => {
        const v = 0.2 + 0.75 * wave01(f, (i % 4) + 1, i * 0.17);
        return (
          <g key={i}>
            <Txt x={452} y={792 + i * 24} size={8.5} fill={c} opacity={0.8} mono>
              {`L${i + 1}`}
            </Txt>
            <line x1={474} y1={789 + i * 24} x2={560} y2={789 + i * 24} stroke={c} opacity={0.2} />
            <line x1={474} y1={789 + i * 24} x2={474 + 86 * v} y2={789 + i * 24} stroke={c} strokeWidth={2} />
          </g>
        );
      })}
    </g>
  );
};

const windowPts = (s: number[], pos: number, count: number, x: number, y: number, w: number, h: number) => {
  const base = Math.floor(pos);
  const fr = pos - base;
  const step = w / (count - 1);
  return Array.from({ length: count + 1 }, (_, i) => {
    const v = s[(base + i) % s.length];
    return `${(x + (i - fr) * step).toFixed(2)},${(y + h - v * h).toFixed(2)}`;
  }).join(" ");
};

const TopRow: React.FC<Ctx> = ({ f, c }) => {
  const labels = ["75", "DATA", "08.63", "47.21", "75", "06.2", "21.4", "ON"];
  return (
    <g>
      {labels.map((l, i) => (
        <Toggle key={i} f={f} c={c} x={372 + i * 31} y={72} i={i} label={l} />
      ))}
      {["T.O", "78.5", "BR", "07"].map((l, i) => (
        <g key={i}>
          <circle cx={384 + i * 62} cy={120} r={11} fill="none" stroke={c} strokeWidth={1} opacity={0.6} />
          <Txt x={384 + i * 62} y={123} size={7.5} anchor="middle" fill={c} mono>
            {l}
          </Txt>
        </g>
      ))}
      <Txt x={372} y={174} size={14} ls={2} fill={c} weight={500}>
        {HUD_LABELS.indicators}
      </Txt>
      {HUD_LABELS.indicatorsSub.map((s, i) => (
        <Txt key={s} x={372} y={192 + i * 12} size={8} fill={c} opacity={0.75} ls={0.5}>
          {s}
        </Txt>
      ))}
    </g>
  );
};

const BottomStrip: React.FC<Ctx> = ({ f, c }) => (
  <g>
    <line x1={40} y1={1010} x2={1880} y2={1010} stroke={c} opacity={0.35} />
    {["999 AA 99 AA", "999 AA 99 AA", "999 AA 99 AA", "999 AA 99 AA", "999 AA 99 AA"].map((p, i) => (
      <g key={i}>
        <rect x={40 + i * 372} y={1018} width={10} height={10} fill="none" stroke={c} strokeWidth={1} opacity={0.6} />
        <Txt x={58 + i * 372} y={1027} size={9} fill={c} opacity={0.85} mono>
          {flicker(p, 130 + i, f, 60)}
        </Txt>
        <line x1={180 + i * 372} y1={1023} x2={380 + i * 372} y2={1023} stroke={c} opacity={0.18} />
      </g>
    ))}
    {Array.from({ length: 93 }, (_, i) => (
      <line key={i} x1={40 + i * 20} y1={1004} x2={40 + i * 20} y2={i % 5 === 0 ? 1016 : 1010} stroke={c} opacity={0.3} />
    ))}
  </g>
);

// -------------------------------------------------------------- root ---
export const MinimalHud: React.FC<{ th: HudTheme }> = ({ th }) => {
  const f = useCurrentFrame();
  const c = th.c;
  const ctx = { f, c };
  const m1 = 185 + 62 * D_MARK(f);
  return (
    // Pure black, fixed camera, no grain.
    <Stage bg="#000000">
      <g filter={GLOW_SOFT}>
        <Corner c={c} x={22} y={22} sx={1} sy={1} />
        <Corner c={c} x={1898} y={22} sx={-1} sy={1} />
        <Corner c={c} x={22} y={1058} sx={1} sy={-1} />
        <Corner c={c} x={1898} y={1058} sx={-1} sy={-1} />
        <TopLeft {...ctx} />
        <TopRow {...ctx} />
        <AccessDenied {...ctx} />
        <Sliders {...ctx} />
        <ButtonsAndEq {...ctx} />
        <BottomLeft {...ctx} />
        <TickScale {...ctx} x={474} y={262} h={450} from={110} to={260} marker={m1} />
        <CodeColumn {...ctx} />
        <TopCentre {...ctx} />
        <BracketColumn {...ctx} />
        <RightCentre {...ctx} />
        <FarRight {...ctx} />
        <BottomCentre {...ctx} />
        <BottomStrip {...ctx} />
        <Extras {...ctx} />
      </g>
    </Stage>
  );
};
