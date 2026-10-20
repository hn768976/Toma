import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useVideoConfig } from "remotion";
import { composite, type PaperParams } from "./engine/composite";
import { Painter, yieldStats } from "./engine/painter";
import { makeNoise, makeRng } from "./engine/rng";
import { PALETTES, type PaletteKey } from "./data/palettes";
import { LAYOUTS, type LayoutKey } from "./layouts";

export type WatercolourStillProps = {
  layout: LayoutKey;
  palette: PaletteKey;
  seed: number;
  /** 0.5..1.5, how much paint the layout puts down */
  density: number;
  /** paint canvas size as a fraction of the output (0.5 = paint at half, Lanczos 2x) */
  paintScale: number;
  /** development overrides for the paper/composite parameters */
  tuning?: Partial<PaperParams>;
};

const run = async (props: WatercolourStillProps, out: HTMLCanvasElement, host: HTMLElement) => {
  const t0 = performance.now();
  const pw = Math.round(out.width * props.paintScale);
  const ph = Math.round(out.height * props.paintScale);
  const painter = await Painter.create(host, pw, ph, props.seed);
  const palette = PALETTES[props.palette];
  const layout = LAYOUTS[props.layout];
  const rng = makeRng(props.seed);
  await layout.paint({
    painter,
    rng,
    noise: makeNoise(props.seed + 7),
    colors: palette.colors,
    density: props.density,
    W: painter.W,
    H: painter.H,
  });
  await painter.flush();
  const t1 = performance.now();
  composite(painter.canvas, out, {
    granulation: Math.min(1, palette.granulation * (layout.granulationBoost ?? 1)),
    settle: 0.22,
    edge: layout.edge ?? 1.0,
    seed: props.seed,
    ...props.tuning,
  });
  const t2 = performance.now();
  const slow = [...painter.prof].sort((x, y) => y.ms - x.ms).slice(0, 12);
  const sum = painter.prof.reduce((a, b) => a + b.ms, 0);
  console.log(`wc-prof yields=${JSON.stringify(yieldStats)} fillsTotal=${Math.round(sum)}ms slowest=${slow.map((x) => `${Math.round(x.ms)}:${x.color}:${x.n}`).join(" ")}`);
  painter.destroy();
  // picked up by the render script for the timing report
  (window as unknown as { __wcTiming: object }).__wcTiming = {
    paintMs: Math.round(t1 - t0),
    compositeMs: Math.round(t2 - t1),
    fills: painter.ops,
    paintSize: [pw, ph],
  };
  console.log(`wc-timing paint=${Math.round(t1 - t0)}ms composite=${Math.round(t2 - t1)}ms fills=${painter.ops} paint=${pw}x${ph}`);
};

export const WatercolourStill: React.FC<WatercolourStillProps> = (props) => {
  const { width, height } = useVideoConfig();
  const out = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [handle] = useState(() =>
    delayRender("painting watercolour", { timeoutInMilliseconds: 1_800_000 }),
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run(props, out.current!, host.current!)
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle, props]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#FAF7F0" }}>
      <canvas ref={out} width={width} height={height} style={{ width, height, display: "block" }} />
      <div
        ref={host}
        style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
};
