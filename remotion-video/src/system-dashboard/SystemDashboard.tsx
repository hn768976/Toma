import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import "./fonts";
import { BASE_H, BASE_W, FINE, HAIRLINE } from "./constants";
import { appear, flickerOpacity, ramp, tickingDigits, tickingHex } from "./anim";
import { numCode, shortCode, unitLabel } from "./text";
import { THEME_CYAN, THEME_MONO, ThemeContext, useTheme } from "./theme";
import { Corners, Cross, Dots, Mod, Svg, TickRow, Txt } from "./primitives";
import {
  BarColumns,
  BarRow,
  DataTable,
  FillerCluster,
  PanelFrame,
  ParagraphBlock,
  ProgressBar,
  ReadoutColumn,
  StripMeter,
  VerticalMeter,
  Waveform,
} from "./modules/Common";
import {
  AttentionBanner,
  BlockMeter,
  CaptionBox,
  ControlCluster,
  DataAnalysis,
  DisplayFrame,
  ErrorButton,
  FlowDiagram,
  HeaderRail,
  Scanner,
  SpectrumPanel,
} from "./modules/Widgets";
import { Overlay } from "./Overlay";

export const systemDashboardSchema = z.object({
  variant: z.enum(["mono", "cyan"]),
});

export type SystemDashboardProps = z.infer<typeof systemDashboardSchema>;

export const systemDashboardDefaults: SystemDashboardProps = { variant: "mono" };

/** Rare one- or two-frame dip applied to a whole module. */
const Flicker: React.FC<{ seed: number; children: React.ReactNode }> = ({ seed, children }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, opacity: flickerOpacity(frame, seed) }}>
      {children}
    </div>
  );
};

/** A very slightly lifted rectangular region - a translucent pane behind the UI. */
const Pane: React.FC<{ x: number; y: number; w: number; h: number; start: number }> = ({
  x,
  y,
  w,
  h,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: theme.lift,
        opacity: ramp(frame, start, 40),
      }}
    />
  );
};

const LeftBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const X = 80;
  const W = 1180;
  return (
    <>
      {/* Bordered SYSTEM LEVEL 4 panel. */}
      <Mod x={X} y={140} w={W} h={920}>
        <Flicker seed={11}>
          <PanelFrame w={W} h={920} title="SYSTEM LEVEL 4" p={appear(frame, 12, 60)} grid gridStep={26} lift />
          <Mod x={26} y={100} w={700} h={580}>
            <DataTable w={700} rows={21} cols={4} cellW={6} seed={4211} start={64} rowStep={26} size={18} />
          </Mod>
          <Mod x={764} y={110} w={380} h={520}>
            <BarColumns w={380} h={500} count={4} seed={733} start={92} />
          </Mod>
          <Mod x={26} y={702} w={1128} h={92}>
            <Waveform w={1128} h={92} seed={9001} start={182} speed={1.4} />
          </Mod>
          <Mod x={26} y={806} w={1128} h={92}>
            <Waveform w={1128} h={92} seed={9002} start={196} speed={0.95} dx={2.4} />
          </Mod>
          <Mod x={764} y={648} w={390} h={40}>
            <ReadoutColumn w={380} rows={1} seed={7733} start={120} size={18} rowStep={26} />
          </Mod>
          <Mod x={26} y={686} w={1128} h={12}>
            <Svg w={1128} h={12} style={{ opacity: ramp(frame, 178, 30) }}>
              <TickRow w={1128} step={14} len={5} major={5} majorLen={10} />
            </Svg>
          </Mod>
        </Flicker>
      </Mod>

      {/* Paragraph block. */}
      <Mod x={X} y={1100} w={W} h={230}>
        <ParagraphBlock w={W} lines={8} seed={521} start={128} size={21} lineStep={27} chars={98} />
      </Mod>

      {/* Framed caption box with the R17 badge. */}
      <Mod x={X} y={1370} w={W} h={214}>
        <Flicker seed={12}>
          <CaptionBox w={W} h={214} seed={317} start={150} />
        </Flicker>
      </Mod>

      {/* Cluster between the caption box and the bottom edge. */}
      <Mod x={X} y={1612} w={W} h={230}>
        <FillerCluster w={W} h={220} seed={881} start={196} />
        <Mod x={0} y={0} w={560} h={78}>
          <Waveform w={560} h={72} seed={9003} start={204} speed={0.8} dx={2.2} mirror={false} />
        </Mod>
        <Mod x={604} y={4} w={300} h={70}>
          <BarRow w={300} h={68} count={14} seed={9105} start={208} />
        </Mod>
        <Mod x={946} y={30} w={234} h={30}>
          <StripMeter w={234} h={26} count={18} seed={9207} start={214} />
        </Mod>
        <Mod x={0} y={96} w={430} h={70}>
          <ReadoutColumn w={430} rows={2} seed={4401} start={210} size={19} rowStep={30} />
        </Mod>
        <Mod x={604} y={96} w={576} h={70}>
          <ReadoutColumn w={576} rows={2} seed={4409} start={218} size={19} rowStep={30} />
        </Mod>
        <Mod x={0} y={176} w={W} h={40}>
          <DataTable w={W} rows={1} cols={7} cellW={6} seed={4517} start={220} rowStep={26} size={18} />
        </Mod>
      </Mod>

      {/* Bottom edge: progress bar, ERROR button and its readout. */}
      <Mod x={X} y={1878} w={W} h={18}>
        <ProgressBar w={W} h={16} seed={601} start={168} segments={40} />
      </Mod>
      <Mod x={X} y={1846} w={W} h={20}>
        <Svg w={W} h={20} style={{ opacity: ramp(frame, 170, 26) }}>
          <TickRow w={W} step={20} len={6} major={5} majorLen={12} />
        </Svg>
      </Mod>
      <Mod x={X} y={1936} w={W} h={76}>
        <ErrorButton w={214} h={72} start={186} seed={1777} />
        <Mod x={470} y={0} w={300} h={72}>
          <BarRow w={300} h={70} count={16} seed={2323} start={216} />
        </Mod>
        <Mod x={806} y={12} w={374} h={30}>
          <StripMeter w={374} h={26} count={26} seed={2417} start={222} />
        </Mod>
        <Mod x={806} y={52} w={374} h={24}>
          <Svg w={374} h={20} style={{ opacity: ramp(frame, 226, 26) }}>
            <TickRow w={374} step={10} len={5} major={5} majorLen={11} />
          </Svg>
        </Mod>
      </Mod>
      <Mod x={X} y={2058} w={W} h={30}>
        <Svg w={W} h={30} style={{ opacity: ramp(frame, 214, 30) * 0.9 }}>
          <TickRow w={W} step={11} len={5} major={8} majorLen={12} />
        </Svg>
        <Txt x={0} y={14} size={16} mono color={theme.structure} opacity={ramp(frame, 220, 30)}>
          {shortCode(31)} {numCode(77, 8)} {unitLabel(19)}
        </Txt>
      </Mod>
    </>
  );
};

const RightBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const X = 1330;
  const W = 2430;
  return (
    <>
      <Mod x={X} y={110} w={W} h={110}>
        <HeaderRail w={W} h={110} start={26} seed={2201} />
      </Mod>

      {/* Scanner widgets. */}
      {[0, 1, 2].map((i) => (
        <Mod key={i} x={X + i * 280} y={250} w={240} h={240}>
          <Flicker seed={40 + i}>
            <Scanner
              size={240}
              seed={5100 + i * 37}
              start={78 + i * 14}
              label={shortCode(900 + i)}
              speed={0.18 + i * 0.07}
            />
          </Flicker>
        </Mod>
      ))}
      <Mod x={X} y={506} w={810} h={200}>
        <Svg w={810} h={30} style={{ opacity: ramp(frame, 130, 30) }}>
          <TickRow w={810} step={13} len={6} major={5} majorLen={13} />
          <path d={`M0 28H${810}`} stroke={theme.structure} strokeWidth={FINE} strokeDasharray="12 8" />
        </Svg>
        <Txt x={0} y={36} size={17} mono color={theme.secondary} opacity={ramp(frame, 136, 24) * 0.85}>
          {shortCode(12)} {tickingHex(frame, 771, 6)} {"  "} {shortCode(44)} {tickingDigits(frame, 883, 5)} {"  "} 32 Hz
        </Txt>
        <Mod x={0} y={70} w={370} h={130}>
          <DataTable w={370} rows={5} cols={3} cellW={5} seed={3907} start={146} rowStep={25} size={17} />
        </Mod>
        <Mod x={410} y={72} w={170} h={124}>
          <BarRow w={170} h={110} count={10} seed={3911} start={152} />
        </Mod>
        <Mod x={614} y={70} w={196} h={130}>
          <ReadoutColumn w={196} rows={4} seed={3919} start={158} size={18} rowStep={30} />
        </Mod>
      </Mod>

      {/* DATA ANALYSIS. */}
      <Mod x={2200} y={250} w={580} h={320}>
        <Flicker seed={51}>
          <DataAnalysis w={580} h={310} seed={661} start={96} />
        </Flicker>
      </Mod>

      {/* ATTENTION! banner, upper right of centre. */}
      <Mod x={2200} y={596} w={560} h={100}>
        <AttentionBanner w={560} h={100} start={206} />
      </Mod>

      {/* Large display frame with POWER / GROUP. */}
      <Mod x={2840} y={250} w={920} h={550}>
        <Flicker seed={52}>
          <DisplayFrame w={920} h={550} seed={881} start={70} />
        </Flicker>
      </Mod>
      <Mod x={2840} y={834} w={920} h={100}>
        <BarRow w={920} h={94} count={26} seed={1201} start={140} />
      </Mod>
      <Mod x={2840} y={964} w={920} h={40}>
        <StripMeter w={920} h={34} count={46} seed={1303} start={156} />
      </Mod>

      {/* Spectrum panel. */}
      <Mod x={X} y={722} w={1430} h={318}>
        <Flicker seed={53}>
          <SpectrumPanel w={1430} h={310} seed={2801} start={112} />
        </Flicker>
      </Mod>

      {/* Flow diagram. */}
      <Mod x={X} y={1094} w={940} h={470}>
        <Flicker seed={54}>
          <FlowDiagram w={940} h={460} seed={3301} start={122} />
        </Flicker>
      </Mod>

      {/* Paragraph columns filling the right edge. */}
      <Mod x={2320} y={1094} w={560} h={470}>
        <ParagraphBlock w={560} lines={15} seed={7101} start={140} size={20} lineStep={30} chars={56} />
      </Mod>
      <Mod x={2930} y={1094} w={560} h={470}>
        <ParagraphBlock w={560} lines={15} seed={7207} start={162} size={20} lineStep={30} chars={56} opacity={0.4} />
      </Mod>

      {/* Vertical meters at the right edge. */}
      <Mod x={3560} y={1094} w={52} h={800}>
        <VerticalMeter w={52} h={800} seed={4801} start={150} ticks={34} />
      </Mod>
      <Mod x={3648} y={1094} w={112} h={800}>
        <BlockMeter w={112} h={800} seed={4903} start={166} />
      </Mod>

      <Mod x={X} y={1572} w={1460} h={26}>
        <Svg w={1460} h={22} style={{ opacity: ramp(frame, 210, 30) * 0.9 }}>
          <TickRow w={1460} step={11} len={5} major={6} majorLen={12} />
        </Svg>
      </Mod>

      {/* Second cluster row. */}
      <Mod x={X} y={1620} w={900} h={300}>
        <DataTable w={880} rows={9} cols={5} cellW={5} seed={5511} start={172} rowStep={28} size={19} />
      </Mod>
      <Mod x={2320} y={1618} w={240} h={240}>
        <Flicker seed={55}>
          <Scanner size={220} seed={6003} start={188} label={shortCode(931)} speed={-0.14} />
        </Flicker>
      </Mod>
      <Mod x={2596} y={1620} w={280} h={260}>
        <ReadoutColumn w={280} rows={8} seed={6301} start={196} size={19} rowStep={30} />
      </Mod>
      <Mod x={2930} y={1620} w={560} h={260}>
        <ParagraphBlock w={560} lines={8} seed={7411} start={186} size={19} lineStep={29} chars={54} opacity={0.34} />
      </Mod>

      {/* Bottom row. */}
      <Mod x={X} y={1948} w={700} h={100}>
        <BarRow w={700} h={92} count={22} seed={8101} start={200} />
      </Mod>
      <Mod x={2090} y={2010} w={1000} h={40}>
        <StripMeter w={1000} h={34} count={62} seed={8203} start={210} />
      </Mod>
      <Mod x={2090} y={1962} w={1000} h={30}>
        <Svg w={1000} h={30} style={{ opacity: ramp(frame, 206, 28) }}>
          <TickRow w={1000} step={12} len={6} major={6} majorLen={13} />
        </Svg>
      </Mod>
      <Mod x={3150} y={1936} w={610} h={120}>
        <ControlCluster w={610} h={116} seed={8807} start={214} />
      </Mod>
    </>
  );
};

/** Isolated dots, crosses and brackets that fill the channels between clusters. */
const Filler: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = ramp(frame, 200, 40);
  return (
    <Svg w={BASE_W} h={BASE_H} style={{ opacity: p }}>
      <Dots w={BASE_W} h={BASE_H} count={70} seed={9911} r={2.4} opacity={0.45} />
      <Cross x={1296} y={640} r={9} />
      <Cross x={1296} y={1300} r={9} />
      <Cross x={2790} y={1060} r={9} />
      <Cross x={3520} y={230} r={9} />
      <Cross x={2170} y={1980} r={9} />
      <g transform="translate(1284 700)">
        <path d={`M0 0V620`} stroke={theme.structure} strokeWidth={FINE} strokeDasharray="10 12" />
      </g>
      <g transform="translate(40 40)">
        <Corners w={BASE_W - 80} h={BASE_H - 80} len={44} color={theme.secondary} sw={HAIRLINE} opacity={0.8} />
      </g>
    </Svg>
  );
};

export const SystemDashboard: React.FC<SystemDashboardProps> = ({ variant }) => {
  const { width } = useVideoConfig();
  const theme = variant === "cyan" ? THEME_CYAN : THEME_MONO;
  // Authored at 3840x2160 and scaled to whatever the composition is, so a
  // 1080p preview is an exact half-scale of the 4K render.
  const scale = width / BASE_W;
  return (
    <ThemeContext.Provider value={theme}>
      <AbsoluteFill style={{ backgroundColor: "#000000" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: BASE_W,
            height: BASE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <Pane x={60} y={120} w={1220} h={960} start={16} />
          <Pane x={2820} y={230} w={960} h={790} start={58} />
          <Pane x={1310} y={702} w={1470} h={358} start={104} />
          <Pane x={1310} y={1074} w={980} h={510} start={116} />

          <LeftBlock />
          <RightBlock />
          <Filler />
          <Overlay w={BASE_W} h={BASE_H} />
        </div>
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
