import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SimOptions, SimRunner, createSim } from "./engine/sim";
import { Camera, Look, SmokeRenderer } from "./engine/renderer";

type Vec3 = [number, number, number];

export type CameraPath = {
  // Orbit around `target` in the x-z plane; angle 0 = camera on +z looking
  // down -z (so world +x is screen right).
  angleStart: number; // degrees
  angleEnd: number;
  distanceStart: number;
  distanceEnd: number;
  heightStart: number;
  heightEnd: number;
  target: Vec3;
  fovY: number;
};

export type ColorStop = { te: number; color: Vec3 };

export type SmokeBurstProps = {
  sim: SimOptions;
  camera: CameraPath;
  look: Look;
  // Colour by emission time (seconds), linear-light RGB.
  colorStops: ColorStop[];
  // How far (in seconds of emission time) a strand's hue offset shifts it
  // along the colour ramp.
  hueSpread: number;
  intensity: number;
};

// One simulation runner per configuration for the lifetime of the tab.
const runners = new Map<string, SimRunner>();
const getRunner = (opts: SimOptions, fps: number) => {
  const key = JSON.stringify(opts) + fps;
  let r = runners.get(key);
  if (!r) {
    r = new SimRunner(createSim(opts), fps);
    runners.set(key, r);
  }
  return r;
};

const ease = (x: number) => x * x * (3 - 2 * x);

const sampleStops = (stops: ColorStop[], te: number): Vec3 => {
  if (te <= stops[0].te) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    if (te <= stops[i].te) {
      const a = stops[i - 1];
      const b = stops[i];
      const f = ease((te - a.te) / (b.te - a.te));
      return [
        a.color[0] + (b.color[0] - a.color[0]) * f,
        a.color[1] + (b.color[1] - a.color[1]) * f,
        a.color[2] + (b.color[2] - a.color[2]) * f,
      ];
    }
  }
  return stops[stops.length - 1].color;
};

export const cameraAt = (path: CameraPath, progress: number): Camera => {
  const e = ease(progress);
  const a = ((path.angleStart + (path.angleEnd - path.angleStart) * e) * Math.PI) / 180;
  const d = path.distanceStart + (path.distanceEnd - path.distanceStart) * e;
  const h = path.heightStart + (path.heightEnd - path.heightStart) * e;
  const [tx, ty, tz] = path.target;
  return {
    eye: [tx + Math.sin(a) * d, ty + h, tz + Math.cos(a) * d],
    target: path.target,
    fovY: path.fovY,
  };
};

export const SmokeBurst: React.FC<SmokeBurstProps> = ({
  sim: simOpts,
  camera,
  look,
  colorStops,
  hueSpread,
  intensity,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SmokeRenderer | null>(null);
  const runner = useMemo(() => getRunner(simOpts, fps), [simOpts, fps]);
  const { sim } = runner;

  // Static per-particle colour (emission time + strand hue offset).
  const colors = useMemo(() => {
    const c = new Float32Array(sim.count * 3);
    for (let i = 0; i < sim.count; i++) {
      const rgb = sampleStops(colorStops, sim.emitTime[i] + sim.strandHue[i] * hueSpread);
      c[i * 3] = rgb[0];
      c[i * 3 + 1] = rgb[1];
      c[i * 3 + 2] = rgb[2];
    }
    return c;
  }, [sim, colorStops, hueSpread]);

  const segments = useMemo(() => new Float32Array(sim.count * 2 * 10), [sim]);

  useLayoutEffect(() => {
    const handle = delayRender(`Simulating frame ${frame}`, { timeoutInMilliseconds: 180000 });
    if (!rendererRef.current) rendererRef.current = new SmokeRenderer(canvasRef.current!);
    const state = runner.at(frame);
    const { pos, born } = state;
    const per = sim.opts.particlesPerStrand;
    const t = state.t;
    let n = 0;
    for (let i = 0; i < sim.count; i++) {
      if (!born[i]) continue;
      const age = t - sim.emitTime[i];
      const fade = Math.min(1, age / 0.4);
      // Later material piles up near the source; keep it from blowing out.
      const k = fade * fade * intensity * (0.55 + 0.45 * Math.exp(-sim.emitTime[i] / 1.5));
      const r = colors[i * 3] * k;
      const g = colors[i * 3 + 1] * k;
      const b = colors[i * 3 + 2] * k;
      const o = i * 3;
      // Filament segment to the next (younger) particle of the same strand.
      const j = i + 1;
      if ((i + 1) % per !== 0 && born[j]) {
        const q = j * 3;
        const dx = pos[q] - pos[o];
        const dy = pos[q + 1] - pos[o + 1];
        const dz = pos[q + 2] - pos[o + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1.6) {
          const s = n * 10;
          segments[s] = pos[o];
          segments[s + 1] = pos[o + 1];
          segments[s + 2] = pos[o + 2];
          segments[s + 3] = pos[q];
          segments[s + 4] = pos[q + 1];
          segments[s + 5] = pos[q + 2];
          segments[s + 6] = r;
          segments[s + 7] = g;
          segments[s + 8] = b;
          segments[s + 9] = 1;
          n++;
        }
      }
      // A fine sparkle dot at the particle itself.
      const s = n * 10;
      segments[s] = pos[o];
      segments[s + 1] = pos[o + 1];
      segments[s + 2] = pos[o + 2];
      segments[s + 3] = pos[o];
      segments[s + 4] = pos[o + 1];
      segments[s + 5] = pos[o + 2];
      segments[s + 6] = r * 0.35;
      segments[s + 7] = g * 0.35;
      segments[s + 8] = b * 0.35;
      segments[s + 9] = 1.2;
      n++;
    }
    const progress = frame / Math.max(1, durationInFrames - 1);
    rendererRef.current.draw(segments, n, cameraAt(camera, progress), look);
    continueRender(handle);
  }, [frame, durationInFrames, runner, sim, colors, segments, camera, look, intensity]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
