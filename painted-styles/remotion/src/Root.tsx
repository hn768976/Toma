import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { PaintedCanvas } from "./gl/PaintedCanvas";
import { DRAWON_FRAMES, DRAWON_STYLES, drawOnScene, FPS, LOOP_FRAMES, loopScene, STYLES } from "./gl/scene";

const LoopComp: React.FC<{ styleKey: string }> = ({ styleKey }) => {
  const s = STYLES.find((x) => x.key === styleKey)!;
  const scene = React.useMemo(() => loopScene(s), [s]);
  return <AbsoluteFill><PaintedCanvas scene={scene} /></AbsoluteFill>;
};
const DrawOnComp: React.FC<{ styleKey: string }> = ({ styleKey }) => {
  const s = STYLES.find((x) => x.key === styleKey)!;
  const scene = React.useMemo(() => drawOnScene(s), [s]);
  return <AbsoluteFill><PaintedCanvas scene={scene} /></AbsoluteFill>;
};

export const RemotionRoot: React.FC = () => (
  <>
    {STYLES.map((s) => (
      <Composition key={s.key + "loop"} id={`Painted-${s.prefix}-LakeLoop`} component={LoopComp}
        durationInFrames={LOOP_FRAMES + 1} fps={FPS} width={3840} height={2160} defaultProps={{ styleKey: s.key }} />
    ))}
    {STYLES.filter((s) => s.drawon && DRAWON_STYLES.includes(s.key)).map((s) => (
      <Composition key={s.key + "draw"} id={`Painted-${s.prefix}-DrawOn`} component={DrawOnComp}
        durationInFrames={DRAWON_FRAMES} fps={FPS} width={3840} height={2160} defaultProps={{ styleKey: s.key }} />
    ))}
  </>
);
