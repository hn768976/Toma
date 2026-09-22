import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_MONO, PALETTE } from "./constants";
import { ICONS } from "./icons";
import { Icon } from "./icons";
import { BarMeter, Gauge, GridBlock, Label, Num, Panel, TickRows } from "./panels";
import { osc, pulse } from "./loop";

// ---------------------------------------------------------------------------
// The two instrument clusters, split by depth.
//
// FarFurniture  -> pushed back and softly blurred
// MidCluster    -> the sharp plane; core, traces and everything readable
// NearFurniture -> pushed forward and heavily blurred
//
// Panels deliberately start at negative x and run past BASE_WIDTH so the
// interface is cropped by BOTH side edges and reads as continuing off-frame.
// ---------------------------------------------------------------------------

const ICON_BOX = 134;
const ICON_GLYPH = 86;

/** Icon in a thin square frame, lit in sequence with the rest of the set. */
const FramedIcon: React.FC<{ index: number; x: number; y: number }> = ({ index, x, y }) => {
  const frame = useCurrentFrame();
  // Three passes over the nine icons across the loop; each icon peaks at its
  // own moment, so one or two are bright at a time.
  const lit = pulse(frame, 3, index / ICONS.length, 0.2);
  const def = ICONS[index % ICONS.length];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={ICON_BOX}
        height={ICON_BOX}
        fill={PALETTE.cyanDeep}
        opacity={0.1 + lit * 0.22}
      />
      <rect
        x={x}
        y={y}
        width={ICON_BOX}
        height={ICON_BOX}
        fill="none"
        stroke={PALETTE.line}
        strokeWidth={3.2}
        opacity={0.5 + lit * 0.5}
      />
      <Icon
        def={def}
        x={x + (ICON_BOX - ICON_GLYPH) / 2}
        y={y + (ICON_BOX - ICON_GLYPH) / 2}
        size={ICON_GLYPH}
        color={lit > 0.35 ? "#F2FCFF" : "#D2ECFB"}
        stroke={5.6}
        opacity={0.82 + lit * 0.18}
      />
    </g>
  );
};

const ICON_SLOTS: { x: number; y: number }[] = [
  // Three up and left of the core.
  { x: 1024, y: 470 },
  { x: 1240, y: 366 },
  { x: 1466, y: 282 },
  // Six to the right, in a loose two-column grid.
  { x: 2452, y: 690 },
  { x: 2688, y: 748 },
  { x: 2418, y: 944 },
  { x: 2664, y: 1010 },
  { x: 2456, y: 1198 },
  { x: 2706, y: 1266 },
];

/** Deep slab: soft, low-contrast instrumentation that sits behind the action. */
export const FarFurniture: React.FC = () => (
  <g>
    <Panel x={2980} y={168} w={760} h={250} title="INPUT">
      <TickRows x={3000} y={238} w={716} rows={5} seed={4101} />
      <Num x={3690} y={210} size={24} anchor="end" opacity={0.6}>
        0114
      </Num>
    </Panel>
    <Panel x={3560} y={520} w={700} h={230} title="CHANNEL">
      <TickRows x={3580} y={590} w={660} rows={4} seed={4102} />
    </Panel>
    <Panel x={1980} y={92} w={560} h={150} filled={false}>
      <TickRows x={1998} y={116} w={520} rows={3} seed={4104} opacity={0.4} />
    </Panel>
    <Panel x={2262} y={1562} w={660} h={230} title="OUTPUT">
      <TickRows x={2284} y={1632} w={616} rows={4} seed={4108} />
    </Panel>
    <Panel x={3222} y={1040} w={640} h={470} title="ANALYSIS">
      <TickRows x={3244} y={1114} w={596} rows={11} seed={4107} gap={22} />
      <BarMeter x={3244} y={1412} w={430} cycles={3} shift={0.4} />
    </Panel>
    <Panel x={-300} y={1214} w={700} h={210} title="STATUS">
      <TickRows x={-278} y={1284} w={656} rows={4} seed={4106} />
    </Panel>
    <Panel x={3240} y={1660} w={720} h={300} title="SEGMENT">
      <TickRows x={3262} y={1732} w={676} rows={6} seed={4105} />
    </Panel>
    {/* A run of plates along the very top — that band was reading as an
        empty gradient across the whole width. */}
    {[
      { x: -180, y: -170, w: 520 },
      { x: 430, y: -140, w: 390 },
      { x: 930, y: -120, w: 460 },
      { x: 1500, y: -96, w: 420 },
      { x: 2020, y: -74, w: 500 },
      { x: 2620, y: -48, w: 430 },
      { x: 3160, y: -24, w: 540 },
    ].map((b, i) => (
      <g key={`top${i}`} opacity={0.5}>
        <rect
          x={b.x}
          y={b.y}
          width={b.w}
          height={150}
          fill="url(#panelGrad)"
          stroke={PALETTE.line}
          strokeWidth={2.2}
          opacity={0.45}
        />
        <TickRows x={b.x + 14} y={b.y + 22} w={b.w - 28} rows={4} seed={7100 + i} gap={20} />
      </g>
    ))}

    {/* Micro-detail across the areas that would otherwise read as bare
        black: small plates, silkscreen digits and bracket marks. */}
    {[
      { x: 96, y: 60, w: 300, h: 92, seed: 6001, rows: 3 },
      { x: 470, y: 128, w: 236, h: 76, seed: 6002, rows: 2 },
      { x: 1620, y: 46, w: 340, h: 84, seed: 6003, rows: 3 },
      { x: 2060, y: 116, w: 268, h: 70, seed: 6004, rows: 2 },
      { x: 1236, y: 1852, w: 330, h: 96, seed: 6005, rows: 3 },
      { x: 1700, y: 1936, w: 286, h: 78, seed: 6006, rows: 2 },
      { x: 3060, y: 372, w: 252, h: 88, seed: 6007, rows: 3 },
      { x: 3080, y: 700, w: 214, h: 70, seed: 6008, rows: 2 },
      { x: 640, y: 1980, w: 260, h: 74, seed: 6009, rows: 2 },
    ].map((b) => (
      <g key={b.seed} opacity={0.62}>
        <rect
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill="none"
          stroke={PALETTE.line}
          strokeWidth={2.2}
          opacity={0.4}
        />
        <TickRows
          x={b.x + 12}
          y={b.y + 16}
          w={b.w - 24}
          rows={b.rows}
          seed={b.seed}
          gap={22}
          opacity={0.45}
        />
      </g>
    ))}
    {[
      { x: 820, y: 236 },
      { x: 2420, y: 96 },
      { x: 1440, y: 2010 },
      { x: 3420, y: 940 },
      { x: 220, y: 386 },
    ].map((c, i) => (
      <g key={`bk${i}`} stroke={PALETTE.cyanDim} strokeWidth={2.6} opacity={0.4} fill="none">
        <path d={`M ${c.x} ${c.y + 26} L ${c.x} ${c.y} L ${c.x + 26} ${c.y}`} />
        <path d={`M ${c.x + 120} ${c.y} L ${c.x + 146} ${c.y} L ${c.x + 146} ${c.y + 26}`} />
      </g>
    ))}

    {/* Loose strings of digits, as in a board silkscreen. */}
    <text
      x={1180}
      y={176}
      fontFamily={FONT_MONO}
      fontSize={30}
      fill={PALETTE.textDim}
      opacity={0.42}
      letterSpacing={7}
    >
      0610011101001101
    </text>
    {[
      { x: 340, y: 1064, n: "1011001010", o: 0.32 },
      { x: 120, y: 224, n: "01101100 1001", o: 0.3 },
      { x: 1660, y: 234, n: "0100110101", o: 0.28 },
      { x: 2480, y: 176, n: "110100101101", o: 0.26 },
      { x: 1280, y: 2064, n: "0110100110", o: 0.28 },
      { x: 2820, y: 1966, n: "10110100", o: 0.26 },
      { x: 3140, y: 556, n: "0101101", o: 0.28 },
      { x: 560, y: 1890, n: "1101001011", o: 0.24 },
    ].map((d, i) => (
      <text
        key={`mx${i}`}
        x={d.x}
        y={d.y}
        fontFamily={FONT_MONO}
        fontSize={28}
        fill={PALETTE.textDim}
        opacity={d.o}
        letterSpacing={6}
      >
        {d.n}
      </text>
    ))}
  </g>
);

/** The sharp plane. */
export const MidCluster: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <g>
      {/* ---- Left: gauges, meters, grid block ---- */}
      <g filter="url(#glowSoft)">
        <Gauge cx={186} cy={452} r={70} cycles={2} shift={0.0} lo={18} hi={74} label="LEVEL" />
        <Gauge cx={420} cy={486} r={70} cycles={3} shift={0.31} lo={26} hi={92} label="RATE" />
        <Gauge cx={272} cy={702} r={58} cycles={4} shift={0.62} lo={12} hi={58} />
        <Gauge
          cx={566}
          cy={790}
          r={62}
          cycles={2}
          shift={0.47}
          lo={34}
          hi={88}
          color={PALETTE.warm}
        />
      </g>

      <Panel x={-420} y={92} w={620} h={240} title="MODULE A">
        <TickRows x={-400} y={162} w={576} rows={5} seed={4103} />
      </Panel>

      <Panel x={700} y={330} w={470} h={300} title="PROCESS">
        <BarMeter x={722} y={418} w={420} cycles={3} shift={0.12} label="A" />
        <BarMeter x={722} y={490} w={420} cycles={4} shift={0.55} label="B" />
        <BarMeter x={722} y={562} w={420} cycles={2} shift={0.81} label="C" color={PALETTE.warm} />
      </Panel>

      <g>
        <Label x={124} y={952} size={21} opacity={0.5}>
          MATRIX
        </Label>
        <GridBlock x={124} y={982} cols={14} rows={6} cell={28} gap={11} seed={5150} cycles={2} />
      </g>

      <BarMeter x={760} y={1092} w={380} cycles={5} shift={0.2} label="STREAM" />
      <BarMeter x={760} y={1158} w={380} cycles={3} shift={0.68} label="BUFFER" />

      {/* A large neutral plate designation, as on the reference. */}
      <text
        x={1004}
        y={1704}
        fontFamily={FONT_MONO}
        fontSize={78}
        fontWeight={500}
        fill={PALETTE.text}
        opacity={0.78}
        letterSpacing={8}
      >
        M-42
      </text>
      <line
        x1={996}
        y1={1592}
        x2={1596}
        y2={1592}
        stroke={PALETTE.line}
        strokeWidth={3}
        opacity={0.45}
      />

      {/* ---- Right: icon grid and panels ---- */}
      <g filter="url(#glowSoft)">
        {ICON_SLOTS.map((slot, i) => (
          <FramedIcon key={i} index={i} x={slot.x} y={slot.y} />
        ))}
      </g>

      {/* Small readout plates tucked between the icons. */}
      {[
        { x: 2214, y: 812, w: 172 },
        { x: 2206, y: 1074, w: 146 },
        { x: 2892, y: 884, w: 198 },
        { x: 2900, y: 1386, w: 164 },
        { x: 2210, y: 1420, w: 190 },
        { x: 2944, y: 1150, w: 132 },
      ].map((p, i) => (
        <g key={i}>
          <rect
            x={p.x}
            y={p.y}
            width={p.w}
            height={46}
            fill={PALETTE.cyanDeep}
            opacity={0.34}
            stroke={PALETTE.line}
            strokeWidth={2.2}
          />
          <rect
            x={p.x + 8}
            y={p.y + 12}
            width={(p.w - 16) * osc(frame, 2 + i, i * 0.23, 0.25, 0.95)}
            height={22}
            fill={PALETTE.cyan}
            opacity={0.6}
          />
        </g>
      ))}

      <Label x={2286} y={548} size={21} opacity={0.42}>
        NODE MAP
      </Label>
    </g>
  );
};

/** Near slab: large, soft plates that crowd the bottom of the frame. */
export const NearFurniture: React.FC = () => (
  <g>
    <Panel x={-460} y={1682} w={880} h={380} title="QUEUE" opacity={0.9}>
      <TickRows x={-432} y={1768} w={824} rows={6} seed={4201} gap={26} />
    </Panel>
    <Panel x={560} y={1892} w={720} h={320} opacity={0.75}>
      <TickRows x={584} y={1926} w={672} rows={5} seed={4202} gap={26} />
    </Panel>
    <Panel x={1880} y={1960} w={900} h={300} opacity={0.6} filled={false}>
      <TickRows x={1904} y={1996} w={852} rows={4} seed={4203} gap={26} />
    </Panel>
    <Panel x={3560} y={140} w={760} h={280} opacity={0.5} filled={false}>
      <TickRows x={3584} y={180} w={712} rows={5} seed={4204} gap={26} />
    </Panel>
  </g>
);
