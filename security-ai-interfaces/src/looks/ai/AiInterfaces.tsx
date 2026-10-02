import React from "react";
import { useCurrentFrame } from "remotion";
import { Icon } from "../../lib/icons";
import { smooth } from "../../lib/loop";
import { Stage } from "../../lib/Stage";
import { Txt } from "../../lib/ui";
import { AL } from "./data";
import {
  AiChip,
  AiCore,
  AppChrome,
  chatState,
  ChatWindow,
  CodeEditor,
  DataFlow,
  FolderTree,
  Globe,
  LogPanel,
  Metrics,
  NeuralNet,
  Panel,
  Processing,
  Structure,
  Waveform,
} from "./panels";
import { AiTheme } from "./theme";

const NET_SMALL = [5, 7, 7, 3];
const NET_BIG = [6, 8, 8, 4];

// ------------------------------------------------- look 3: code layout --
export const AiInterfaceCode: React.FC<{ th: AiTheme }> = ({ th }) => {
  const f = useCurrentFrame();
  const c = { f, th };
  return (
    <Stage bg={th.bg} drift={8}>
      <AppChrome {...c} active={0} />
      <FolderTree {...c} uid="c-tree" x={60} y={64} w={360} h={968} />
      <CodeEditor {...c} uid="c-code" x={428} y={64} w={436} h={640} />
      <Processing {...c} uid="c-proc" x={428} y={712} w={436} h={170} />
      <LogPanel {...c} uid="c-build" x={428} y={890} w={436} h={142} kind="build" />
      <AiCore {...c} uid="c-core" x={872} y={64} w={292} h={300} compact />
      <Metrics {...c} uid="c-met" x={1172} y={64} w={300} h={300} rows={4} />
      <Globe {...c} uid="c-globe" x={872} y={372} w={600} h={420} />
      <AssistantMini {...c} x={872} y={800} w={210} h={232} />
      <ChatWindow {...c} uid="c-chat" x={1090} y={800} w={382} h={232} menu={false} maxChars={34} size={11} title="AI CHAT" />
      <Structure {...c} uid="c-struct" x={1480} y={64} w={416} h={236} />
      <DataFlow {...c} uid="c-flow" x={1480} y={308} w={416} h={140} />
      <NeuralNet {...c} uid="c-net" x={1480} y={456} w={416} h={290} layers={NET_SMALL} seed={5001} />
      <LogPanel {...c} uid="c-log" x={1480} y={754} w={416} h={278} kind="ai" />
    </Stage>
  );
};

const AssistantMini: React.FC<{ f: number; th: AiTheme; x: number; y: number; w: number; h: number }> = ({ f, th, x, y, w, h }) => {
  const st = chatState(f);
  return (
    <Panel f={f} th={th} uid="c-mini" x={x} y={y} w={w} h={h} title={AL.assistant} controls={false}>
      <circle cx={x + 20} cy={y + 56} r={4} fill={th.green} />
      <Txt x={x + 31} y={y + 60} size={11} weight={600} fill={th.green}>
        {AL.online}
      </Txt>
      {AL.menu.map((m, i) => (
        <Txt key={m} x={x + 16} y={y + 86 + i * 20} size={11} fill={th.textDim}>
          {`•  ${m}`}
        </Txt>
      ))}
      <AiChip f={f} th={th} cx={x + w - 54} cy={y + 110} s={46} glow />
      <Waveform f={f} th={th} x={x + 16} y={y + h - 44} w={w - 32} h={30} amp={st.listen} />
    </Panel>
  );
};

// -------------------------------------------- look 5: assistant layout --
export const AiInterfaceAssistant: React.FC<{ th: AiTheme }> = ({ th }) => {
  const f = useCurrentFrame();
  const c = { f, th };
  return (
    <Stage bg={th.bg} drift={8}>
      <AppChrome {...c} active={3} />
      <CodeEditor {...c} uid="a-code" x={60} y={64} w={420} h={968} />
      <AssistantCard {...c} x={488} y={64} w={520} h={380} />
      <NeuralNet {...c} uid="a-net" x={1016} y={64} w={504} h={380} layers={NET_BIG} seed={5002} big />
      <ChatWindow {...c} uid="a-chat" x={488} y={452} w={1032} h={340} maxChars={70} size={13} title="AI CHAT" />
      <Processing {...c} uid="a-proc" x={488} y={800} w={1032} h={232} big />
      <Metrics {...c} uid="a-met" x={1528} y={64} w={368} h={560} rows={5} />
      <AiCore {...c} uid="a-core" x={1528} y={632} w={368} h={400} />
    </Stage>
  );
};

const AssistantCard: React.FC<{ f: number; th: AiTheme; x: number; y: number; w: number; h: number }> = ({ f, th, x, y, w, h }) => {
  const st = chatState(f);
  const listening = st.listen;
  const greet = 1;
  return (
    <Panel f={f} th={th} uid="a-card" x={x} y={y} w={w} h={h} title="" controls head={0}>
      {/* chip with soft halo */}
      <circle cx={x + 120} cy={y + 120} r={78} fill={th.accent} opacity={0.05 + 0.05 * listening} />
      <AiChip f={f} th={th} cx={x + 120} cy={y + 120} s={96} glow />
      <Waveform f={f} th={th} x={x + 44} y={y + 196} w={152} h={34} amp={listening} />
      <Txt x={x + 120} y={y + 254} size={11} anchor="middle" fill={th.textDim} opacity={listening}>
        Listening…
      </Txt>
      <Txt x={x + 120} y={y + 254} size={11} anchor="middle" fill={th.textFaint} opacity={1 - listening}>
        Standby
      </Txt>
      <Txt x={x + 250} y={y + 92} size={28} weight={600} fill={th.text}>
        {AL.assistant}
      </Txt>
      <circle cx={x + 256} cy={y + 118} r={5} fill={th.green} />
      <Txt x={x + 270} y={y + 123} size={14} weight={600} fill={th.green}>
        {AL.online}
      </Txt>
      <g opacity={greet}>
        <rect x={x + 250} y={y + 148} width={226} height={44} rx={10} fill={th.panelAlt} stroke={th.borderHi} />
        <path d={`M${x + 262} ${y + 192}l-6 10 16-10`} fill={th.panelAlt} stroke={th.borderHi} />
        <rect x={x + 263} y={y + 189} width={14} height={4} fill={th.panelAlt} />
        <Txt x={x + 266} y={y + 175} size={14} fill={th.text}>
          {AL.greeting}
        </Txt>
      </g>
      {/* input bar */}
      <rect x={x + 22} y={y + h - 74} width={w - 44} height={50} rx={25} fill={th.panelAlt} stroke={th.border} />
      <Icon name="mic" x={x + 40} y={y + h - 61} size={24} color={listening > 0.5 ? th.accent : th.textDim} sw={1.5} />
      <line x1={x + 76} y1={y + h - 62} x2={x + 76} y2={y + h - 36} stroke={th.border} />
      <Txt x={x + 92} y={y + h - 44} size={14} fill={th.textFaint}>
        {AL.inputPlaceholder}
      </Txt>
      <Icon name="sliders" x={x + w - 108} y={y + h - 61} size={24} color={th.textDim} sw={1.4} />
      <circle cx={x + w - 50} cy={y + h - 49} r={19} fill={th.accent} opacity={0.9} />
      <Icon name="send" x={x + w - 61} y={y + h - 60} size={22} color={th.accentText} sw={1.6} />
      <rect x={x + 22} y={y + h - 74} width={w - 44} height={50} rx={25} fill="none" stroke={th.accent} strokeWidth={1.5} opacity={smooth(0, 1, listening) * 0.8} />
    </Panel>
  );
};
